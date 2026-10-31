#!/usr/bin/env bash
# Contract test for loop.sh. A scripted stub stands in for Claude Code: each call prints the next
# line of a script file and counts itself, so every branch of the loop is exercised without a model.
#
# Run: bash scripts/runner/loop.test.sh
set -u

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LOOP="$HERE/loop.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

STUB="$TMP/stub.sh"
cat > "$STUB" <<'STUB_EOF'
#!/usr/bin/env bash
n=$(cat "$STUB_DIR/calls" 2>/dev/null || echo 0)
n=$((n + 1))
echo "$n" > "$STUB_DIR/calls"
echo "some model output"
sed -n "${n}p" "$STUB_DIR/script"
STUB_EOF
chmod +x "$STUB"

# The in-flight probe stub prints the next line of $STUB_DIR/inflight, or "free" once it runs out.
PROBE="$TMP/probe.sh"
cat > "$PROBE" <<'PROBE_EOF'
#!/usr/bin/env bash
n=$(cat "$STUB_DIR/probes" 2>/dev/null || echo 0)
n=$((n + 1))
echo "$n" > "$STUB_DIR/probes"
line=$(sed -n "${n}p" "$STUB_DIR/inflight" 2>/dev/null)
echo "${line:-free}"
PROBE_EOF
chmod +x "$PROBE"

# run_case NAME WANT_EXIT WANT_CALLS MAX [OUTPUT-NEEDLE] -- LINE...
run_case() {
  local name=$1 want_exit=$2 want_calls=$3 max=$4 needle=$5
  shift 6
  rm -f "$TMP/calls" "$TMP/probes" "$TMP/inflight"
  printf '%s\n' "$@" > "$TMP/script"
  if [ -n "${INFLIGHT:-}" ]; then printf '%s\n' $INFLIGHT > "$TMP/inflight"; fi
  STUB_DIR="$TMP" RUNNER_CLAUDE="$STUB" RUNNER_INFLIGHT="$PROBE" RUNNER_SLEEP=0 \
    RUNNER_LIMIT_SLEEP=0 bash "$LOOP" "$max" > "$TMP/out" 2>&1
  local got=$?
  local calls
  calls=$(cat "$TMP/calls" 2>/dev/null || echo 0)
  local probes
  probes=$(cat "$TMP/probes" 2>/dev/null || echo 0)
  if [ "$got" = "$want_exit" ] && [ "$calls" = "$want_calls" ] &&
    { [ -z "${WANT_PROBES:-}" ] || [ "$probes" = "$WANT_PROBES" ]; } &&
    { [ -z "$needle" ] || grep -q -- "$needle" "$TMP/out"; }; then
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %s: exit %s (want %s), calls %s (want %s)\n' "$name" "$got" "$want_exit" "$calls" "$want_calls"
    sed 's/^/        /' "$TMP/out"
    FAIL=$((FAIL + 1))
  fi
}

echo "runner loop contract"

run_case "empty queue stops at once" 0 1 20 "" -- "RUNNER: QUEUE EMPTY"
run_case "waits out an in-flight PR" 0 4 20 "" -- \
  "RUNNER: PR OPENED #11" "RUNNER: PR IN FLIGHT #11" "RUNNER: PR IN FLIGHT #11" "RUNNER: QUEUE EMPTY"
run_case "a blocked issue stops the loop and names it" 3 1 20 "#7" -- "RUNNER: BLOCKED #7"
run_case "retries after a usage limit" 0 3 20 "" -- \
  "Claude usage limit reached" "usage limit reached, resets at 5pm" "RUNNER: QUEUE EMPTY"

limits=()
for _ in $(seq 1 13); do limits+=("Claude usage limit reached"); done
run_case "gives up after 12 usage-limit retries" 4 13 20 "" -- "${limits[@]}"

run_case "stops after max opened PRs" 0 2 2 "" -- "RUNNER: PR OPENED #1" "RUNNER: PR OPENED #2" "RUNNER: QUEUE EMPTY"
run_case "output without a sentinel is an error" 5 1 20 "" -- "something went sideways"
INFLIGHT="inflight inflight free" WANT_PROBES=3 run_case "waits in bash, starting no session, while a PR is in flight" 0 1 20 "" -- "RUNNER: QUEUE EMPTY"
INFLIGHT="blocked" run_case "a blocked PR still starts a session so /start can ping the owner" 3 1 20 "#9" -- "RUNNER: BLOCKED #9"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "OK  $PASS/$PASS"
  exit 0
fi
echo "FAILED  $FAIL of $((PASS + FAIL))"
exit 1
