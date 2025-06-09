# Certificate Authority Manager

A web-based application for managing a Certificate Authority (CA) with both UI and REST API interfaces. Built with Node.js/Express backend and React frontend, containerized with Docker.

## Features

- **Web UI**: Easy-to-use interface for CA and certificate management
- **REST API**: Programmatic access to all CA operations
- **Docker Support**: Containerized application with volume mounts
- **Certificate Operations**:
  - Create Certificate Authority (CA)
  - Sign host certificates
  - List issued certificates
  - Download certificates, keys, and fullchain files

## Quick Start

### Using Docker Compose (Recommended)

1. **Build and start the application:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Web UI: http://localhost:5000
   - API: http://localhost:5000/api

3. **Create directories for persistence (optional):**
   ```bash
   mkdir -p ca-data cert-data
   ```

### Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **Build frontend:**
   ```bash
   npm run build
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## Usage

### Web Interface

1. **Create CA**: Go to the "Certificate Authority" tab and fill in the CA creation form
2. **Sign Certificates**: Go to the "Certificates" tab to sign new host certificates
3. **Download Files**: Download CA certificate, host certificates, keys, and fullchain files

### REST API Endpoints

#### CA Management
- `GET /api/ca/status` - Check CA status
- `POST /api/ca/create` - Create new CA
- `GET /api/ca/download` - Download CA certificate

#### Certificate Management
- `GET /api/certificates` - List all certificates
- `POST /api/certificates/sign` - Sign new certificate
- `GET /api/certificates/:hostname/download/:type` - Download certificate files

### API Examples

**Create CA:**
```bash
curl -X POST http://localhost:5000/api/ca/create \
  -H "Content-Type: application/json" \
  -d '{
    "password": "your-secure-password",
    "commonName": "My Root CA",
    "organization": "My Organization",
    "organizationalUnit": "IT Department",
    "validityDays": 3650
  }'
```

**Sign Certificate:**
```bash
curl -X POST http://localhost:5000/api/certificates/sign \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "example.local",
    "password": "your-ca-password",
    "validityDays": 825
  }'
```

## Volume Mounts

The application uses two important directories:

- `/app/ca` - Contains CA private key and certificate
- `/app/certs` - Contains signed certificates and keys

### Docker Volumes

When using docker-compose, these are automatically mounted to:
- `./ca-data:/app/ca`
- `./cert-data:/app/certs`

### Custom Mounts

You can mount your own directories:

```bash
docker run -p 5000:5000 \
  -v /path/to/your/ca:/app/ca \
  -v /path/to/your/certs:/app/certs \
  certificate-authority-manager
```

## Container Images

The application is available as pre-built container images on multiple registries:

### Docker Hub
```bash
docker pull [DOCKERHUB_USERNAME]/certificate-authority-manager:latest
```

### GitHub Container Registry (GHCR)
```bash
docker pull ghcr.io/[REPOSITORY]/certificate-authority-manager:latest
```

**Note:** Replace `[DOCKERHUB_USERNAME]` and `[REPOSITORY]` with the actual values for your setup.

### Using GHCR Image with Docker Compose

To use the GHCR image instead of building locally, modify your `docker-compose.yml`:

```yaml
services:
  certificate-manager:
    image: ghcr.io/[REPOSITORY]/certificate-authority-manager:latest
    # Remove the 'build: .' line
    ports:
      - "5000:5000"
    # ... rest of configuration
```

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment mode (development/production)

## Security Notes

- CA private keys are encrypted with AES-256
- Store CA password securely
- Backup CA directory regularly
- Restrict access to mounted volumes
- Use strong passwords for CA creation

## File Structure

```
/app/
    server.js              # Express server
    create-ca.sh           # CA creation script
    sign-host.sh           # Certificate signing script
    client/                # React frontend
        src/
            App.jsx
            App.css
            main.jsx
        dist/              # Built frontend (production)
    ca/                    # CA files (mounted)
        root_ca.key        # CA private key
        root_ca.crt        # CA certificate
        root_ca.srl        # Serial number file
    certs/                 # Certificate files (mounted)
        hostname.key       # Private keys
        hostname.crt       # Certificates
        hostname_fullchain.crt  # Fullchain files
```

## Documentation

### API Documentation
- **[Complete API Documentation](API_DOCUMENTATION.md)** - Detailed API reference with examples
- **[OpenAPI Specification](api-spec.yaml)** - Swagger-compatible API specification

### Key Documentation Files
- `README.md` - This file (project overview and quick start)
- `API_DOCUMENTATION.md` - Complete API reference
- `api-spec.yaml` - OpenAPI 3.0 specification for Swagger tools

## Architecture

### System Overview

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Express Server │    │  Shell Scripts  │
│   (Frontend)    │◄──►│   (REST API)    │◄──►│  (CA Operations)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   File System   │
                       │  (Certificates) │
                       └─────────────────┘
```

### Components
- **Frontend (React)**: Web UI for certificate management
- **Backend (Express)**: REST API server handling requests
- **Shell Scripts**: OpenSSL wrapper scripts for CA operations
- **File System**: Persistent storage for CA and certificate files

### Directory Structure

```text
/app/
├── server.js              # Express server
├── create-ca.sh          # CA creation script
├── sign-host.sh          # Certificate signing script
├── manage-ca.sh          # CA management script
├── client/               # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   └── dist/             # Built frontend
├── ca/                   # CA files (mounted volume)
│   ├── root_ca.key      # CA private key
│   ├── root_ca.crt      # CA certificate
│   └── root_ca.srl      # Serial number file
└── certs/               # Certificate files (mounted volume)
    ├── hostname.key     # Private keys
    ├── hostname.crt     # Certificates
    └── hostname_fullchain.crt  # Fullchain files
```

## Security Considerations

### CA Security
- CA private keys are encrypted with AES-256
- Store CA passwords in secure password managers
- Regular backup of CA directory is critical
- Implement proper access controls on mounted volumes

### API Security
- Currently no authentication implemented
- For production, implement API key authentication
- Consider implementing rate limiting
- Use HTTPS in production environments
- Validate all inputs and sanitize file uploads

### Certificate Best Practices
- Use appropriate validity periods (not too long/short)
- Implement certificate rotation policies
- Monitor certificate expiration dates
- Maintain certificate inventory and tracking

## Monitoring and Maintenance

### Health Checks
Monitor these endpoints for system health:
- `GET /api/ca/status` - CA availability
- `GET /api/certificates` - Certificate inventory

### Maintenance Tasks
- **Daily**: Check disk space usage
- **Weekly**: Review certificate inventory
- **Monthly**: Backup CA and certificate directories
- **Quarterly**: Review expiring certificates

### Logging
Application logs include:
- CA creation and management operations
- Certificate signing requests
- File upload/download activities
- Error conditions and troubleshooting

## Troubleshooting

### Common Issues

1. **Permission denied on scripts:**
   ```bash
   chmod +x create-ca.sh sign-host.sh manage-ca.sh
   ```

2. **CA not found error:**
   - Ensure CA has been created first
   - Check volume mounts are correct
   - Verify CA files exist in mounted directory

3. **Port already in use:**
   ```bash
   docker-compose down
   # Or change port in docker-compose.yml
   ```

4. **File upload errors:**
   - Check file extensions (.crt, .key, .srl for CA)
   - Ensure files are under 5MB limit
   - Verify write permissions on mounted volumes

5. **Certificate download failures:**
   - Ensure certificate was signed successfully
   - Check hostname spelling and case sensitivity
   - Verify file exists in certificates directory

### Debugging Steps

1. **Check container status:**
   ```bash
   docker-compose ps
   ```

2. **View application logs:**
   ```bash
   docker-compose logs -f certificate-manager
   ```

3. **Inspect mounted volumes:**
   ```bash
   ls -la ./ca-data/
   ls -la ./cert-data/
   ```

4. **Test API endpoints:**
   ```bash
   curl http://localhost:5000/api/ca/status
   ```

### Recovery Procedures

**CA Recovery:**
If CA files are corrupted or lost:
1. Restore from backup if available
2. Upload replacement CA files via `/api/upload/ca`
3. Verify CA status via `/api/ca/status`

**Certificate Recovery:**
If certificates are lost:
1. Re-sign certificates using existing CA
2. Update applications with new certificates
3. Verify certificate functionality