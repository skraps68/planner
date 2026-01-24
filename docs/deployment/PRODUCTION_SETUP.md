# Production Environment Setup Guide

## Overview

This guide provides step-by-step instructions for setting up the Program and Project Management System in a production environment.

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ or similar)
- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Memory**: Minimum 4GB RAM (8GB+ recommended)
- **Storage**: Minimum 20GB available disk space
- **Network**: Stable internet connection for initial setup

### Required Access

- Root or sudo access to the server
- Access to configure firewall rules
- Domain name (optional, for HTTPS setup)
- SSL certificates (for HTTPS)

## Installation Steps

### 1. Install Docker

```bash
# Update package index
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up stable repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
```

### 2. Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### 3. Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd planner

# Checkout the desired version/tag
git checkout main  # or specific version tag
```

### 4. Configure Environment Variables

```bash
# Copy the production environment template
cp .env.production.example .env

# Edit the .env file with production values
nano .env
```

**Critical Environment Variables to Update:**

```bash
# Security - MUST CHANGE!
SECRET_KEY="<generate-with-openssl-rand-hex-32>"
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database
POSTGRES_SERVER="db"  # or external RDS endpoint
POSTGRES_USER="planner_admin"
POSTGRES_PASSWORD="<strong-password>"
POSTGRES_DB="planner_production"

# Redis
REDIS_HOST="redis"  # or external ElastiCache endpoint
REDIS_PASSWORD="<strong-password>"

# Application
ENVIRONMENT="production"
DEBUG=false
BACKEND_CORS_ORIGINS="https://your-domain.com"
```

**Generate a secure SECRET_KEY:**

```bash
openssl rand -hex 32
```

### 5. Configure SSL Certificates (for HTTPS)

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy your SSL certificates
cp /path/to/your/cert.pem nginx/ssl/cert.pem
cp /path/to/your/key.pem nginx/ssl/key.pem

# Set proper permissions
chmod 600 nginx/ssl/key.pem
chmod 644 nginx/ssl/cert.pem
```

**For Let's Encrypt certificates:**

```bash
# Install certbot
sudo apt-get install -y certbot

# Obtain certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
```

### 6. Configure Firewall

```bash
# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### 7. Build and Start Services

```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

### 8. Run Database Migrations

```bash
# Run migrations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic upgrade head

# Verify migration status
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic current
```

### 9. Create Initial Admin User

```bash
# Access the application container
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app bash

# Run the user creation script (if available)
python scripts/create_admin_user.py

# Or use the API to create the first user
```

### 10. Verify Installation

```bash
# Check all services are running
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Check application logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app

# Test API health endpoint
curl http://localhost:8000/health

# Or with HTTPS
curl https://your-domain.com/health
```

## Post-Installation Configuration

### Configure Backup Strategy

```bash
# Create backup directory
mkdir -p /var/backups/planner

# Set up automated database backups (add to crontab)
0 2 * * * docker-compose -f /path/to/docker-compose.yml -f /path/to/docker-compose.prod.yml exec -T db pg_dump -U planner_admin planner_production > /var/backups/planner/backup-$(date +\%Y\%m\%d-\%H\%M\%S).sql
```

### Configure Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/planner
```

Add the following content:

```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
```

### Set Up Monitoring

1. Configure application monitoring (Sentry, Datadog, etc.)
2. Set up server monitoring (CPU, memory, disk usage)
3. Configure alerting for critical issues
4. Set up log aggregation

## Security Hardening

### 1. Disable Debug Mode

Ensure in `.env`:
```bash
DEBUG=false
ENVIRONMENT=production
```

### 2. Restrict Database Access

```bash
# Only allow connections from application container
# Configure PostgreSQL pg_hba.conf if using external database
```

### 3. Enable Rate Limiting

The Nginx configuration includes rate limiting. Adjust as needed in `nginx/nginx.conf`.

### 4. Regular Security Updates

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 5. Configure Secrets Management

For production, consider using:
- AWS Secrets Manager
- HashiCorp Vault
- Docker Secrets

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs

# Check specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app

# Restart services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps db

# Test database connection
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U planner_admin -d planner_production

# Check database logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs db
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check application logs for errors
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app | grep ERROR

# Increase resources if needed (edit docker-compose.prod.yml)
```

## Maintenance

### Regular Tasks

- **Daily**: Check application logs for errors
- **Weekly**: Review system resource usage
- **Monthly**: Update Docker images and system packages
- **Quarterly**: Review and rotate SSL certificates
- **Annually**: Review and update security configurations

### Backup Verification

```bash
# Test backup restoration periodically
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U planner_admin -d planner_test < /var/backups/planner/backup-latest.sql
```

## Support

For issues or questions:
- Check the troubleshooting guide
- Review application logs
- Contact the development team
- Refer to the deployment runbook for detailed procedures
