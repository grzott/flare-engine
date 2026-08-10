#!/usr/bin/env bash
# Contract test for pre-bash-guard.sh.
#
# The guard existed for four months with no test. An audit on 2026-08-09 walked
# through it four ways (wrapper, eval, `git -C`, unnamed verbs), which is what a
# rule with no executable contract eventually earns. This file is that contract.
#
# Run: bash .claude/hooks/pre-bash-guard.test.sh
set -u

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
GUARD="$HERE/pre-bash-guard.sh"
PASS=0
FAIL=0

run_guard() {
  printf '%s' "$1" \
    | python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.stdin.read()}}))' \
    | bash "$GUARD" >/dev/null 2>&1
}

expect_block() {
  if run_guard "$1"; then
    printf '  FAIL  expected BLOCK, got ALLOW: %s\n' "$1"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
}

expect_allow() {
  if run_guard "$1"; then
    PASS=$((PASS + 1))
  else
    printf '  FAIL  expected ALLOW, got BLOCK: %s\n' "$1"
    FAIL=$((FAIL + 1))
  fi
}

echo "pre-bash-guard contract"

echo " state-changing git"
expect_block "git commit -m x"
expect_block "git add ."
expect_block "git push origin main"
expect_block "git reset --hard HEAD"
expect_block "git rebase main"
expect_block "git merge feature"
expect_block "git checkout main"

echo " verbs the old blocklist never named"
expect_block "git revert HEAD"
expect_block "git cherry-pick abc123"
expect_block "git rm src/foo.ts"
expect_block "git restore src/"
expect_block "git stash"
expect_block "git stash push -m wip"
expect_block "git switch -c feature"
expect_block "git worktree add ../wt"
expect_block "git submodule update --init"
expect_block "git config user.name Bob"
expect_block "git branch -D old"
expect_block "git tag v1.0.0"

echo " displaced by a global option"
expect_block "git -C . commit -m x"
expect_block "git -C packages add ."
expect_block "git -c user.name=x commit -m y"
expect_block "git --git-dir=.git commit -m x"

echo " reached through a wrapper"
expect_block 'bash -c "git commit -m x"'
expect_block "bash -c 'cd packages; git add .'"
expect_block 'sh -c "git push"'
expect_block 'eval "git commit -m x"'
expect_block "xargs git add"
expect_block 'python3 -c "import subprocess; subprocess.run([\"git\",\"commit\"])"'
expect_block 'node -e "require(\"child_process\").execSync(\"git commit\")"'
expect_block 'perl -e "system(\"git add .\")"'

echo " chained and env-prefixed"
expect_block "cd packages && git add ."
expect_block "echo hi; git add ."
expect_block "true && git commit -m x"
expect_block "FOO=1 git push origin main"

echo " non-bun package managers"
expect_block "pnpm install"
expect_block "npm ci"
expect_block "yarn add react"
expect_block "npx tsc"
expect_block 'bash -c "pnpm install"'

echo " destructive rm"
expect_block "rm -rf /"
expect_block "rm -rf ~"

# Added 2026-08-09 after a review probe walked the FIRST rewrite of this guard.
# `fetch` and `symbolic-ref` had been filed as read-only; both write refs.
# The lesson is the one this whole guard is about: an allowlist is only as good
# as the classification behind it, so every entry needs a case here.
echo " verbs that look read-only and are not"
expect_block "git fetch"
expect_block "git fetch --prune"
expect_block "git fetch origin main:sidebranch"
expect_block "git symbolic-ref HEAD refs/heads/evil"
expect_allow "git fetch --dry-run"
expect_allow "git symbolic-ref HEAD"
expect_allow "git symbolic-ref --short HEAD"

echo " read-only git stays allowed"
expect_allow "git status"
expect_allow "git status --porcelain"
expect_allow "git diff HEAD~1 -- src/"
expect_allow "git log --oneline -20"
expect_allow "git show df1e3de"
expect_allow "git rev-parse HEAD"
expect_allow "git ls-files | wc -l"
expect_allow "git branch"
expect_allow "git branch -a"
expect_allow "git tag -l"
expect_allow "git stash list"
expect_allow "git config --get user.email"
expect_allow "git remote -v"
expect_allow "git submodule status"
expect_allow "git blame src/index.ts"

echo " ordinary work stays allowed"
expect_allow "bun test"
expect_allow "bun run typecheck"
expect_allow "bash -c 'bun test'"
expect_allow "cd packages && bun test"
expect_allow "grep -rn TODO src/"
expect_allow "wc -l .claude/hooks/*.sh"
expect_allow 'echo "a; b"'
expect_allow 'python3 -c "print(1+1)"'

echo
if [ "$FAIL" -eq 0 ]; then
  echo "OK  $PASS/$PASS"
  exit 0
fi
echo "FAILED  $FAIL of $((PASS + FAIL))"
exit 1
