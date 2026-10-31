#!/usr/bin/env bash
# Runs Claude Code as the agent bot: commits are authored by the bot, and pushes and `gh` calls use
# the bot's token instead of the owner's. Reads ~/.config/flare-bot/env (created by the owner, never
# committed): BOT_LOGIN, BOT_NAME, BOT_EMAIL, GH_CONFIG_DIR.
#
# Usage: scripts/runner/claude-as-bot.sh [claude args...]
set -eu

ENV_FILE="${FLARE_BOT_ENV:-$HOME/.config/flare-bot/env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "claude-as-bot: $ENV_FILE is missing (see the A2 plan, Task 1 Step 5)" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a
: "${BOT_LOGIN:?}" "${BOT_NAME:?}" "${BOT_EMAIL:?}" "${GH_CONFIG_DIR:?}"

export GIT_AUTHOR_NAME="$BOT_NAME" GIT_COMMITTER_NAME="$BOT_NAME"
export GIT_AUTHOR_EMAIL="$BOT_EMAIL" GIT_COMMITTER_EMAIL="$BOT_EMAIL"

# Command-scope git config: reset the owner's credential helper, then let gh (pointed at the bot's
# config dir) answer git's credential requests.
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0=
export GIT_CONFIG_KEY_1=credential.helper GIT_CONFIG_VALUE_1='!gh auth git-credential'

exec claude "$@"
