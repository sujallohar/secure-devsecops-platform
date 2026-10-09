# DAST Security Architecture & OWASP ZAP Baseline Scan (Phase 12)

## 1. Overview & Objective

Dynamic Application Security Testing (DAST) represents Stage 3 in the pipeline security gating architecture. While SAST inspects source code, SCA checks third-party packages, and container scanning analyzes container images, DAST evaluates the **running, assembled system from the outside in** over HTTP.

The Phase 12 DAST pipeline (`.github/workflows/dast.yml`):
1. Provisions an ephemeral multi-service test stack using `docker/docker-compose.test.yml` strictly within the GitHub Actions runner (zero external or cloud dependencies).
2. Waits for health probe readiness on the API Gateway (`http://localhost:3000/health`).
3. Executes the pinned OWASP ZAP Baseline Scan action (`zaproxy/action-baseline@de8ad967d3548d44ef623df22cf95c3b0baf8b25` # v0.15.0).
4. Enforces the security gate: fails on any `FAIL`-level alert while capturing and reporting `WARN`-level findings (`-I` flag).
5. Automatically archives complete HTML, JSON, and Markdown reports as pipeline artifacts.
6. Guarantees complete stack teardown (`docker compose down -v`) upon completion.

---

## 2. Security Taxonomy: What DAST Catches vs. SAST, SCA, and Container Scanning

To defend this pipeline in a viva or technical review, understand the fundamental distinctions between the four testing layers (§ A.8):

| Security Layer | Target | Technique | What It Catches | What It CANNOT Catch |
| :--- | :--- | :--- | :--- | :--- |
| **SAST** (Semgrep) | Source Code (AST) | Static white-box pattern analysis & taint tracking | SQL injection patterns, unsafe shell execs, hardcoded secrets, insecure API calls in custom code | Dynamic runtime behavior, runtime configuration drift, middleware execution bugs, deployed HTTP headers |
| **SCA** (npm audit / OSV) | Manifests (`package.json`) | Known CVE matching against package databases | Vulnerable third-party dependencies, indirect transitive dependencies | First-party custom vulnerabilities, runtime deployment errors, bad server configurations |
| **Container Scan** (Trivy) | Image filesystem / OS packages | Package manager database and binary matching | Vulnerable OS binaries (e.g., glibc, OpenSSL), secrets baked into image layers, Dockerfile misconfigurations | Runtime networking, response headers, dynamic request validation, inter-service HTTP routing |
| **DAST** (OWASP ZAP) | Live HTTP Surface (Runtime) | Dynamic black-box passive & active HTTP probing | **Missing/misconfigured security headers (CSP, Permissions-Policy, HSTS), sensitive data caching in transit, server header information leakage, routing/proxy errors, cookie attributes** | Source code line attribution, inactive dead-code flaws, unexposed backend libraries |

### Why DAST is Crucial:
A codebase can have 0 SAST flaws, 0 SCA vulnerabilities, and 0 container CVEs, yet still be completely vulnerable at runtime if:
- Express or Nginx omits `Content-Security-Policy` or `X-Frame-Options` (enabling clickjacking or XSS).
- API endpoints lack `Cache-Control: no-store`, allowing intermediate corporate/ISP proxy caches to store sensitive user data or JWTs.
- Browser feature permissions (`Permissions-Policy`) are not locked down, allowing malicious embedded iframes to access sensors/cameras.

---

## 3. Implementation Details

### 3.1 Ephemeral Test Environment (`docker/docker-compose.test.yml`)
- Boots isolated containers for `postgres`, `user-service`, `product-service`, `order-service`, `api-gateway`, and `frontend`.
- PostgreSQL runs with `tmpfs` on `/var/lib/postgresql/data` for high speed and instant zero-trace teardown.
- Rate limits are relaxed specifically for the test environment (`RATE_LIMIT_MAX_REQUESTS: 10000`) so automated scanners do not trigger 429 throttling during baseline scans.

### 3.2 Gateway Hardening (`src/api-gateway/src/app.js`)
On the initial baseline scan, OWASP ZAP identified three security header gaps:
1. **CSP Fallback Gap (Rule 10055 - Medium)**: Default Helmet CSP did not explicitly define directives with no fallback (`frame-ancestors`, `form-action`).
2. **Missing Permissions-Policy (Rule 10063 - Low)**: No policy restriction on browser device features.
3. **Cacheable Content (Rule 10049 - Info)**: API endpoints did not explicitly forbid downstream caching of sensitive responses.
4. **404 Fallback Leak**: Undefined routes fell back to Express's built-in text handler which stripped hardened headers.

**Remediation Applied in Gateway**:
```javascript
// Hardened Content-Security-Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"], // Prevents embedding (Anti-Clickjacking)
      formAction: ["'self'"],     // Restricts form submissions
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
}));

// Permissions-Policy & Anti-Caching Middleware
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// JSON 404 Handler preserving hardened security headers
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      ...(req.correlationId && { correlationId: req.correlationId }),
    },
  });
});
```

---

## 4. Verification & Scan Comparison

### Real Scan Results Comparison:

| Metric | Before Fix (Run 36695480081) | After Fix (Run 36699868899) | Status |
| :--- | :--- | :--- | :--- |
| **High Alerts** | 0 | 0 | Clean |
| **Medium Alerts** | 1 (Rule 10055: CSP No Fallback) | 0 | **Fixed (0)** |
| **Low Alerts** | 1 (Rule 10063: Permissions-Policy) | 0 | **Fixed (0)** |
| **Informational** | 1 (Rule 10049: Storable Content) | 1 (Non-Storable Content `no-store`) | **Hardened** |
| **Total Failures** | 0 | 0 | Pass |
| **Total Warnings** | 3 | **0** | **100% Clean** |

Both full HTML and JSON scan reports are generated automatically and uploaded under the `zap-dast-reports` artifact in GitHub Actions.

---

## 5. Security Controls & Limitations

### What This Control Covers:
- Validates the real HTTP response headers emitted by the live API Gateway.
- Ensures defense-in-depth headers (`Content-Security-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control`) are present on all endpoints (including 200 OK and 404 Not Found).
- Confirms zero information leakage from headers like `Server`, `X-Powered-By`, `X-AspNet-Version`, or stack trace leaks.

### What This Control Does NOT Cover (Limitations):
- **Baseline vs. Full Active Scan**: The baseline scan performs passive analysis and spidering of discovered URLs. It does not perform invasive payload injection (fuzzing, SQLi payloads, active CSRF/XSS fuzzing). Full active scanning is reserved for staging environments due to the time and state corruption risk.
- **Deep Authentication Coverage**: Unauthenticated baseline spidering tests public routes and gateway middleware responses; exercising authenticated backend endpoints requires ZAP session/token scripting.
