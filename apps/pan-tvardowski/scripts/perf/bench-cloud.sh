#!/usr/bin/env bash
# bench-cloud.sh — TestingBot Maestro perf-bench cloud runner.
#
# This script lives in scripts/perf/ intentionally — E7 CI calls it directly
# without going through app package.json scripts.
#
# Usage:
#   BENCH_APK_PATH=build.apk TESTINGBOT_KEY=... TESTINGBOT_SECRET=... \
#     bash scripts/perf/bench-cloud.sh [--app <name>] [--scenario <id>|all] [--tier mid-gate|headroom|low|all]
#
# Flags (all optional):
#   --app <name>         App directory under apps/ (default: pan-tvardowski)
#   --scenario <id>|all  Perf scenario file stem, e.g. "boot" or "all" (default: all)
#   --tier mid-gate|headroom|low|all  Device tier filter (default: mid-gate)
#   --download-artifacts all|failures-only
#                        Control TestingBot artifact download (default: failures-only).
#                        Use "all" during E8 baseline capture and first Tier-A landing.
#                        "failures-only" saves wall-clock time and TestingBot retention
#                        storage on every green run.
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
# APP_ROOT is two levels up from scripts/perf/ — works in both monorepo and
# post-split standalone layouts. REPO_ROOT is two more levels up in monorepo
# (apps/<name>/../../ = repo root); in standalone it equals APP_ROOT.
APP_ROOT="$(cd -- "$SCRIPT_DIR/../.." &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "$APP_ROOT/../.." &> /dev/null && pwd 2>/dev/null || echo "$APP_ROOT")"
DEVICES_JSON="$SCRIPT_DIR/devices.json"

# Defaults
APP_NAME="pan-tvardowski"
SCENARIO_FILTER="all"
TIER_FILTER="mid-gate"
DOWNLOAD_ARTIFACTS="failures-only"

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
    --download-artifacts)
      DOWNLOAD_ARTIFACTS="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      echo "Usage: bench-cloud.sh [--app <name>] [--scenario <id>|all] [--tier mid-gate|headroom|low|all] [--download-artifacts all|failures-only]" >&2
      exit 1
      ;;
  esac
done

# In monorepo: APP_ROOT/../../apps/$APP_NAME — but when called with --app matching
# the containing app, APP_ROOT itself is the app dir (subtree-split layout).
# Detect layout: if APP_ROOT ends with "apps/$APP_NAME" use it directly, else
# look for it under REPO_ROOT/apps/.
if [[ "$(basename "$APP_ROOT")" == "$APP_NAME" ]]; then
  APP_DIR="$APP_ROOT"
else
  APP_DIR="$REPO_ROOT/apps/$APP_NAME"
fi
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

# The testingbot Maestro plugin reads credentials from ~/.testingbot only —
# it does not consult TESTINGBOT_KEY / TESTINGBOT_SECRET env vars even when set.
TB_CREDS_FILE="$HOME/.testingbot"
if [[ ! -f "$TB_CREDS_FILE" ]]; then
  printf '%s:%s' "$TESTINGBOT_KEY" "$TESTINGBOT_SECRET" > "$TB_CREDS_FILE"
  chmod 600 "$TB_CREDS_FILE"
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

  # Persist artifacts under perf-artifacts/<device>-<scenario>/ so CI can
  # upload them for debugging. Slug spaces in device names so the path is safe.
  local device_slug; device_slug="${device_name// /_}"
  local artifact_dir="$REPO_ROOT/perf-artifacts/${device_slug}-${scenario}"
  rm -rf "$artifact_dir"
  mkdir -p "$artifact_dir"

  # testingbot CLI writes verbose progress to stdout. Redirect to stderr so our
  # NDJSON output (the only thing we want on stdout) stays clean — downstream
  # `>> bench-results.ndjson` in CI would otherwise pollute the file with
  # "Uploading Maestro Flows", "Downloading artifacts...", etc.
  local flow_failed=false
  testingbot maestro "$artifact_bin" "$flow_file" \
      --device "$device_name" \
      --deviceVersion "$os_version" \
      --real-device \
      --device-locale "$BENCH_DEVICE_LOCALE" \
      --download-artifacts "$DOWNLOAD_ARTIFACTS" \
      --artifacts-output-dir "$artifact_dir" >&2 \
    || flow_failed=true
  if [[ "$flow_failed" == "true" ]]; then
    echo "ERROR: TestingBot flow failed for $device_name / $scenario" >&2
  fi

  # Unzip any artifact archives in place so logcat etc. are inspectable
  find "$artifact_dir" -maxdepth 2 -name '*.zip' -print0 | while IFS= read -r -d '' z; do
    unzip -q -o "$z" -d "$artifact_dir" 2>/dev/null || true
  done

  if [[ "$flow_failed" == "true" ]]; then
    return 4
  fi

  # Find candidate log files. maestro.txt / maestro.log is preferred for RN
  # release Hermes builds — see scripts/perf/README or perf-boot.yml comments.
  # logcat / xcode log kept as fallback for non-RN cases.
  local logfiles
  logfiles="$(find "$artifact_dir" \( \
      -name 'maestro*.txt' \
      -o -name 'maestro*.log' \
      -o -name 'logcat*.txt' \
      -o -name 'xcode*.log' \
    \) -print 2>/dev/null || true)"

  local perf_line=""
  local f
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    perf_line="$(grep '\[perf-bench\]' "$f" | head -1 || true)"
    if [[ -n "$perf_line" ]]; then break; fi
  done <<< "$logfiles"

  if [[ -z "$perf_line" ]]; then
    echo "ERROR: [perf-bench] line absent for $device_name / $scenario" >&2
    return 5
  fi

  # Extract the JSON payload after the [perf-bench] tag. The maestro.txt line
  # contains: "<timestamp> [ INFO] ...: JsConsole: [perf-bench] {json}"
  local perf_json
  perf_json="$(printf '%s' "$perf_line" | sed -n 's/.*\[perf-bench\] //p')"
  if [[ -z "$perf_json" ]]; then
    echo "ERROR: failed to extract JSON payload from perf line for $device_name / $scenario" >&2
    return 5
  fi

  # Validate it's parseable JSON before emitting rows
  if ! echo "$perf_json" | jq empty 2>/dev/null; then
    echo "ERROR: perf payload is not valid JSON for $device_name / $scenario" >&2
    echo "  payload: $perf_json" >&2
    return 5
  fi

  # Capture timestamp once per scenario; regression-check uses this for the
  # rolling 7-day window.
  local captured_at
  captured_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Emit one NDJSON BenchRow per perf-recorder section. Schema must match
  # scripts/perf/regression-check.ts:BenchRow exactly:
  # { device, scenario, metric, p95, capturedAt }
  echo "$perf_json" | jq -c \
    --arg device "$device_id" \
    --arg scenario "$scenario" \
    --arg capturedAt "$captured_at" \
    '.sections[] | {
      device: $device,
      scenario: $scenario,
      metric: .name,
      p95: .p95,
      capturedAt: $capturedAt
    }'
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
    # `cmd || exit_code=$?` captures the real exit code on failure.
    # The previous `if ! cmd; then exit_code=$?` pattern was broken:
    # `!` consumes the exit code, so `$?` was always 0 in the body.
    run_scenario_on_device "$d_name" "$d_platform" "$d_os" "$d_id" "$scenario" \
      || exit_code=$?
  done
done < <(jq -c '.[]' "$DEVICES_JSON")

if [[ "$exit_code" -ne 0 ]]; then
  exit "$exit_code"
fi

echo "[bench-cloud] all selected combos OK" >&2
