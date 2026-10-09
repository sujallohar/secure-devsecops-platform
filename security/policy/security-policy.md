# Security Policy: Software Composition Analysis (SCA) & Vulnerability Management

## 1. Executive Summary

This document defines the Software Composition Analysis (SCA) policy, vulnerability classification, gating thresholds, and remediation workflows for the Secure DevSecOps Platform.

Our SCA strategy operates under two complementary layers:
1. **Production Dependency Gate (`npm audit`)**: Strict, automated build-blocking gate targeting vulnerabilities in production dependencies shipped inside Docker images.
2. **Advisory Multi-Ecosystem Scanner (`OSV-Scanner`)**: Advisory scanner evaluating all lockfiles against the Open Source Vulnerabilities (OSV) global database to identify cross-ecosystem supply chain risks.

---

## 2. SCA Gating Thresholds

All production builds must satisfy the following thresholds defined in `security/policy/gate-config.yaml`:

| Vulnerability Severity | Production Dependencies (`--omit=dev`) | Development Dependencies (`devDependencies`) | Action / Enforcement |
|:---|:---:|:---:|:---|
| **CRITICAL** | **0 permitted** | Monitored & Reported | **Build Fails Immediately** for production deps; SLA: 24h |
| **HIGH** | **0 permitted** | Monitored & Reported | **Build Fails Immediately** for production deps; SLA: 7 days |
| **MODERATE** | Monitored (< 10) | Monitored & Reported | Build Passes; triaged in regular sprint cycle; SLA: 30 days |
| **LOW** | Monitored (< 50) | Monitored & Reported | Build Passes; tracked via automated Dependabot PRs |

---

## 3. Rationale for Production-Only Gating

Our CI pipeline enforces gating strictly via:
```bash
npm audit --omit=dev --audit-level=high
```

### Why Production Dependencies Are Gated
Production dependencies (`dependencies` in `package.json`) are bundled into final runtime container images (`npm ci --omit=dev`) and run continuously in Kubernetes pods processing untrusted network traffic from the internet. Vulnerabilities in these packages (e.g., Express, jsonwebtoken, pg, helmet) directly impact runtime integrity, confidentiality, and availability.

### Why `devDependencies` Are Reported but NOT Blocked
1. **Zero Runtime Attack Surface**:
   DevDependencies (e.g., Jest, Supertest, Testcontainers, ESLint, Vite build plugins) are **completely omitted** from production container images. The multi-stage Dockerfiles explicitly run `npm ci --omit=dev` in runner stages. A vulnerability in Jest's CLI parser or an APFS path bug in a test-mocking utility cannot be reached or exploited by external users sending HTTP requests to production microservices.
2. **Preventing Developer Friction & "Security Fatigue"**:
   Blocking development or deployment pipelines on vulnerabilities in test utilities produces false urgency and developer resistance. By gating strictly on production attack surface, engineering focus remains directed at actual exploitability.
3. **Why DevDependencies Are Still Scanned & Reported**:
   While not gating production deployments, devDependencies represent a **CI build-time supply chain vector**. A compromised devDependency (e.g., malicious `postinstall` script) could attempt to exfiltrate CI secrets (OIDC tokens, credentials) or tamper with build artifacts during the CI run. Reporting devDependencies provides supply chain visibility without halting production delivery.

---

## 4. The Critical Importance of Nightly Scheduled Audits

Our pipeline includes a nightly cron trigger:
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Runs nightly at 02:00 UTC
```

### The Problem of "Silent Aging"
A common misconception in software engineering is that *code that was clean when merged remains clean indefinitely*. 

In reality:
1. **Asymmetric Vulnerability Disclosure**:
   A microservice merged on Monday with zero known CVEs might have a critical remote code execution (RCE) advisory published against one of its dependencies on Friday. 
2. **Vulnerability Without Code Changes**:
   Without scheduled scans, a repository that receives no new commits for three months would never run CI, remaining dangerously oblivious to newly discovered zero-days affecting its running production workloads.
3. **Automated Early Warning**:
   Nightly scans ensure that emerging CVEs are detected and surfaced to the security team immediately, even when no active developer is touching the codebase.

---

## 5. OSV-Scanner vs. npm Audit: Database Coverage Comparison

The pipeline integrates both `npm audit` and `OSV-Scanner` (in advisory mode). Understanding their complementary strengths is essential:

| Dimension | `npm audit` | `OSV-Scanner` |
|:---|:---|:---|
| **Primary Scope** | npm ecosystem & JavaScript packages | Cross-ecosystem: npm, PyPI, Go, Rust/Cargo, Maven, Debian, Alpine |
| **Data Source** | GitHub Advisory Database (npm advisories) | Open Source Vulnerabilities (OSV) unified schema |
| **Aggregated Feeds** | GitHub Security Advisories (GHSA), npm security team | GHSA, CVE (NVD), Linux Kernel CVEs, RustSec, PyPA, Alpine SecDB, Debian Security Tracker |
| **Version Resolution** | Evaluates resolved dependency tree via npm registry API | Resolves exact commit SHAs and version ranges using Git and package hashes |
| **CI Role** | **Hard Gate**: blocks on High/Critical production CVEs | **Advisory Intelligence**: provides broader vulnerability intelligence across transitive tools |

---

## 6. Vulnerability Remediation Workflow

When a vulnerability is detected:
1. **Automated Fix**: Run `npm update` or `npm audit fix` to bump to non-breaking patched versions.
2. **Explicit Dependency Overrides**: If an upstream package has not yet updated a transitive dependency, specify an explicit `overrides` block in `package.json` to enforce the secure patched release.
3. **Formal Exception Process**: If no upstream patch exists and the vulnerability cannot be exploited due to architectural compensating controls (e.g., input sanitized by Zod, network blocked by NetworkPolicy), an exception must be documented in `security/policy/exceptions.yaml` with an explicit expiration date and security lead sign-off.
