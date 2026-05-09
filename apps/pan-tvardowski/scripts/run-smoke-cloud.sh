#!/usr/bin/env bash
# run-smoke-cloud.sh — TestingBot Maestro cloud runner.
#
# Primary gate (default / 'all' / 'android' / 'ios'):
#   android : Pixel 10    (Android 16) — canonical Android real-device gate
#   ios     : iPhone 16 Pro (iOS 18)   — canonical iOS real-device gate
#   all     : android then ios (default when no arg supplied)
#
# Optional 3-tier Android expansion (power-user; not part of the release gate):
#   low  : Galaxy A12     (older mid-range; stale-API regressions)
#   mid  : Galaxy A55     (mainstream Android)
#   high : Pixel 10       (same as 'android' primary gate; included for parity)
#
# Usage:
#   APK_PATH=build.apk IPA_PATH=build.ipa TESTINGBOT_KEY=... TESTINGBOT_SECRET=... \
#     bash scripts/run-smoke-cloud.sh                  # primary gate: android + ios
#   bash scripts/run-smoke-cloud.sh android            # Android only (Pixel 10)
#   bash scripts/run-smoke-cloud.sh ios                # iOS only (iPhone 16 Pro)
#   bash scripts/run-smoke-cloud.sh low                # optional expansion tier
#   bash scripts/run-smoke-cloud.sh smoke-only         # skip TTI flow
#
# Prereqs:
#   - @testingbot/cli installed: `npm install -g @testingbot/cli`
#   - TESTINGBOT_KEY + TESTINGBOT_SECRET env vars set (OSS free tier or paid)
#   - APK_PATH points to a release-built .apk  (required for android/all/low/mid/high)
#   - IPA_PATH points to a release-built .ipa  (required for ios/all)
#   - bun installed for the TTI gate
#
# Exits 0 iff every selected device passes both smoke + TTI gate.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
MAESTRO_DIR="$APP_DIR/.maestro"
GATE="$APP_DIR/scripts/tti-gate.ts"
ENV_FILE="$APP_DIR/.env.testingbot"

# Auto-load .env.testingbot if present. `set -a` auto-exports every var defined
# in the sourced file, so the .env file can use plain `KEY=value` syntax — no
# `export` prefix required, no manual `source` step in the user's shell.
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

APK_PATH="${APK_PATH:-}"
IPA_PATH="${IPA_PATH:-}"
TTI_THRESHOLD_MS="${TTI_THRESHOLD_MS:-3000}"
TTI_RUN_COUNT="${TTI_RUN_COUNT:-3}"
# Force device locale so smoke.yaml's English text matchers ("Play", "Settings",
# "Back", etc.) resolve. Override via env if you need to smoke-test PL strings.
SMOKE_DEVICE_LOCALE="${SMOKE_DEVICE_LOCALE:-en_US}"

mode="${1:-all}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: $1 not found in PATH. $2" >&2
    exit 1
  fi
}

require_cmd testingbot "Install via npm install -g @testingbot/cli"
require_cmd bun "Install bun: https://bun.sh"
require_cmd unzip "Install unzip (Git Bash on Windows includes it; on Linux: apt install unzip)"

if [[ -z "${TESTINGBOT_KEY:-}" || -z "${TESTINGBOT_SECRET:-}" ]]; then
  echo "ERROR: TESTINGBOT_KEY and TESTINGBOT_SECRET required." >&2
  echo "       Either set them in the shell or in $ENV_FILE" >&2
  echo "       (copy from .env.testingbot.example and fill in values)." >&2
  exit 1
fi

# Device definitions: primary gate
DEVICE_ANDROID=("Pixel 10" "16.0")
DEVICE_IOS=("iPhone 16 Pro" "18.0")

# Optional expansion tiers
TIERS_LOW=("Galaxy A12" "11.0")
TIERS_MID=("Galaxy A55" "14.0")
TIERS_HIGH=("Pixel 10" "16.0")

run_android_tier() {
  local tier="$1"
  local device="$2"
  local os="$3"
  if [[ -z "$APK_PATH" ]]; then
    echo "ERROR: APK_PATH not set. Build a release APK first (eas build --profile preview --platform android --local)." >&2
    exit 1
  fi
  if [[ ! -f "$APK_PATH" ]]; then
    echo "ERROR: APK not found at $APK_PATH" >&2
    exit 1
  fi
  echo "[run-smoke-cloud] android tier=$tier device=$device os=$os"
  if [[ "$mode" != "smoke-only" ]]; then
    local logcat_dump; logcat_dump="$(mktemp)"
    local i
    echo "[run-smoke-cloud] running cold-start TTI x $TTI_RUN_COUNT on $device ($tier)"
    : > "$logcat_dump"
    for ((i = 1; i <= TTI_RUN_COUNT; i++)); do
      echo "[run-smoke-cloud]   iteration $i / $TTI_RUN_COUNT"
      local artifact_dir; artifact_dir="$(mktemp -d)"
      testingbot maestro "$APK_PATH" "$MAESTRO_DIR/cold-start-tti.yaml" \
        --device "$device" \
        --deviceVersion "$os" \
        --real-device \
        --device-locale "$SMOKE_DEVICE_LOCALE" \
        --download-artifacts all \
        --artifacts-output-dir "$artifact_dir" \
        || { echo "ERROR: TTI flow failed on $device (iteration $i)" >&2; rm -rf "$artifact_dir"; rm -f "$logcat_dump"; return 4; }
      # CLI saves a single artifacts.zip; extract in place before searching.
      find "$artifact_dir" -maxdepth 2 -name '*.zip' -print0 | while IFS= read -r -d '' z; do
        unzip -q -o "$z" -d "$artifact_dir" 2>/dev/null || true
      done
      local logfile; logfile="$(find "$artifact_dir" -name 'logcat*.txt' -print -quit)"
      if [[ -z "$logfile" ]]; then
        echo "WARN: no logcat artifact for $device iteration $i — skipping sample" >&2
      else
        grep "\[boot-trace\]" "$logfile" | head -1 >> "$logcat_dump" || true
      fi
      rm -rf "$artifact_dir"
    done
    local total_count; total_count="$(grep -c '\[boot-trace\]' "$logcat_dump" 2>/dev/null || true)"
    if [[ "$total_count" -eq 0 ]]; then
      echo "WARN: no [boot-trace] lines captured for $device ($tier) — TTI gate skipped" >&2
    else
      bun "$APP_DIR/scripts/parse-boot-trace.ts" < "$logcat_dump" \
        | DEVICE_NAME="$device ($tier)" TTI_THRESHOLD_MS="$TTI_THRESHOLD_MS" bun "$GATE" \
        || { echo "ERROR: TTI gate breached on $device ($tier)" >&2; rm -f "$logcat_dump"; return 3; }
    fi
    rm -f "$logcat_dump"
  fi
  testingbot maestro "$APK_PATH" "$MAESTRO_DIR/smoke.yaml" \
    --device "$device" \
    --deviceVersion "$os" \
    --real-device \
    --device-locale "$SMOKE_DEVICE_LOCALE" \
    || { echo "ERROR: smoke flow failed on $device" >&2; return 5; }
  echo "[run-smoke-cloud] android tier=$tier OK"
}

run_ios_tier() {
  local tier="$1"
  local device="$2"
  local os="$3"
  if [[ -z "$IPA_PATH" ]]; then
    echo "ERROR: IPA_PATH not set. Build a release IPA first (eas build --profile preview --platform ios --local)." >&2
    exit 1
  fi
  if [[ ! -f "$IPA_PATH" ]]; then
    echo "ERROR: IPA not found at $IPA_PATH" >&2
    exit 1
  fi
  echo "[run-smoke-cloud] ios tier=$tier device=$device os=$os"
  if [[ "$mode" != "smoke-only" ]]; then
    local log_dump; log_dump="$(mktemp)"
    local i
    echo "[run-smoke-cloud] running cold-start TTI x $TTI_RUN_COUNT on $device ($tier)"
    : > "$log_dump"
    for ((i = 1; i <= TTI_RUN_COUNT; i++)); do
      echo "[run-smoke-cloud]   iteration $i / $TTI_RUN_COUNT"
      local artifact_dir; artifact_dir="$(mktemp -d)"
      testingbot maestro "$IPA_PATH" "$MAESTRO_DIR/cold-start-tti.yaml" \
        --device "$device" \
        --deviceVersion "$os" \
        --real-device \
        --device-locale "$SMOKE_DEVICE_LOCALE" \
        --download-artifacts all \
        --artifacts-output-dir "$artifact_dir" \
        || { echo "ERROR: TTI flow failed on $device (iteration $i)" >&2; rm -rf "$artifact_dir"; rm -f "$log_dump"; return 4; }
      find "$artifact_dir" -maxdepth 2 -name '*.zip' -print0 | while IFS= read -r -d '' z; do
        unzip -q -o "$z" -d "$artifact_dir" 2>/dev/null || true
      done
      local logfile; logfile="$(find "$artifact_dir" \( -name 'logcat*.txt' -o -name 'xcode*.log' \) -print -quit 2>/dev/null || true)"
      if [[ -z "$logfile" ]]; then
        echo "WARN: no log artifact for $device iteration $i — skipping sample" >&2
      else
        grep "\[boot-trace\]" "$logfile" | head -1 >> "$log_dump" || true
      fi
      rm -rf "$artifact_dir"
    done
    local total_count; total_count="$(grep -c '\[boot-trace\]' "$log_dump" 2>/dev/null || true)"
    if [[ "$total_count" -eq 0 ]]; then
      echo "WARN: no [boot-trace] lines captured for $device ($tier) — TTI gate skipped" >&2
    else
      bun "$APP_DIR/scripts/parse-boot-trace.ts" < "$log_dump" \
        | DEVICE_NAME="$device ($tier)" TTI_THRESHOLD_MS="$TTI_THRESHOLD_MS" bun "$GATE" \
        || { echo "ERROR: TTI gate breached on $device ($tier)" >&2; rm -f "$log_dump"; return 3; }
    fi
    rm -f "$log_dump"
  fi
  testingbot maestro "$IPA_PATH" "$MAESTRO_DIR/smoke.yaml" \
    --device "$device" \
    --deviceVersion "$os" \
    --real-device \
    --device-locale "$SMOKE_DEVICE_LOCALE" \
    || { echo "ERROR: smoke flow failed on $device" >&2; return 5; }
  echo "[run-smoke-cloud] ios tier=$tier OK"
}

case "$mode" in
  android)
    run_android_tier android "${DEVICE_ANDROID[0]}" "${DEVICE_ANDROID[1]}"
    ;;
  ios)
    run_ios_tier ios "${DEVICE_IOS[0]}" "${DEVICE_IOS[1]}"
    ;;
  all|smoke-only)
    run_android_tier android "${DEVICE_ANDROID[0]}" "${DEVICE_ANDROID[1]}"
    run_ios_tier ios "${DEVICE_IOS[0]}" "${DEVICE_IOS[1]}"
    ;;
  low)
    run_android_tier low "${TIERS_LOW[0]}" "${TIERS_LOW[1]}"
    ;;
  mid)
    run_android_tier mid "${TIERS_MID[0]}" "${TIERS_MID[1]}"
    ;;
  high)
    run_android_tier high "${TIERS_HIGH[0]}" "${TIERS_HIGH[1]}"
    ;;
  *)
    echo "Unknown mode: $mode (android|ios|all|low|mid|high|smoke-only)" >&2
    exit 1
    ;;
esac

echo "[run-smoke-cloud] all selected devices OK"
