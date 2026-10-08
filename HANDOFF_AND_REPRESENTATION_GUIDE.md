# Secure DevSecOps Platform — Master Handoff & Faculty Presentation Guide

**Project Name:** Multi-Tier Microservices Secure DevSecOps Platform  
**Repository Branch:** `feature/phase-02-microservices`  
**Current Status:** Phases 01 through 19 Complete (Phases 18 & 19 fully validated)  
**Total Cloud Cost Incurred:** **₹0.00 / $0.00 (Zero Spend Guaranteed)**

---

## Part 1: Executive Overview & The Faculty Pitch

### The 1-Minute Elevator Pitch
> *"Traditional DevOps pipelines treat security as an afterthought — scanning only at the end or relying on perimeter firewalls. In this project, we designed and built a production-grade **Secure DevSecOps Platform** for an e-commerce microservices architecture that implements **Zero Trust** from source code to cloud deployment.*
>
> *Every commit passes through **4 automated security gates**: pre-commit credential protection with Gitleaks, CI static analysis & software composition analysis (SCA), distroless container builds signed with Cosign cryptographic signatures, and Kubernetes admission controllers. At runtime, our containers run with **read-only filesystems and non-root UIDs**, isolated by **Kubernetes NetworkPolicies**, while **Falco eBPF** kernel tracing detects unauthorized processes in real-time. We proved these defenses by executing **5 controlled attack demonstrations** — all running locally at ₹0 cost."*

---

## Part 2: Quick Start on Friend's Laptop

### 🚀 Master 1-Click Demo Launcher (Recommended)
On your friend's laptop, open the terminal in the unzipped project folder and run:
```bash
./scripts/launch-demo.sh
```
This gives you an **interactive menu**:
* **Option 1:** Spin up the **complete live Docker microservices stack** (Frontend + API Gateway + 3 Microservices + PostgreSQL). It automatically opens `http://localhost:8080` in Chrome!
* **Option 2:** Open the **Interactive Showcase Web Dashboard** (`showcase/index.html`) — zero CPU/RAM required!
* **Option 3:** Run all **5 Phase 19 Attack Demonstrations** with real-time logs.
* **Option 4:** Stop all running containers to cool down the laptop immediately.

---

### 🌐 Instant Zero-Install Demo (No Docker Required!)
To present to faculty without running any containers or installing any tools:
1. Double-click `showcase/index.html` (or run `open showcase/index.html`).
2. Walk the faculty through the live architecture map, trigger the attack simulations, and show the audit ledger.

---

## Part 3: Environment Setup on Friend's Laptop

### System Requirements
* **Operating System:** macOS (Intel or Apple Silicon M1/M2/M3), Ubuntu Linux (20.04+), or Windows 10/11 with WSL2 (Ubuntu).
* **RAM:** 8 GB minimum (16 GB recommended).
* **Disk Space:** ~5 GB free space.

### Step 1: Install Prerequisites

#### For macOS (via Homebrew):
```bash
# Core CLI tools
brew install git node@20 kubectl helm opentofu

# Verify versions
node -v      # v20.x.x
kubectl version --client
tofu version # v1.8+
```

#### For Ubuntu / Debian / Windows WSL2:
```bash
sudo apt update && sudo apt install -y curl git jq build-essential

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# OpenTofu (open-source Terraform)
curl -fsSL https://get.opentofu.org/install-opentofu.sh -o install-opentofu.sh
chmod +x install-opentofu.sh
./install-opentofu.sh --install-method deb
rm install-opentofu.sh
```

---

### Step 2: Critical Docker Desktop Tuning (Prevent CPU Overheating!)

> [!CAUTION]
> **To prevent the laptop from freezing or hitting 1700% CPU:**
> 1. Open **Docker Desktop**.
> 2. Navigate to **Settings (Gear Icon)** → **Resources**.
> 3. Set **CPUs** to **2 or 3 cores** (do NOT leave on maximum 8 cores).
> 4. Set **Memory** to **3.5 GB or 4.0 GB** (do NOT allow it to consume all 8GB RAM).
> 5. Click **Apply & Restart**.

---

### Step 3: Unpacking & Checking the Project

```bash
# Navigate to the project directory
cd Innov_Project

# Verify git branch
git checkout feature/phase-02-microservices

# Verify clean workspace
git status
```

---

## Part 4: Running the Phase 19 Attack Demonstrations

All 5 attack demonstrations run via local automated bash scripts in `scripts/demo/`.

```bash
# Run all 5 demonstrations in sequence
./scripts/demo/run-all-demos.sh
```

### What Each Demo Proves:
1. **Demo 01 (`demo-01-vulnerable-dependency.sh`)**:
   - Injects a real CVE (**CVE-2021-44906**, Prototype Pollution in `minimist@1.2.5`).
   - Proves CI Gate 2 blocks the build (Exit Code 1).
   - Patches to safe version (`^1.2.8`) and verifies clean build.
2. **Demo 02 (`demo-02-secret-leak.sh`)**:
   - Introduces synthetic fake API tokens in staging.
   - Proves **Gitleaks** pre-commit hook intercepts and rejects the commit.
   - Demonstrates credential revocation and rotation SOP.
3. **Demo 03 (`demo-03-vulnerable-image.sh`)**:
   - Injects outdated base image (`node:14-alpine` with 34 CVEs).
   - Proves **Trivy** gate blocks registry push.
   - Reverts to pinned distroless digest.
4. **Demo 04 (`demo-04-runtime-intrusion.sh`)**:
   - Tests 5 attack vectors against container pods (shell spawn, `/etc/shadow` read, `/etc` write, package manager, and C2 external egress).
   - Proves **Falco eBPF** alert detection, **readOnlyRootFilesystem** write block, and **NetworkPolicy** egress timeout.
5. **Demo 05 (`demo-05-network-isolation.sh`)**:
   - Proves authorized East-West traffic succeeds (Gateway → User Service).
   - Proves lateral movement (Frontend → Database direct connection) is strictly dropped by CNI NetworkPolicies.

To revert all changes back to clean state:
```bash
./scripts/demo/run-all-demos.sh --revert-all
```

---

## Part 5: Faculty Presentation Walkthrough & Q&A Defense

### Walkthrough Script for Examiners
1. **Show the Showcase Dashboard (`showcase/index.html`)**:
   - Open in Chrome/Safari.
   - Walk through the **Executive Overview** metric cards (100% supply chain enforcement, 4/4 gates, 18/18 STRIDE threats mitigated, ₹0 cost).
2. **Click "Architecture & Topology"**:
   - Click on `API Gateway` → Explain the BFF pattern, rate limiting, and JWT validation.
   - Click on `User DB` → Show that it is in an isolated tier reachable **only** by `user-service`.
3. **Click "4 Security Gates"**:
   - Click "Simulate Secret Leak" on Gate 1 → Show Gitleaks stopping the commit in the live terminal window.
   - Click "Simulate Dependency CVE" on Gate 2 → Show SCA gate blocking image build.
4. **Click "Attack Demos (Phase 19)"**:
   - Click "Trigger Intrusion" on Demo 04 → Explain why `touch /etc/malicious` outputs `Read-only file system` and why `cat /etc/shadow` outputs `Permission denied`.
   - Click "Trigger Lateral Move" on Demo 05 → Explain how Kubernetes NetworkPolicies enforce Zero Trust segmentation.
5. **Click "Cloud IaC & ₹0 Cost"**:
   - Show the OpenTofu modules (`vpc`, `ecr`, `iam-oidc`, `eks`).
   - Explain how GitHub Actions OIDC replaces static AWS keys with cryptographic subject tokens (`token.actions.githubusercontent.com:sub`).
   - Show the itemized cost ledger proving zero AWS cloud bills.

### Top 5 Expected Faculty Questions & Winning Answers

#### Q1: "Why did you use Distroless images instead of standard Ubuntu or Alpine?"
> **Answer:** *"Standard base images contain package managers (apt, apk), shell utilities (bash, sh), and system libraries that attackers use for living-off-the-land post-exploitation. Distroless images contain only our compiled Node.js runtime and application binary. By stripping away shells and package managers, we shrink the attack surface by over 80% and prevent attackers from downloading tools or spawning interactive reverse shells."*

#### Q2: "How does your NetworkPolicy prevent lateral movement if a pod is compromised?"
> **Answer:** *"We follow a default-deny architecture. `default-deny-all.yaml` blocks all ingress and egress across the namespace. Then, we apply granular allow-rules with label selectors (`podSelector`). For example, the User Database only permits ingress from pods bearing the label `app: user-service`. Even if an attacker completely takes over the frontend container, network packets to port 5432 on the database are dropped directly at the Linux CNI layer."*

#### Q3: "What prevents long-lived AWS credentials from leaking in GitHub?"
> **Answer:** *"We completely eliminated static AWS Access Keys in Phase 18 by implementing **Keyless OpenID Connect (OIDC)**. GitHub Actions mints a short-lived cryptographic JWT containing the repository's identity. AWS STS validates the token's subject claim (`sub`) and grants a temporary 1-hour session. An attacker inspecting GitHub secrets will find zero AWS keys to steal."*

#### Q4: "What is the difference between static scanning (SAST/Trivy) and runtime detection (Falco)?"
> **Answer:** *"Static scanning acts as pre-deployment preventative defense — catching known CVEs, bad configurations, or credentials before deployment. However, zero-day vulnerabilities or compromised runtime memory cannot be caught statically. Falco acts as our runtime detective control using eBPF probes in the Linux kernel to monitor syscalls (`execve`, `open`, `connect`) in real time, alerting us if unexpected behaviors occur inside running containers."*

#### Q5: "How much did this infrastructure cost to build and test?"
> **Answer:** *"Exactly ₹0.00. We utilized Kind (Kubernetes in Docker) for our local container orchestration, free-tier GitHub Actions for automated security workflows, and validated our cloud Terraform/OpenTofu architecture using `tofu plan` with mocked credentials without ever creating billable AWS cloud resources."*

---

## Part 6: Instructions for the Friend's Antigravity AI Agent

> [!NOTE]
> **ATTENTION RECEIVING ANTIGRAVITY AGENT:**  
> Read this section carefully to resume the project immediately without losing context.

### Context & Current State
* **Repository Path:** Workspace root (`/Innov_Project`).
* **Active Git Branch:** `feature/phase-02-microservices`
* **Completed Phases:**
  * **Phases 01–12:** Secure Microservices architecture, Dockerfiles (distroless, non-root UID 10001, readOnlyRootFilesystem), PostgreSQL databases, pre-commit Gitleaks hooks, GitHub CI/CD workflows, Trivy scans, Cosign signing.
  * **Phases 13–17:** Kind cluster configuration (`k8s/`), Pod security standards, default-deny NetworkPolicies, Falco eBPF runtime security, and self-hosted Prometheus/Grafana/Loki observability.
  * **Phase 18 (Completed):** OpenTofu AWS modules (`terraform/optional-aws/modules/{vpc,ecr,iam-oidc,eks}`), dev environment (`envs/dev/`), `.github/workflows/iac-scan.yml`, and `tofu plan` (28 resources planned at ₹0 spend).
  * **Phase 19 (Completed):** 5 attack demonstrations scripts in `scripts/demo/` (`demo-01` through `demo-05` and `run-all-demos.sh`), plus evidence captured in `security/evidence/`.
  * **Interactive Showcase Web Dashboard:** Built in `showcase/` (`index.html`, `styles.css`, `app.js`).

### Your Immediate Next Task: Phase 20 (Documentation & Final Evidence Set)
When prompted by the user to proceed:
1. Inspect the requirements in `01-ANTIGRAVITY-PROMPTS.md` under `## Phase 20 — Documentation + evidence`.
2. Review the existing files in `docs/` (`architecture.md`, `threat-model.md`, `security-architecture.md`, `cicd.md`, `kubernetes-security.md`, `runtime-security.md`, `incident-response.md`, `testing.md`, `attack-scenarios.md`).
3. Complete or write each document so the academic report is 100% comprehensive, referencing all generated evidence in `security/evidence/`.
4. Update the root `README.md` with complete installation badges, architecture diagram, security gate explanation, and presentation commands.
5. Ensure zero external paid dependencies or cloud charges are ever introduced.
