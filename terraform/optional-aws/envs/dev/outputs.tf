# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/envs/dev/outputs.tf
# ──────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID."
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs."
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs."
  value       = module.vpc.private_subnet_ids
}

output "ecr_repository_urls" {
  description = "ECR repository URLs (service → URL)."
  value       = module.ecr.repository_urls
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role."
  value       = module.iam_oidc.github_actions_role_arn
}
