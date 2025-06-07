# Build stage for React frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Production stage
FROM node:18-alpine

# Install OpenSSL for certificate operations
RUN apk add --no-cache openssl bash

WORKDIR /app

# Copy backend package files
COPY package*.json ./
RUN npm install --only=production

# Copy backend source
COPY server.js ./
COPY create-ca.sh ./
COPY sign-host.sh ./

# Make scripts executable
RUN chmod +x create-ca.sh sign-host.sh

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Create directories for CA and certificates
RUN mkdir -p /app/ca /app/certs

# Set permissions
RUN chmod 700 /app/ca /app/certs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/ca/status || exit 1

# Start the application
CMD ["node", "server.js"]