# Variables for AWS EKS Fargate deployment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "planner"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

# EKS Configuration
variable "eks_cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "eks_public_access_cidrs" {
  description = "CIDR blocks that can access the EKS public API endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "vpc_cni_version" {
  description = "Version of VPC CNI addon"
  type        = string
  default     = "v1.15.1-eksbuild.1"
}

variable "coredns_version" {
  description = "Version of CoreDNS addon"
  type        = string
  default     = "v1.10.1-eksbuild.6"
}

variable "kube_proxy_version" {
  description = "Version of kube-proxy addon"
  type        = string
  default     = "v1.28.2-eksbuild.2"
}

# Application Configuration
variable "app_image" {
  description = "Docker image for the application"
  type        = string
}

variable "app_port" {
  description = "Port exposed by the application"
  type        = number
  default     = 8000
}

variable "app_replicas" {
  description = "Number of application pod replicas"
  type        = number
  default     = 2
}

variable "app_cpu_request" {
  description = "CPU request for application pods (e.g., '500m')"
  type        = string
  default     = "500m"
}

variable "app_cpu_limit" {
  description = "CPU limit for application pods (e.g., '1000m')"
  type        = string
  default     = "1000m"
}

variable "app_memory_request" {
  description = "Memory request for application pods (e.g., '1Gi')"
  type        = string
  default     = "1Gi"
}

variable "app_memory_limit" {
  description = "Memory limit for application pods (e.g., '2Gi')"
  type        = string
  default     = "2Gi"
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "planner"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "planner_admin"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

# Application Configuration
variable "secret_key" {
  description = "Application secret key"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
  default     = ""
}

# Auto Scaling Configuration
variable "autoscaling_min_replicas" {
  description = "Minimum number of pod replicas"
  type        = number
  default     = 2
}

variable "autoscaling_max_replicas" {
  description = "Maximum number of pod replicas"
  type        = number
  default     = 10
}

variable "autoscaling_target_cpu" {
  description = "Target CPU utilization percentage for autoscaling"
  type        = number
  default     = 70
}

variable "autoscaling_target_memory" {
  description = "Target memory utilization percentage for autoscaling"
  type        = number
  default     = 80
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

# Monitoring Configuration
variable "enable_control_plane_logging" {
  description = "Enable EKS control plane logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "alert_email" {
  description = "Email address for CloudWatch alerts"
  type        = string
  default     = ""
}
