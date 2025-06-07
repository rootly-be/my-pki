# Certificate Authority Manager - API Documentation

## Overview

The Certificate Authority Manager provides a comprehensive REST API for managing Certificate Authorities (CA) and SSL/TLS certificates. This API enables you to create CAs, sign host certificates, and manage certificate files programmatically.

**Base URL:** `http://localhost:5000/api`

## Authentication

Currently, the API does not require authentication. For production deployments, consider implementing API key authentication or other security measures.

## Content Types

- **Request Content-Type:** `application/json` (for JSON payloads)
- **Response Content-Type:** `application/json` (for API responses)
- **File Downloads:** `application/x-pem-file` or `application/octet-stream`

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## API Endpoints

### Certificate Authority Management

#### 1. Get CA Status

**Endpoint:** `GET /api/ca/status`

Check if Certificate Authority exists and retrieve CA information.

**Response:**
```json
{
  "exists": true,
  "caKeyExists": true,
  "caCertExists": true,
  "caInfo": "Certificate:\n    Data:\n        Version: 3 (0x2)..."
}
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/ca/status
```

#### 2. List Available CAs

**Endpoint:** `GET /api/ca/list`

Retrieve a list of all available Certificate Authorities.

**Response:**
```json
[
  {
    "id": "default",
    "subject": "CN=rootly network, O=rootly, OU=IT",
    "expires": "Dec 31 23:59:59 2034 GMT",
    "exists": true
  }
]
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/ca/list
```

#### 3. Create Certificate Authority

**Endpoint:** `POST /api/ca/create`

Create a new Certificate Authority with specified parameters.

**Request Body:**
```json
{
  "password": "secure-password-123",
  "caId": "production-ca",
  "commonName": "Production Root CA",
  "organization": "My Company",
  "organizationalUnit": "IT Security",
  "validityDays": 3650
}
```

**Parameters:**
- `password` (required): Password to encrypt the CA private key (minimum 8 characters)
- `caId` (optional): CA identifier, default: "default" (alphanumeric, hyphens, underscores only)
- `commonName` (optional): Certificate common name, default: "rootly network"
- `organization` (optional): Organization name, default: "rootly"
- `organizationalUnit` (optional): Organizational unit, default: "IT"
- `validityDays` (optional): Certificate validity in days, default: 3650

**Response:**
```json
{
  "message": "CA 'production-ca' created successfully",
  "output": "Generating RSA private key...",
  "caId": "production-ca"
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/ca/create \
  -H "Content-Type: application/json" \
  -d '{
    "password": "my-secure-ca-password",
    "caId": "my-ca",
    "commonName": "My Root CA",
    "organization": "My Organization",
    "organizationalUnit": "IT Department",
    "validityDays": 3650
  }'
```

#### 4. Download CA Certificate

**Endpoint:** `GET /api/ca/download`

Download the CA certificate file.

**Response:** Binary file (PEM format)

**Example:**
```bash
curl -X GET http://localhost:5000/api/ca/download -o root_ca.crt
```

### Certificate Management

#### 1. List Certificates

**Endpoint:** `GET /api/certificates`

Retrieve a list of all signed certificates with their information.

**Response:**
```json
[
  {
    "hostname": "example.local",
    "certFile": "example.local.crt",
    "keyExists": true,
    "fullchainExists": true,
    "certInfo": "Certificate:\n    Data:\n        Version: 3 (0x2)..."
  }
]
```

**Example:**
```bash
curl -X GET http://localhost:5000/api/certificates
```

#### 2. Sign Certificate

**Endpoint:** `POST /api/certificates/sign`

Create and sign a new host certificate using the specified CA.

**Request Body:**
```json
{
  "hostname": "api.example.com",
  "password": "ca-password-123",
  "caId": "production-ca",
  "validityDays": 365
}
```

**Parameters:**
- `hostname` (required): Hostname or domain for the certificate (alphanumeric, dots, hyphens only)
- `password` (required): CA private key password
- `caId` (optional): CA identifier to use for signing, default: "default"
- `validityDays` (optional): Certificate validity in days, default: 825, maximum: 3650

**Response:**
```json
{
  "message": "Certificate for 'api.example.com' signed successfully with CA 'production-ca'",
  "output": "Generating private key...",
  "caId": "production-ca"
}
```

**Example:**
```bash
curl -X POST http://localhost:5000/api/certificates/sign \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "myapp.local",
    "password": "my-ca-password",
    "caId": "my-ca",
    "validityDays": 365
  }'
```

#### 3. Download Certificate Files

**Endpoint:** `GET /api/certificates/{hostname}/download/{type}`

Download certificate, private key, or fullchain file for a specific hostname.

**Path Parameters:**
- `hostname`: Certificate hostname (e.g., "example.local")
- `type`: File type to download
  - `cert` - Certificate file (.crt)
  - `key` - Private key file (.key)
  - `fullchain` - Fullchain certificate file (_fullchain.crt)

**Response:** Binary file (PEM format)

**Examples:**
```bash
# Download certificate
curl -X GET http://localhost:5000/api/certificates/example.local/download/cert -o example.local.crt

# Download private key
curl -X GET http://localhost:5000/api/certificates/example.local/download/key -o example.local.key

# Download fullchain
curl -X GET http://localhost:5000/api/certificates/example.local/download/fullchain -o example.local_fullchain.crt
```

### File Operations

#### Upload Files

**Endpoint:** `POST /api/upload/{type}`

Upload CA or certificate files to the server.

**Path Parameters:**
- `type`: Type of files being uploaded
  - `ca` - CA files (.crt, .key, .srl)
  - `cert` - Certificate files (.crt, .key, .pem)

**Request:** Multipart form data with file uploads

**File Restrictions:**
- **CA files:** .crt, .key, .srl extensions only
- **Certificate files:** .crt, .key, .pem extensions only
- **Maximum file size:** 5MB per file

**Response:**
```json
{
  "message": "Successfully uploaded 2 file(s)",
  "uploadedFiles": [
    {
      "filename": "root_ca.crt",
      "size": 1024,
      "path": "/app/ca/root_ca.crt"
    }
  ],
  "errors": ["Error messages if any"]
}
```

**Example:**
```bash
# Upload CA files
curl -X POST http://localhost:5000/api/upload/ca \
  -F "files=@root_ca.crt" \
  -F "files=@root_ca.key"

# Upload certificate files
curl -X POST http://localhost:5000/api/upload/cert \
  -F "files=@example.local.crt" \
  -F "files=@example.local.key"
```

## Complete Workflow Examples

### 1. Setting up a new CA and signing a certificate

```bash
# 1. Create a new CA
curl -X POST http://localhost:5000/api/ca/create \
  -H "Content-Type: application/json" \
  -d '{
    "password": "secure-ca-password",
    "caId": "production",
    "commonName": "Production Root CA",
    "organization": "My Company",
    "validityDays": 3650
  }'

# 2. Verify CA was created
curl -X GET http://localhost:5000/api/ca/status

# 3. Sign a certificate
curl -X POST http://localhost:5000/api/certificates/sign \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "api.mycompany.com",
    "password": "secure-ca-password",
    "caId": "production",
    "validityDays": 365
  }'

# 4. Download the certificate files
curl -X GET http://localhost:5000/api/certificates/api.mycompany.com/download/cert -o api.mycompany.com.crt
curl -X GET http://localhost:5000/api/certificates/api.mycompany.com/download/key -o api.mycompany.com.key
curl -X GET http://localhost:5000/api/certificates/api.mycompany.com/download/fullchain -o api.mycompany.com_fullchain.crt
```

### 2. Listing and managing existing certificates

```bash
# List all certificates
curl -X GET http://localhost:5000/api/certificates

# List all CAs
curl -X GET http://localhost:5000/api/ca/list

# Download CA certificate for trust store
curl -X GET http://localhost:5000/api/ca/download -o root_ca.crt
```

## Response Schemas

### CA Status Response
```json
{
  "exists": boolean,
  "caKeyExists": boolean,
  "caCertExists": boolean,
  "caInfo": string | null
}
```

### Certificate List Item
```json
{
  "hostname": string,
  "certFile": string,
  "keyExists": boolean,
  "fullchainExists": boolean,
  "certInfo": string
}
```

### Success Response
```json
{
  "message": string,
  "output": string,
  "caId": string
}
```

### Error Response
```json
{
  "error": string,
  "details": string
}
```

## Best Practices

1. **Security:**
   - Use strong passwords for CA creation (minimum 8 characters)
   - Store CA passwords securely
   - Backup CA directories regularly
   - Restrict access to the API in production

2. **Certificate Management:**
   - Use descriptive hostnames for certificates
   - Set appropriate validity periods (not too long for security, not too short for maintenance)
   - Download and backup certificate files after creation

3. **API Usage:**
   - Check CA status before signing certificates
   - Verify certificate creation was successful before downloading files
   - Handle errors gracefully in your applications

4. **File Organization:**
   - Use consistent naming conventions for CA IDs
   - Organize certificates by environment or purpose
   - Keep track of certificate expiration dates

## Integration Examples

### Python Example

```python
import requests
import json

# Create CA
ca_data = {
    "password": "secure-password",
    "caId": "production",
    "commonName": "Production Root CA",
    "organization": "My Company"
}

response = requests.post('http://localhost:5000/api/ca/create', 
                        json=ca_data)
print(response.json())

# Sign certificate
cert_data = {
    "hostname": "api.example.com",
    "password": "secure-password",
    "caId": "production",
    "validityDays": 365
}

response = requests.post('http://localhost:5000/api/certificates/sign', 
                        json=cert_data)
print(response.json())
```

### JavaScript Example

```javascript
// Create CA
const caData = {
  password: 'secure-password',
  caId: 'production',
  commonName: 'Production Root CA',
  organization: 'My Company'
};

fetch('http://localhost:5000/api/ca/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(caData)
})
.then(response => response.json())
.then(data => console.log(data));

// Sign certificate
const certData = {
  hostname: 'api.example.com',
  password: 'secure-password',
  caId: 'production',
  validityDays: 365
};

fetch('http://localhost:5000/api/certificates/sign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(certData)
})
.then(response => response.json())
.then(data => console.log(data));
```

## Troubleshooting

### Common Issues

1. **CA not found error:**
   - Ensure CA has been created first using `/api/ca/create`
   - Check that CA files exist in the mounted directory
   - Verify the `caId` parameter matches an existing CA

2. **Invalid password error:**
   - Ensure you're using the correct password that was used during CA creation
   - Password is case-sensitive

3. **File upload errors:**
   - Check file extensions are correct (.crt, .key, .srl for CA; .crt, .key, .pem for certificates)
   - Ensure files are under 5MB limit
   - Verify file permissions allow reading

4. **Certificate download 404:**
   - Ensure certificate has been signed first
   - Check hostname spelling and case
   - Verify the certificate type (cert/key/fullchain) exists

5. **Permission errors:**
   - Check Docker volume mounts are configured correctly
   - Ensure write permissions on mounted directories
   - Verify script execution permissions (`chmod +x *.sh`)

### API Rate Limiting

Currently, no rate limiting is implemented. For production use, consider implementing rate limiting to prevent abuse.

### Logging and Monitoring

Monitor the following for production deployments:
- API response times
- Error rates
- Certificate creation/signing volume
- Disk space usage for certificate storage
- CA private key access attempts