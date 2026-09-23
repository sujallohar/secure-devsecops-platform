# Contributing to secure-devsecops-platform

Thank you for your interest in contributing! This document explains our
branch strategy, commit conventions, and review process.

## Branch Strategy

```
main (protected) ← develop ← feature/*
```

- **`main`** — Production-ready code only. Protected: no direct commits, all
  changes arrive via approved pull requests from `develop`.
- **`develop`** — Integration branch. Feature branches merge here after review.
- **`feature/*`** — One branch per phase or task, e.g. `feature/phase-01-repo-init`.

### Rules

1. **Never commit directly to `main`.** Always go through a PR.
2. **Never commit `.env`, keys, certificates, or manually-crafted evidence
   files** (`security/evidence/`).
3. One PR per phase. Keep PRs focused and reviewable.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use                                      |
| ---------- | ------------------------------------------------ |
| `feat`     | A new feature or capability                      |
| `fix`      | A bug fix                                        |
| `docs`     | Documentation only changes                       |
| `style`    | Formatting, missing semicolons (not CSS changes) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or correcting tests                       |
| `chore`    | Maintenance, tooling, CI config                  |
| `security` | Security-related changes (custom type for this project) |

### Scope

Use the component name: `user-service`, `product-service`, `order-service`,
`api-gateway`, `frontend`, `ci`, `k8s`, `terraform`, `docs`, `security`.

### Examples

```
feat(user-service): add JWT issuance on login
security(api-gateway): add rate limiting on auth routes
chore(ci): pin actions to commit SHAs
docs(architecture): add Kubernetes deployment diagram
test(order-service): add SQL injection rejection tests
```

## Pull Request Process

1. Create a feature branch from `develop`.
2. Make your changes following the coding standards in the master prompt.
3. Ensure all tests pass locally (`npm test`).
4. Ensure no secrets are staged (`gitleaks protect --staged`).
5. Open a PR against `develop` with the PR template filled in.
6. Request a review.
7. Address all review comments.
8. Squash-merge when approved.

## Security Checklist (included in PR template)

Before submitting, confirm:

- [ ] No hardcoded secrets, tokens, or passwords
- [ ] All SQL uses parameterised queries
- [ ] Input validation on all new routes
- [ ] Error handler does not leak stack traces
- [ ] Logging does not include passwords or tokens
- [ ] New dependencies are justified
- [ ] Security tests cover new auth/authz logic

## Code of Conduct

Be respectful, constructive, and professional. This is an academic project
built for learning — questions are welcome.
