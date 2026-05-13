#!/usr/bin/env bash
# SessionStart hook — prints a minimal banner so Claude opens each session oriented.
# Non-blocking: always exits 0. Output goes to stderr (Claude sees it as context).
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

{
  echo "=== Flare session banner ==="
  echo "Branch:      $(git branch --show-current 2>/dev/null || echo '?')"
  echo "Last commit: $(git log -1 --oneline 2>/dev/null || echo '?')"

  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DIRTY" != "0" ]; then
    echo "Dirty files: $DIRTY (uncommitted changes in tree)"
  fi

  if [ -f "docs/plans/todo.md" ]; then
    ACTIVE=$(awk '/^## Active/{flag=1; next} /^## /{flag=0} flag && /^- /{print; exit}' docs/plans/todo.md)
    [ -n "$ACTIVE" ] && echo "Next:        $ACTIVE"
  fi

  if [ -f "SESSION_LOG.md" ]; then
    LAST=$(grep -E '^## Session [0-9]+' SESSION_LOG.md | tail -n 1 || true)
    [ -n "$LAST" ] && echo "Last closed: $LAST"
  fi

  echo "============================="
} >&2

exit 0
