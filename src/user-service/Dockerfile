# ──────────────────────────────────────────────────────────────
# src/user-service/Dockerfile — Hardened Multi-Stage Build
# Security controls:
#   - Pinned base image digest (immutable provenance)
#   - Multi-stage: dev tools & build artifacts discarded in stage 1
#   - Production dependencies only (no devDependencies/test tools)
#   - Least-privilege non-root execution (UID 10001)
#   - Exec-form CMD for proper POSIX signal propagation
#   - Container HEALTHCHECK defined
# ──────────────────────────────────────────────────────────────

# Stage 1: Dependency resolution & build
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install ONLY production dependencies (omit devDependencies)
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Minimal runtime image
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Security: Create dedicated non-root user with fixed UID/GID 10001
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

# Copy dependencies and application source with correct ownership
COPY --from=builder --chown=10001:10001 /app/node_modules ./node_modules
COPY --chown=10001:10001 package.json ./
COPY --chown=10001:10001 src ./src

# Switch to unprivileged non-root user
USER 10001

# Healthcheck monitoring
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

EXPOSE 3001

# Exec-form CMD ensures PID 1 receives SIGTERM/SIGINT
CMD ["node", "src/index.js"]
