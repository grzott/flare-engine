#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit) hook - auto-format touched TS/TSX files with Biome.
# Scope: only files under packages/** or apps/** ending in .ts or .tsx.
# Never blocks: always exits 0 so a lint issue does not abort an edit.
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    ti = d.get("tool_input", {})
    print(ti.get("file_path", ""))
except Exception:
    pass' 2>/dev/null)

[ -z "$FILE" ] && exit 0

case "$FILE" in
  */packages/*.ts|*/packages/*.tsx|*/apps/*.ts|*/apps/*.tsx|packages/*.ts|packages/*.tsx|apps/*.ts|apps/*.tsx)
    ;;
  *)
    exit 0
    ;;
esac

REL=${FILE#"$(pwd)/"}
[ -f "$REL" ] || exit 0

# Biome applies safe fixes + format. Silent on success; warnings go to stderr.
bunx biome check --write --no-errors-on-unmatched "$REL" >/dev/null 2>&1 || true

exit 0
