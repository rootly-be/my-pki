import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = '/api';

function App() {
  const [caStatus, setCaStatus] = useState(null);
  const [availableCAs, setAvailableCAs] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('ca');
  const [uploadFiles, setUploadFiles] = useState({ ca: [], cert: [] });

  // CA Creation Form
  const [caForm, setCaForm] = useState({
    password: '',
    caId: '',
    commonName: 'rootly network',
    organization: 'rootly',
    organizationalUnit: 'IT',
    validityDays: 3650
  });

  // Certificate Signing Form
  const [certForm, setCertForm] = useState({
    hostname: '',
    password: '',
    caId: 'default',
    validityDays: 825
  });

  useEffect(() => {
    fetchCaStatus();
    fetchAvailableCAs();
    fetchCertificates();
  }, []);

  const fetchCaStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/ca/status`);
      setCaStatus(response.data);
    } catch (error) {
      console.error('Error fetching CA status:', error);
    }
  };

  const fetchAvailableCAs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/ca/list`);
      setAvailableCAs(response.data);
    } catch (error) {
      console.error('Error fetching available CAs:', error);
    }
  };

  const fetchCertificates = async () => {
    try {
      const response = await axios.get(`${API_BASE}/certificates`);
      setCertificates(response.data);
    } catch (error) {
      console.error('Error fetching certificates:', error);
    }
  };

  const createCA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/ca/create`, caForm);
      setMessage(`Success: ${response.data.message}`);
      fetchCaStatus();
      fetchAvailableCAs();
      setCaForm({ ...caForm, password: '', caId: '' });
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    }
    setLoading(false);
  };

  const signCertificate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/certificates/sign`, certForm);
      setMessage(`Success: ${response.data.message}`);
      fetchCertificates();
      setCertForm({ ...certForm, hostname: '', password: '' });
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    }
    setLoading(false);
  };

  const downloadFile = (hostname, type) => {
    window.open(`${API_BASE}/certificates/${hostname}/download/${type}`);
  };

  const downloadCA = () => {
    window.open(`${API_BASE}/ca/download`);
  };

  const handleFileChange = (type, files) => {
    setUploadFiles(prev => ({
      ...prev,
      [type]: Array.from(files)
    }));
  };

  const uploadFilesHandler = async (type) => {
    if (uploadFiles[type].length === 0) {
      setMessage('Please select files to upload');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      uploadFiles[type].forEach(file => {
        formData.append('files', file);
      });

      const response = await axios.post(`${API_BASE}/upload/${type}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage(`Success: ${response.data.message}`);
      if (response.data.errors) {
        setMessage(prev => prev + ` Errors: ${response.data.errors.join(', ')}`);
      }

      // Clear uploaded files
      setUploadFiles(prev => ({
        ...prev,
        [type]: []
      }));

      // Refresh data
      if (type === 'ca') {
        fetchCaStatus();
      } else {
        fetchCertificates();
      }
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🔐 Certificate Authority Manager</h1>
        <nav className="nav">
          <button 
            className={activeTab === 'ca' ? 'active' : ''} 
            onClick={() => setActiveTab('ca')}
          >
            Certificate Authority
          </button>
          <button 
            className={activeTab === 'certs' ? 'active' : ''} 
            onClick={() => setActiveTab('certs')}
          >
            Certificates
          </button>
          <button 
            className={activeTab === 'docs' ? 'active' : ''} 
            onClick={() => setActiveTab('docs')}
          >
            API Documentation
          </button>
        </nav>
      </header>

      <main className="main">
        {message && (
          <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
            {message}
            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {activeTab === 'ca' && (
          <div className="tab-content">
            <div className="card">
              <h2>Certificate Authority Status</h2>
              <div className="status">
                <div className={`status-indicator ${availableCAs.length > 0 || caStatus?.exists ? 'success' : 'warning'}`}>
                  {availableCAs.length > 0 || caStatus?.exists ? `✅ ${availableCAs.length + (caStatus?.exists ? 1 : 0)} CA(s) Available` : '⚠️ No CAs Found'}
                </div>
                
                {availableCAs.length > 0 && (
                  <div className="ca-list">
                    <h3>Available CAs:</h3>
                    {availableCAs.map((ca) => (
                      <div key={ca.id} className="ca-item">
                        <strong>{ca.id}</strong>
                        <p>Subject: {ca.subject}</p>
                        <p>Expires: {ca.expires}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {caStatus?.exists && (
                  <div className="ca-item">
                    <strong>default (legacy)</strong>
                    <div className="status-details">
                      <p>CA Key: {caStatus.caKeyExists ? '✅' : '❌'}</p>
                      <p>CA Certificate: {caStatus.caCertExists ? '✅' : '❌'}</p>
                    </div>
                    <button onClick={downloadCA} className="btn btn-secondary">
                      Download CA Certificate
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <h2>Upload CA Files</h2>
              <div className="upload-section">
                <div className="form-group">
                  <label>Upload CA Files (.crt, .key, .srl):</label>
                  <input
                    type="file"
                    multiple
                    accept=".crt,.key,.srl,.pem"
                    onChange={(e) => handleFileChange('ca', e.target.files)}
                  />
                  {uploadFiles.ca.length > 0 && (
                    <div className="file-list">
                      <p>Selected files:</p>
                      <ul>
                        {uploadFiles.ca.map((file, index) => (
                          <li key={index}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => uploadFilesHandler('ca')} 
                  disabled={loading || uploadFiles.ca.length === 0}
                  className="btn btn-primary"
                >
                  {loading ? 'Uploading...' : 'Upload CA Files'}
                </button>
              </div>
            </div>

            <div className="card">
              <h2>Create Certificate Authority</h2>
              <form onSubmit={createCA}>
                <div className="form-group">
                  <label>CA ID (required):</label>
                  <input
                    type="text"
                    value={caForm.caId}
                    onChange={(e) => setCaForm({ ...caForm, caId: e.target.value })}
                    placeholder="e.g., prod, dev, test"
                    pattern="[a-zA-Z0-9-_]+"
                    title="Only letters, numbers, hyphens, and underscores are allowed"
                    required
                  />
                  <small>Unique identifier for this CA (letters, numbers, hyphens, underscores only)</small>
                </div>
                <div className="form-group">
                  <label>Password (required):</label>
                  <input
                    type="password"
                    value={caForm.password}
                    onChange={(e) => setCaForm({ ...caForm, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Common Name:</label>
                  <input
                    type="text"
                    value={caForm.commonName}
                    onChange={(e) => setCaForm({ ...caForm, commonName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Organization:</label>
                  <input
                    type="text"
                    value={caForm.organization}
                    onChange={(e) => setCaForm({ ...caForm, organization: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Organizational Unit:</label>
                  <input
                    type="text"
                    value={caForm.organizationalUnit}
                    onChange={(e) => setCaForm({ ...caForm, organizationalUnit: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Validity (days):</label>
                  <input
                    type="number"
                    value={caForm.validityDays}
                    onChange={(e) => setCaForm({ ...caForm, validityDays: parseInt(e.target.value) })}
                  />
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Creating...' : 'Create CA'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'certs' && (
          <div className="tab-content">
            <div className="card">
              <h2>Upload Certificate Files</h2>
              <div className="upload-section">
                <div className="form-group">
                  <label>Upload Certificate Files (.crt, .key, fullchain files):</label>
                  <input
                    type="file"
                    multiple
                    accept=".crt,.key,.pem"
                    onChange={(e) => handleFileChange('cert', e.target.files)}
                  />
                  {uploadFiles.cert.length > 0 && (
                    <div className="file-list">
                      <p>Selected files:</p>
                      <ul>
                        {uploadFiles.cert.map((file, index) => (
                          <li key={index}>{file.name} ({(file.size / 1024).toFixed(1)} KB)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => uploadFilesHandler('cert')} 
                  disabled={loading || uploadFiles.cert.length === 0}
                  className="btn btn-primary"
                >
                  {loading ? 'Uploading...' : 'Upload Certificate Files'}
                </button>
              </div>
            </div>

            <div className="card">
              <h2>Sign New Certificate</h2>
              <form onSubmit={signCertificate}>
                <div className="form-group">
                  <label>Certificate Authority:</label>
                  <select
                    value={certForm.caId}
                    onChange={(e) => setCertForm({ ...certForm, caId: e.target.value })}
                    required
                  >
                    <option value="">Select a CA</option>
                    {availableCAs.map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.id} - {ca.subject}
                      </option>
                    ))}
                    <option value="default">default (legacy)</option>
                  </select>
                  {availableCAs.length === 0 && (
                    <small>No CAs available. Create one first.</small>
                  )}
                </div>
                <div className="form-group">
                  <label>Hostname (required):</label>
                  <input
                    type="text"
                    value={certForm.hostname}
                    onChange={(e) => setCertForm({ ...certForm, hostname: e.target.value })}
                    placeholder="e.g., homepage.mgmt.rootly.local"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>CA Password (required):</label>
                  <input
                    type="password"
                    value={certForm.password}
                    onChange={(e) => setCertForm({ ...certForm, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Validity (days):</label>
                  <input
                    type="number"
                    value={certForm.validityDays}
                    onChange={(e) => setCertForm({ ...certForm, validityDays: parseInt(e.target.value) })}
                  />
                </div>
                <button type="submit" disabled={loading || (!caStatus?.exists && availableCAs.length === 0) || !certForm.caId} className="btn btn-primary">
                  {loading ? 'Signing...' : 'Sign Certificate'}
                </button>
                {(!caStatus?.exists && availableCAs.length === 0) && <p className="warning">Create a CA first</p>}
                {!certForm.caId && (caStatus?.exists || availableCAs.length > 0) && <p className="warning">Select a CA</p>}
              </form>
            </div>

            <div className="card">
              <h2>Issued Certificates ({certificates.length})</h2>
              {certificates.length === 0 ? (
                <p>No certificates found</p>
              ) : (
                <div className="certificates-list">
                  {certificates.map((cert) => (
                    <div key={cert.hostname} className="certificate-item">
                      <h3>{cert.hostname}</h3>
                      <div className="certificate-actions">
                        <button 
                          onClick={() => downloadFile(cert.hostname, 'cert')}
                          className="btn btn-secondary"
                        >
                          Download Certificate
                        </button>
                        <button 
                          onClick={() => downloadFile(cert.hostname, 'key')}
                          className="btn btn-secondary"
                          disabled={!cert.keyExists}
                        >
                          Download Key
                        </button>
                        <button 
                          onClick={() => downloadFile(cert.hostname, 'fullchain')}
                          className="btn btn-secondary"
                          disabled={!cert.fullchainExists}
                        >
                          Download Fullchain
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="tab-content">
            <div className="card">
              <h2>📚 API Documentation</h2>
              <div className="documentation">
                <h3>Quick Reference</h3>
                <p>This Certificate Authority Manager provides a REST API for managing CAs and certificates.</p>
                
                <h4>Base URL</h4>
                <code>http://localhost:5000/api</code>
                
                <h4>Key Endpoints</h4>
                <div className="endpoint-list">
                  <div className="endpoint">
                    <strong>GET /api/ca/status</strong> - Check CA status
                  </div>
                  <div className="endpoint">
                    <strong>GET /api/ca/list</strong> - List available CAs
                  </div>
                  <div className="endpoint">
                    <strong>POST /api/ca/create</strong> - Create new CA
                  </div>
                  <div className="endpoint">
                    <strong>POST /api/certificates/sign</strong> - Sign certificate
                  </div>
                  <div className="endpoint">
                    <strong>GET /api/certificates</strong> - List certificates
                  </div>
                  <div className="endpoint">
                    <strong>GET /api/certificates/:hostname/download/:type</strong> - Download certificate files
                  </div>
                </div>

                <h4>Example: Create CA</h4>
                <pre><code>{`curl -X POST http://localhost:5000/api/ca/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "password": "secure-password",
    "caId": "production",
    "commonName": "Production Root CA",
    "organization": "My Company",
    "validityDays": 3650
  }'`}</code></pre>

                <h4>Example: Sign Certificate</h4>
                <pre><code>{`curl -X POST http://localhost:5000/api/certificates/sign \\
  -H "Content-Type: application/json" \\
  -d '{
    "hostname": "api.example.com",
    "password": "ca-password",
    "caId": "production",
    "validityDays": 365
  }'`}</code></pre>

                <h4>File Upload</h4>
                <p>Upload CA or certificate files using multipart form data:</p>
                <pre><code>{`curl -X POST http://localhost:5000/api/upload/ca \\
  -F "files=@root_ca.crt" \\
  -F "files=@root_ca.key"`}</code></pre>

                <div className="docs-note">
                  <h4>📋 Complete Documentation</h4>
                  <p>For complete API documentation with all parameters, response schemas, and advanced examples, see the full documentation file included with this application.</p>
                  <button 
                    onClick={() => window.open('/api-docs', '_blank')}
                    className="btn btn-secondary"
                  >
                    View Full Documentation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;