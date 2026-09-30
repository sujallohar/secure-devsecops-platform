# ADR 0007: Dynamic Application Security Testing (DAST) via OWASP ZAP Baseline Scan

## Status

Accepted

## Date

2026-09-30

## Context

Static analysis (SAST), secret detection, and Software Composition Analysis (SCA) examine the codebase at rest. However, vulnerabilities frequently manifest solely at runtime due to:
1. Web server and reverse proxy misconfiguration (e.g., missing security headers, improper CORS, default server banner disclosure).
2. Middleware order or override issues (e.g., error handlers stripping security headers, missing anti-caching directives on sensitive JSON responses).
3. Runtime endpoint exposure (e.g., unintended unauthenticated routes or unhandled 404 behavior).

To close the gap between static artifacts and runtime exposure without incurring cloud costs, we require an automated DAST stage in the CI/CD pipeline.

## Decision

We implement automated Dynamic Application Security Testing using OWASP ZAP Baseline Scan in `.github/workflows/dast.yml`:

### 1. Ephemeral Runner-Local Architecture
- Uses `docker/docker-compose.test.yml` to spin up the entire microservices stack (`postgres`, `user-service`, `product-service`, `order-service`, `api-gateway`, `frontend`) entirely on the GitHub Actions Ubuntu runner.
- Relies on zero cloud infrastructure, strictly complying with the zero-cost policy.
- Teardown is guaranteed on `always()` using `docker compose down -v`.

### 2. Pinned Scanner Action
- Executes `zaproxy/action-baseline@de8ad967d3548d44ef623df22cf95c3b0baf8b25` (v0.15.0).
- Uses `--network="host"` on Linux runners to target `http://localhost:3000` directly.

### 3. Gating Criteria
- Runs with `cmd_options: '-I'` and `fail_action: true`.
- Fails the CI/CD pipeline on any `FAIL`-level alert (critical runtime flaws).
- Captures and reports `WARN`-level findings without unnecessarily breaking the pipeline, allowing incremental hardening.

### 4. Artifact Preservation
- Archives `report_html.html`, `report_json.json`, and `report_md.md` under the `zap-dast-reports` artifact for audit evidence.

---

## Architectural Rationale

### Why ZAP Baseline Scan over Full Scan in PR CI?
- **Execution Speed**: The Baseline scan performs passive scanning and spidering within 1–2 minutes, fitting within PR turnaround requirements. Full active scanning (which injects fuzzing attacks and exploits) requires significant time and can corrupt state in persistent databases.
- **Header & Misconfiguration Focus**: The most frequent real-world production oversights in Express/Node microservices involve missing CSP directives, caching of authenticated responses, and missing `Permissions-Policy` or `X-Frame-Options` headers. The baseline scan specifically targets these.

### Remediation in API Gateway
Initial baseline scanning revealed missing CSP fallbacks (`frame-ancestors`, `form-action`), missing `Permissions-Policy`, and unhandled route header stripping. These were remediated in `src/api-gateway/src/app.js` using hardened `helmet` configuration, custom response header middleware, and an explicit JSON 404 handler.
