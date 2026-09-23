# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it
responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities.
2. Email the maintainer at: **sujal.panchal@example.com** (replace with your
   actual contact).
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
4. You will receive an acknowledgement within **48 hours**.
5. A fix will be developed and released as soon as possible, typically within
   **7 days** for critical issues.

## Security Measures in This Project

This project implements multiple layers of security controls:

- **SAST** — Semgrep with custom rules (Phase 6)
- **Secret scanning** — Gitleaks on full history + pre-commit hook (Phase 7)
- **SCA** — npm audit + OSV-Scanner (Phase 8)
- **Container scanning** — Trivy for vulnerabilities, secrets, misconfigs (Phase 10)
- **SBOM generation** — Syft in SPDX-JSON and CycloneDX formats (Phase 11)
- **Image signing** — Cosign keyless with Sigstore transparency log (Phase 11)
- **DAST** — OWASP ZAP baseline scan against running application (Phase 12)
- **Kubernetes hardening** — PSA restricted, NetworkPolicy, least-privilege (Phases 14–15)
- **Runtime detection** — Falco with custom rules (Phase 16)
- **Observability** — Prometheus, Grafana, Loki for monitoring and alerting (Phase 17)

## Limitations

- This is an academic project. While it implements real security controls,
  it has not undergone a professional penetration test.
- Kubernetes Secrets are base64-encoded, not encrypted at rest (see
  docs/kubernetes-security.md for alternatives).
- The JWT implementation uses a symmetric key (HS256). In a production
  multi-service environment, asymmetric keys (RS256/ES256) would be preferred.
- Rate limiting is per-instance, not distributed. A production deployment
  would need Redis-backed rate limiting.

## Disclosure Policy

We follow coordinated disclosure. Please allow us reasonable time to fix
issues before public disclosure.
