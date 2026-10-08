#!/usr/bin/env bash
# ==============================================================================
# RUN ALL 5 PHASE 19 ATTACK DEMONSTRATIONS
# ==============================================================================
# Executes all 5 security demonstrations in sequence:
#   Demo 01: Vulnerable Dependency Injection (CVE-2021-44906 SCA Gate)
#   Demo 02: Secret Leak Prevention (Gitleaks Gate)
#   Demo 03: Vulnerable Container Image (Trivy Gate)
#   Demo 04: Runtime Intrusion Detection (Falco + Hardening)
#   Demo 05: Network Microsegmentation (Zero Trust NetworkPolicies)
#
# Usage:
#   ./scripts/demo/run-all-demos.sh              # Run all 5 demonstrations
#   ./scripts/demo/run-all-demos.sh --revert-all # Revert all demonstration states
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EVIDENCE_DIR="${PROJECT_ROOT}/security/evidence"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
SUMMARY_LOG="${EVIDENCE_DIR}/phase-19-demo-summary-${TIMESTAMP}.log"

mkdir -p "${EVIDENCE_DIR}"

log() {
  echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${SUMMARY_LOG}"
}

if [[ "${1:-}" == "--revert-all" ]]; then
  log "--- REVERTING ALL DEMONSTRATION CHANGES ---"
  bash "${SCRIPT_DIR}/demo-01-vulnerable-dependency.sh" --revert
  bash "${SCRIPT_DIR}/demo-02-secret-leak.sh" --revert
  bash "${SCRIPT_DIR}/demo-03-vulnerable-image.sh" --revert
  bash "${SCRIPT_DIR}/demo-04-runtime-intrusion.sh" --revert
  bash "${SCRIPT_DIR}/demo-05-network-isolation.sh" --revert
  log "✅ All demonstration environments restored to clean baseline."
  exit 0
fi

log "======================================================================"
log "STARTING PHASE 19: FIVE CONTROLLED ATTACK DEMONSTRATIONS"
log "Environment: Local Project Environment"
log "Total Cost: ₹0.00"
log "External Systems: None"
log "Timestamp: $(date)"
log "======================================================================"

DEMOS=(
  "demo-01-vulnerable-dependency.sh:Demo 01 - Vulnerable Dependency Injection (CVE-2021-44906)"
  "demo-02-secret-leak.sh:Demo 02 - Secret Leak Prevention (Gitleaks Gate)"
  "demo-03-vulnerable-image.sh:Demo 03 - Vulnerable Container Image (Trivy Gate)"
  "demo-04-runtime-intrusion.sh:Demo 04 - Runtime Intrusion Detection (Falco + Hardening)"
  "demo-05-network-isolation.sh:Demo 05 - Network Microsegmentation (Zero Trust NetworkPolicies)"
)

PASSED=0
TOTAL=${#DEMOS[@]}

for ITEM in "${DEMOS[@]}"; do
  SCRIPT="${ITEM%%:*}"
  TITLE="${ITEM#*:}"
  
  log ""
  log ">>> RUNNING: ${TITLE}..."
  if bash "${SCRIPT_DIR}/${SCRIPT}" 2>&1 | tee -a "${SUMMARY_LOG}"; then
    log ">>> STATUS: ✅ PASSED"
    PASSED=$((PASSED + 1))
  else
    log ">>> STATUS: ❌ FAILED"
  fi
  sleep 1
done

log ""
log "======================================================================"
log "PHASE 19 SUMMARY: ${PASSED}/${TOTAL} Demonstrations Executed Successfully"
log "All evidence files recorded in: ${EVIDENCE_DIR}/"
log "Summary report saved to: ${SUMMARY_LOG}"
log "======================================================================"
