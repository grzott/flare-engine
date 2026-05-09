#!/usr/bin/env bash
# run-smoke-cloud.sh — TestingBot Maestro cloud runner for the Android tier matrix.
#
# Tier matrix (verified against TestingBot device catalog 2026-05):
#   low  : Galaxy A12     (older mid-range; catches stale-API regressions)
#   mid  : Galaxy A55     (mainstream — primary smoke target)
#   high : Pixel 10       (latest Android, latest API; new-OS regressions)
#
# Usage:
#   APK_PATH=build.apk TESTINGBOT_KEY=... TESTINGBOT_SECRET=... \
#     bash scripts/run-smoke-cloud.sh                  # all 3 tiers
#   bash scripts/run-smoke-cloud.sh low                # one tier only
#   bash scripts/run-smoke-cloud.sh smoke-only         # skip TTI flow
#
# Prereqs:
#   - @testingbot/cli installed: `npm install -g @testingbot/cli`
#   - TESTINGBOT_KEY + TESTINGBOT_SECRET env vars set (OSS free tier or paid)
#   - APK_PATH points to a release-built .apk
#   - bun installed for the TTI gate
#
# Exits 0 iff every tier passes both smoke + TTI gate.

set -euo pipefail

APK_PATH="${APK_PATH:-}"
TTI_THRESHOLD_MS="${TTI_THRESHOLD_MS:-3000}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MAESTRO_DIR="$APP_DIR/.maestro"
GATE="$APP_DIR/scripts/tti-gate.ts"

mode="${1:-all}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 not found in PATH. $2" >&2
    exit 1
  fi
}

require_cmd testingbot "Install via npm install -g @testingbot/cli"
require_cmd bun "Install bun: https://bun.sh"

if [[ -z "$APK_PATH" ]]; then
  echo "ERROR: APK_PATH not set. Build a release APK first (eas build --profile preview --platform android --local)." >&2
  exit 1
fi
if [[ -z "${TESTINGBOT_KEY:-}" || -z "${TESTINGBOT_SECRET:-}" ]]; then
  echo "ERROR: TESTINGBOT_KEY and TESTINGBOT_SECRET env vars required." >&2
  exit 1
fi
if [[ ! -f "$APK_PATH" ]]; then
  echo "ERROR: APK not found at $APK_PATH" >&2
  exit 1
fi

# Tier definitions: tier-key | testingbot device name | os version
TIERS_LOW=("Galaxy A12" "11.0")
TIERS_MID=("Galaxy A55" "14.0")
TIERS_HIGH=("Pixel 10" "16.0")

run_tier() {
  local tier="$1"
  local device="$2"
  local os="$3"
  echo "[run-smoke-cloud] tier=$tier device=$device os=$os"
  if [[ "$mode" != "smoke-only" ]]; then
    # TTI flow first; capture cloud-side artifact log + parse via tti-gate.
    local artifact_dir; artifact_dir="$(mktemp -d)"
    testingbot maestro "$APK_PATH" "$MAESTRO_DIR/cold-start-tti.yaml" \
      --device "$device" \
      --deviceVersion "$os" \
      --real-device \
      --artifacts-dir "$artifact_dir" \
      || { echo "ERROR: TTI flow failed on $device" >&2; return 4; }
    # TestingBot artifact dir contains a logcat.txt or similar; parse boot-trace lines.
    local logfile; logfile="$(find "$artifact_dir" -name 'logcat*.txt' -print -quit)"
    if [[ -z "$logfile" ]]; then
      echo "WARN: no logcat artifact returned by TestingBot for $device — TTI gate skipped" >&2
    else
      bun "$APP_DIR/scripts/parse-boot-trace.ts" < "$logfile" \
        | DEVICE_NAME="$device ($tier)" TTI_THRESHOLD_MS="$TTI_THRESHOLD_MS" bun "$GATE" \
        || { echo "ERROR: TTI gate breached on $device ($tier)" >&2; return 3; }
    fi
    rm -rf "$artifact_dir"
  fi
  testingbot maestro "$APK_PATH" "$MAESTRO_DIR/smoke.yaml" \
    --device "$device" \
    --deviceVersion "$os" \
    --real-device \
    || { echo "ERROR: smoke flow failed on $device" >&2; return 5; }
  echo "[run-smoke-cloud] tier=$tier OK"
}

case "$mode" in
  low) run_tier low "${TIERS_LOW[0]}" "${TIERS_LOW[1]}" ;;
  mid) run_tier mid "${TIERS_MID[0]}" "${TIERS_MID[1]}" ;;
  high) run_tier high "${TIERS_HIGH[0]}" "${TIERS_HIGH[1]}" ;;
  all|smoke-only)
    run_tier low "${TIERS_LOW[0]}" "${TIERS_LOW[1]}"
    run_tier mid "${TIERS_MID[0]}" "${TIERS_MID[1]}"
    run_tier high "${TIERS_HIGH[0]}" "${TIERS_HIGH[1]}"
    ;;
  *) echo "Unknown mode: $mode (low|mid|high|all|smoke-only)" >&2; exit 1 ;;
esac

echo "[run-smoke-cloud] all tiers OK"
