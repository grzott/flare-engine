#!/usr/bin/env bash
# bench-cloud.sh — TestingBot Maestro perf-bench cloud runner.
#
# This script lives in scripts/perf/ intentionally — E7 CI calls it directly
# without going through app package.json scripts.
#
# Usage:
#   BENCH_APK_PATH=build.apk TESTINGBOT_KEY=... TESTINGBOT_SECRET=... \
#     bash scripts/perf/bench-cloud.sh [--app <name>] [--scenario <id>|all] [--tier mid-gate|headroom|all]
#
# Flags (all optional):
#   --app <name>         App directory under apps/ (default: pan-tvardowski)
#   --scenario <id>|all  Perf scenario file stem, e.g. "boot" or "all" (default: all)
#   --tier mid-gate|headroom|all  Device tier filter (default: mid-gate)
#
# For each non-skipped device matching the tier filter × each selected scenario:
#   1. Runs testingbot maestro <apk|ipa> apps/<name>/maestro/perf-<scenario>.yml
#   2. Unzips artifacts
#   3. Greps [perf-bench] from logcat / xcode log
#   4. Emits one NDJSON line to stdout per combo
#
# Exit codes:
#   0  all combos passed
#   4  TestingBot flow failed
#   5  [perf-bench] line absent in artifacts
#
# Prereqs:
#   - @testingbot/cli installed: npm install -g @testingbot/cli
#   - TESTINGBOT_KEY + TESTINGBOT_SECRET set (shell or .env.testingbot)
#   - BENCH_APK_PATH pointing to a release .apk (required for android devices)
#   - BENCH_IPA_PATH pointing to a release .ipa (required for iOS; currently all iOS skip:true)
#   - unzip available (Git Bash on Windows includes it; Linux: apt install unzip)

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." &> /dev/null && pwd)"
DEVICES_JSON="$SCRIPT_DIR/devices.json"

# Defaults
APP_NAME="pan-tvardowski"
SCENARIO_FILTER="all"
TIER_FILTER="mid-gate"

# Parse flags
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
    --tier)
      TIER_FILTER="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      echo "Usage: bench-cloud.sh [--app <name>] [--scenario <id>|all] [--tier mid-gate|headroom|all]" >&2
      exit 1
      ;;
  esac
done

APP_DIR="$REPO_ROOT/apps/$APP_NAME"
MAESTRO_DIR="$APP_DIR/maestro"
ENV_FILE="$APP_DIR/.env.testingbot"

# Auto-load .env.testingbot if present
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BENCH_APK_PATH="${BENCH_APK_PATH:-}"
BENCH_IPA_PATH="${BENCH_IPA_PATH:-}"
BENCH_DEVICE_LOCALE="${BENCH_DEVICE_LOCALE:-en_US}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 not found in PATH. $2" >&2
    exit 1
  fi
}

require_cmd testingbot "Install via: npm install -g @testingbot/cli"
require_cmd unzip "Install unzip (Git Bash on Windows includes it; Linux: apt install unzip)"
require_cmd jq "Install jq: https://stedolan.github.io/jq/"

if [[ -z "${TESTINGBOT_KEY:-}" || -z "${TESTINGBOT_SECRET:-}" ]]; then
  echo "ERROR: TESTINGBOT_KEY and TESTINGBOT_SECRET required." >&2
  echo "       Set them in the shell or in $ENV_FILE" >&2
  exit 1
fi

# Collect scenario stems from maestro/perf-*.yml
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

# Check if all iOS devices are skipped and warn if IPA provided unnecessarily
ios_all_skipped=true
while IFS= read -r device_json; do
  local_flag="$(echo "$device_json" | jq -r '.local')"
  platform="$(echo "$device_json" | jq -r '.platform')"
  skip="$(echo "$device_json" | jq -r '.skip')"
  if [[ "$platform" == "ios" && "$skip" != "true" ]]; then
    ios_all_skipped=false
  fi
done < <(jq -c '.[]' "$DEVICES_JSON")

if [[ -n "$BENCH_IPA_PATH" && "$ios_all_skipped" == "true" ]]; then
  echo "WARN: BENCH_IPA_PATH is set but all iOS devices are skip:true — IPA will not be used" >&2
fi

run_scenario_on_device() {
  local device_name="$1"
  local platform="$2"
  local os_version="$3"
  local device_id="$4"
  local scenario="$5"

  local flow_file="$MAESTRO_DIR/perf-${scenario}.yml"
  if [[ ! -f "$flow_file" ]]; then
    echo "ERROR: flow file not found: $flow_file" >&2
    exit 1
  fi

  local artifact_bin
  if [[ "$platform" == "android" ]]; then
    if [[ -z "$BENCH_APK_PATH" ]]; then
      echo "ERROR: BENCH_APK_PATH not set (required for android device $device_name)" >&2
      exit 1
    fi
    if [[ ! -f "$BENCH_APK_PATH" ]]; then
      echo "ERROR: APK not found at $BENCH_APK_PATH" >&2
      exit 1
    fi
    artifact_bin="$BENCH_APK_PATH"
  else
    if [[ -z "$BENCH_IPA_PATH" ]]; then
      echo "ERROR: BENCH_IPA_PATH not set (required for ios device $device_name)" >&2
      exit 1
    fi
    if [[ ! -f "$BENCH_IPA_PATH" ]]; then
      echo "ERROR: IPA not found at $BENCH_IPA_PATH" >&2
      exit 1
    fi
    artifact_bin="$BENCH_IPA_PATH"
  fi

  echo "[bench-cloud] device=$device_name os=$os_version scenario=$scenario" >&2

  local artifact_dir; artifact_dir="$(mktemp -d)"

  if ! testingbot maestro "$artifact_bin" "$flow_file" \
      --device "$device_name" \
      --deviceVersion "$os_version" \
      --real-device \
      --device-locale "$BENCH_DEVICE_LOCALE" \
      --download-artifacts all \
      --artifacts-output-dir "$artifact_dir"; then
    echo "ERROR: TestingBot flow failed for $device_name / $scenario" >&2
    rm -rf "$artifact_dir"
    return 4
  fi

  # Unzip any artifact archives in place
  find "$artifact_dir" -maxdepth 2 -name '*.zip' -print0 | while IFS= read -r -d '' z; do
    unzip -q -o "$z" -d "$artifact_dir" 2>/dev/null || true
  done

  # Find logcat or xcode log defensively
  local logfile
  logfile="$(find "$artifact_dir" \( -name 'logcat*.txt' -o -name 'xcode*.log' \) -print -quit 2>/dev/null || true)"

  local perf_line=""
  if [[ -n "$logfile" ]]; then
    perf_line="$(grep '\[perf-bench\]' "$logfile" | head -1 || true)"
  fi

  rm -rf "$artifact_dir"

  if [[ -z "$perf_line" ]]; then
    echo "ERROR: [perf-bench] line absent for $device_name / $scenario" >&2
    return 5
  fi

  # Emit NDJSON line to stdout
  printf '%s\n' "$(jq -cn \
    --arg device "$device_id" \
    --arg deviceName "$device_name" \
    --arg platform "$platform" \
    --arg scenario "$scenario" \
    --arg raw "$perf_line" \
    '{device: $device, deviceName: $deviceName, platform: $platform, scenario: $scenario, raw: $raw}')"
}

# Main loop: iterate devices × scenarios
exit_code=0

while IFS= read -r device_json; do
  d_id="$(echo "$device_json" | jq -r '.id')"
  d_name="$(echo "$device_json" | jq -r '.name')"
  d_platform="$(echo "$device_json" | jq -r '.platform')"
  d_os="$(echo "$device_json" | jq -r '.osVersion')"
  d_tier="$(echo "$device_json" | jq -r '.tier')"
  d_local="$(echo "$device_json" | jq -r '.local')"
  d_skip="$(echo "$device_json" | jq -r '.skip')"

  # Skip local devices — those are for bench-local.sh
  if [[ "$d_local" == "true" ]]; then
    continue
  fi

  # Apply skip flag
  if [[ "$d_skip" == "true" ]]; then
    d_skip_reason="$(echo "$device_json" | jq -r '.skipReason // "no reason given"')"
    echo "[bench-cloud] skipping $d_name: $d_skip_reason" >&2
    continue
  fi

  # Apply tier filter
  if [[ "$TIER_FILTER" != "all" && "$d_tier" != "$TIER_FILTER" ]]; then
    continue
  fi

  for scenario in "${SCENARIOS[@]}"; do
    if ! run_scenario_on_device "$d_name" "$d_platform" "$d_os" "$d_id" "$scenario"; then
      exit_code=$?
    fi
  done
done < <(jq -c '.[]' "$DEVICES_JSON")

if [[ "$exit_code" -ne 0 ]]; then
  exit "$exit_code"
fi

echo "[bench-cloud] all selected combos OK" >&2
