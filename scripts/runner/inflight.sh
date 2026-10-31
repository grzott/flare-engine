#!/usr/bin/env bash
# Prints `free`, `inflight` or `blocked` for the agent bot's open PR, without starting a Claude
# session — loop.sh polls this while it waits. `blocked` means the PR will not merge on its own:
# `ci` failed, or `risk-gate` failed on a `risk:auto` PR (the review asked for changes or gave no
# verdict). A `risk:held` PR waiting for the owner is `inflight`.
set -u

ENV_FILE="${FLARE_BOT_ENV:-$HOME/.config/flare-bot/env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
: "${BOT_LOGIN:?BOT_LOGIN is not set}"

pr=$(gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100" --jq \
  "first(.[] | select(.user.login == \"$BOT_LOGIN\")) | [.number, .head.sha, ([.labels[].name] | join(\",\"))] | @tsv")
if [ -z "$pr" ]; then
  echo free
  exit 0
fi

sha=$(printf '%s' "$pr" | cut -f2)
labels=$(printf '%s' "$pr" | cut -f3)
failed=$(gh api "repos/{owner}/{repo}/commits/$sha/check-runs" --jq \
  '.check_runs[] | select(.conclusion == "failure") | .name')

if printf '%s\n' "$failed" | grep -qx ci; then
  echo blocked
elif printf '%s\n' "$failed" | grep -qx risk-gate && printf '%s' "$labels" | grep -q 'risk:auto'; then
  echo blocked
else
  echo inflight
fi
