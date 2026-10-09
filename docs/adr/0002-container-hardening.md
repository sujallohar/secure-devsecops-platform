# ADR 0002: Container Hardening and Multi-Stage Image Design

## Status
Accepted

## Context
Deploying microservices in containerized environments exposes applications to supply chain risks, container breakouts, privilege escalation, and unintended secret leaks. Default Docker configurations often run processes as root (UID 0), use unpinned mutable tags (e.g., `:latest`), include build-time toolchains and package managers in production images, and lack signal propagation mechanisms.

## Decision
Adopt hardened multi-stage Docker builds across all 5 components (4 Node.js services + 1 React/Nginx frontend) with the following controls:

1. **Pinned Immutable Image Digests**:
   - Node services: `node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402`
   - Frontend runtime: `nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0`
   - Database: `postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`
2. **Deterministic Non-Root Execution**:
   - Fixed UID/GID 10001 (`appuser:appgroup`) created in every container image.
   - `USER 10001` enforced before `CMD`.
3. **Multi-Stage Build Pipeline**:
   - Stage 1 (builder): Installs dependencies and compiles assets.
   - Stage 2 (runner): Copies only production runtime artifacts (`--omit=dev`). Excludes devDependencies, test runners, source maps, and build tools.
4. **Exec-Form CMD**:
   - Uses JSON array format `CMD ["node", "src/index.js"]` / `CMD ["nginx", "-g", "daemon off;"]` so PID 1 directly receives POSIX OS signals (`SIGTERM`, `SIGINT`).
5. **Hardened Nginx**:
   - Unprivileged port `8080`.
   - `server_tokens off;` to prevent server banner fingerprinting.
   - Defense-in-depth headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
6. **Container Health Checks**:
   - Active `HEALTHCHECK` defined using lightweight `wget` spider queries against `/health` endpoints.

## Security Controls Analysis

| Control | Threat Addressed | Implementation | Validation Method | Limitation |
|---|---|---|---|---|
| **Non-Root UID 10001** | Container breakout privilege escalation to host root (CWE-250) | Dedicated user `appuser` (UID 10001) in Dockerfile; `USER 10001` | `docker run --rm <image> id` confirms UID is 10001, not 0 | Does not prevent local container filesystem manipulation within UID 10001 permissions if files are writable. |
| **Pinned Image Digests** | Base image tampering, supply chain poisoning, upstream tag mutation | Immutable SHA256 hashes in `FROM` declarations | Inspection of Dockerfile and `docker inspect` digests | Pinned digests must be periodically updated through automated dependency scanning (Dependabot). |
| **Multi-Stage Dev Dependency Exclusion** | Attack surface inflation, vulnerabilities in development dependencies (e.g. build tooling) | `npm ci --omit=dev` in builder stage; only runtime directory copied to runner | Final image size audit (<260MB total disk, <70MB content) and `ls -la node_modules` | Vulnerabilities present in direct production dependencies are not addressed by this control alone. |
| **Exec-form CMD** | Unclean shutdown leading to corrupted transactions or state | `CMD ["node", "src/index.js"]` (no shell wrapper) | Container stops promptly within grace period upon `SIGTERM` | Does not guarantee that in-flight network requests finish if application logic lacks graceful shutdown handlers. |
| **Hardened Nginx Headers & Server Tokens Off** | Clickjacking, MIME sniffing, XSS, server fingerprinting | `nginx.conf` with CSP, X-Frame-Options, X-Content-Type-Options, `server_tokens off` | `curl -I http://localhost:8080/` inspection | CSP script-src allows 'unsafe-inline' for simple Vite bundle bootstrapping; strict nonce-based CSP is required for higher assurance. |
| **Container Healthchecks** | Traffic routing to hung or deadlocked processes | `HEALTHCHECK` directives probing `/health` HTTP endpoints | `docker ps` status displays `(healthy)` | A basic HTTP health check validates process liveness, not downstream dependency deep health (e.g. database network partition). |
