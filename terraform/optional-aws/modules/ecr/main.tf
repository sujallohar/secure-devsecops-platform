# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/modules/ecr/main.tf
#
# Creates 5 ECR repositories for the microservices platform:
#   - api-gateway
#   - user-service
#   - product-service
#   - order-service
#   - frontend
#
# Security hardening:
#   - scan_on_push = true  → automated Clair vulnerability scanning
#   - image_tag_mutability = IMMUTABLE → prevents tag overwriting attacks
#   - Lifecycle policy retains only the last 10 images per repo
#
# Cost note:
#   ECR: Free tier = 500 MB/month storage for 12 months.
#   Beyond that: $0.10/GB/month for storage.
#   Scan on push: $0.09 per image scan (first 50 free/month in some regions).
# ──────────────────────────────────────────────────────────────

locals {
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
  })
}

resource "aws_ecr_repository" "services" {
  for_each = toset(var.repository_names)

  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(local.common_tags, {
    Name    = "${var.project_name}-${each.key}"
    Service = each.key
  })
}

# ── Lifecycle Policy: retain only the last 10 images ─────────
# Prevents unbounded storage growth and cost accumulation.

resource "aws_ecr_lifecycle_policy" "retain_last_10" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
