# CI/CD Foundation Guide (Phase 5)

## Overview

The CI/CD pipeline foundation is built using GitHub Actions with a reusable workflow architecture designed to support defense-in-depth security, strict permission scoping, and immutable action pinning.

---

## Workflow Structure

```text
.github/
├── CODEOWNERS                      # Repository code ownership and review gates
├── dependabot.yml                  # Automated dependency scanning across 3 ecosystems
├── pull_request_template.md        # Pull request template with security checklist
└── workflows/
    ├── _reusable-node-ci.yml       # Modular reusable workflow for Node.js build/test
    └── ci.yml                      # Primary workflow matrixing over all 5 components
```

---

## Security Requirements & Baseline

### 1. Workflow-Level Least Privilege
All workflows explicitly declare:
```yaml
permissions:
  contents: read
```
This restricts the auto-generated `GITHUB_TOKEN` from writing to repositories, pushing tags, or altering pull request contents.

### 2. Third-Party Action SHA Pinning
Every external action is pinned to an immutable 40-character commit SHA:
- `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (`v4.2.2`)
- `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af` (`v4.1.0`)
- `actions/upload-artifact@b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882` (`v4.4.3`)

### 3. Concurrency Groups
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
Cancels superseded workflow runs to prevent redundant CI consumption and eliminate deployment race conditions.

### 4. Dependabot Multi-Ecosystem Coverage
Monitors:
- **npm:** `/` (root), `/src/user-service`, `/src/product-service`, `/src/order-service`, `/src/api-gateway`, `/src/frontend`
- **docker:** `/src/user-service`, `/src/product-service`, `/src/order-service`, `/src/api-gateway`, `/src/frontend`
- **github-actions:** `/`

---

## Pipeline Execution Trace

The pipeline executes a matrix job across the 5 services:
1. `src/api-gateway`
2. `src/user-service`
3. `src/product-service`
4. `src/order-service`
5. `src/frontend`

Each matrix run:
1. Checks out repository at current commit.
2. Configures Node 22 LTS with npm cache keyed to the service's `package-lock.json`.
3. Runs `npm ci` for deterministic dependency installation.
4. Executes `npm run lint` for code syntax validation.
5. Runs `npm test` to execute Jest unit/integration tests and generate coverage.
6. Archives coverage report artifacts.
