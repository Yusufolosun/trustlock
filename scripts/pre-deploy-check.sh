#!/usr/bin/env bash
# ==============================================================
# TrustLock Pre-Deployment Checklist
# Run before deploying to testnet or mainnet.
# Usage: bash scripts/pre-deploy-check.sh [testnet|mainnet]
# ==============================================================
set -euo pipefail

NETWORK="${1:-testnet}"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  [PASS] $label"
    ((PASS++))
  else
    echo "  [FAIL] $label"
    ((FAIL++))
  fi
}

echo ""
echo "======================================"
echo "  TrustLock Pre-Deploy Check ($NETWORK)"
echo "======================================"
echo ""

# --- Source code checks ---
echo "Source Code"
check "Clarinet check passes" clarinet check
check "All tests pass" npm test

# --- Deployment artifacts ---
echo ""
echo "Deployment Artifacts"
check "Testnet plan exists" test -f deployments/default.testnet-plan.yaml
check "Mainnet plan exists" test -f deployments/default.mainnet-plan.yaml

if [ "$NETWORK" = "testnet" ]; then
  check "Testnet.toml exists" test -f settings/Testnet.toml
elif [ "$NETWORK" = "mainnet" ]; then
  check "Mainnet.toml exists" test -f settings/Mainnet.toml
fi

# --- Security checks ---
echo ""
echo "Security"
check "No .env files committed" bash -c '! git ls-files --error-unmatch .env 2>/dev/null'
check "Testnet.toml not tracked" bash -c '! git ls-files --error-unmatch settings/Testnet.toml 2>/dev/null'
check "Mainnet.toml not tracked" bash -c '! git ls-files --error-unmatch settings/Mainnet.toml 2>/dev/null'

# --- Lint & format ---
echo ""
echo "Code Quality"
check "ESLint passes" npx eslint tests/
check "Prettier check passes" npx prettier --check tests/

# --- Summary ---
echo ""
echo "======================================"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS/$TOTAL passed"
if [ "$FAIL" -gt 0 ]; then
  echo "  STATUS: BLOCKED — fix $FAIL failing check(s)"
  exit 1
else
  echo "  STATUS: READY for $NETWORK deployment"
  exit 0
fi
