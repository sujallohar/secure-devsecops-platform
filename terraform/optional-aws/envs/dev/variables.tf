# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/envs/dev/variables.tf
# ──────────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "ap-south-1" # Mumbai — closest to the developer
}

variable "project_name" {
  description = "Project name used in resource naming."
  type        = string
  default     = "secure-devsecops"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

variable "extra_tags" {
  description = "Additional tags to apply to all resources."
  type        = map(string)
  default     = {}
}
