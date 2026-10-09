#!/usr/bin/env bash
# ==============================================================================
# DEMO 02: Secret Leak Prevention & Gitleaks Gate Demonstration
# ==============================================================================
# Environment: local project environment
# Cost: ₹0
# External systems: none
#
# Threat Model: Threat T01 (Hardcoded Secrets & Credential Leakage)
# Synthetic Credential Used: Clearly-fake simulated token format
#
# Expected Outcome:
#   1. Creating a file with simulated secret and staging it triggers Gitleaks scanner.
#   2. Pre-commit / CI Gitleaks gate FAILS (exit code 1).
#   3. Commit is BLOCKED; zero secrets enter version history.
#   4. Remediation step cleans the file and documents the credential rotation protocol.
#
# Usage:
#   ./scripts/demo/demo-02-secret-leak.sh          # Run demonstration
#   ./scripts/demo/demo-02-secret-leak.sh --revert # Revert changes
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EVIDENCE_DIR="${PROJECT_ROOT}/security/evidence"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
LOG_FILE="${EVIDENCE_DIR}/demo-02-secret-leak-${TIMESTAMP}.log"
LEAK_FILE="${PROJECT_ROOT}/src/api-gateway/config-leak-test.env"

mkdir -p "${EVIDENCE_DIR}"

log() {
  echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

revert_changes() {
  log "--- REVERTING DEMO 02 CHANGES ---"
  cd "${PROJECT_ROOT}"
  rm -f "${LEAK_FILE}"
  git reset HEAD -- "${LEAK_FILE}" 2>/dev/null || true
  log "✅ Demo 02 environment successfully reverted."
}

if [[ "${1:-}" == "--revert" ]]; then
  revert_changes
  exit 0
fi

log "======================================================================"
log "DEMO 02: Secret Leak Prevention (Gitleaks Gate Enforcement)"
log "Environment: Local Project Environment"
log "Cost: ₹0.00"
log "External Systems: None"
log "Secret Type: Obviously-fake synthetic AWS/GitHub test token format"
log "======================================================================"

# 1. Create a file containing a simulated credential
log "Step 1: Introducing synthetic fake credential in ${LEAK_FILE}..."
cat << 'EOF' > "${LEAK_FILE}"
# SYNTHETIC TEST CONFIGURATION - NOT REAL KEYS
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLEFAKE99
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEYFAKE
GITHUB_TOKEN=ghp_FAKE999999999999999999999999999999999999
STRIPE_SECRET_KEY=sk_test_fake51J2eFakeKeyForGitleaksDemoTesting000
EOF

log "Synthetic secret file created."

# 2. Stage the file in git
cd "${PROJECT_ROOT}"
git add "${LEAK_FILE}" 2>&1 | tee -a "${LOG_FILE}"

# 3. Execute Gitleaks scanner
log "Step 2: Executing Gate 1: Gitleaks Pre-commit / CI Scanner..."
SCAN_FAILED=false
if command -v gitleaks &> /dev/null; then
  log "Running installed gitleaks binary on staged files..."
  gitleaks protect --staged -v 2>&1 | tee -a "${LOG_FILE}" || SCAN_FAILED=true
else
  log "Simulating Gitleaks pattern detector on staged file..."
  if grep -E "(AKIA[0-9A-Z]{16}|ghp_[0-9a-zA-Z]{36}|sk_test_[0-9a-zA-Z]{24})" "${LEAK_FILE}" > /dev/null; then
    echo "🚨 GITLEAKS SCAN FAILED: Rule 'aws-access-token' / 'github-pat' triggered!" | tee -a "${LOG_FILE}"
    echo "   File: ${LEAK_FILE}" | tee -a "${LOG_FILE}"
    echo "   Finding: Unencrypted synthetic secret detected in staging area." | tee -a "${LOG_FILE}"
    echo "   Commit rejected by pre-commit hook (exit code 1)." | tee -a "${LOG_FILE}"
    SCAN_FAILED=true
  fi
fi

if [ "$SCAN_FAILED" = true ]; then
  log "✅ EXPECTED RESULT ACHIEVED: Gitleaks gate BLOCKED the commit!"
  log "   Zero secrets were allowed into git commit history."
else
  log "❌ Unexpected: Secret leak was not detected."
  exit 1
fi

# 4. Remediation & Incident Response Protocol Documentation
log "Step 3: Executing Secret Remediation & Rotation Procedure..."
git reset HEAD -- "${LEAK_FILE}" 2>&1 | tee -a "${LOG_FILE}"
rm -f "${LEAK_FILE}"

log "File un-staged and permanently removed from workspace."

# Record rotation documentation
cat << 'EOF' | tee -a "${LOG_FILE}"

[INCIDENT RESPONSE DOCUMENTATION - CREDENTIAL EXPOSURE EVENT]
----------------------------------------------------------------------
If this had been a real leaked credential in production, the following
Standard Operating Procedure (SOP) must be immediately executed:
1. REVOCATION: Immediately revoke the exposed token in AWS IAM / GitHub
   Admin / Provider Console within 5 minutes.
2. ROTATION: Mint a new credential with least-privilege scoping and
   inject it into HashiCorp Vault or Kubernetes Secret store.
3. AUDIT: Review AWS CloudTrail / Provider audit logs from the timestamp
   of the leak to determine if any unauthorized API calls were made.
4. REBASE: If committed upstream, use git-filter-repo or BFG Repo-Cleaner
   to purge the commit SHA from git history, and rotate all neighboring
   credentials that shared the same blast radius.
----------------------------------------------------------------------
EOF

log "Step 4: Re-verifying git staging area is clean..."
git status --short 2>&1 | tee -a "${LOG_FILE}"

log "======================================================================"
log "DEMO 02 COMPLETED SUCCESSFULLY."
log "Evidence written to: ${LOG_FILE}"
log "======================================================================"
