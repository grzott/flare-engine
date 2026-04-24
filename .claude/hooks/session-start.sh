#!/usr/bin/env bash
# SessionStart hook — prints context banner so Claude opens each session oriented.
# Non-blocking: always exits 0. Output goes to stderr (Claude sees it as context).
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

SESSIONS="docs/plans/sessions.md"
LOG="SESSION_LOG.md"

{
  echo "=== Flare session banner ==="
  if [ -f "$SESSIONS" ]; then
    NEXT=$(grep -E '^\| *[0-9]+ *\| *(pending|in_progress) *\|' "$SESSIONS" | head -n 1 || true)
    if [ -n "$NEXT" ]; then
      echo "Next session: $NEXT"
    else
      echo "No pending sessions in $SESSIONS - run /plan-sessions to refresh the slice."
    fi
  else
    echo "No $SESSIONS yet - run /plan-sessions to create the first 10-20 session slice."
  fi

  echo ""
  echo "Branch:      $(git branch --show-current 2>/dev/null || echo '?')"
  echo "Last commit: $(git log -1 --oneline 2>/dev/null || echo '?')"

  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DIRTY" != "0" ]; then
    echo "Dirty files: $DIRTY (uncommitted changes in tree)"
  fi

  if [ -f "$LOG" ]; then
    LAST_SESSION=$(grep -E '^## Session [0-9]+' "$LOG" | tail -n 1 || true)
    [ -n "$LAST_SESSION" ] && echo "Last closed: $LAST_SESSION"
  fi

  echo "============================="
} >&2

exit 0
