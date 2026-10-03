# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/envs/dev/main.tf
#
# Dev environment wiring: VPC + ECR + IAM-OIDC
#
# THIS IS A VALIDATION-ONLY CONFIGURATION.
# It is designed to pass `tofu validate` and `tofu plan` (with
# mocked credentials) but is NEVER intended to be applied.
# No AWS resources will be created. Cost: $0.00.
# ──────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # ── Remote Backend Configuration (S3 + DynamoDB) ───────────
  # COMMENTED OUT: This backend requires an existing S3 bucket
  # and DynamoDB table, which have not been provisioned.
  #
  # To enable remote state:
  # 1. Create an S3 bucket (e.g. "secure-devsecops-tf-state-dev")
  #    with versioning enabled and server-side encryption (AES256).
  # 2. Create a DynamoDB table (e.g. "secure-devsecops-tf-locks")
  #    with partition key "LockID" (String type).
  # 3. Uncomment the block below and run `tofu init`.
  #
  # backend "s3" {
  #   bucket         = "secure-devsecops-tf-state-dev"
  #   key            = "envs/dev/terraform.tfstate"
  #   region         = "ap-south-1"
  #   encrypt        = true
  #   dynamodb_table = "secure-devsecops-tf-locks"
  #
  #   # Optional: use a specific IAM role for state access
  #   # role_arn = "arn:aws:iam::123456789012:role/terraform-state-access"
  # }
}

provider "aws" {
  region = var.aws_region

  # ── Validation-only flags ──────────────────────────────────
  # These allow `tofu plan` to run without real AWS credentials.
  # Remove these lines before any real `tofu apply`.
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "opentofu"
    }
  }
}

# ── VPC Module ───────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  project_name = var.project_name
  environment  = var.environment
  vpc_cidr     = "10.0.0.0/16"

  tags = var.extra_tags
}

# ── ECR Module ───────────────────────────────────────────────

module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  environment  = var.environment

  repository_names = [
    "api-gateway",
    "user-service",
    "product-service",
    "order-service",
    "frontend"
  ]

  tags = var.extra_tags
}

# ── IAM-OIDC Module (GitHub Actions keyless auth) ────────────

module "iam_oidc" {
  source = "../../modules/iam-oidc"

  project_name = var.project_name
  environment  = var.environment

  allowed_subjects = [
    "repo:sujallohar/secure-devsecops-platform:ref:refs/heads/main",
    "repo:sujallohar/secure-devsecops-platform:ref:refs/heads/feature/*"
  ]

  ecr_repository_arns = values(module.ecr.repository_arns)

  tags = var.extra_tags
}

# ── EKS Module (documented, wired, ready for future use) ─────
# Uncomment below to include EKS in the plan. This adds ~$140/month
# in AWS costs if applied. Left commented for zero-cost validation.
#
# module "eks" {
#   source = "../../modules/eks"
#
#   project_name       = var.project_name
#   environment        = var.environment
#   private_subnet_ids = module.vpc.private_subnet_ids
#   cluster_version    = "1.31"
#   node_instance_types = ["t3.medium"]
#   node_desired_size   = 2
#   node_min_size       = 1
#   node_max_size       = 4
#   node_disk_size      = 20
#
#   tags = var.extra_tags
# }
