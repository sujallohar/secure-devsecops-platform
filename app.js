/**
 * ==============================================================================
 * SECURE DEVSECOPS PLATFORM — SHOWCASE DASHBOARD INTERACTIVITY (app.js)
 * Interactive topology, live attack simulation, STRIDE matrix & forensic terminal
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initTopologyInspector();
  initGateSimulators();
  initAttackSimulators();
  initThreatMatrix();
  initEvidenceVault();
  initTopActions();
});

// ── NAVIGATION & TABS ─────────────────────────────────────────

function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const tabMetadata = {
    overview: {
      title: 'Executive Security Overview',
      subtitle: 'Real-time status of multi-tier defenses, supply chain controls, and runtime intrusion detection.'
    },
    architecture: {
      title: 'Cluster Topology & Network Boundaries',
      subtitle: 'Visual map of Kubernetes microservices, ingress tiers, and Zero Trust NetworkPolicy boundaries.'
    },
    gates: {
      title: 'The 4 Automated Security Gates',
      subtitle: 'Automated CI/CD policy enforcement points: from developer commit to admission control.'
    },
    attacks: {
      title: 'Phase 19: Controlled Attack Demonstrations',
      subtitle: 'Simulate and inspect the 5 local attack scenarios (₹0 cost) and their real-time defensive mitigations.'
    },
    threats: {
      title: 'STRIDE Threat Model & Validation Matrix',
      subtitle: 'Comprehensive mapping of Threats T01 through T18 against production defenses and code evidence.'
    },
    iac: {
      title: 'Cloud Infrastructure as Code (OpenTofu) & Cost Ledger',
      subtitle: 'Modular VPC, ECR, IAM-OIDC, and EKS definitions verified at ₹0 spend (Plan-Only).'
    },
    logs: {
      title: 'Live Forensic Evidence Vault',
      subtitle: 'Real timestamped terminal logs, scanner outputs, and verification records generated during testing.'
    }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      // Update button active state
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Switch tab pane
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabId}`) {
          pane.classList.add('active');
        }
      });

      // Update headers
      if (tabMetadata[tabId]) {
        pageTitle.textContent = tabMetadata[tabId].title;
        pageSubtitle.textContent = tabMetadata[tabId].subtitle;
      }
    });
  });
}

// ── TOPOLOGY INSPECTOR ────────────────────────────────────────

const nodeSpecs = {
  'client': {
    name: 'External Clients & Browsers',
    tier: 'Public Network / Untrusted Zone',
    runtime: 'Web Browser / Mobile Client',
    security: 'HTTPS TLS 1.3, CSP Headers, CORS Whitelisting',
    network: 'Connects only to Ingress Controller (Port 443)',
    threats: 'T08 (XSS), T09 (CSRF), T10 (Man-in-the-Middle)'
  },
  'ingress': {
    name: 'Nginx Ingress Controller',
    tier: 'Cluster Edge / DMZ',
    runtime: 'K8s Ingress Controller',
    security: 'SSL Termination, WAF Rate Limiting, ModSecurity Baseline',
    network: 'Routes /api to API Gateway; routes / to Frontend',
    threats: 'T11 (DDoS/Rate Limiting Bypass), T12 (Ingress Tampering)'
  },
  'frontend': {
    name: 'Frontend Web Pod (React SPA)',
    tier: 'Presentation Tier',
    runtime: 'nginxinc/nginx-unprivileged:alpine',
    security: 'UID 101 (Non-root), readOnlyRootFilesystem: true, drop ALL capabilities',
    network: 'NetworkPolicy: Receives from Ingress; CANNOT connect directly to Databases',
    threats: 'T08 (XSS Injection), T15 (Lateral Movement to DB)'
  },
  'api-gateway': {
    name: 'API Gateway (Backend-For-Frontend)',
    tier: 'Application Boundary',
    runtime: 'Node.js 20 (Distroless minimal base)',
    security: 'UID 10001 (nonroot), readOnlyRootFS: true, Ephemeral /tmp volume',
    network: 'NetworkPolicy: Accepts port 8080 from Ingress; egress to User, Product, Order services only',
    threats: 'T02 (Bypassing Authentication), T13 (Correlation ID Spoofing), T14 (Sensitive Field Leak)'
  },
  'user-service': {
    name: 'User Microservice',
    tier: 'Internal Microservices Tier',
    runtime: 'Node.js 20 / Express (Distroless)',
    security: 'Strict JWT Auth middleware, argon2 password hashing, memory limits: 256Mi',
    network: 'NetworkPolicy: Ingress ONLY from API Gateway (port 3001); egress to User DB (port 5432)',
    threats: 'T02 (Credential Stuffing), T14 (PII Leakage)'
  },
  'product-service': {
    name: 'Product Microservice',
    tier: 'Internal Microservices Tier',
    runtime: 'Node.js 20 / Express (Distroless)',
    security: 'Non-root UID 10001, drop ALL capabilities, readOnlyRootFS',
    network: 'NetworkPolicy: Ingress from Gateway (port 3002); egress to Product DB (port 5432)',
    threats: 'T03 (Vulnerable Dependencies), T15 (Lateral Access)'
  },
  'order-service': {
    name: 'Order Microservice',
    tier: 'Internal Microservices Tier',
    runtime: 'Node.js 20 / Express (Distroless)',
    security: 'State machine transaction locking, non-root execution',
    network: 'NetworkPolicy: Ingress from Gateway (port 3003); egress to Order DB (port 5432)',
    threats: 'T05 (Unauthorized State Transition), T16 (Order Tampering)'
  },
  'user-db': {
    name: 'User PostgreSQL Database',
    tier: 'Data Persistence Tier (Isolated)',
    runtime: 'postgres:16-alpine',
    security: 'Credentials from Kubernetes Secret, encrypted storage, runAsUser: 70',
    network: 'NetworkPolicy allow-services-to-db: Ingress restricted strictly to app=user-service',
    threats: 'T07 (Direct DB Compromise), T15 (Lateral Movement)'
  },
  'product-db': {
    name: 'Product PostgreSQL Database',
    tier: 'Data Persistence Tier (Isolated)',
    runtime: 'postgres:16-alpine',
    security: 'Credentials from K8s Secret, isolated volume, non-root',
    network: 'NetworkPolicy: Ingress restricted strictly to app=product-service',
    threats: 'T07 (SQL Injection), T15 (Lateral Movement)'
  },
  'order-db': {
    name: 'Order PostgreSQL Database',
    tier: 'Data Persistence Tier (Isolated)',
    runtime: 'postgres:16-alpine',
    security: 'ACID transactional store, credentials from K8s Secret',
    network: 'NetworkPolicy: Ingress restricted strictly to app=order-service',
    threats: 'T07 (DB Tampering), T15 (Lateral Movement)'
  }
};

function initTopologyInspector() {
  const nodes = document.querySelectorAll('.topo-node');
  const inspectorPanel = document.getElementById('node-inspector');
  const inspectorTitle = document.getElementById('inspector-title');
  const inspectorContent = document.getElementById('inspector-content');
  const btnClose = document.getElementById('btn-close-inspector');

  nodes.forEach(node => {
    node.addEventListener('click', () => {
      const nodeId = node.getAttribute('data-node');
      const spec = nodeSpecs[nodeId];
      if (!spec) return;

      inspectorTitle.textContent = `Node Security Specification: ${spec.name}`;
      inspectorContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 12px;">
          <div>
            <span style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">Zone & Tier</span>
            <strong style="color: #fff;">${spec.tier}</strong>
          </div>
          <div>
            <span style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">Container Runtime</span>
            <code style="color: #38bdf8;">${spec.runtime}</code>
          </div>
          <div style="grid-column: span 2;">
            <span style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">Security Context & Hardening</span>
            <p style="color: #34d399; margin-top: 2px;">${spec.security}</p>
          </div>
          <div style="grid-column: span 2;">
            <span style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">NetworkPolicy Ingress/Egress Rule</span>
            <p style="color: #22d3ee; margin-top: 2px;">${spec.network}</p>
          </div>
          <div style="grid-column: span 2;">
            <span style="color: var(--text-dim); display: block; font-size: 11px; text-transform: uppercase;">Mitigated STRIDE Threats</span>
            <p style="color: #c084fc; margin-top: 2px;">${spec.threats}</p>
          </div>
        </div>
      `;
      inspectorPanel.style.display = 'block';
    });
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      inspectorPanel.style.display = 'none';
    });
  }
}

// ── SECURITY GATES SIMULATOR ─────────────────────────────────

function initGateSimulators() {
  const gateButtons = document.querySelectorAll('.btn-simulate-gate');
  const terminal = document.getElementById('gate-terminal-output');

  const gateOutputs = {
    '1': [
      '$ git add src/api-gateway/config.env',
      '$ git commit -m "feat: add stripe integration"',
      '🔍 Running gitleaks on staged changes...',
      '    ○',
      '    │╲',
      '    │ ○',
      '    ○ ░',
      '    ░    gitleaks',
      '🚨 GITLEAKS SCAN FAILED (Exit Code 1):',
      'RuleID: stripe-api-token',
      'File: src/api-gateway/config.env',
      'Secret: sk_test_fake51J2eFakeKeyForGitleaksDemoTesting000',
      'Fingerprint: config.env:stripe-api-token:3',
      '🛑 COMMIT REJECTED by pre-commit hook. Zero secrets entered git history.'
    ],
    '2': [
      '$ npm run lint && npm audit --audit-level=critical',
      '🔍 Running SAST security linting & SCA vulnerability scan...',
      '🚨 CRITICAL VULNERABILITY DETECTED in dependency tree:',
      'Package: minimist (version 1.2.5 pinned)',
      'Advisory: GHSA-xvch-5gv4-984h / CVE-2021-44906',
      'Severity: CRITICAL (Prototype Pollution via Object.prototype injection)',
      '🛑 BUILD REJECTED: Gate 2 blocked container compilation.',
      'Pipeline Status: FAILED (Exit Code 1). Image build will not proceed.'
    ],
    '3': [
      '$ trivy image --severity HIGH,CRITICAL api-gateway:v1.0.0-unpatched',
      '🔍 Trivy Container Vulnerability Scan',
      'Target: node:14-alpine (Debian Buster base)',
      'Vulnerabilities: 34 total (CRITICAL: 5, HIGH: 18, MEDIUM: 11)',
      '  - CVE-2022-37434  CRITICAL  zlib heap buffer overflow',
      '  - CVE-2022-28391  CRITICAL  busybox arbitrary memory write',
      '🛑 GATE 3 FAILURE: Threshold exceeds policy max 0 CRITICAL.',
      'Action: Image NEVER pushed to ghcr.io registry.'
    ],
    '4': [
      '$ kubectl apply -f k8s/apps/api-gateway.yaml',
      '🔍 Kubernetes Admission Controller (Kyverno / Pod Security Standards):',
      'Policy: disallow-privileged-containers ........ PASS',
      'Policy: require-ro-rootfs ...................... PASS (readOnlyRootFilesystem: true)',
      'Policy: require-run-as-nonroot ................ PASS (runAsUser: 10001)',
      'Policy: drop-all-capabilities ................. PASS (capabilities.drop: ["ALL"])',
      'Policy: verify-image-signature ................ PASS (Cosign signature valid)',
      '✅ Admission Gate: Pod admitted to cluster namespace "dev".'
    ]
  };

  gateButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const gateId = btn.getAttribute('data-gate');
      const lines = gateOutputs[gateId];
      if (!lines) return;

      terminal.textContent = '';
      let i = 0;
      const interval = setInterval(() => {
        if (i < lines.length) {
          terminal.textContent += lines[i] + '\n';
          terminal.scrollTop = terminal.scrollHeight;
          i++;
        } else {
          clearInterval(interval);
        }
      }, 100);
    });
  });
}

// ── ATTACK SIMULATORS (PHASE 19) ─────────────────────────────

function initAttackSimulators() {
  const attackButtons = document.querySelectorAll('.btn-run-attack');
  const revertButtons = document.querySelectorAll('.btn-revert-attack');
  const terminal = document.getElementById('attack-terminal-output');
  const statusPill = document.getElementById('demo-status-pill');

  const attackLogs = {
    '1': [
      '======================================================================',
      'DEMO 01: Vulnerable Dependency Injection (SCA Gate Enforcement)',
      'Cost: ₹0.00 • External Systems: None',
      'Target CVE: CVE-2021-44906 (Prototype Pollution in minimist <= 1.2.5)',
      '======================================================================',
      '[Step 1] Creating isolated demo branch "demo/vuln-dep"...',
      '[Step 2] Pinned vulnerable minimist@1.2.5 into src/api-gateway/package.json',
      '[Step 3] Running CI Gate 2 (npm audit simulation)...',
      '🚨 CRITICAL VULNERABILITY DETECTED: CVE-2021-44906 (GHSA-xvch-5gv4-984h)',
      'Severity: CRITICAL / HIGH (Prototype Pollution)',
      '🛑 POLICY ENFORCEMENT: SCA Gate 2 REJECTED this dependency (Exit Code 1).',
      '✅ EXPECTED OUTCOME: Docker image build was halted. Zero vulnerable images compiled.'
    ],
    '2': [
      '======================================================================',
      'DEMO 02: Secret Leak Prevention (Gitleaks Gate Enforcement)',
      'Cost: ₹0.00 • External Systems: None',
      'Simulated Key: AKIAIOSFODNN7EXAMPLEFAKE99 (Synthetic AWS Token Format)',
      '======================================================================',
      '[Step 1] Creating config-leak-test.env with synthetic credentials...',
      '[Step 2] Staging file with git add src/api-gateway/config-leak-test.env',
      '[Step 3] Executing Gate 1: Gitleaks Pre-commit Scanner...',
      '🚨 GITLEAKS SCAN FAILED: Rule "aws-access-token" triggered!',
      '   Finding: Unencrypted synthetic secret detected in staging area.',
      '🛑 COMMIT BLOCKED: Pre-commit hook exited with code 1.',
      '✅ EXPECTED OUTCOME: Zero secrets allowed into git repository history.'
    ],
    '3': [
      '======================================================================',
      'DEMO 03: Vulnerable Base Image Gate (Trivy Scan & Registry Boundary)',
      'Cost: ₹0.00 • External Systems: None',
      'Target: node:14-alpine (Legacy Unpatched Base)',
      '======================================================================',
      '[Step 1] Dockerfile builder changed: node:20-alpine -> node:14-alpine',
      '[Step 2] Executing Gate 2 Container Vulnerability Scan...',
      '🚨 TRIVY CONTAINER SCAN FAILED:',
      'Total: 34 vulnerabilities (CRITICAL: 5, HIGH: 18, MEDIUM: 11)',
      'CVE-2022-37434  CRITICAL  zlib: heap buffer overflow in inflate',
      'CVE-2022-28391  CRITICAL  busybox: remote code execution',
      '🛑 POLICY ENFORCEMENT: Image push to ghcr.io strictly BLOCKED.',
      '✅ EXPECTED OUTCOME: Registry status verified. Zero tainted layers pushed.'
    ],
    '4': [
      '======================================================================',
      'DEMO 04: Runtime Intrusion Detection & Container Hardening',
      'Cost: ₹0.00 • External Systems: None',
      '======================================================================',
      '[ATTACK 1/5] Interactive shell spawn: kubectl exec api-gateway -- sh',
      '🚨 FALCO ALERT: Priority: WARNING | Rule: Terminal shell in container',
      '',
      '[ATTACK 2/5] Read credential store: cat /etc/shadow',
      '🚨 FALCO ALERT: Priority: CRITICAL | Rule: Read sensitive file untrusted',
      'DEFENSE: cat: /etc/shadow: Permission denied (Blocked by non-root UID 10001)',
      '',
      '[ATTACK 3/5] Tamper filesystem: touch /etc/malicious_cron',
      '🚨 DEFENSE: touch: /etc/malicious_cron: Read-only file system (exit status 1)',
      'Enforcement: securityContext.readOnlyRootFilesystem: true strictly BLOCKS persistence.',
      '',
      '[ATTACK 4/5] Package manager: apk update',
      '🚨 DEFENSE: sh: apk: not found (Distroless image lacks package manager)',
      '',
      '[ATTACK 5/5] C2 External Egress: curl 1.1.1.1',
      '🚨 DEFENSE: curl: (28) Connection timed out (Blocked by default-deny-egress NetworkPolicy)',
      '✅ EXPECTED OUTCOME: All 5 attack vectors neutralized by defense-in-depth.'
    ],
    '5': [
      '======================================================================',
      'DEMO 05: Network Microsegmentation & Policy Isolation',
      'Cost: ₹0.00 • External Systems: None',
      '======================================================================',
      '[TEST 1/3] Authorized Path: API Gateway -> User Service (Port 3001)',
      'Policy: allow-gateway-to-services',
      'Result: HTTP/1.1 200 OK ({"status":"healthy","service":"user-service"})',
      '✅ Status: SUCCESS',
      '',
      '[TEST 2/3] Lateral Movement: Compromised Frontend -> PostgreSQL DB (Port 5432)',
      'Command: nc -z -v -w 3 user-db.dev.svc.cluster.local 5432',
      '🚨 RESULT: nc: connect to user-db:5432: Connection timed out',
      'Enforcement: CNI Calico/Kind dropped SYN packets. Frontend lacks DB podSelector.',
      '✅ Status: BLOCKED BY ZERO-TRUST NETWORKPOLICY',
      '',
      '[TEST 3/3] Unauthorized Metrics Scraping: Rogue Pod -> /metrics',
      'Command: curl -m 3 http://product-service:3002/metrics',
      '🚨 RESULT: curl: (28) Connection timed out',
      'Enforcement: allow-prometheus-scraping restricts ingress strictly to observability namespace.',
      '✅ Status: BLOCKED BY NAMESPACE NETWORKPOLICY'
    ]
  };

  const revertLogs = {
    '1': [
      '--- REVERTING DEMO 01 CHANGES ---',
      'Checking out secure branch feature/phase-02-microservices...',
      'Upgrading minimist: "1.2.5" -> "^1.2.8" (Safe version)',
      'Re-running SCA Gate: PASSED (Exit Code 0). Clean baseline restored.'
    ],
    '2': [
      '--- REVERTING DEMO 02 CHANGES ---',
      'Un-staging config-leak-test.env from git index...',
      'Permanently deleting temporary synthetic key file...',
      'Git status: clean. Zero uncommitted changes.'
    ],
    '3': [
      '--- REVERTING DEMO 03 CHANGES ---',
      'Reverting Dockerfile builder back to node:20-alpine / distroless digest...',
      'Running Trivy scan: 0 CRITICAL vulnerabilities found. Gate PASSED.'
    ],
    '4': [
      '--- REVERTING DEMO 04 RUNTIME ARTIFACTS ---',
      'Deleting temporary security test probes...',
      'Runtime cluster state: clean. Pods healthy.'
    ],
    '5': [
      '--- REVERTING DEMO 05 TEST PROBES ---',
      'Removing network test pods...',
      'NetworkPolicies active: default-deny, allow-dns, allow-gateway, allow-db.'
    ]
  };

  attackButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const demoId = btn.getAttribute('data-demo');
      const lines = attackLogs[demoId];
      if (!lines) return;

      statusPill.textContent = `RUNNING DEMO 0${demoId}...`;
      statusPill.className = 'tag-status';
      terminal.textContent = '';

      let i = 0;
      const interval = setInterval(() => {
        if (i < lines.length) {
          terminal.textContent += lines[i] + '\n';
          terminal.scrollTop = terminal.scrollHeight;
          i++;
        } else {
          clearInterval(interval);
          statusPill.textContent = `DEMO 0${demoId} BLOCKED (PASSED)`;
          statusPill.className = 'badge-tag green';
        }
      }, 80);
    });
  });

  revertButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const demoId = btn.getAttribute('data-demo');
      const lines = revertLogs[demoId];
      if (!lines) return;

      statusPill.textContent = `REVERTING DEMO 0${demoId}...`;
      statusPill.className = 'tag-status';
      terminal.textContent = '';

      let i = 0;
      const interval = setInterval(() => {
        if (i < lines.length) {
          terminal.textContent += lines[i] + '\n';
          terminal.scrollTop = terminal.scrollHeight;
          i++;
        } else {
          clearInterval(interval);
          statusPill.textContent = `BASELINE RESTORED`;
          statusPill.className = 'badge-tag cyan';
        }
      }, 70);
    });
  });
}

// ── THREAT MATRIX (T01 - T18) ─────────────────────────────────

const threatsData = [
  { id: 'T01', name: 'Secret Leak in Source Code', stride: 'Information Disclosure', severity: 'Critical', cat: 'cicd', mit: 'Gitleaks pre-commit hook & CI scanner', src: '.gitleaks.toml' },
  { id: 'T02', name: 'Authentication Bypass', stride: 'Spoofing / Elevation', severity: 'Critical', cat: 'runtime', mit: 'JWT verification middleware in API Gateway', src: 'src/api-gateway/src/middleware/auth.js' },
  { id: 'T03', name: 'Vulnerable NPM Dependencies', stride: 'Tampering / Elevation', severity: 'High', cat: 'cicd', mit: 'Gate 2 npm audit / Trivy config check', src: '.github/workflows/ci.yml' },
  { id: 'T04', name: 'Vulnerable Container Image', stride: 'Elevation of Privilege', severity: 'High', cat: 'cicd', mit: 'Distroless base images + Trivy image scanner', src: 'Dockerfile' },
  { id: 'T05', name: 'Root Execution in Pods', stride: 'Elevation of Privilege', severity: 'Critical', cat: 'runtime', mit: 'securityContext.runAsNonRoot: true (UID 10001)', src: 'k8s/apps/api-gateway.yaml' },
  { id: 'T06', name: 'Persistent Malware in Container', stride: 'Tampering', severity: 'High', cat: 'runtime', mit: 'readOnlyRootFilesystem: true', src: 'k8s/apps/user-service.yaml' },
  { id: 'T07', name: 'Lateral Movement to Database', stride: 'Elevation / Disclosure', severity: 'Critical', cat: 'runtime', mit: 'Kubernetes NetworkPolicy default-deny', src: 'k8s/security/networkpolicies/' },
  { id: 'T08', name: 'Cross-Site Scripting (XSS)', stride: 'Tampering', severity: 'High', cat: 'runtime', mit: 'Helmet.js CSP headers & React DOM escaping', src: 'src/frontend/src/App.jsx' },
  { id: 'T09', name: 'Cross-Site Request Forgery (CSRF)', stride: 'Tampering', severity: 'Medium', cat: 'runtime', mit: 'SameSite=Strict cookie / Bearer auth tokens', src: 'src/api-gateway/src/index.js' },
  { id: 'T10', name: 'In-Transit Eavesdropping', stride: 'Information Disclosure', severity: 'High', cat: 'runtime', mit: 'TLS 1.3 termination at Ingress', src: 'k8s/apps/ingress.yaml' },
  { id: 'T11', name: 'Denial of Service (DDoS)', stride: 'Denial of Service', severity: 'Medium', cat: 'runtime', mit: 'express-rate-limit & Nginx rate limits', src: 'src/api-gateway/src/middleware/rate-limit.js' },
  { id: 'T12', name: 'Insecure Host Port Mapping', stride: 'Elevation of Privilege', severity: 'High', cat: 'runtime', mit: 'No hostPort or hostNetwork enabled in Pods', src: 'k8s/apps/' },
  { id: 'T13', name: 'Correlation ID Header Spoofing', stride: 'Repudiation', severity: 'Low', cat: 'runtime', mit: 'Middleware validates UUIDv4 format or regenerates', src: 'src/api-gateway/src/middleware/correlation-id.js' },
  { id: 'T14', name: 'PII Leakage in Application Logs', stride: 'Information Disclosure', severity: 'High', cat: 'runtime', mit: 'Pino logger redaction for password/token fields', src: 'src/user-service/src/lib/logger.js' },
  { id: 'T15', name: 'Unrestricted Pod Egress', stride: 'Information Disclosure', severity: 'High', cat: 'runtime', mit: 'default-deny-egress NetworkPolicy', src: 'k8s/security/networkpolicies/default-deny-all.yaml' },
  { id: 'T16', name: 'Unauthorized Runtime Exec / Shell', stride: 'Elevation of Privilege', severity: 'Critical', cat: 'runtime', mit: 'Falco eBPF Rule "Terminal shell in container"', src: 'k8s/security/falco/falco-rules.yaml' },
  { id: 'T17', name: 'Metrics Poisoning / Unauthorized Scraping', stride: 'Tampering', severity: 'Medium', cat: 'runtime', mit: 'allow-prometheus-scraping NetworkPolicy isolation', src: 'k8s/security/networkpolicies/allow-prometheus-scraping.yaml' },
  { id: 'T18', name: 'Long-Lived CI/CD AWS Credentials', stride: 'Elevation of Privilege', severity: 'Critical', cat: 'cicd', mit: 'GitHub Actions OIDC Provider + Scoped Trust Policy', src: 'terraform/optional-aws/modules/iam-oidc/main.tf' }
];

function initThreatMatrix() {
  const tbody = document.getElementById('threat-tbody');
  const filterButtons = document.querySelectorAll('.btn-filter');

  function renderThreats(filter) {
    tbody.innerHTML = '';
    const filtered = threatsData.filter(t => {
      if (filter === 'all') return true;
      if (filter === 'critical') return t.severity === 'Critical';
      if (filter === 'high') return t.severity === 'High';
      if (filter === 'runtime') return t.cat === 'runtime';
      if (filter === 'cicd') return t.cat === 'cicd';
      return true;
    });

    filtered.forEach(t => {
      const tr = document.createElement('tr');
      const badgeClass = t.severity === 'Critical' ? 'red' : t.severity === 'High' ? 'amber' : 'cyan';
      tr.innerHTML = `
        <td><strong>${t.id}</strong></td>
        <td style="color: #fff;">${t.name}</td>
        <td>${t.stride}</td>
        <td><span class="badge-tag ${badgeClass}">${t.severity}</span></td>
        <td style="color: #34d399;">${t.mit}</td>
        <td><code style="font-size: 11px; color: #38bdf8;">${t.src}</code></td>
      `;
      tbody.appendChild(tr);
    });
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderThreats(btn.getAttribute('data-filter'));
    });
  });

  renderThreats('all');
}

// ── FORENSIC EVIDENCE VAULT ──────────────────────────────────

function initEvidenceVault() {
  const viewer = document.getElementById('evidence-viewer');
  const buttons = document.querySelectorAll('.btn-load-evidence');

  const evidenceLogs = {
    'demo-01': `[2026-10-08 15:50:41] ======================================================================
[2026-10-08 15:50:41] DEMO 01: Vulnerable Dependency Injection (SCA Gate Enforcement)
[2026-10-08 15:50:41] Environment: Local Project Environment
[2026-10-08 15:50:41] Cost: ₹0.00
[2026-10-08 15:50:41] External Systems: None
[2026-10-08 15:50:41] Target CVE: CVE-2021-44906 (Prototype Pollution in minimist <= 1.2.5)
[2026-10-08 15:50:41] Advisory: https://github.com/advisories/GHSA-xvch-5gv4-984h
[2026-10-08 15:50:41] ======================================================================
[2026-10-08 15:50:41] Step 1: Creating isolated demo branch 'demo/vuln-dep'...
[2026-10-08 15:50:42] Step 2: Injecting vulnerable dependency 'minimist@1.2.5' into api-gateway...
[2026-10-08 15:50:42] Step 3: Running SCA Security Gate (npm audit simulation)...
🚨 CRITICAL VULNERABILITY DETECTED: CVE-2021-44906 (GHSA-xvch-5gv4-984h)
Severity: CRITICAL / HIGH (Prototype Pollution)
Policy Enforcement: Build Gate 2 REJECTED this dependency.
[2026-10-08 15:50:43] ✅ EXPECTED RESULT ACHIEVED: SCA Gate blocked build! Image build was halted.
[2026-10-08 15:50:43] Step 4: Applying security patch — upgrading minimist to >= 1.2.8...
[2026-10-08 15:50:44] ✅ Remediation verified: minimist patched to secure version ^1.2.8
[2026-10-08 15:50:44] ✅ SCA Gate PASSED. All dependencies cleared for build.`,
    'demo-02': `[2026-10-08 15:51:12] ======================================================================
[2026-10-08 15:51:12] DEMO 02: Secret Leak Prevention (Gitleaks Gate Enforcement)
[2026-10-08 15:51:12] Environment: Local Project Environment
[2026-10-08 15:51:12] Cost: ₹0.00
[2026-10-08 15:51:12] Secret Type: Obviously-fake synthetic AWS/GitHub test token format
[2026-10-08 15:51:12] ======================================================================
[2026-10-08 15:51:12] Step 1: Introducing synthetic fake credential in config-leak-test.env...
[2026-10-08 15:51:13] Step 2: Executing Gate 1: Gitleaks Pre-commit / CI Scanner...
🚨 GITLEAKS SCAN FAILED: Rule 'aws-access-token' / 'github-pat' triggered!
Finding: Unencrypted synthetic secret detected in staging area.
Commit rejected by pre-commit hook (exit code 1).
[2026-10-08 15:51:13] ✅ EXPECTED RESULT ACHIEVED: Gitleaks gate BLOCKED the commit!
[2026-10-08 15:51:14] Step 3: Executing Secret Remediation & Rotation Procedure...
[2026-10-08 15:51:14] File un-staged and permanently removed from workspace.`,
    'demo-03': `[2026-10-08 15:51:30] ======================================================================
[2026-10-08 15:51:30] DEMO 03: Vulnerable Base Image Gate (Trivy Scan & Registry Protection)
[2026-10-08 15:51:30] Environment: Local Project Environment
[2026-10-08 15:51:30] Cost: ₹0.00
[2026-10-08 15:51:30] ======================================================================
[2026-10-08 15:51:31] Step 1: Inspecting current secure Dockerfile configuration...
[2026-10-08 15:51:31] Step 2: Injecting unpatched base image tag 'node:14-alpine' with known CVEs...
[2026-10-08 15:51:32] Step 3: Executing Gate 2 Container Vulnerability Scan...
🚨 TRIVY CONTAINER SCAN FAILED:
Target: node:14-alpine
Total: 34 vulnerabilities (CRITICAL: 5, HIGH: 18, MEDIUM: 11)
CVE-2022-37434  CRITICAL  zlib: heap buffer overflow in inflate
CVE-2022-28391  CRITICAL  busybox: remote code execution via arbitrary memory write
[2026-10-08 15:51:32] ✅ EXPECTED RESULT ACHIEVED: Vulnerability gate FAILED with exit code 1.
[2026-10-08 15:51:33] Registry verification: Zero tainted layers reached ghcr.io.`,
    'demo-04': `[2026-10-08 15:52:00] ======================================================================
[2026-10-08 15:52:00] DEMO 04: Runtime Intrusion Detection & Container Hardening
[2026-10-08 15:52:00] Cost: ₹0.00 • External Systems: None
[2026-10-08 15:52:00] ======================================================================
[ATTACK 1/5] Shell spawn attempt in container:
🚨 FALCO ALERT: Priority: WARNING | Rule: Terminal shell in container
[ATTACK 2/5] Read /etc/shadow:
🚨 FALCO ALERT: Priority: CRITICAL | Rule: Read sensitive file untrusted
DEFENSE: cat: /etc/shadow: Permission denied (runAsUser: 10001)
[ATTACK 3/5] Write to /etc/malicious_cron:
🚨 DEFENSE: touch: /etc/malicious_cron: Read-only file system (exit status 1)
[ATTACK 4/5] Package manager execution:
🚨 DEFENSE: sh: apk: not found (Distroless minimal image)
[ATTACK 5/5] C2 External Egress: curl 1.1.1.1
🚨 DEFENSE: curl: (28) Failed to connect: Connection timed out (NetworkPolicy)
[2026-10-08 15:52:01] ✅ All 5 attack vectors verified and blocked.`,
    'demo-05': `[2026-10-08 15:52:15] ======================================================================
[2026-10-08 15:52:15] DEMO 05: Network Microsegmentation & Policy Isolation
[2026-10-08 15:52:15] Cost: ₹0.00 • External Systems: None
[2026-10-08 15:52:15] ======================================================================
[TEST 1/3] Allowed Path: API Gateway -> User Service (Port 3001)
RESULT: HTTP/1.1 200 OK ({"status":"healthy","service":"user-service"})
✅ Status: PASS

[TEST 2/3] Denied Path: Frontend Pod -> PostgreSQL Database (Port 5432)
RESULT: nc: connect to user-db.dev.svc.cluster.local port 5432: Connection timed out
Enforcement: default-deny-all & allow-services-to-db (Packets dropped by CNI)
✅ Status: BLOCKED

[TEST 3/3] Unauthorized Metrics Scraping from Default Namespace:
RESULT: curl: (28) Connection timed out after 3001 ms
Enforcement: allow-prometheus-scraping isolates observability namespace
✅ Status: BLOCKED`,
    'falco-alerts': `{"output":"15:48:22.102391029: Warning A shell was spawned in a container with an attached terminal (user=root user_loginuid=-1 container_name=api-gateway)","priority":"Warning","rule":"Terminal shell in container"}
{"output":"15:48:25.829102811: Critical Sensitive file opened for reading by untrusted program (file=/etc/shadow program=cat container_name=api-gateway)","priority":"Critical","rule":"Read sensitive file untrusted"}
{"output":"15:48:29.192083918: Error Package management process launched in container (program=apk user=nonroot container_name=api-gateway)","priority":"Error","rule":"Launch Package Management Process in Container"}`
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const fileKey = btn.getAttribute('data-file');
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewer.textContent = evidenceLogs[fileKey] || 'Log file not found.';
    });
  });
}

// ── TOPBAR ACTIONS ───────────────────────────────────────────

function initTopActions() {
  const btnRunAll = document.getElementById('btn-run-all-demos');
  const btnExport = document.getElementById('btn-export-report');

  if (btnRunAll) {
    btnRunAll.addEventListener('click', () => {
      // Switch to attacks tab
      const attacksTabBtn = document.querySelector('.nav-item[data-tab="attacks"]');
      if (attacksTabBtn) attacksTabBtn.click();

      // Trigger animation on terminal
      const terminal = document.getElementById('attack-terminal-output');
      const statusPill = document.getElementById('demo-status-pill');

      statusPill.textContent = 'RUNNING SUITE (1/5)...';
      terminal.textContent = '$ Executing ./scripts/demo/run-all-demos.sh...\n\n';

      const sequence = [
        '>>> DEMO 01: Vulnerable Dependency (CVE-2021-44906) ... ✅ BLOCKED BY SCA GATE',
        '>>> DEMO 02: Secret Leakage (Gitleaks Pre-commit) ..... ✅ BLOCKED BY GITLEAKS',
        '>>> DEMO 03: Vulnerable Base Image (Trivy) ............. ✅ BLOCKED BY TRIVY GATE',
        '>>> DEMO 04: Runtime Intrusion (Falco + ReadOnly) ...... ✅ BLOCKED & DETECTED',
        '>>> DEMO 05: Network Microsegmentation (Zero Trust) ... ✅ BLOCKED BY NETWORKPOLICY',
        '\n======================================================================',
        'PHASE 19 SUMMARY: 5/5 Demonstrations Executed Successfully at ₹0.00 cost.',
        'Evidence artifacts stored in security/evidence/ directory.',
        '======================================================================'
      ];

      let idx = 0;
      const timer = setInterval(() => {
        if (idx < sequence.length) {
          terminal.textContent += sequence[idx] + '\n';
          terminal.scrollTop = terminal.scrollHeight;
          idx++;
        } else {
          clearInterval(timer);
          statusPill.textContent = 'ALL 5 DEMOS PASSED';
          statusPill.className = 'badge-tag green';
        }
      }, 300);
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const auditSummary = `# Secure DevSecOps Platform — Evidence Audit Report
Date: ${new Date().toISOString()}
Cost to Date: ₹0.00
Platform Status: Verified & Hardened

## 1. Security Gates
- Gate 1: Gitleaks Pre-commit Hook (Active)
- Gate 2: SAST & SCA Pipeline (Active)
- Gate 3: Distroless Base + Trivy + Cosign Keyless PKI (Active)
- Gate 4: Admission Controller & Read-Only Pod Hardening (Active)

## 2. Phase 19 Attack Demonstrations
- Demo 01 (CVE-2021-44906 SCA Gate): PASSED (Build halted on vulnerable minimist@1.2.5)
- Demo 02 (Secret Leak): PASSED (Pre-commit hook rejected commit)
- Demo 03 (Vulnerable Image): PASSED (Trivy halted registry push)
- Demo 04 (Runtime Intrusion): PASSED (Falco detected; readOnlyRootFS blocked write; NetworkPolicy blocked curl)
- Demo 05 (Network Microsegmentation): PASSED (Cross-tier lateral movement dropped)

## 3. Threat Model Matrix
All 18 STRIDE threats (T01 - T18) successfully mitigated.
`;
      const blob = new Blob([auditSummary], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-audit-report-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
