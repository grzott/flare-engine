#!/usr/bin/env bash
# check-balance-freeze.sh — refuse to ship edits to balance-frozen files.
#
# Files listed in PROTECTED below carry a BALANCE_FROZEN_AT constant. Once
# that date is set, this script enforces the freeze: any staged or unstaged
# change to a protected file fails CI / the next commit unless the env var
# ALLOW_BALANCE_CHANGE=1 is set (escape hatch for the rare authorised pass).
#
# Usage:
#   bash apps/pan-tvardowski/scripts/check-balance-freeze.sh         # check
#   ALLOW_BALANCE_CHANGE=1 bash .../check-balance-freeze.sh          # bypass

set -euo pipefail

# Resolve paths from the script location so the script works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(git -C "${APP_DIR}" rev-parse --show-toplevel)"

PROTECTED=(
  "src/config/gameplay.ts"
  "src/config/zones.ts"
)

# Sanity: every protected file must declare BALANCE_FROZEN_AT.
missing_constant=()
for rel in "${PROTECTED[@]}"; do
  abs="${APP_DIR}/${rel}"
  if [[ ! -f "${abs}" ]]; then
    echo "check-balance-freeze: missing protected file: ${rel}" >&2
    exit 2
  fi
  if ! grep -q "BALANCE_FROZEN_AT" "${abs}"; then
    missing_constant+=("${rel}")
  fi
done
if (( ${#missing_constant[@]} > 0 )); then
  echo "check-balance-freeze: BALANCE_FROZEN_AT missing in:" >&2
  printf '  %s\n' "${missing_constant[@]}" >&2
  exit 2
fi

# Bypass — authorised balance pass.
if [[ "${ALLOW_BALANCE_CHANGE:-0}" == "1" ]]; then
  echo "check-balance-freeze: bypass enabled (ALLOW_BALANCE_CHANGE=1)."
  exit 0
fi

# Collect any protected files that are dirty (staged or unstaged) vs HEAD.
cd "${REPO_DIR}"
dirty=()
for rel in "${PROTECTED[@]}"; do
  if ! git diff --quiet HEAD -- "${APP_DIR}/${rel}" 2>/dev/null; then
    dirty+=("${rel}")
  fi
done

if (( ${#dirty[@]} > 0 )); then
  echo "check-balance-freeze: balance is FROZEN — refusing the following changes:" >&2
  printf '  %s\n' "${dirty[@]}" >&2
  echo >&2
  echo "  Set ALLOW_BALANCE_CHANGE=1 to override (authorised post-launch passes only)." >&2
  exit 1
fi

echo "check-balance-freeze: clean (no changes to balance-frozen files)."
