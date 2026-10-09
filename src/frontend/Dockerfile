# ──────────────────────────────────────────────────────────────
# src/frontend/Dockerfile — Hardened Multi-Stage Build
# Security controls:
#   - Pinned base image digests (Node 22 build, Nginx unprivileged runtime)
#   - Multi-stage: node, vite, build dependencies discarded in stage 1
#   - Non-root UID 10001 execution on unprivileged port 8080
#   - Hardened nginx.conf (server_tokens off, CSP, clickjacking prevention)
#   - Exec-form CMD
#   - Container HEALTHCHECK defined
# ──────────────────────────────────────────────────────────────

# Stage 1: Build static React SPA assets with Vite
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies required for the Vite build
RUN npm ci

# Copy application source code and configuration
COPY . .

# Build production bundle (minified, no source maps)
RUN npm run build

# Stage 2: Serve static artifacts via unprivileged Nginx
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS runner

USER root

# Create appuser with fixed UID/GID 10001 to conform with security baseline
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

# Remove default nginx html files
RUN rm -rf /usr/share/nginx/html/*

# Copy hardened nginx configuration
COPY --chown=10001:10001 nginx/nginx.conf /etc/nginx/nginx.conf

# Copy compiled static assets from builder stage
COPY --from=builder --chown=10001:10001 /app/dist /usr/share/nginx/html

# Ensure permissions across nginx runtime directories for UID 10001
RUN chown -R 10001:10001 /var/cache/nginx /var/run /var/log/nginx /etc/nginx /usr/share/nginx/html /tmp

# Switch to non-root UID 10001
USER 10001

# Healthcheck monitoring on port 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1

EXPOSE 8080

# Exec-form CMD
CMD ["nginx", "-g", "daemon off;"]
