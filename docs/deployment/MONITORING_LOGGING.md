# Monitoring and Logging Guide

## Overview

This guide covers monitoring, logging, and observability practices for the Program and Project Management System.

## Table of Contents

1. [Logging Configuration](#logging-configuration)
2. [Monitoring Setup](#monitoring-setup)
3. [Metrics Collection](#metrics-collection)
4. [Alerting](#alerting)
5. [Log Analysis](#log-analysis)

---

## Logging Configuration

### Application Logging

The application uses Python's logging module with JSON formatting for structured logs.

**Log Levels:**
- `DEBUG`: Detailed information for diagnosing problems
- `INFO`: General informational messages
- `WARNING`: Warning messages for potentially harmful situations
- `ERROR`: Error messages for serious problems
- `CRITICAL`: Critical messages for very serious errors

**Configuration:**

```python
# backend/app/core/config.py
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = os.getenv("LOG_FORMAT", "json")  # or "text"
```

### Docker Logging

Docker containers log to stdout/stderr, which Docker captures.

**View Logs:**

```bash
# View all logs
docker-compose logs

# View specific service
docker-compose logs app

# Follow logs in real-time
docker-compose logs -f app

# View last N lines
docker-compose logs --tail=100 app

# View logs with timestamps
docker-compose logs -t app

# View logs for specific time range
docker-compose logs --since="2024-01-24T10:00:00" app
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```yaml
# docker-compose.prod.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
```

**System-wide log rotation:**

```bash
# /etc/logrotate.d/docker-containers
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
```

### Centralized Logging

For production, send logs to a centralized logging system.

**Options:**
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- CloudWatch Logs (AWS)
- Google Cloud Logging

**Example: CloudWatch Logs**

```yaml
# docker-compose.prod.yml
services:
  app:
    logging:
      driver: "awslogs"
      options:
        awslogs-region: "us-east-1"
        awslogs-group: "planner-production"
        awslogs-stream: "app"
```

---

## Monitoring Setup

### Health Checks

The application provides health check endpoints:

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed health check (includes database, Redis)
curl http://localhost:8000/health/detailed
```

**Health Check Response:**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-24T10:30:00Z",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "disk_space": "healthy"
  }
}
```

### Container Monitoring

**Docker Stats:**

```bash
# Real-time stats
docker stats

# One-time snapshot
docker stats --no-stream

# Specific containers
docker stats planner-app planner-db
```

**Metrics Collected:**
- CPU usage percentage
- Memory usage and limit
- Network I/O
- Block I/O
- PIDs

### Application Metrics

Implement Prometheus metrics for detailed monitoring:

```python
# backend/app/main.py
from prometheus_client import Counter, Histogram, generate_latest

# Define metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration')

# Expose metrics endpoint
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

**Key Metrics to Track:**
- Request rate (requests/second)
- Error rate (errors/second)
- Response time (p50, p95, p99)
- Database query time
- Cache hit rate
- Active connections
- Queue length (if using Celery)

### Database Monitoring

**PostgreSQL Metrics:**

```bash
# Connection count
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Database size
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT pg_size_pretty(pg_database_size('planner'));"

# Table sizes
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size 
   FROM pg_tables 
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema') 
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Slow queries
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;"

# Cache hit ratio
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT sum(heap_blks_read) as heap_read, 
          sum(heap_blks_hit) as heap_hit, 
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio 
   FROM pg_statio_user_tables;"
```

### Redis Monitoring

```bash
# Redis info
docker-compose exec redis redis-cli info

# Memory usage
docker-compose exec redis redis-cli info memory

# Stats
docker-compose exec redis redis-cli info stats

# Key count
docker-compose exec redis redis-cli dbsize

# Monitor commands in real-time
docker-compose exec redis redis-cli monitor
```

---

## Metrics Collection

### Prometheus Setup

**1. Add Prometheus to docker-compose:**

```yaml
# docker-compose.prod.yml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: planner-prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - planner-network
    restart: unless-stopped

volumes:
  prometheus_data:
```

**2. Configure Prometheus:**

```yaml
# prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'planner-app'
    static_configs:
      - targets: ['app:8000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Setup

**1. Add Grafana to docker-compose:**

```yaml
# docker-compose.prod.yml
services:
  grafana:
    image: grafana/grafana:latest
    container_name: planner-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - planner-network
    restart: unless-stopped

volumes:
  grafana_data:
```

**2. Configure Datasource:**

```yaml
# grafana/datasources/prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

**3. Create Dashboard:**

Key panels to include:
- Request rate over time
- Error rate over time
- Response time percentiles
- CPU and memory usage
- Database connections
- Cache hit rate

---

## Alerting

### Alert Rules

**Prometheus Alert Rules:**

```yaml
# prometheus/alerts.yml
groups:
  - name: planner_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"
          description: "PostgreSQL database is not responding"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Container memory usage is {{ $value | humanizePercentage }}"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Only {{ $value | humanizePercentage }} disk space remaining"
```

### Alertmanager Configuration

```yaml
# prometheus/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-notifications'

receivers:
  - name: 'team-notifications'
    email_configs:
      - to: 'devops@company.com'
        from: 'alerts@company.com'
        smarthost: 'smtp.company.com:587'
        auth_username: 'alerts@company.com'
        auth_password: 'password'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#planner-alerts'
        title: 'Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

### PagerDuty Integration

```yaml
# prometheus/alertmanager.yml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
        description: '{{ .GroupLabels.alertname }}: {{ .CommonAnnotations.summary }}'
```

---

## Log Analysis

### Common Log Queries

**Find Errors:**

```bash
# All errors
docker-compose logs app | grep -i "error"

# Specific error type
docker-compose logs app | grep "DatabaseError"

# Errors in last hour
docker-compose logs --since="1h" app | grep -i "error"

# Count errors
docker-compose logs app | grep -i "error" | wc -l
```

**Performance Analysis:**

```bash
# Slow requests
docker-compose logs app | grep "slow request"

# Database queries
docker-compose logs app | grep "query"

# Cache misses
docker-compose logs app | grep "cache miss"
```

**User Activity:**

```bash
# Login attempts
docker-compose logs app | grep "login"

# Failed authentication
docker-compose logs app | grep "authentication failed"

# API usage by endpoint
docker-compose logs app | grep "GET\|POST\|PUT\|DELETE" | awk '{print $X}' | sort | uniq -c
```

### Log Aggregation Queries

**Elasticsearch/Kibana:**

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "ERROR" }},
        { "range": { "@timestamp": { "gte": "now-1h" }}}
      ]
    }
  }
}
```

**Splunk:**

```
index=planner level=ERROR earliest=-1h
| stats count by error_type
| sort -count
```

### Log Retention

**Retention Policy:**
- **Development**: 7 days
- **Staging**: 30 days
- **Production**: 90 days
- **Audit logs**: 1 year

**Implementation:**

```bash
# Automated cleanup script
#!/bin/bash
# /usr/local/bin/cleanup-logs.sh

# Remove logs older than retention period
find /var/log/planner -name "*.log" -mtime +90 -delete

# Remove old Docker logs
docker system prune -f --filter "until=720h"

# Remove old backups
find /var/backups/planner -name "*.sql" -mtime +30 -delete
```

**Add to crontab:**

```bash
# Run daily at 2 AM
0 2 * * * /usr/local/bin/cleanup-logs.sh
```

---

## Best Practices

### Logging Best Practices

1. **Use Structured Logging**
   ```python
   logger.info("User logged in", extra={
       "user_id": user.id,
       "username": user.username,
       "ip_address": request.client.host
   })
   ```

2. **Log Appropriate Level**
   - DEBUG: Development debugging
   - INFO: Normal operations
   - WARNING: Unexpected but handled
   - ERROR: Errors that need attention
   - CRITICAL: System-critical failures

3. **Include Context**
   - Request ID for tracing
   - User ID for audit
   - Timestamp
   - Service name

4. **Avoid Logging Sensitive Data**
   - Never log passwords
   - Mask credit card numbers
   - Redact PII when necessary

### Monitoring Best Practices

1. **Monitor What Matters**
   - User-facing metrics (response time, errors)
   - System health (CPU, memory, disk)
   - Business metrics (signups, transactions)

2. **Set Meaningful Thresholds**
   - Based on historical data
   - Account for normal variations
   - Adjust for traffic patterns

3. **Reduce Alert Fatigue**
   - Only alert on actionable issues
   - Group related alerts
   - Use appropriate severity levels

4. **Regular Review**
   - Review dashboards weekly
   - Update alert thresholds monthly
   - Audit metrics quarterly

---

## Troubleshooting with Logs

### Common Scenarios

**1. Application Crash**

```bash
# Find crash logs
docker-compose logs app | grep -B 20 -A 5 "Traceback\|Exception"

# Check for OOM kills
dmesg | grep -i "out of memory"

# Review recent changes
git log --since="1 day ago" --oneline
```

**2. Performance Degradation**

```bash
# Check slow queries
docker-compose logs app | grep "slow query"

# Review resource usage
docker stats --no-stream

# Check for errors
docker-compose logs app | grep -i "error" | tail -50
```

**3. Authentication Issues**

```bash
# Check auth logs
docker-compose logs app | grep -i "auth\|login\|token"

# Verify JWT configuration
grep SECRET_KEY .env

# Check user records
docker-compose exec db psql -U postgres -d planner -c \
  "SELECT id, username, is_active FROM users WHERE username='problematic-user';"
```

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Docker Logging Documentation](https://docs.docker.com/config/containers/logging/)
- [PostgreSQL Monitoring](https://www.postgresql.org/docs/current/monitoring.html)
