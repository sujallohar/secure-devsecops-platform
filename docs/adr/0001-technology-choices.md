# ADR-0001: Technology Choices

**Status:** Accepted
**Date:** 2026-09-23
**Decision makers:** Sujal Panchal

---

## Context

This project (`secure-devsecops-platform`) is a final-year B.Tech capstone
demonstrating DevSecOps practices. It must run at **zero cost** on a student's
local machine, be explainable in an oral examination, and demonstrate real
security controls — not simulations.

Each technology choice below was evaluated against three criteria:

1. **Zero-cost constraint** — no paid services or infrastructure
2. **Educational clarity** — can I explain this in a viva?
3. **Industry relevance** — is this used in real DevSecOps workflows?

---

## Decisions

### 1. Node.js 22 LTS + Express 4

**Decision:** Use Node.js 22 with Express 4 for all backend services.

**Alternatives considered:**
| Alternative   | Why rejected                                                |
| ------------- | ----------------------------------------------------------- |
| Python/Flask  | Less ecosystem support for JWT/middleware patterns used here |
| Go/Gin        | Steeper learning curve; harder to explain in viva           |
| NestJS        | Too much abstraction; harder to explain every line          |
| Express 5     | Still in beta at time of decision; Express 4 is stable      |

**Rationale:** Express 4 is the most widely-documented Node.js HTTP framework.
Its middleware pattern maps directly to security controls (helmet, rate-limit,
JWT verification) that are individually explainable.

---

### 2. React 18 + Vite 5

**Decision:** Use React 18 with Vite 5 for the frontend, served as a static
build via nginx.

**Alternatives considered:**
| Alternative | Why rejected                                             |
| ----------- | -------------------------------------------------------- |
| Vue.js      | Explicitly excluded in the master prompt                 |
| Next.js     | SSR adds complexity without security-relevant benefit    |
| Vanilla JS  | Harder to maintain; React's component model aids clarity |

**Rationale:** React 18 is industry-standard. Vite 5 provides fast builds.
Serving as static files via nginx lets us harden the web server separately
from the application logic.

---

### 3. PostgreSQL 16

**Decision:** Use PostgreSQL 16 as the single database engine with three
logical databases and three least-privilege roles.

**Alternatives considered:**
| Alternative | Why rejected                                                |
| ----------- | ----------------------------------------------------------- |
| MongoDB     | Explicitly excluded; SQL parameterisation is a key demo     |
| SQLite      | No network access model; can't demonstrate role separation  |
| MySQL       | PostgreSQL has better role/grant granularity for this demo   |

**Rationale:** PostgreSQL's role system allows demonstrating database-level
access isolation (one of the project's security controls). Three roles with
distinct GRANTs make cross-database access failure a provable, testable control.

---

### 4. kind + Calico (Kubernetes)

**Decision:** Use kind (Kubernetes IN Docker) with Calico CNI as the
deployment target. This is the **only** deployment environment in the
mandatory project.

**Alternatives considered:**
| Alternative    | Why rejected                                             |
| -------------- | -------------------------------------------------------- |
| minikube       | Single-node only; can't demonstrate multi-node policies  |
| k3s            | Requires a Linux host; kind works inside Docker on macOS |
| EKS (AWS)      | Costs money; violates zero-cost constraint               |
| GKE (Google)   | Costs money; violates zero-cost constraint               |
| AKS (Azure)    | Costs money; violates zero-cost constraint               |

**Rationale:** kind runs a multi-node Kubernetes cluster inside Docker
containers on any developer machine. However, **kind's default CNI (kindnet)
does not enforce NetworkPolicy** — which means deploying NetworkPolicies on
kindnet would create an illusion of security with no actual enforcement. Calico
is installed as a replacement CNI specifically because it enforces NetworkPolicy,
making network microsegmentation a real, testable control rather than
configuration theatre.

> **Zero-cost constraint:** kind + Calico runs entirely on the local machine.
> No cloud account is needed. No billing is possible. A managed Kubernetes
> service (EKS, GKE, AKS) would cost a minimum of ~$70/month for the control
> plane alone, plus worker node compute charges. This is incompatible with the
> project's zero-cost mandate.

---

### 5. GitHub Actions (CI/CD)

**Decision:** Use GitHub Actions with reusable workflows.

**Alternatives considered:**
| Alternative | Why rejected                                              |
| ----------- | --------------------------------------------------------- |
| Jenkins     | Explicitly excluded; requires self-hosted infrastructure  |
| GitLab CI   | Would require migrating the repository                    |
| CircleCI    | Free tier is limited; GitHub Actions is more generous     |

**Rationale:** GitHub Actions is free for public repositories (unlimited
minutes) and provides 2,000 free minutes/month for private repos. Reusable
workflows reduce duplication and are an industry best practice.

---

### 6. Trivy (Container Scanning)

**Decision:** Use Trivy for vulnerability, secret, and misconfiguration
scanning of container images and IaC.

**Alternatives considered:**
| Alternative  | Why rejected                                             |
| ------------ | -------------------------------------------------------- |
| Snyk         | Explicitly excluded; freemium with limits                |
| Grype        | Good scanner but less comprehensive (no misconfig/IaC)   |
| Clair        | Requires server deployment; heavier operational burden   |

**Rationale:** Trivy is a single binary that scans for vulnerabilities, secrets,
and misconfigurations in container images, filesystems, and IaC — all in one
tool. It's fully open-source with no usage limits.

---

### 7. Semgrep OSS (SAST)

**Decision:** Use Semgrep OSS for static analysis with custom rules.

**Alternatives considered:**
| Alternative  | Why rejected                                             |
| ------------ | -------------------------------------------------------- |
| SonarQube    | Explicitly excluded; requires server deployment          |
| ESLint       | Linter, not a security scanner; limited pattern matching |
| CodeQL       | GitHub-only; slower; less suitable for custom rules      |

**Rationale:** Semgrep allows writing custom rules in YAML that are simple
enough to explain in a viva. The OSS engine is free and runs locally.

---

### 8. Falco (Runtime Detection)

**Decision:** Use Falco with the `modern_ebpf` driver for runtime intrusion
detection.

**Alternatives considered:**
| Alternative  | Why rejected                                             |
| ------------ | -------------------------------------------------------- |
| Sysdig       | Commercial; Falco is its open-source counterpart         |
| OSSEC        | File-integrity focused; doesn't cover syscall monitoring |
| Auditd       | Lower-level; harder to write and explain rules           |

**Rationale:** Falco uses eBPF to monitor syscalls in real-time and evaluate
them against rules. It detects (but does not prevent) suspicious activity.
The `modern_ebpf` driver requires kernel ≥ 5.8 with BTF support, which is
available inside Docker Desktop's Linux VM on macOS.

---

### 9. Cosign Keyless (Image Signing)

**Decision:** Use Cosign keyless signing via GitHub OIDC + Sigstore
transparency log.

**Alternatives considered:**
| Alternative         | Why rejected                                      |
| ------------------- | ------------------------------------------------- |
| Cosign key-based    | Requires managing a signing key; keyless is safer |
| Docker Content Trust| Limited ecosystem support; DCT is Docker-specific |
| Notation (Notary v2)| Less mature; fewer tutorials and examples         |

**Rationale:** Keyless signing eliminates the need to store and rotate a
private key. The signing identity comes from GitHub's OIDC token, and the
signature is recorded on Sigstore's public transparency log (Rekor). This
is free and requires no infrastructure.

---

### 10. ghcr.io (Container Registry)

**Decision:** Use GitHub Container Registry (ghcr.io) as the sole registry.

**Alternatives considered:**
| Alternative  | Why rejected                                             |
| ------------ | -------------------------------------------------------- |
| Docker Hub   | Rate limits on free tier; 100 pulls/6h for anonymous     |
| AWS ECR      | Costs money; AWS is optional-only                        |
| Self-hosted  | Requires infrastructure; adds complexity                 |

**Rationale:** ghcr.io is free for public packages, tightly integrated with
GitHub Actions (no extra auth config for GITHUB_TOKEN), and supports OCI
artifacts for storing SBOMs and signatures alongside images.

---

### 11. Observability Stack (Prometheus + Grafana + Loki)

**Decision:** Self-hosted Prometheus, Grafana, and Loki inside the cluster.

**Alternatives considered:**
| Alternative        | Why rejected                                       |
| ------------------ | -------------------------------------------------- |
| Datadog            | Commercial SaaS; costs money                       |
| Grafana Cloud      | Free tier exists but violates zero-cost principle   |
| ELK Stack          | Heavier resource footprint; Loki is lighter        |

**Rationale:** All three are open-source, run locally inside the kind
cluster, and cost nothing. Loki is specifically chosen over Elasticsearch
because it uses significantly less memory — critical on an 8 GB machine.

---

## Summary

Every technology in this project is:
- ✅ Free and open-source
- ✅ Runnable on a local machine with no cloud account
- ✅ Industry-relevant (used in real DevSecOps pipelines)
- ✅ Explainable by a student in an oral examination
