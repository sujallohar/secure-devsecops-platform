# ADR 0004: SAST with Semgrep

## Status

Accepted

## Date

2026-09-25

## Context

The CI pipeline needs static application security testing (SAST) to detect
insecure code patterns before they reach production. SAST tools analyse source
code without executing it, catching vulnerabilities like SQL injection, command
injection, and hardcoded secrets at the code-review stage.

## Decision

We use **Semgrep OSS** as our SAST tool, running in the GitHub Actions pipeline
via the official `semgrep/semgrep` Docker image.

### Alternatives Considered

| Tool | Verdict | Reason |
|:---|:---|:---|
| **SonarQube** | Rejected | Explicitly excluded by master prompt. Requires a server. |
| **CodeQL** | Considered | Free for public repos, but heavier (requires build). Semgrep is faster for pattern matching and has stronger community rules for Node.js/Express. |
| **ESLint security plugins** | Considered | Too narrow — catches style issues but not deep security patterns. Semgrep covers OWASP Top 10. |
| **Snyk Code** | Rejected | Explicitly excluded by master prompt. |

### Why Semgrep

1. **Free and open-source** — complies with the zero-cost policy.
2. **Fast** — pattern-matching engine, no compilation step, runs in seconds.
3. **Extensible** — custom rules in YAML that are readable and explainable.
4. **SARIF output** — integrates with GitHub Code Scanning for in-PR annotations.
5. **Community rulesets** — `p/javascript`, `p/nodejs`, `p/owasp-top-ten`, `p/secrets` provide broad coverage out of the box.

### Custom Rules

Three project-specific rules in `security/semgrep/custom-rules.yaml`:

1. **SQL string concatenation** — detects `pool.query(\`...${...}\`)` and `pool.query(sql + input)`. Catches CWE-89.
2. **child_process.exec with non-literal** — detects `exec(variable)` and `exec(\`...${...}\`)`. Catches CWE-78.
3. **JWT verify without algorithm pinning** — detects `jwt.verify(token, secret)` without `{ algorithms: [...] }`. Catches CWE-345/CWE-327.

### Failure Policy

- **ERROR severity** → build fails (security gate).
- **WARNING / INFO severity** → reported in SARIF but does not block merge.

### SARIF & Code Scanning Integration

- SARIF reports are uploaded directly to GitHub Code Scanning when available (free on public repos, requires GHAS on private repos).
- `Upload SARIF to Code Scanning` includes `continue-on-error: true` so pipelines run reliably across both private and public repositories without breaking builds when GHAS licenses are absent.
- The SARIF file `semgrep-results.sarif` is unconditionally archived as an immutable GitHub Actions artifact (`semgrep-sarif`) for audit and compliance evidence.

## Consequences

- Semgrep runs on every push and PR, adding ~30 seconds to CI time.
- False positives are possible — the team must triage findings.
- Semgrep cannot detect runtime issues, dependency vulnerabilities, or complex
  cross-file data flows. These are covered by other tools (DAST, SCA, Trivy).

## Limitations

- **No inter-procedural taint tracking** in the OSS version (Pro has this).
- **Pattern-based only** — if no rule exists for a vulnerability class, it won't
  be detected. Coverage depends entirely on the ruleset quality.
- **No type information** — Semgrep treats JavaScript dynamically; it cannot
  resolve types across modules the way a compiler-based tool can.
