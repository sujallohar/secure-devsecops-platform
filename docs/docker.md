# Containerization and Hardening Guide (Phase 4)

## Overview

All 5 platform components are containerized using multi-stage Dockerfiles adhering to defense-in-depth principles:
1. **api-gateway** (Node 22 Express, Port 3000)
2. **user-service** (Node 22 Express, Port 3001)
3. **product-service** (Node 22 Express, Port 3002)
4. **order-service** (Node 22 Express, Port 3003)
5. **frontend** (React 18 + Vite 5 SPA + Hardened Nginx 1.27, Port 8080)

Supporting Database:
- **postgres** (PostgreSQL 16 Alpine, Port 5432) with 3 isolated databases (`usersdb`, `productsdb`, `ordersdb`) and 3 least-privilege roles (`user_svc`, `product_svc`, `order_svc`).

---

## Service Matrix

| Service | Base Image Digest | Exposed Port | Non-Root User | Exec Form CMD | Healthcheck |
|---|---|---|---|---|---|
| **api-gateway** | `node:22-alpine@sha256:0a71...` | 3000 | UID 10001 (`appuser`) | `["node", "src/index.js"]` | `wget -q http://127.0.0.1:3000/health` |
| **user-service** | `node:22-alpine@sha256:0a71...` | 3001 | UID 10001 (`appuser`) | `["node", "src/index.js"]` | `wget -q http://127.0.0.1:3001/health` |
| **product-service** | `node:22-alpine@sha256:0a71...` | 3002 | UID 10001 (`appuser`) | `["node", "src/index.js"]` | `wget -q http://127.0.0.1:3002/health` |
| **order-service** | `node:22-alpine@sha256:0a71...` | 3003 | UID 10001 (`appuser`) | `["node", "src/index.js"]` | `wget -q http://127.0.0.1:3003/health` |
| **frontend** | `nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3...` | 8080 | UID 10001 (`appuser`) | `["nginx", "-g", "daemon off;"]` | `wget -q http://127.0.0.1:8080/health` |
| **postgres** | `postgres:16-alpine@sha256:7218...` | 5432 | UID 70 (`postgres`) | PostgreSQL default | `pg_isready -U admin -d postgres` |

---

## Security Controls

### 1. Pinned Base Image Digests
- **Threat addressed:** Supply chain attacks via upstream tag mutation or hijacked image repositories (CWE-829).
- **Implementation:** All Dockerfiles reference images by exact cryptographic SHA256 digest rather than mutable floating tags (`:latest`, `:22-alpine`).
- **Validation method:** Inspect Dockerfile `FROM` lines; run `docker inspect --format='{{index .RepoDigests 0}}' <image>`.
- **Limitation:** Does not prevent vulnerabilities within the pinned digest version; requires periodic scanning with Trivy / Dependabot to identify newly reported CVEs.

### 2. Least-Privilege Non-Root Execution (UID 10001)
- **Threat addressed:** Container escape privilege escalation allowing an attacker to gain root control over the host kernel (CWE-250).
- **Implementation:** Dedicated system group `appgroup` (GID 10001) and user `appuser` (UID 10001) are created in each image. `USER 10001` is declared prior to `CMD`.
- **Validation method:** `docker run --rm <image> id` output verifies `uid=10001(appuser) gid=10001(appgroup)`.
- **Limitation:** Running as non-root does not isolate processes from kernel exploits (e.g., Dirty COW, kernel UAF). Kernel hardening (Seccomp, AppArmor, eBPF Falco monitoring) is needed for comprehensive defense.

### 3. Build-Time vs Runtime Multi-Stage Separation
- **Threat addressed:** Attack surface bloat; presence of development tools (compilers, npm CLI, test runners, git) that attackers could exploit for local privilege escalation or reconnaissance (CWE-656).
- **Implementation:** Multi-stage Docker builds discard build dependencies and caches (`npm ci --omit=dev && npm cache clean --force`). Frontend statically compiles with Vite and transfers only `/dist` to an unprivileged Nginx image.
- **Validation method:** Image content audit: `docker run --rm <image> ls -la` verifies absence of `.git`, `.env`, `tests`, `src/*.test.js`, and build tools.
- **Limitation:** Does not eliminate runtime vulnerabilities in bundled production npm dependencies.

### 4. Hardened Reverse Proxy & Web Server (Nginx)
- **Threat addressed:** Clickjacking (CWE-1021), MIME type confusion attacks (CWE-430), Cross-Site Scripting (XSS, CWE-79), Information disclosure via server banner reconnaissance (CWE-200).
- **Implementation:** `nginx.conf` sets `server_tokens off`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a restrictive `Content-Security-Policy`.
- **Validation method:** `curl -s -I http://localhost:8080/` validates the presence of all security headers and the absence of version tokens.
- **Limitation:** The current CSP allows `'unsafe-inline'` styles for Vite development conveniences. Production deployments should transition to nonce-based or hash-based CSP.

---

## Compose Environments

### Local Development Stack (`docker/docker-compose.yml`)
- Spins up PostgreSQL with a persistent named volume (`postgres_data`).
- Runs database initialization scripts (`db/init/01-init.sh`).
- Isolates backend services onto `backend-net`, exposing only `api-gateway` (3000) and `frontend` (8080) to the host.
```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml down
```

### Ephemeral CI/DAST Stack (`docker/docker-compose.test.yml`)
- Ephemeral PostgreSQL mounted on `tmpfs` (in-memory storage) for rapid startup, zero disk residue, and clean state per run.
- Configured with `NODE_ENV=test` and relaxed rate limits so automated CI integration tests and OWASP ZAP DAST scanners are not throttled.
```bash
docker compose -f docker/docker-compose.test.yml up -d
# Run tests / DAST scans
docker compose -f docker/docker-compose.test.yml down -v
```
