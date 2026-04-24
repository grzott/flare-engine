#!/usr/bin/env bash
# PreToolUse (Bash) guard - blocks state-changing git and non-bun package managers.
# Defense in depth: settings.json `deny` is the primary gate; this hook catches
# variants (env-prefixed, quoted, chained) and prints a clear reason.
#
# Protocol: exit 0 -> allow. Non-zero exit + stderr message -> block with that reason.
set -u

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    print(d.get("tool_input",{}).get("command",""))
except Exception:
    pass' 2>/dev/null)

block() {
  echo "BLOCKED by .claude/hooks/pre-bash-guard.sh: $1" >&2
  echo "Rationale: repo contract - agents produce paste-ready commit blocks; the user runs them." >&2
  exit 2
}

# Strip leading env assignments and collapse whitespace.
NORM=$(printf '%s' "$CMD" | sed -E 's/^[[:space:]]*(env|[A-Z_]+=[^[:space:]]+)[[:space:]]+//; s/[[:space:]]+/ /g')

case "$NORM" in
  "git push"*|"git commit"*|"git add"*|"git reset"*|"git rebase"*|"git merge"*|"git checkout"*)
    block "state-changing git command '$NORM' is not allowed from agents"
    ;;
  *"&& git push"*|*"&& git commit"*|*"&& git add"*|*"; git push"*|*"; git commit"*|*"; git add"*)
    block "chained git state change detected in '$NORM'"
    ;;
  "npm "*|"npx "*|"yarn "*|"pnpm "*)
    block "this is a bun-only project - use bun equivalents"
    ;;
  "rm -rf /"*|"rm -rf ~"*|"rm -rf \$HOME"*|"rm -rf --no-preserve-root"*)
    block "destructive rm -rf on system root"
    ;;
esac

exit 0
