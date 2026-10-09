# ADR 0005: Secret Detection with Gitleaks

## Status

Accepted

## Date

2026-09-25

## Context

Hardcoded secrets (API keys, database passwords, private keys, JWT signing keys) represent one of the most critical risks in software engineering (CWE-798: Use of Hard-coded Credentials). Once pushed to a remote repository, credentials must be considered permanently compromised.

We require a multi-layered secret scanning defense:
1. **Pre-commit scanning** on developer machines to catch credentials *before* they enter git history.
2. **CI pipeline scanning** in GitHub Actions across the *entire* commit history (`fetch-depth: 0`) to catch leaks from any contributor or branch.

## Decision

We use **Gitleaks** as our secret detection tool across both local pre-commit hooks (`gitleaks protect --staged`) and CI scanning (`gitleaks detect`).

### Alternatives Considered

| Tool | Verdict | Reason |
|:---|:---|:---|
| **TruffleHog** | Considered | Powerful secret verification engine, but heavier runtime footprint and slower in high-frequency CI matrix workflows. |
| **GitGuardian** | Rejected | Requires commercial SaaS account and external API token, violating the ₹0 local/OSS policy. |
| **git-secrets (AWS)** | Rejected | Regex-only, legacy tool with unmaintained rule ecosystems; lacks modern SARIF export and community rule coverage. |
| **Gitleaks** | **Accepted** | Fast (written in Go), zero cost, permissive OSS license for CLI, native SARIF export, highly customizable TOML syntax, and dual modes (`protect --staged` and `detect`). |

### Rules & Customization

The project configuration in `security/gitleaks/.gitleaks.toml` extends the comprehensive default Gitleaks ruleset (`[extend] useDefault = true`) with two project-specific rules:

1. **`project-jwt-secret`**:
   - Detects hardcoded JWT signing secrets of 32+ characters in assignments or definitions (`JWT_SECRET`, `secret_key`).
   - Prevents authentication bypass and token forgery attacks (CWE-798).

2. **`project-postgres-inline-password`**:
   - Detects database connection URIs containing inline credentials (`postgres[ql]://user:password@host[:port]/db`).
   - Enforces 12-factor application principles (credentials injected via environment variables/secret managers, never inline).

### Strict Failure & Gating Policy

- **Zero Tolerance Policy**: The Gitleaks CI job fails on **ANY** finding (exit code 1). Unlike SAST where informational findings may be non-blocking, a leaked secret is an immediate blocker.
- **Redaction**: Scans run with `--redact` so that secret values are masked in console output and logs.
- **Artifact Archival**: The SARIF output `gitleaks-results.sarif` is archived as an immutable artifact (`gitleaks-sarif`) and published to GitHub Code Scanning.

---

## Architectural & Security Analysis

### 1. Why Scanning Only the Diff Is Insufficient

Scanning only the pull request diff or the latest commit is fundamentally incomplete because:
- **Prior Commits in Feature Branches**: A developer might commit a secret in commit A, realize the mistake, delete or overwrite the secret in commit B, and submit a PR. In the diff between the branch and `main`, the secret does not appear. However, commit A remains in the git object database (`.git/objects`) and is cloned by anyone fetching the branch.
- **Rebase & Merge Artifacts**: Secrets introduced in intermediate commits remain reachable via reflogs, tags, and commit trees.
- **Full History Defense**: CI must run `actions/checkout` with `fetch-depth: 0` and execute `gitleaks detect` across the full commit graph.

### 2. Why Deleting the Commit Does NOT Remediate a Leak

When a secret is pushed to a remote repository (e.g., GitHub):
1. **Immediate Exposure**: GitHub and public git mirrors replicate commits within milliseconds. Automated bots constantly scrape public GitHub event streams (`/events`) for AWS keys and tokens within seconds of push.
2. **Reachable Git Objects**: Running `git rm` or `git revert` only creates a *new* commit stating the file is removed; the historical commit containing the plaintext secret remains in the packfiles and remote branch cache.
3. **Mandatory Credential Rotation**: The moment a secret touches a remote repository, it must be considered **compromised**. Deleting the code is merely cleanup; the credential itself must be invalidated and re-issued at the provider (database, identity provider, cloud service).

### 3. Git History Rewriting and Why It Is Disruptive

Removing a secret from git history requires rewriting past commit objects (using tools like `git filter-repo` or BFG Repo-Cleaner):
- **Cryptographic Chaining**: In Git, each commit SHA is a SHA-1/SHA-256 hash of its contents *and* the hash of its parent commit. Modifying a file in a past commit changes that commit's SHA, which in turn changes every subsequent descendant commit SHA.
- **Team-Wide Disruption**: Rewriting history creates a divergent tree:
  - All collaborators must discard their local branches and re-clone or rebase (`git pull --rebase`).
  - Open pull requests become detached or conflict with the rewritten base.
  - CI build hashes and cryptographic commit signatures are invalidated.
  - Upstream mirrors, forks, and deployment tags break.
- **Conclusion**: History rewriting is a high-friction, last-resort recovery procedure. The primary control must be preventive pre-commit scanning (`gitleaks protect --staged`).
