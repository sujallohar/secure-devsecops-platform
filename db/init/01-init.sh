#!/bin/bash
# ──────────────────────────────────────────────────────────────
# db/init/01-init.sh — Database Initialization Script
# Purpose: Create three logical databases, three least-privilege
#          roles, and their schemas on a single PostgreSQL 16
#          instance.
#
# Security controls:
#   - Each service gets its own database and its own role.
#   - Each role is granted CONNECT only to its own database.
#   - Cross-database access is explicitly denied (demonstrable).
#   - order_svc has NO grant on usersdb — this is intentional
#     and will be demonstrated as a security control.
#   - Passwords come from environment variables, never hardcoded.
#
# This script runs inside the PostgreSQL Docker container via
# /docker-entrypoint-initdb.d/ on first start only.
# ──────────────────────────────────────────────────────────────

set -euo pipefail

# ── Helper: run SQL against a specific database ──────────────
run_sql() {
  local db="$1"
  shift
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" "$@"
}

echo "=== Creating databases ==="

run_sql "$POSTGRES_DB" <<-EOSQL
  -- Create the three application databases
  CREATE DATABASE usersdb;
  CREATE DATABASE productsdb;
  CREATE DATABASE ordersdb;
EOSQL

echo "=== Creating roles with least-privilege grants ==="

# Each role gets:
#   1. LOGIN capability with a password
#   2. CONNECT privilege on ONLY its own database
#   3. Full usage on the public schema of its own database
#   4. No access to any other database
#
# Why not just use the superuser for everything?
#   Threat: SQL injection in one service could read/write data
#   belonging to another service. Separate roles with separate
#   grants ensure that even a compromised service cannot access
#   data outside its own database. This is the principle of
#   least privilege applied at the database layer.

run_sql "$POSTGRES_DB" <<-EOSQL
  -- Revoke default public CONNECT from all three databases.
  -- By default, PostgreSQL grants CONNECT to the 'public' role,
  -- which means any authenticated user can connect to any database.
  -- We revoke this so only explicitly granted roles can connect.
  -- Threat mitigated: unauthorized cross-service database access.
  REVOKE CONNECT ON DATABASE usersdb FROM PUBLIC;
  REVOKE CONNECT ON DATABASE productsdb FROM PUBLIC;
  REVOKE CONNECT ON DATABASE ordersdb FROM PUBLIC;

  -- Create the three service roles
  CREATE ROLE user_svc WITH LOGIN PASSWORD '${USERS_DB_PASSWORD}';
  CREATE ROLE product_svc WITH LOGIN PASSWORD '${PRODUCTS_DB_PASSWORD}';
  CREATE ROLE order_svc WITH LOGIN PASSWORD '${ORDERS_DB_PASSWORD}';

  -- Grant CONNECT only to the role's own database
  GRANT CONNECT ON DATABASE usersdb TO user_svc;
  GRANT CONNECT ON DATABASE productsdb TO product_svc;
  GRANT CONNECT ON DATABASE ordersdb TO order_svc;

  -- NOTE: order_svc intentionally has NO grant on usersdb.
  -- This is a demonstrable security control: if order-service
  -- tried to connect to usersdb, it would be rejected.
EOSQL

echo "=== Creating usersdb schema ==="

run_sql "usersdb" <<-EOSQL
  -- Grant schema usage to user_svc
  GRANT USAGE ON SCHEMA public TO user_svc;
  GRANT CREATE ON SCHEMA public TO user_svc;

  -- Users table: stores registered user accounts
  CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,  -- bcrypt hash, never plaintext
    role        VARCHAR(50) NOT NULL DEFAULT 'customer',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Index for login lookups (email is the lookup key)
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- Grant table-level privileges to user_svc
  GRANT SELECT, INSERT, UPDATE, DELETE ON users TO user_svc;

  -- Grant usage on sequences (needed for any serial columns)
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO user_svc;
EOSQL

echo "=== Creating productsdb schema ==="

run_sql "productsdb" <<-EOSQL
  -- Grant schema usage to product_svc
  GRANT USAGE ON SCHEMA public TO product_svc;
  GRANT CREATE ON SCHEMA public TO product_svc;

  -- Products table: stores the product catalogue
  CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    price       DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Grant table-level privileges to product_svc
  GRANT SELECT, INSERT, UPDATE, DELETE ON products TO product_svc;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO product_svc;
EOSQL

echo "=== Creating ordersdb schema ==="

run_sql "ordersdb" <<-EOSQL
  -- Grant schema usage to order_svc
  GRANT USAGE ON SCHEMA public TO order_svc;
  GRANT CREATE ON SCHEMA public TO order_svc;

  -- Orders table: stores customer orders
  CREATE TABLE IF NOT EXISTS orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,          -- references users.id logically, not via FK
                                          -- (cross-database FK not possible in PostgreSQL)
    product_id   UUID NOT NULL,          -- references products.id logically
    product_name VARCHAR(255) NOT NULL,  -- denormalised: snapshot at order time
    quantity     INTEGER NOT NULL CHECK (quantity > 0),
    unit_price   DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price  DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
    status       VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Index for user's order history queries
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

  -- Grant table-level privileges to order_svc
  GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO order_svc;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO order_svc;
EOSQL

echo "=== Database initialization complete ==="
echo "Databases: usersdb, productsdb, ordersdb"
echo "Roles: user_svc, product_svc, order_svc"
echo "Cross-database access: DENIED (CONNECT revoked from PUBLIC)"
