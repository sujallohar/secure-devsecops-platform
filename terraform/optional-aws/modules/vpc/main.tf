# ──────────────────────────────────────────────────────────────
# terraform/optional-aws/modules/vpc/main.tf
#
# Creates a production-grade VPC with:
#   - 2 public subnets (one per AZ) for load balancers / NAT GWs
#   - 2 private subnets (one per AZ) for EKS worker nodes
#   - Internet Gateway for public subnets
#   - NAT Gateway (single, in AZ-a) for private subnet egress
#   - Separate route tables for public and private subnets
#   - Default security group locked down to VPC-internal only
#
# Cost note:
#   NAT Gateway: ~$0.045/hr (~$32/month) + $0.045/GB processed
#   This is NOT free-tier eligible. See cost breakdown in Phase 18 report.
#   Elastic IP for NAT GW: $0.005/hr when attached (~$3.60/month)
# ──────────────────────────────────────────────────────────────

# In a real deployment, uncomment this data source and remove the
# `availability_zones` variable to auto-discover AZs:
#
# data "aws_availability_zones" "available" {
#   state = "available"
# }

locals {
  azs = slice(var.availability_zones, 0, 2)

  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "opentofu"
  })
}

# ── VPC ──────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-vpc"
  })
}

# ── Internet Gateway ─────────────────────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-igw"
  })
}

# ── Public Subnets (one per AZ) ──────────────────────────────

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name                     = "${var.project_name}-${var.environment}-public-${local.azs[count.index]}"
    "kubernetes.io/role/elb" = "1"
    Tier                     = "public"
  })
}

# ── Private Subnets (one per AZ) ─────────────────────────────

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = local.azs[count.index]

  tags = merge(local.common_tags, {
    Name                              = "${var.project_name}-${var.environment}-private-${local.azs[count.index]}"
    "kubernetes.io/role/internal-elb" = "1"
    Tier                              = "private"
  })
}

# ── Elastic IP for NAT Gateway ───────────────────────────────

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-nat-eip"
  })
}

# ── NAT Gateway (single, in first public subnet) ────────────
# A single NAT GW is cheaper than one per AZ.
# For production HA, deploy one per AZ.

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-nat-gw"
  })

  depends_on = [aws_internet_gateway.main]
}

# ── Public Route Table ───────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Private Route Table ──────────────────────────────────────

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-private-rt"
  })
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── Default Security Group (locked down) ─────────────────────
# The default SG should allow nothing from outside the VPC.
# EKS and services will create their own purpose-built SGs.

resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  # Allow all traffic within the VPC only
  ingress {
    from_port = 0
    to_port   = 0
    protocol  = "-1"
    self      = true
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-default-sg"
  })
}
