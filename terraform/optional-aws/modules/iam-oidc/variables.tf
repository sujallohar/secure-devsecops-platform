# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/modules/iam-oidc/variables.tf
# ──────────────────────────────────────────────────────────────

variable "project_name" {
  description = "Project name used in resource naming and tagging."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)."
  type        = string
}

variable "allowed_subjects" {
  description = <<-EOT
    List of GitHub OIDC subject claims allowed to assume the role.
    Format: "repo:<owner>/<repo>:ref:refs/heads/<branch>"
    Example: ["repo:sujallohar/secure-devsecops-platform:ref:refs/heads/main"]
    Use "*" at the end to allow all branches from the repo.
  EOT
  type        = list(string)
  default = [
    "repo:sujallohar/secure-devsecops-platform:ref:refs/heads/main",
    "repo:sujallohar/secure-devsecops-platform:ref:refs/heads/feature/*"
  ]
}

variable "ecr_repository_arns" {
  description = "List of ECR repository ARNs the role is allowed to push to."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Additional tags to apply to all resources."
  type        = map(string)
  default     = {}
}
