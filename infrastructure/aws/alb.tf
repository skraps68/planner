# Application Load Balancer Configuration
# Note: For EKS, the AWS Load Balancer Controller will create and manage
# the ALB and target groups based on Kubernetes Ingress resources.
# This file provides the base security group and S3 bucket for ALB logs.

# S3 Bucket for ALB logs is defined in s3.tf

# Security Group for ALB (will be used by AWS Load Balancer Controller)
# The actual ALB will be created by the controller based on Ingress resources

# CloudWatch Alarms for ALB (will need to be updated after ALB is created by controller)
# These are example alarms - actual alarm configuration should reference the
# dynamically created ALB after deployment

