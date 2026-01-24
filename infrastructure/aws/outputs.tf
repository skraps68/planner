# Terraform Outputs

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "eks_cluster_id" {
  description = "ID of the EKS cluster"
  value       = aws_eks_cluster.main.id
}

output "eks_cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "Endpoint of the EKS cluster"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_cluster_certificate_authority" {
  description = "Certificate authority data for the EKS cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "eks_cluster_oidc_issuer_url" {
  description = "OIDC issuer URL for the EKS cluster"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "eks_fargate_profile_app" {
  description = "Name of the application Fargate profile"
  value       = aws_eks_fargate_profile.app.fargate_profile_name
}

output "eks_fargate_profile_kube_system" {
  description = "Name of the kube-system Fargate profile"
  value       = aws_eks_fargate_profile.kube_system.fargate_profile_name
}

output "rds_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "rds_address" {
  description = "Address of the RDS instance"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "rds_database_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

output "redis_endpoint" {
  description = "Endpoint of the ElastiCache Redis cluster"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "redis_port" {
  description = "Port of the ElastiCache Redis cluster"
  value       = aws_elasticache_cluster.main.cache_nodes[0].port
}

output "s3_app_storage_bucket" {
  description = "Name of the S3 bucket for application storage"
  value       = aws_s3_bucket.app_storage.id
}

output "s3_alb_logs_bucket" {
  description = "Name of the S3 bucket for ALB logs"
  value       = aws_s3_bucket.alb_logs.id
}

output "cloudwatch_log_group_eks" {
  description = "Name of the CloudWatch log group for EKS"
  value       = aws_cloudwatch_log_group.eks.name
}

output "cloudwatch_log_group_app_pods" {
  description = "Name of the CloudWatch log group for application pods"
  value       = aws_cloudwatch_log_group.app_pods.name
}

output "sns_alerts_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "application_url" {
  description = "URL of the application"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.app.repository_url
}
