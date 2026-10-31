#!/usr/bin/env bash
# Workstation-on runner: calls `/start next` in a fresh Claude Code session per issue until the queue
# is empty, an issue is blocked, or MAX PRs have been opened. One PR in flight at a time: while the
# last PR waits for its checks (or the owner's tap), it sleeps and asks again. A usage limit pauses
# the loop instead of failing it.
#
# Usage: scripts/runner/loop.sh [max-issues=20]
# Env:   RUNNER_CLAUDE (default scripts/runner/claude-as-bot.sh), RUNNER_SLEEP (600),
#        RUNNER_LIMIT_SLEEP (1800), RUNNER_LIMIT_RETRIES (12)
# Exit:  0 queue empty or max reached · 3 blocked · 4 usage limit persisted · 5 no sentinel
set -u

MAX="${1:-20}"
CLAUDE_CMD="${RUNNER_CLAUDE:-scripts/runner/claude-as-bot.sh}"
INFLIGHT_CMD="${RUNNER_INFLIGHT:-scripts/runner/inflight.sh}"
SLEEP_SECONDS="${RUNNER_SLEEP:-600}"
LIMIT_SLEEP_SECONDS="${RUNNER_LIMIT_SLEEP:-1800}"
LIMIT_RETRIES="${RUNNER_LIMIT_RETRIES:-12}"

opened=0
limit_hits=0

while [ "$opened" -lt "$MAX" ]; do
  # Wait in bash while a PR is in flight: a Claude session per poll would spend usage for nothing.
  # "blocked" still starts a session, so /start can ping the owner on the PR.
  if [ "$("$INFLIGHT_CMD" 2>/dev/null || echo free)" = "inflight" ]; then
    sleep "$SLEEP_SECONDS"
    continue
  fi

  out=$("$CLAUDE_CMD" -p "/start next" --permission-mode acceptEdits 2>&1)
  sentinel=$(printf '%s\n' "$out" | grep -E '^RUNNER: ' | tail -1)

  case "$sentinel" in
    "RUNNER: QUEUE EMPTY")
      echo "runner: queue empty after $opened PR(s)"
      exit 0
      ;;
    "RUNNER: PR OPENED"*)
      opened=$((opened + 1))
      limit_hits=0
      echo "$sentinel"
      ;;
    "RUNNER: PR IN FLIGHT"*)
      limit_hits=0
      sleep "$SLEEP_SECONDS"
      ;;
    "RUNNER: BLOCKED"*)
      echo "runner: $sentinel — needs the owner" >&2
      exit 3
      ;;
    *)
      if printf '%s' "$out" | grep -qiE 'usage limit|limit reached'; then
        limit_hits=$((limit_hits + 1))
        if [ "$limit_hits" -gt "$LIMIT_RETRIES" ]; then
          echo "runner: usage limit persisted through $LIMIT_RETRIES retries" >&2
          exit 4
        fi
        sleep "$LIMIT_SLEEP_SECONDS"
      else
        echo "runner: the session printed no RUNNER sentinel; last lines:" >&2
        printf '%s\n' "$out" | tail -20 >&2
        exit 5
      fi
      ;;
  esac
done

echo "runner: opened $opened PR(s), the maximum for this run"
