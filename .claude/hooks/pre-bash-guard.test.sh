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
expect_block "git push origin main"
expect_block "git reset --hard HEAD"
expect_block "git rebase main"
expect_block "git merge feature"
expect_block "git checkout main"

# 2026-11 (A2): agents commit on claude/* branches and open PRs; main is
# protected by a ruleset. add and commit are allowed; push only to claude/*.
echo " agent PR flow is allowed"
expect_allow "git add ."
expect_allow "git add -A"
expect_allow "git add packages/math/src/vec2.ts"
expect_allow 'git commit -m "fix(math): clamp lerp t"'
expect_allow "git fetch origin"
expect_allow "git fetch origin main"
expect_allow "git switch -c claude/issue-12-clamp-lerp origin/main"
expect_allow "git checkout -b claude/issue-12-clamp-lerp origin/main"
expect_allow "git switch claude/issue-12-clamp-lerp"
expect_allow "git switch -c claude/issue-12-clamp-lerp origin/claude/issue-12-clamp-lerp"
expect_allow "git push -u origin claude/issue-12-clamp-lerp"
expect_allow "git push --set-upstream origin claude/issue-12-clamp-lerp"
expect_allow "git push origin HEAD:claude/issue-12-clamp-lerp"

echo " agent PR flow stays inside claude/*"
expect_block "git push"
expect_block "git push origin"
expect_block "git push origin HEAD:main"
expect_block "git push origin claude/x:main"
expect_block "git push --force origin claude/x"
expect_block "git push -f origin claude/x"
expect_block "git push --force-with-lease origin claude/x"
expect_block "git push origin +claude/x"
expect_block "git push origin --delete claude/x"
expect_block "git push --all origin"
expect_block "git push --tags origin"
expect_block "git push upstream claude/x"
expect_block "git commit --amend -m x"
expect_block "git commit --no-verify -m x"
expect_block "git commit -n -m x"
expect_block "git switch main"
expect_block "git switch -c feature/x"
expect_block "git checkout -b feature/x"
expect_block "git checkout -- src/a.ts"
expect_block "git checkout ."
expect_block "git switch -c claude/../main"
expect_block "git switch -c claude/x origin/feature"
expect_block "git switch -c claude/x origin/claude/y"

echo " push and commit cannot be re-pointed by config"
expect_block "git -c remote.origin.push=refs/heads/claude/x:refs/heads/main push origin claude/x"
expect_block "git --config-env=remote.origin.push=X push origin claude/x"
expect_block "git -c core.hooksPath=/dev/null commit -m x"
expect_block "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=remote.origin.push GIT_CONFIG_VALUE_0=x git push origin claude/x"
expect_block "GIT_DIR=../other/.git git commit -m x"
expect_block "git add -f docs/plans/_local/notes.md"
expect_block "git add --force ."
expect_block "git add -fA"

echo " gh stays away from merges, reviews, checks and settings"
expect_block "gh pr merge 12 --admin"
expect_block "gh pr merge 12 --squash"
expect_block "gh pr review 12 --approve"
expect_block "gh api -X POST repos/o/r/pulls/12/reviews -f event=APPROVE"
expect_block "gh api -X PUT repos/o/r/pulls/12/merge"
expect_block "gh api -X POST repos/o/r/merges -f base=main -f head=claude/x"
expect_block "gh api -X POST repos/o/r/statuses/abc -f state=success -f context=risk-gate"
expect_block "gh api -X POST repos/o/r/check-runs -f name=risk-gate"
expect_block "gh api -X DELETE repos/o/r/rulesets/1"
expect_block "gh api --method PATCH repos/o/r/git/refs/heads/main -f sha=abc"
expect_block "gh api -X PUT repos/o/r/contents/README.md -f message=x"
expect_block "gh api -X PUT repos/o/r/collaborators/someone"
expect_block "gh api graphql -f query=mutation"
expect_block "gh auth token"
expect_block "gh secret set BOT_TOKEN"
expect_block "gh variable set BOT_LOGIN"
expect_block "gh workflow run runner.yml"
expect_block "gh repo edit --visibility private"
expect_block 'bash -c "gh pr merge 12"'
expect_allow 'gh api repos/{owner}/{repo}/pulls -f title=x -f head=claude/issue-1-x -f base=main -F body=@/tmp/b.md'
expect_allow 'gh api "repos/{owner}/{repo}/issues?state=open&labels=status:ready&per_page=100"'
expect_allow "gh api -X POST repos/{owner}/{repo}/issues/12/labels -f labels[]=status:in-review"
expect_allow "gh api -X DELETE repos/{owner}/{repo}/issues/12/labels/status:ready"
expect_allow "gh api -X POST repos/{owner}/{repo}/issues/12/comments -f body=done"
expect_allow "gh api -X PATCH repos/{owner}/{repo}/issues/12 -f state=closed"
expect_allow "gh api repos/{owner}/{repo}/commits/abc/check-runs"
expect_allow "gh pr view 12"
expect_allow "gh auth status"

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
expect_allow "git -C . commit -m x"
expect_allow "git -C packages add ."
expect_block "git -C . push origin main"
expect_block "git -c user.name=x reset --hard"
expect_block "git --git-dir=.git rebase main"

echo " reached through a wrapper"
expect_allow 'bash -c "git commit -m x"'
expect_allow "bash -c 'cd packages; git add .'"
expect_block 'bash -c "git push origin main"'
expect_block "bash -c 'cd packages; git reset --hard'"
expect_block 'sh -c "git push"'
expect_block 'eval "git reset --hard"'
expect_block "xargs git rm"
expect_block 'python3 -c "import subprocess; subprocess.run([\"git\",\"commit\"])"'
expect_block 'node -e "require(\"child_process\").execSync(\"git commit\")"'
expect_block 'perl -e "system(\"git add .\")"'

echo " chained and env-prefixed"
expect_allow "cd packages && git add ."
expect_allow "true && git commit -m x"
expect_block "cd packages && git push origin main"
expect_block "echo hi; git reset --hard"
expect_block "true && git push --force origin claude/x"
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
