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
    ACTIVE=$(awk -F'|' '
      /^\| *[0-9]+ *\| *in_progress/ { print; exit }
    ' "$SESSIONS" || true)
    if [ -n "$ACTIVE" ]; then
      echo "Active session (in_progress): $ACTIVE"
      echo "Run /session-close before starting a new one, or pass an explicit #N."
    fi

    NEXT=$(awk -F'|' '
      /^\| *[0-9]+ *\| *pending *\|/ {
        id=$2+0; goal=$5
        # Skip Deferred (manual launch tier) — picker never surfaces these
        if (goal ~ /PT-Store|PT-Legal-|PT-Submit-|PT-Accounts|PT-DataSafety|PT-RR-Walk|PT-AppIcon|PT-Screenshots-|PT-Trailer|PT-DocsiteLive|PT-ClosedTest-Kickoff/) next
        # P0 (highest) — visual-runtime closure
        tier=2
        if (goal ~ /Postfx-Compositor|PT-PostFx-Wire|PT-Boss-PaletteShift-Wire|PT-HUD-DataDriven/) tier=1
        # P2 (lowest active) — quality + dev-tooling
        else if (goal ~ /Hermes-|PT-LocaleQA-Fix|PT-DocSync-|PT-Smoke-|PT-DebugHUD|PT-UnskipCloudSmoke/) tier=3
        if (best_tier=="" || tier<best_tier || (tier==best_tier && id<best_id)) {
          best_tier=tier; best_id=id; best_line=$0
        }
      }
      END { if (best_line!="") print best_line }
    ' "$SESSIONS" || true)
    if [ -n "$NEXT" ]; then
      echo "Next pending: $NEXT"
    elif [ -z "$ACTIVE" ]; then
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
