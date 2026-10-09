# ADR 0006: Software Composition Analysis (SCA) & Dependency Vulnerability Management

## Status

Accepted

## Date

2026-09-25

## Context

Modern applications are composed primarily of open-source dependencies. In Node.js/Express architectures, transitive dependencies account for over 90% of the overall codebase. Known vulnerabilities (CVEs) in open-source libraries represent a primary initial access vector (A06:2021 - Vulnerable and Outdated Components).

We require an automated SCA strategy in the CI/CD pipeline that:
1. Blocks deployments when high or critical vulnerabilities exist in production runtime code.
2. Avoids false-positive friction on developer test and build utilities.
3. Monitors the global open-source vulnerability landscape across all project lockfiles.
4. Detects newly published CVEs against existing unchanged production code.

## Decision

We implement a two-tier Software Composition Analysis architecture in `.github/workflows/security-scan.yml`:

### 1. Tier 1: Hard Gate via `npm audit` (Production-Only)
- **Scope**: Matrix job evaluating each of the 5 project components (`api-gateway`, `user-service`, `product-service`, `order-service`, `frontend`).
- **Gating Level**: `--audit-level=high` (blocks on High and Critical CVEs).
- **Environment Isolation**: Evaluates `--production` (or `--omit=dev`), strictly ignoring `devDependencies`.
- **Artifacts**: Archives raw JSON audit reports (`npm-audit-<service-name>`) for audit compliance.

### 2. Tier 2: Advisory Intelligence via `OSV-Scanner`
- **Scope**: Scans all repository lockfiles recursively against the Open Source Vulnerabilities (OSV) distributed database.
- **Mode**: Advisory (reports findings in table and JSON formats without blocking merge).
- **Value**: Provides cross-ecosystem tracking (Go, Python, Rust, Alpine/Debian base layers) and surfaces early vulnerability intelligence before it is indexed in standard package manager advisories.

### 3. Continuous Monitoring via Nightly Schedule
- A scheduled cron workflow triggers every night at 02:00 UTC (`0 2 * * *`) on default branches.
- Catches "silent aging": dependencies that had zero known vulnerabilities when merged but became vulnerable later due to newly disclosed CVEs.

---

## Architectural Rationale

### Why Gate Strictly on Production Dependencies?
1. **Container Runtime Reality**:
   Production container images are built using multi-stage Dockerfiles where runner stages execute `npm ci --omit=dev`. DevDependencies (such as `jest`, `supertest`, `eslint`) are physically absent from the running container image filesystem.
2. **Eliminating Security Fatigue**:
   Failing a critical release pipeline because of a ReDoS vulnerability in a test-mocking utility or an APFS path parsing flaw in a local developer tool provides no security improvement while causing developer friction and delayed patches.
3. **Defense-in-Depth for Build Time**:
   DevDependencies are still scanned and reported in CI logs to maintain visibility against build-time supply chain attacks (e.g., malicious install scripts), without gating deployment.

### Transitive Vulnerability Remediation Strategy
When a transitive dependency has a vulnerability that an upstream package has not yet patched, we employ npm's native `overrides` in `package.json`:
```json
{
  "overrides": {
    "vulnerable-package": "^patched-version"
  }
}
```
This forces the dependency resolver to install the secure, patched release across the dependency sub-tree.
