# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/modules/ecr/variables.tf
# ──────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used in resource naming and tagging."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
}

variable "repository_names" {
  description = "List of ECR repository names to create."
  type        = list(string)
  default = [
    "api-gateway",
    "user-service",
    "product-service",
    "order-service",
    "frontend"
  ]
}

variable "tags" {
  description = "Additional tags to apply to all resources."
  type        = map(string)
  default     = {}
}
