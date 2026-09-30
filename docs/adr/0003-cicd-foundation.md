# ADR 0003: CI/CD Foundation and Security Controls

## Status
Accepted

## Context
Continuous integration workflows execute arbitrary code and third-party tasks with access to code repositories and build environments. Compromised GitHub Actions or overly permissive workflow permissions have led to major supply chain attacks (e.g. SolarWinds, Codecov). Furthermore, stale dependencies and unpinned actions expose build environments to automated tag hijacking.

## Decision
Establish the CI foundation using modular reusable workflows and defense-in-depth pipeline controls:

1. **Modular Reusable Workflow Pattern**:
   - `_reusable-node-ci.yml` encapsulates the checkout, Node.js setup, caching, `npm ci`, linting, testing, and coverage artifact publishing.
   - `ci.yml` runs a parallel matrix over all 5 services calling the reusable workflow.
2. **Action SHA Pinning**:
   - All third-party GitHub Actions are pinned to full 40-character commit SHAs with an inline comment denoting the semantic version:
     - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`
     - `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0`
     - `actions/upload-artifact@b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882 # v4.4.3`
3. **Workflow-Level Least-Privilege Permissions**:
   - Explicit `permissions: contents: read` declared at top-level in both workflows to block unauthorized token write privileges.
4. **Concurrency Control**:
   - Concurrency groups cancel in-progress runs when a branch receives new commits (`cancel-in-progress: true`), saving compute resources and preventing race conditions.
5. **Continuous Dependency Scanning (Dependabot)**:
   - Automated monitoring across npm (all 5 microservices + root), Dockerfiles, and GitHub Actions ecosystems.
6. **Code Ownership & Security PR Checklist**:
   - `CODEOWNERS` assigns mandatory review requirements.
   - `pull_request_template.md` mandates pre-merge verification of secrets, parameterized queries, and digest pinning.

## Security Controls Analysis

| Control | Threat Addressed | Implementation | Validation Method | Limitation |
|---|---|---|---|---|
| **Action SHA Pinning** | Upstream action tag hijacking / supply chain poisoning (CWE-829) | Full 40-char commit SHAs in `uses:` statements | Static review / workflow validation | Requires intentional updating when upstream patches are released (automated via Dependabot). |
| **Least-Privilege Permissions (`contents: read`)** | Malicious PR step modifying repository contents or creating tags (CWE-272) | Top-level `permissions: contents: read` | GitHub Actions token permission validation | Does not restrict read access to public repository code; secrets (when added in later phases) must be scoped individually. |
| **Concurrency Groups** | Stale build artifacts and race conditions overwriting deployments | `concurrency: group: ... cancel-in-progress: true` | Pushing successive commits cancels previous job | If a job is midway through writing state to an external service, abrupt cancellation could leave external state inconsistent. |
| **`npm ci` vs `npm install`** | Dependency drift and uncommitted lockfile discrepancies | Strict execution of `npm ci` referencing `package-lock.json` | Build fails if lockfile is out of sync with `package.json` | Lockfile poisoning (where malicious package is committed into lockfile) is not prevented by `npm ci` alone; requires SCA scanning. |
| **Dependabot Multi-Ecosystem Tracking** | Known vulnerabilities in third-party libraries (A06:2021) | `.github/dependabot.yml` tracking npm, docker, and github-actions | Dependabot alerts and auto-generated PRs | Reactive to published CVEs; zero-day vulnerabilities prior to CVE registration are not detected. |
