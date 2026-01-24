# AWS Secrets Manager Configuration

# Database Password Secret
resource "aws_secretsmanager_secret" "db_password" {
  name        = "${local.name_prefix}-db-password"
  description = "Database password for ${local.name_prefix}"
  
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = var.db_password
}

# Application Secret Key
resource "aws_secretsmanager_secret" "secret_key" {
  name        = "${local.name_prefix}-secret-key"
  description = "Application secret key for ${local.name_prefix}"
  
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "secret_key" {
  secret_id     = aws_secretsmanager_secret.secret_key.id
  secret_string = var.secret_key
}

# Redis Password Secret (if needed in future)
resource "aws_secretsmanager_secret" "redis_password" {
  name        = "${local.name_prefix}-redis-password"
  description = "Redis password for ${local.name_prefix}"
  
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_password" {
  secret_id     = aws_secretsmanager_secret.redis_password.id
  secret_string = random_password.redis_password.result
}

# Generate random password for Redis
resource "random_password" "redis_password" {
  length  = 32
  special = true
}
