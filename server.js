const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const { promisify } = require('util');
const multer = require('multer');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Default paths
const CA_DIR = '/app/ca';
const CERTS_DIR = '/app/certs';

// Ensure directories exist
fs.ensureDirSync(CA_DIR);
fs.ensureDirSync(CERTS_DIR);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadType = req.params.type;
    if (uploadType === 'ca') {
      cb(null, CA_DIR);
    } else if (uploadType === 'cert') {
      cb(null, CERTS_DIR);
    } else {
      cb(new Error('Invalid upload type'), null);
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.crt', '.key', '.srl', '.pem'];
    const ext = path.extname(file.originalname);
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Helper function to execute shell scripts
async function executeScript(scriptPath, args) {
  try {
    const command = `bash ${scriptPath} ${args}`;
    const { stdout, stderr } = await execAsync(command);
    return { success: true, stdout, stderr };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr };
  }
}

// API Routes

// List all available CAs
app.get('/api/ca/list', async (req, res) => {
  try {
    const { stdout } = await execAsync(`bash ./manage-ca.sh list -d "${CA_DIR}"`);
    
    // Parse the output to extract CA information
    const cas = [];
    const lines = stdout.split('\n');
    let currentCA = null;
    
    for (const line of lines) {
      if (line.includes('✅')) {
        const match = line.match(/✅\s+([^\s]+)/);
        if (match) {
          currentCA = {
            id: match[1],
            subject: '',
            expires: '',
            exists: true
          };
          cas.push(currentCA);
        }
      } else if (currentCA && line.includes('Subject:')) {
        currentCA.subject = line.replace(/\s*Subject:\s*/, '');
      } else if (currentCA && line.includes('Expires:')) {
        currentCA.expires = line.replace(/\s*Expires:\s*/, '');
        currentCA = null; // Reset for next CA
      }
    }
    
    res.json(cas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get CA status
app.get('/api/ca/status', async (req, res) => {
  try {
    const caKeyExists = await fs.pathExists(path.join(CA_DIR, 'root_ca.key'));
    const caCertExists = await fs.pathExists(path.join(CA_DIR, 'root_ca.crt'));
    
    let caInfo = null;
    if (caCertExists) {
      try {
        const { stdout } = await execAsync(`openssl x509 -in ${CA_DIR}/root_ca.crt -text -noout`);
        caInfo = stdout;
      } catch (err) {
        console.error('Error reading CA certificate:', err);
      }
    }
    
    res.json({
      exists: caKeyExists && caCertExists,
      caKeyExists,
      caCertExists,
      caInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create CA
app.post('/api/ca/create', async (req, res) => {
  try {
    const { password, caId = 'default', commonName = 'rootly network', organization = 'rootly', organizationalUnit = 'IT', validityDays = 3650 } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    if (!caId || !/^[a-zA-Z0-9-_]+$/.test(caId)) {
      return res.status(400).json({ error: 'CA ID is required and must contain only letters, numbers, hyphens, and underscores' });
    }
    
    const args = `-d "${CA_DIR}" -i "${caId}" -n "${commonName}" -o "${organization}" -u "${organizationalUnit}" -p "${password}" -v ${validityDays}`;
    const result = await executeScript('./create-ca.sh', args);
    
    if (result.success) {
      res.json({ message: `CA '${caId}' created successfully`, output: result.stdout, caId });
    } else {
      res.status(500).json({ error: 'Failed to create CA', details: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign host certificate
app.post('/api/certificates/sign', async (req, res) => {
  try {
    const { hostname, password, caId = 'default', validityDays = 825 } = req.body;
    
    if (!hostname || !password) {
      return res.status(400).json({ error: 'Hostname and password are required' });
    }
    
    if (!caId || !/^[a-zA-Z0-9-_]+$/.test(caId)) {
      return res.status(400).json({ error: 'CA ID is required and must contain only letters, numbers, hyphens, and underscores' });
    }
    
    const args = `-n "${hostname}" -p "${password}" -i "${caId}" -d "${CA_DIR}" -c "${CERTS_DIR}" -v ${validityDays}`;
    const result = await executeScript('./sign-host.sh', args);
    
    if (result.success) {
      res.json({ message: `Certificate for '${hostname}' signed successfully with CA '${caId}'`, output: result.stdout, caId });
    } else {
      res.status(500).json({ error: 'Failed to sign certificate', details: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List certificates
app.get('/api/certificates', async (req, res) => {
  try {
    const files = await fs.readdir(CERTS_DIR);
    const certificates = [];
    
    for (const file of files) {
      if (file.endsWith('.crt') && !file.endsWith('_fullchain.crt')) {
        const hostname = file.replace('.crt', '');
        const certPath = path.join(CERTS_DIR, file);
        const keyPath = path.join(CERTS_DIR, `${hostname}.key`);
        const fullchainPath = path.join(CERTS_DIR, `${hostname}_fullchain.crt`);
        
        try {
          const { stdout } = await execAsync(`openssl x509 -in "${certPath}" -text -noout`);
          certificates.push({
            hostname,
            certFile: file,
            keyExists: await fs.pathExists(keyPath),
            fullchainExists: await fs.pathExists(fullchainPath),
            certInfo: stdout
          });
        } catch (err) {
          console.error(`Error reading certificate ${file}:`, err);
        }
      }
    }
    
    res.json(certificates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download certificate files
app.get('/api/certificates/:hostname/download/:type', async (req, res) => {
  try {
    const { hostname, type } = req.params;
    let filename;
    
    switch (type) {
      case 'cert':
        filename = `${hostname}.crt`;
        break;
      case 'key':
        filename = `${hostname}.key`;
        break;
      case 'fullchain':
        filename = `${hostname}_fullchain.crt`;
        break;
      default:
        return res.status(400).json({ error: 'Invalid file type' });
    }
    
    const filePath = path.join(CERTS_DIR, filename);
    
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, filename);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download CA certificate
app.get('/api/ca/download', async (req, res) => {
  try {
    const caCertPath = path.join(CA_DIR, 'root_ca.crt');
    
    if (!(await fs.pathExists(caCertPath))) {
      return res.status(404).json({ error: 'CA certificate not found' });
    }
    
    res.download(caCertPath, 'root_ca.crt');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload CA files
app.post('/api/upload/:type', upload.array('files'), async (req, res) => {
  try {
    const { type } = req.params;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedFiles = [];
    const errors = [];
    
    for (const file of files) {
      try {
        // Validate file based on type and filename
        if (type === 'ca') {
          const validCAFiles = ['crt', 'key', 'srl'];
          const ext = path.extname(file.originalname).substring(1);
          if (!validCAFiles.includes(ext)) {
            errors.push(`Invalid CA file type: ${file.originalname}. Expected .crt, .key, or .srl`);
            continue;
          }
          
          // Validate CA file naming
          const basename = path.basename(file.originalname, path.extname(file.originalname));
          if (!basename.includes('ca') && !basename.includes('root')) {
            console.log(`Warning: CA file ${file.originalname} may not follow standard naming convention`);
          }
        } else if (type === 'cert') {
          const validExtensions = ['.crt', '.key', '.pem'];
          const ext = path.extname(file.originalname);
          if (!validExtensions.includes(ext)) {
            errors.push(`Invalid certificate file type: ${file.originalname}. Expected .crt, .key, or .pem`);
            continue;
          }
        }
        
        uploadedFiles.push({
          filename: file.originalname,
          size: file.size,
          path: file.path
        });
      } catch (error) {
        errors.push(`Error processing ${file.originalname}: ${error.message}`);
      }
    }
    
    if (type === 'ca') {
      await fetchCaStatus();
    } else if (type === 'cert') {
      // Refresh certificate list would be handled by frontend
    }
    
    res.json({
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to refresh CA status (for internal use)
async function fetchCaStatus() {
  try {
    const caKeyExists = await fs.pathExists(path.join(CA_DIR, 'root_ca.key'));
    const caCertExists = await fs.pathExists(path.join(CA_DIR, 'root_ca.crt'));
    return {
      exists: caKeyExists && caCertExists,
      caKeyExists,
      caCertExists
    };
  } catch (error) {
    console.error('Error fetching CA status:', error);
    return { exists: false, caKeyExists: false, caCertExists: false };
  }
}

// Serve API documentation
app.get('/api-docs', (req, res) => {
  const docsPath = path.join(__dirname, 'API_DOCUMENTATION.md');
  if (fs.pathExistsSync(docsPath)) {
    res.sendFile(docsPath);
  } else {
    res.status(404).json({ error: 'API documentation not found' });
  }
});

// Serve OpenAPI specification
app.get('/api-spec.yaml', (req, res) => {
  const specPath = path.join(__dirname, 'api-spec.yaml');
  if (fs.pathExistsSync(specPath)) {
    res.sendFile(specPath);
  } else {
    res.status(404).json({ error: 'API specification not found' });
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CA directory: ${CA_DIR}`);
  console.log(`Certificates directory: ${CERTS_DIR}`);
});