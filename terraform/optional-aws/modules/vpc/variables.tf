# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/modules/vpc/variables.tf
# ──────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used in resource naming and tagging."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "tags" {
  description = "Additional tags to apply to all resources."
  type        = map(string)
  default     = {}
}

variable "availability_zones" {
  description = "List of availability zones to use. Must contain at least 2."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
}
