#!/usr/bin/env bash
# run-smoke-local.sh — local Maestro smoke runner for an Android emulator or attached device.
#
# Usage:
#   bash scripts/run-smoke-local.sh                 # smoke + cold-start TTI
#   bash scripts/run-smoke-local.sh smoke           # smoke only
#   bash scripts/run-smoke-local.sh tti [N]         # cold-start TTI N times (default 3)
#
# Prereqs:
#   - Maestro CLI installed (https://maestro.dev/docs/getting-started/installing-maestro)
#   - One Android emulator running OR one Android device connected via adb
#   - Either:
#       (a) a release-built APK installed at package id `dev.flare.pantvardowski`
#       (b) an .apk path in $APK_PATH (will be installed)
#   - bun + tsc (for parse-boot-trace.ts invocation)
#
# Exits 0 on success; non-zero on any flow failure or TTI gate breach.

set -euo pipefail

APP_ID="dev.flare.pantvardowski"
TTI_THRESHOLD_MS="${TTI_THRESHOLD_MS:-3000}"
TTI_RUN_COUNT="${TTI_RUN_COUNT:-3}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MAESTRO_DIR="$APP_DIR/.maestro"
PARSE="$APP_DIR/scripts/parse-boot-trace.ts"
GATE="$APP_DIR/scripts/tti-gate.ts"

mode="${1:-all}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 not found in PATH. $2" >&2
    exit 1
  fi
}

require_cmd adb "Install Android platform-tools."
require_cmd maestro "Install via curl -Ls https://get.maestro.mobile.dev | bash"
require_cmd bun "Install bun: https://bun.sh"

device_serial() {
  adb devices | awk 'NR>1 && $2=="device" {print $1; exit}'
}

ensure_app_installed() {
  local serial; serial="$(device_serial)"
  if [[ -z "$serial" ]]; then
    echo "ERROR: no adb device or emulator detected. Start one first." >&2
    exit 1
  fi
  if [[ -n "${APK_PATH:-}" ]]; then
    echo "[run-smoke-local] installing $APK_PATH on $serial"
    adb -s "$serial" install -r "$APK_PATH"
  fi
  if ! adb -s "$serial" shell pm list packages | grep -q "$APP_ID"; then
    echo "ERROR: package $APP_ID not installed on $serial. Set APK_PATH=<path> or install manually." >&2
    exit 1
  fi
  echo "[run-smoke-local] target device=$serial app=$APP_ID"
}

run_smoke() {
  echo "[run-smoke-local] running smoke.yaml"
  maestro test "$MAESTRO_DIR/smoke.yaml"
}

run_tti() {
  local serial; serial="$(device_serial)"
  local logcat_dump; logcat_dump="$(mktemp)"
  local i
  echo "[run-smoke-local] running cold-start TTI x $TTI_RUN_COUNT (threshold=${TTI_THRESHOLD_MS}ms)"
  : > "$logcat_dump"
  for ((i = 1; i <= TTI_RUN_COUNT; i++)); do
    echo "[run-smoke-local]   iteration $i / $TTI_RUN_COUNT"
    adb -s "$serial" logcat -c
    maestro test "$MAESTRO_DIR/cold-start-tti.yaml"
    # Capture the first [boot-trace] line for this iteration.
    adb -s "$serial" logcat -d -s ReactNativeJS:* | grep "\[boot-trace\]" | head -1 >> "$logcat_dump" || true
  done
  echo "[run-smoke-local] parsing boot-trace lines..."
  # Pipe the captured logcat dump to the parser; require at least one parsed line.
  local json
  json="$(bun "$PARSE" < "$logcat_dump")"
  echo "$json"
  local total_count; total_count="$(echo "$json" | grep -c '"totalMs"' || true)"
  if [[ "$total_count" -eq 0 ]]; then
    echo "ERROR: no [boot-trace] lines captured. Did the app launch reach first-frame?" >&2
    rm -f "$logcat_dump"
    exit 2
  fi
  # Compute median + assert threshold.
  local pass_status=0
  echo "$json" | DEVICE_NAME="${DEVICE_NAME:-local}" TTI_THRESHOLD_MS="$TTI_THRESHOLD_MS" \
    bun "$GATE" || pass_status=$?
  rm -f "$logcat_dump"
  if [[ "$pass_status" -ne 0 ]]; then
    echo "ERROR: TTI gate breached on local device" >&2
    exit 3
  fi
}

ensure_app_installed
case "$mode" in
  smoke) run_smoke ;;
  tti) run_tti ;;
  all) run_smoke; run_tti ;;
  *) echo "Unknown mode: $mode (smoke|tti|all)" >&2; exit 1 ;;
esac

echo "[run-smoke-local] OK"
