# Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered in the Program and Project Management System.

## Table of Contents

1. [Application Issues](#application-issues)
2. [Database Issues](#database-issues)
3. [Docker Issues](#docker-issues)
4. [Performance Issues](#performance-issues)
5. [Network Issues](#network-issues)
6. [Authentication Issues](#authentication-issues)

---

## Application Issues

### Application Won't Start

**Symptoms:**
- Container exits immediately after starting
- Health checks failing
- Error messages in logs

**Diagnosis:**
```bash
# Check container status
docker-compose ps

# Check application logs
docker-compose logs app

# Check for Python errors
docker-compose logs app | grep -i "error\|exception\|traceback"
```

**Common Causes & Solutions:**

1. **Missing Environment Variables**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # Verify required variables
   grep -E "SECRET_KEY|POSTGRES_|REDIS_" .env
   
   # Solution: Copy from example and configure
   cp .env.example .env
   nano .env
   ```

2. **Database Connection Failed**
   ```bash
   # Check database is running
   docker-compose ps db
   
   # Test database connection
   docker-compose exec db psql -U postgres -d planner -c "SELECT 1;"
   
   # Solution: Ensure database is healthy before starting app
   docker-compose up -d db
   sleep 10
   docker-compose up -d app
   ```

3. **Port Already in Use**
   ```bash
   # Check what's using port 8000
   sudo lsof -i :8000
   
   # Solution: Stop conflicting service or change port
   # Edit docker-compose.yml to use different port
   ```

### API Endpoints Returning 500 Errors

**Diagnosis:**
```bash
# Check recent errors
docker-compose logs app --tail=100 | grep "500\|ERROR"

# Check database connectivity
docker-compose exec app python -c "from app.db.session import SessionLocal; db = SessionLocal(); print('Connected')"
```

**Solutions:**

1. **Database Query Errors**
   - Check migration status: `docker-compose exec app alembic current`
   - Run pending migrations: `docker-compose exec app alembic upgrade head`

2. **Redis Connection Issues**
   ```bash
   # Test Redis connection
   docker-compose exec redis redis-cli ping
   
   # Restart Redis if needed
   docker-compose restart redis
   ```

### Slow Response Times

**Diagnosis:**
```bash
# Check container resource usage
docker stats

# Check database query performance
docker-compose exec db psql -U postgres -d planner -c "SELECT * FROM pg_stat_activity;"

# Check for slow queries
docker-compose logs app | grep "slow query"
```

**Solutions:**

1. **High CPU Usage**
   - Increase worker count in docker-compose.prod.yml
   - Add more application replicas

2. **Database Performance**
   - Add missing indexes
   - Optimize slow queries
   - Increase database resources

3. **Cache Not Working**
   ```bash
   # Check Redis is running
   docker-compose ps redis
   
   # Check Redis memory usage
   docker-compose exec redis redis-cli info memory
   
   # Clear cache if needed
   docker-compose exec redis redis-cli FLUSHALL
   ```

---

## Database Issues

### Cannot Connect to Database

**Symptoms:**
- "Connection refused" errors
- "Could not connect to server" messages
- Application fails to start

**Diagnosis:**
```bash
# Check database container
docker-compose ps db

# Check database logs
docker-compose logs db

# Try direct connection
docker-compose exec db psql -U postgres -d planner
```

**Solutions:**

1. **Database Not Running**
   ```bash
   # Start database
   docker-compose up -d db
   
   # Wait for it to be ready
   docker-compose exec db pg_isready -U postgres
   ```

2. **Wrong Credentials**
   ```bash
   # Verify credentials in .env
   grep POSTGRES .env
   
   # Update if needed
   nano .env
   
   # Restart application
   docker-compose restart app
   ```

3. **Database Initialization Failed**
   ```bash
   # Remove database volume and recreate
   docker-compose down -v
   docker-compose up -d db
   
   # Wait for initialization
   sleep 15
   
   # Run migrations
   docker-compose exec app alembic upgrade head
   ```

### Database Corruption

**Symptoms:**
- Inconsistent data
- Foreign key violations
- Index corruption errors

**Diagnosis:**
```bash
# Check database integrity
docker-compose exec db psql -U postgres -d planner -c "VACUUM ANALYZE;"

# Check for corruption
docker-compose exec db psql -U postgres -d planner -c "SELECT * FROM pg_stat_database WHERE datname='planner';"
```

**Solutions:**

1. **Restore from Backup**
   ```bash
   # Stop application
   docker-compose down
   
   # Start only database
   docker-compose up -d db
   
   # Restore backup
   docker-compose exec -T db psql -U postgres -d planner < backup.sql
   
   # Restart all services
   docker-compose up -d
   ```

2. **Rebuild Indexes**
   ```bash
   docker-compose exec db psql -U postgres -d planner -c "REINDEX DATABASE planner;"
   ```

### Out of Disk Space

**Symptoms:**
- "No space left on device" errors
- Database write failures
- Container crashes

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# Check database size
docker-compose exec db psql -U postgres -d planner -c "SELECT pg_size_pretty(pg_database_size('planner'));"
```

**Solutions:**

1. **Clean Up Docker Resources**
   ```bash
   # Remove unused images
   docker image prune -a
   
   # Remove unused volumes
   docker volume prune
   
   # Remove unused containers
   docker container prune
   
   # Full cleanup (careful!)
   docker system prune -a --volumes
   ```

2. **Clean Up Old Backups**
   ```bash
   # Remove backups older than 30 days
   find /var/backups/planner -name "*.sql" -mtime +30 -delete
   ```

3. **Vacuum Database**
   ```bash
   docker-compose exec db psql -U postgres -d planner -c "VACUUM FULL;"
   ```

---

## Docker Issues

### Container Keeps Restarting

**Diagnosis:**
```bash
# Check container status
docker-compose ps

# Check restart count
docker inspect <container-id> | grep RestartCount

# Check logs
docker-compose logs --tail=100 app
```

**Solutions:**

1. **Application Crash Loop**
   - Fix application errors shown in logs
   - Check for missing dependencies
   - Verify environment configuration

2. **Health Check Failing**
   ```bash
   # Test health endpoint manually
   docker-compose exec app curl http://localhost:8000/health
   
   # Adjust health check settings in docker-compose.yml
   ```

### Cannot Build Docker Image

**Symptoms:**
- Build fails with errors
- Dependencies cannot be installed
- Context too large

**Diagnosis:**
```bash
# Try building manually
docker build -t planner-test .

# Check build context size
du -sh .
```

**Solutions:**

1. **Build Context Too Large**
   ```bash
   # Check .dockerignore file
   cat .dockerignore
   
   # Add large directories to .dockerignore
   echo "node_modules/" >> .dockerignore
   echo "*.log" >> .dockerignore
   ```

2. **Dependency Installation Fails**
   ```bash
   # Clear build cache
   docker build --no-cache -t planner-test .
   
   # Check requirements.txt
   cat backend/requirements.txt
   ```

### Docker Compose Version Issues

**Symptoms:**
- "version not supported" errors
- Unknown configuration keys

**Solutions:**

1. **Update Docker Compose**
   ```bash
   # Check current version
   docker-compose --version
   
   # Install latest version
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Use Compatible Syntax**
   - Check docker-compose.yml version
   - Update syntax for your Docker Compose version

---

## Performance Issues

### High Memory Usage

**Diagnosis:**
```bash
# Check memory usage
docker stats --no-stream

# Check system memory
free -h

# Check for memory leaks
docker-compose logs app | grep -i "memory\|oom"
```

**Solutions:**

1. **Increase Container Memory Limits**
   ```yaml
   # In docker-compose.prod.yml
   services:
     app:
       deploy:
         resources:
           limits:
             memory: 2G
           reservations:
             memory: 1G
   ```

2. **Optimize Application**
   - Review database query efficiency
   - Check for memory leaks in code
   - Implement pagination for large datasets

3. **Add Swap Space**
   ```bash
   # Create swap file
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### High CPU Usage

**Diagnosis:**
```bash
# Check CPU usage
docker stats --no-stream

# Check for CPU-intensive processes
docker-compose exec app top
```

**Solutions:**

1. **Scale Application**
   ```bash
   # Add more workers
   docker-compose up -d --scale app=3
   ```

2. **Optimize Code**
   - Profile application to find bottlenecks
   - Optimize database queries
   - Implement caching

### Slow Database Queries

**Diagnosis:**
```bash
# Enable query logging
docker-compose exec db psql -U postgres -d planner -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"
docker-compose restart db

# Check slow queries
docker-compose logs db | grep "duration:"
```

**Solutions:**

1. **Add Missing Indexes**
   ```sql
   -- Find missing indexes
   SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0;
   
   -- Add indexes as needed
   CREATE INDEX idx_projects_program_id ON projects(program_id);
   ```

2. **Analyze Query Plans**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM projects WHERE program_id = 'xxx';
   ```

3. **Optimize Queries**
   - Use proper joins
   - Limit result sets
   - Use pagination

---

## Network Issues

### Cannot Access Application

**Symptoms:**
- Connection refused
- Timeout errors
- DNS resolution failures

**Diagnosis:**
```bash
# Check if application is listening
docker-compose exec app netstat -tlnp

# Check from host
curl http://localhost:8000/health

# Check firewall
sudo ufw status
```

**Solutions:**

1. **Port Not Exposed**
   ```bash
   # Check port mapping
   docker-compose ps
   
   # Verify in docker-compose.yml
   grep -A 2 "ports:" docker-compose.yml
   ```

2. **Firewall Blocking**
   ```bash
   # Allow port
   sudo ufw allow 8000/tcp
   
   # Reload firewall
   sudo ufw reload
   ```

3. **DNS Issues**
   ```bash
   # Test DNS resolution
   nslookup your-domain.com
   
   # Update DNS settings if needed
   ```

### SSL/TLS Certificate Issues

**Symptoms:**
- Certificate expired warnings
- SSL handshake failures
- Mixed content errors

**Diagnosis:**
```bash
# Check certificate expiration
openssl x509 -in nginx/ssl/cert.pem -noout -dates

# Test SSL connection
openssl s_client -connect your-domain.com:443
```

**Solutions:**

1. **Renew Certificate**
   ```bash
   # For Let's Encrypt
   sudo certbot renew
   
   # Copy new certificates
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem
   
   # Restart Nginx
   docker-compose restart nginx
   ```

2. **Fix Certificate Chain**
   - Ensure full certificate chain is included
   - Verify intermediate certificates

---

## Authentication Issues

### Cannot Log In

**Symptoms:**
- Invalid credentials errors
- Token validation failures
- Session expired messages

**Diagnosis:**
```bash
# Check authentication logs
docker-compose logs app | grep -i "auth\|login"

# Test authentication endpoint
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

**Solutions:**

1. **Password Hash Mismatch**
   ```bash
   # Reset user password
   docker-compose exec app python -c "
   from app.services.authentication import hash_password
   print(hash_password('newpassword'))
   "
   
   # Update in database
   docker-compose exec db psql -U postgres -d planner -c \
     "UPDATE users SET password_hash='<new-hash>' WHERE username='test';"
   ```

2. **JWT Token Issues**
   ```bash
   # Verify SECRET_KEY is set
   grep SECRET_KEY .env
   
   # Regenerate if needed
   openssl rand -hex 32
   ```

3. **Session Expired**
   - Check token expiration settings
   - Implement token refresh mechanism

### Permission Denied Errors

**Symptoms:**
- 403 Forbidden responses
- "Insufficient permissions" messages
- Scope validation failures

**Diagnosis:**
```bash
# Check user roles
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT * FROM user_roles WHERE user_id='<user-id>';"

# Check scope assignments
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT * FROM scope_assignments WHERE user_role_id='<role-id>';"
```

**Solutions:**

1. **Missing Role Assignment**
   ```sql
   -- Assign role to user
   INSERT INTO user_roles (id, user_id, role_type, is_active)
   VALUES (gen_random_uuid(), '<user-id>', 'ADMIN', true);
   ```

2. **Missing Scope Assignment**
   ```sql
   -- Assign program scope
   INSERT INTO scope_assignments (id, user_role_id, scope_type, program_id, is_active)
   VALUES (gen_random_uuid(), '<role-id>', 'PROGRAM', '<program-id>', true);
   ```

---

## Getting Help

If you cannot resolve an issue using this guide:

1. **Check Application Logs**
   ```bash
   docker-compose logs --tail=500 app > app-logs.txt
   ```

2. **Gather System Information**
   ```bash
   docker-compose ps > docker-status.txt
   docker stats --no-stream > docker-stats.txt
   df -h > disk-usage.txt
   ```

3. **Contact Support**
   - Include log files
   - Describe steps to reproduce
   - Note any recent changes
   - Provide system information

4. **Emergency Escalation**
   - Slack: #planner-production
   - Email: devops@company.com
   - On-call: [PagerDuty link]
