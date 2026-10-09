# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/modules/iam-oidc/main.tf
#
# Creates a GitHub Actions OIDC provider and an IAM role that
# can ONLY be assumed by a specific GitHub repository on
# specific branches. This eliminates long-lived AWS access
# keys entirely.
#
# ── How the Trust Policy Prevents Cross-Repository Abuse ─────
#
# GitHub Actions issues an OIDC token for every workflow run.
# The token includes a `sub` (subject) claim in this format:
#
#   repo:<owner>/<repo>:ref:refs/heads/<branch>
#
# The IAM role's trust policy contains a Condition block that
# checks the `sub` claim with StringLike:
#
#   "token.actions.githubusercontent.com:sub": "repo:sujallohar/secure-devsecops-platform:ref:refs/heads/*"
#
# This means:
#   ✅ Workflows in repo `sujallohar/secure-devsecops-platform` CAN assume the role
#   ❌ Workflows in ANY other GitHub repo (e.g. `attacker/evil-repo`) CANNOT
#      assume the role, because their OIDC token's `sub` claim
#      will be `repo:attacker/evil-repo:ref:...` which does NOT
#      match the condition.
#
# To further restrict to specific branches only, the condition
# can be narrowed to:
#   "repo:sujallohar/secure-devsecops-platform:ref:refs/heads/main"
#
# This is the control that replaces long-lived IAM access keys:
#   - No secrets stored in GitHub (no ACCESS_KEY_ID / SECRET)
#   - Credentials are ephemeral (15-min session tokens)
#   - Trust is cryptographically bound to the repo identity
#   - Revoking access = deleting the IAM role (instant)
#
# Cost note: IAM resources are 100% free. No charges.
# ──────────────────────────────────────────────────────────────

locals {
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
  })
}

# ── GitHub OIDC Identity Provider ────────────────────────────
# This tells AWS to trust tokens issued by GitHub Actions.
# The thumbprint is GitHub's TLS certificate thumbprint.

resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub Actions OIDC thumbprint (stable, published by GitHub)
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-github-oidc-provider"
  })
}

# ── IAM Role assumable ONLY from the specified repository ────

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    sid     = "AllowGitHubOIDC"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    # ── THE CRITICAL SECURITY CONDITION ──
    # This is what prevents any other repository from assuming
    # this role. The `sub` claim in the OIDC token is
    # cryptographically signed by GitHub and cannot be forged.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.allowed_subjects
    }

    # Ensure the audience matches our client ID
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name                 = "${var.project_name}-${var.environment}-github-actions"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_trust.json
  max_session_duration = 3600 # 1 hour max session

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-github-actions-role"
  })
}

# ── ECR Push Policy ──────────────────────────────────────────
# Grant the CI/CD role permission to push images to ECR.

data "aws_iam_policy_document" "ecr_push" {
  statement {
    sid    = "ECRAuthToken"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:DescribeRepositories",
      "ecr:ListImages"
    ]
    resources = var.ecr_repository_arns
  }
}

resource "aws_iam_role_policy" "ecr_push" {
  name   = "${var.project_name}-${var.environment}-ecr-push"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.ecr_push.json
}
