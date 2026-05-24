#!/usr/bin/env bash
# bench-local.sh — local Maestro perf-bench runner (Android emulator / device).
#
# This script lives in scripts/perf/ intentionally — E7 CI calls it directly
# without going through app package.json scripts.
#
# NOTE: APK must be pre-built via EAS cloud build. `eas build --local` does not
# work on Windows (see memory: windows-eas-local-blocked). Use:
#   eas build --profile preview --platform android  (cloud)
# then download the APK before running this script.
#
# Usage:
#   BENCH_APK_PATH=build.apk \
#     bash scripts/perf/bench-local.sh [--app <name>] [--scenario <id>|all]
#
# Flags (all optional):
#   --app <name>         App directory under apps/ (default: pan-tvardowski)
#   --scenario <id>|all  Perf scenario stem or "all" (default: all)
#
# For each selected scenario:
#   1. Runs maestro test apps/<name>/maestro/perf-<scenario>.yml
#   2. Reads adb logcat and greps [perf-bench]
#   3. Emits one NDJSON line to stdout per scenario
#
# iOS simulator: soft-skipped with a warning if xcrun is unavailable or no booted
# simulator is found. The script does not error on Windows where xcrun is absent.
#
# Exit codes:
#   0  all scenarios passed
#   4  maestro flow failed
#   5  [perf-bench] line absent in logcat

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." &> /dev/null && pwd)"
DEVICES_JSON="$SCRIPT_DIR/devices.json"

APP_NAME="pan-tvardowski"
SCENARIO_FILTER="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP_NAME="$2"
      shift 2
      ;;
    --scenario)
      SCENARIO_FILTER="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      echo "Usage: bench-local.sh [--app <name>] [--scenario <id>|all]" >&2
      exit 1
      ;;
  esac
done

APP_DIR="$REPO_ROOT/apps/$APP_NAME"
APP_ID="dev.flare.pantvardowski"
MAESTRO_DIR="$APP_DIR/maestro"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 not found in PATH. $2" >&2
    exit 1
  fi
}

require_cmd adb "Install Android platform-tools."
require_cmd maestro "Install via: curl -Ls https://get.maestro.mobile.dev | bash"
require_cmd jq "Install jq: https://stedolan.github.io/jq/"

BENCH_APK_PATH="${BENCH_APK_PATH:-}"

collect_scenarios() {
  local stems=()
  while IFS= read -r -d '' f; do
    local base; base="$(basename "$f" .yml)"
    stems+=("${base#perf-}")
  done < <(find "$MAESTRO_DIR" -maxdepth 1 -name 'perf-*.yml' -print0 2>/dev/null)
  echo "${stems[@]}"
}

if [[ "$SCENARIO_FILTER" == "all" ]]; then
  read -ra SCENARIOS <<< "$(collect_scenarios)"
  if [[ ${#SCENARIOS[@]} -eq 0 ]]; then
    echo "ERROR: no perf-*.yml files found in $MAESTRO_DIR" >&2
    exit 1
  fi
else
  SCENARIOS=("$SCENARIO_FILTER")
fi

# iOS simulator: soft-skip if xcrun unavailable or no booted sim
run_ios_scenarios() {
  if ! command -v xcrun >/dev/null 2>&1; then
    echo "WARN: xcrun not available (not macOS?) — iOS simulator scenarios skipped" >&2
    return 0
  fi
  local booted
  booted="$(xcrun simctl list devices booted 2>/dev/null | grep -c 'Booted' || true)"
  if [[ "$booted" -eq 0 ]]; then
    echo "WARN: no booted iOS simulator found — iOS simulator scenarios skipped" >&2
    return 0
  fi
  echo "WARN: iOS simulator perf path not yet implemented — skipped" >&2
}

# Android device setup
device_serial() {
  adb devices | awk 'NR>1 && $2=="device" {print $1; exit}'
}

DEVICE_SERIAL="$(device_serial)"
if [[ -z "$DEVICE_SERIAL" ]]; then
  echo "ERROR: no adb device or emulator detected. Start one first." >&2
  exit 1
fi

if [[ -n "$BENCH_APK_PATH" ]]; then
  if [[ ! -f "$BENCH_APK_PATH" ]]; then
    echo "ERROR: APK not found at $BENCH_APK_PATH" >&2
    exit 1
  fi
  echo "[bench-local] installing $BENCH_APK_PATH on $DEVICE_SERIAL"
  adb -s "$DEVICE_SERIAL" install -r "$BENCH_APK_PATH"
fi

if ! adb -s "$DEVICE_SERIAL" shell pm list packages 2>/dev/null | grep -q "$APP_ID"; then
  echo "ERROR: $APP_ID not installed on $DEVICE_SERIAL. Set BENCH_APK_PATH=<path> or install manually." >&2
  exit 1
fi

echo "[bench-local] target device=$DEVICE_SERIAL app=$APP_ID" >&2

exit_code=0

for scenario in "${SCENARIOS[@]}"; do
  flow_file="$MAESTRO_DIR/perf-${scenario}.yml"
  if [[ ! -f "$flow_file" ]]; then
    echo "ERROR: flow file not found: $flow_file" >&2
    exit_code=1
    continue
  fi

  echo "[bench-local] scenario=$scenario" >&2

  # Clear logcat before running the flow
  adb -s "$DEVICE_SERIAL" logcat -c 2>/dev/null || true

  if ! maestro test "$flow_file"; then
    echo "ERROR: maestro flow failed for scenario $scenario" >&2
    exit_code=4
    continue
  fi

  perf_line="$(adb -s "$DEVICE_SERIAL" logcat -d -s ReactNativeJS:* 2>/dev/null | grep '\[perf-bench\]' | head -1 || true)"

  if [[ -z "$perf_line" ]]; then
    echo "ERROR: [perf-bench] line absent for scenario $scenario" >&2
    exit_code=5
    continue
  fi

  printf '%s\n' "$(jq -cn \
    --arg device "local-avd" \
    --arg deviceName "$DEVICE_SERIAL" \
    --arg platform "android" \
    --arg scenario "$scenario" \
    --arg raw "$perf_line" \
    '{device: $device, deviceName: $deviceName, platform: $platform, scenario: $scenario, raw: $raw}')"
done

# Attempt iOS simulator (soft-skip if unavailable)
run_ios_scenarios

if [[ "$exit_code" -ne 0 ]]; then
  exit "$exit_code"
fi

echo "[bench-local] all scenarios OK" >&2
