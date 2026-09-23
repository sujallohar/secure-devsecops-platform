# secure-devsecops-platform

<!-- Badges (will be populated as CI is configured) -->
![CI](https://img.shields.io/badge/CI-pending-lightgrey)
![Security Scan](https://img.shields.io/badge/security%20scan-pending-lightgrey)
![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)
![Cost](https://img.shields.io/badge/cost-₹0-brightgreen)

A containerized e-commerce microservices application delivered through a
**security-gated CI/CD pipeline**, deployed to **hardened Kubernetes** with
**runtime intrusion detection** and **full-stack observability**. Built as a
final-year B.Tech Computer Science capstone to demonstrate real, end-to-end
DevSecOps practices at zero cost.

---

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Security Features](#security-features)
- [Demo Scenarios](#demo-scenarios)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Cost & Requirements](#cost--requirements)
- [Documentation](#documentation)
- [What This Project Does NOT Do](#what-this-project-does-not-do)
- [Contributing](#contributing)
- [License](#license)

---

## Architecture

> See [docs/architecture.md](docs/architecture.md) for detailed diagrams and
> component descriptions.

```
Browser → Ingress (nginx) → API Gateway → User/Product/Order Services → PostgreSQL
                                 ↓
                         Falco (runtime detection)
                         Prometheus + Grafana (metrics)
                         Loki (logs)
```

**Deployment target:** Local Kubernetes via kind + Calico CNI.

---

## Quick Start

> *Prerequisites:* Docker Desktop, Node.js 22, kubectl, kind, git

```bash
# Clone and enter the repository
git clone https://github.com/<your-username>/secure-devsecops-platform.git
cd secure-devsecops-platform

# Copy environment variables
cp .env.example .env
# Edit .env with your local values

# Start the local development stack
docker compose -f docker/docker-compose.yml up -d

# Or deploy to a kind cluster
./scripts/setup-kind-cluster.sh
kubectl apply -k k8s/base/
```

*Detailed instructions in [docs/deployment.md](docs/deployment.md).*

---

## Security Features

| Layer              | Tool                  | What it does                                    |
| ------------------ | --------------------- | ----------------------------------------------- |
| SAST               | Semgrep               | Static code analysis with custom rules          |
| Secret Detection   | Gitleaks              | Scans full git history for leaked secrets       |
| SCA                | npm audit + OSV       | Dependency vulnerability scanning               |
| Container Scanning | Trivy                 | Image vulns, secrets, and misconfigs            |
| SBOM               | Syft                  | Software bill of materials (SPDX + CycloneDX)  |
| Image Signing      | Cosign (keyless)      | Cryptographic image provenance via Sigstore     |
| DAST               | OWASP ZAP             | Runtime HTTP surface scanning                   |
| K8s Hardening      | PSA + NetworkPolicy   | Pod security + network microsegmentation        |
| Runtime Detection  | Falco (eBPF)          | Syscall-level intrusion detection               |
| Observability      | Prometheus + Grafana  | Metrics dashboards + security alerting          |
| Log Aggregation    | Loki + Alloy          | Centralized logs + Falco alert aggregation      |

---

## Demo Scenarios

| # | Demo                       | What it proves                                    |
|---|----------------------------|---------------------------------------------------|
| 1 | Vulnerable dependency      | SCA gate blocks pipeline; fix restores it          |
| 2 | Leaked secret              | Gitleaks detects and blocks; rotation documented   |
| 3 | Vulnerable container image | Trivy + Gate 2 block; image never pushed           |
| 4 | Runtime intrusion          | Falco detects shell, file access, pkg manager      |
| 5 | Network isolation          | NetworkPolicy blocks unauthorized traffic          |

*Each demo is scripted, idempotent, and has a `--revert` mode.*

---

## Technology Stack

Node 22 LTS · Express 4 · React 18 + Vite 5 · PostgreSQL 16 · Jest + Supertest
· Docker + BuildKit · kind (K8s 1.31) + Calico · ingress-nginx · GitHub Actions
· Semgrep OSS · Gitleaks · npm audit + OSV-Scanner · Trivy · Syft · Cosign ·
OWASP ZAP · Falco (modern_ebpf) + Falcosidekick · Prometheus + Grafana · Loki
+ Alloy · Terraform (write/validate only)

---

## Repository Structure

```
src/           → Application source code (5 components)
db/            → Database init scripts and migrations
docker/        → Docker Compose files
k8s/           → Kubernetes manifests (base, overlays, security, observability)
terraform/     → IaC modules (local README + optional AWS)
scripts/       → Setup and demo scripts
security/      → Scanner configs, policies, evidence
tests/         → Fixtures and smoke tests
docs/          → Architecture, security, deployment documentation
.github/       → CI/CD workflows, PR templates, Dependabot
```

*Full tree in [docs/architecture.md](docs/architecture.md#5-repository-structure).*

---

## Cost & Requirements

| Requirement       | Details                           |
| ----------------- | --------------------------------- |
| **Total cost**    | **₹0** — everything runs locally  |
| **Cloud account** | Not required                      |
| **RAM**           | 16 GB recommended, 8 GB minimum   |
| **Disk**          | ~10 GB for images and cluster     |
| **OS**            | macOS, Linux, or Windows (WSL2)   |
| **Docker**        | Docker Desktop (free for students)|
| **GitHub**        | Free tier (public repo)           |

---

## Documentation

| Document                                                              | Description                          |
| --------------------------------------------------------------------- | ------------------------------------ |
| [Architecture](docs/architecture.md)                                  | System design and diagrams           |
| [ADR: Technology Choices](docs/adr/0001-technology-choices.md)        | Why each technology was chosen        |
| [Security Architecture](docs/security-architecture.md)                | Security controls and threat model    |
| [CI/CD Pipeline](docs/cicd.md)                                       | Pipeline stages and gates             |
| [Kubernetes Security](docs/kubernetes-security.md)                    | K8s hardening details                 |
| [Runtime Security](docs/runtime-security.md)                         | Falco rules and detection             |
| [Deployment Guide](docs/deployment.md)                                | Step-by-step deployment               |
| [Monitoring](docs/monitoring.md)                                      | Dashboards and alerting               |
| [Testing Strategy](docs/testing.md)                                   | Test types and coverage               |
| [Attack Scenarios](docs/attack-scenarios.md)                          | Demo documentation                    |
| [Incident Response](docs/incident-response.md)                       | Response procedures                   |

---

## What This Project Does NOT Do

- ❌ **Production deployment** — This is an academic demonstration, not a
  production system. It lacks distributed rate limiting, secrets encryption
  at rest (K8s Secrets are base64, not encrypted), HA database replication,
  and professional penetration testing.
- ❌ **Prevent intrusions** — Falco *detects* suspicious activity but does
  not block it. A response layer (e.g., OPA Gatekeeper, automated pod
  termination) would be needed for prevention.
- ❌ **Cloud deployment** — The implemented environment is local Kubernetes
  via kind. AWS IaC exists as documentation artifacts only.
- ❌ **Replace professional security tooling** — The scanning tools cover
  common vulnerabilities but are not a substitute for a professional security
  audit.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategy, commit conventions,
and the security checklist.

---

## License

[MIT](LICENSE)
