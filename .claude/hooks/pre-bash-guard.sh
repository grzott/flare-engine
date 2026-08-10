#!/usr/bin/env bash
# PreToolUse (Bash) guard - blocks state-changing git and non-bun package managers.
#
# Defense in depth: settings.json `deny` is the primary gate; this hook catches the
# variants a prefix matcher misses.
#
# 2026-08-09 rewrite. The previous version was a `case` over start-anchored globs
# naming seven git verbs. An audit walked through it four ways:
#   bash -c 'git commit -m x'   -> allowed (wrapper hid the verb)
#   eval "git commit -m x"      -> allowed (same)
#   git -C . commit -m x        -> allowed (global option displaced the verb)
#   git revert / cherry-pick / rm / restore / stash -> allowed (never named)
# A blocklist of verbs can only refuse the verbs someone remembered to write down,
# so this is now an ALLOWLIST of read-only git subcommands: anything not proven
# read-only is refused, and a git call reached through a wrapper is unwrapped first.
#
# Protocol: exit 0 -> allow. Non-zero exit + stderr message -> block with that reason.
set -u

INPUT=$(cat)

VERDICT=$(printf '%s' "$INPUT" | python3 -c '
import json, re, shlex, sys

RAW = sys.stdin.read()

def emit(reason):
    print(reason)
    sys.exit(0)

if not RAW.strip():
    sys.exit(0)

try:
    CMD = json.loads(RAW).get("tool_input", {}).get("command", "") or ""
except Exception:
    # Fail CLOSED. The old hook swallowed a parse error and allowed the call,
    # which made every rule below advisory whenever the payload shape changed.
    emit("could not parse the tool payload - refusing rather than guessing")

if not CMD.strip():
    sys.exit(0)

# Read-only git subcommands. Everything absent from this set is treated as
# state-changing, including subcommands git has not shipped yet.
GIT_READONLY = {
    "status", "diff", "log", "show", "blame", "annotate", "rev-parse", "rev-list",
    "ls-files", "ls-tree", "ls-remote", "cat-file", "describe", "shortlog", "grep",
    "for-each-ref", "name-rev", "merge-base", "diff-tree", "diff-index", "show-ref",
    "var", "check-ignore", "check-attr", "count-objects", "cherry",
    "range-diff", "verify-commit", "verify-tag", "whatchanged", "version", "help",
}
# Read-only only in certain shapes. A bare `git branch` lists; `git branch foo` creates.
GIT_CONDITIONAL = {
    "branch": re.compile(r"^(-a|-r|-v|-vv|-av|-rv|--list|--all|--remotes|--verbose|--show-current|--contains|--no-contains|--merged|--no-merged|--points-at|--sort|--format|--color|--column)\b"),
    "tag": re.compile(r"^(-l|--list|-n\d*|--contains|--no-contains|--merged|--no-merged|--points-at|--sort|--format|--color|--column)\b"),
    "config": re.compile(r"^(--get|--get-all|--get-regexp|--get-urlmatch|-l|--list|--show-origin|--show-scope)\b"),
    "remote": re.compile(r"^(-v|--verbose|show|get-url)\b"),
    "stash": re.compile(r"^(list|show)\b"),
    "notes": re.compile(r"^(list|show)\b"),
    "worktree": re.compile(r"^(list)\b"),
    "submodule": re.compile(r"^(status|summary)\b"),
    "bisect": re.compile(r"^(log|view|visualize)\b"),
    "reflog": re.compile(r"^(show)\b"),
    # `fetch` looks read-only and is not. `git fetch origin main:sidebranch` creates
    # a local ref, and `git fetch --prune` deletes remote-tracking refs. It sat in
    # the read-only set above until a review probe walked through it on 2026-08-09.
    "fetch": re.compile(r"^--dry-run\b"),
    # `git symbolic-ref HEAD refs/heads/x` repoints HEAD. Only the read form is safe.
    "symbolic-ref": re.compile(r"^(-q\s+)?(--short\s+)?[A-Za-z_/-]+\s*$"),
}
# Conditionals whose BARE form still writes. `git stash` with no argument pushes a
# stash and bare `git fetch` updates remote-tracking refs; `git branch` with no
# argument only lists.
GIT_BARE_UNSAFE = {"stash", "fetch"}
# git global options that sit between `git` and the subcommand.
GIT_OPT_WITH_VALUE = {"-C", "-c", "--exec-path", "--git-dir", "--work-tree", "--namespace", "--config-env"}
GIT_OPT_BARE = {"-P", "--no-pager", "--paginate", "--bare", "--literal-pathspecs",
                "--no-replace-objects", "--no-optional-locks", "--icase-pathspecs",
                "--glob-pathspecs", "--noglob-pathspecs"}

FORBIDDEN_PM = {"npm", "npx", "yarn", "pnpm"}

# Commands whose quoted payload is another command, and which therefore have to be
# unwrapped before any of the above means anything.
WRAPPER_FLAG = {
    "bash": {"-c"}, "sh": {"-c"}, "zsh": {"-c"}, "dash": {"-c"}, "ksh": {"-c"},
    "python": {"-c"}, "python3": {"-c"}, "py": {"-c"},
    "node": {"-e", "--eval", "-p", "--print"}, "bun": {"-e", "--eval"},
    "perl": {"-e", "-E"}, "ruby": {"-e"}, "php": {"-r"},
}
WRAPPER_ALL_ARGS = {"eval", "exec", "xargs", "nohup", "time", "sudo", "doas", "command",
                    "nice", "ionice", "stdbuf", "watch", "timeout", "env", "setsid"}
# Wrappers whose payload is a general-purpose language rather than shell.
INTERPRETER = {"python", "python3", "py", "node", "bun", "perl", "ruby", "php"}

def split_segments(text):
    """Split a shell string into command segments at operators and command-substitution
    boundaries, WITHOUT splitting inside quotes.

    Quote-awareness is the whole point. A naive split on `;` cuts
    `python3 -c "import os; os.system(...)"` in half and the payload is never seen
    as a payload.

    Correction 2026-08-10: an earlier version of this docstring said that was
    "exactly how the previous guard was walked through". It was not. The previous
    guard did no splitting at all - it was a `case` over substring globs
    (`*"; git commit"*`), so it never inspected an interpreter payload in the
    first place: python3 -c "import os; os.system(...git commit...)" matched none
    of its patterns and exited 0. Quote-aware splitting is what makes the payload
    check below reachable; it is not a fix for a bug the old hook had.

    NOTE: this whole program is embedded in a single-quoted shell string. A
    literal apostrophe anywhere in it - including in a comment or docstring -
    terminates that string and silently corrupts the guard. Adding one here on
    2026-08-10 broke 26 of the 72 contract cases, including `git status`.
    """
    out, buf = [], []
    i, n = 0, len(text)
    sq = dq = False
    while i < n:
        c = text[i]
        if c == chr(92) and not sq and i + 1 < n:      # backslash escape
            buf.append(c)
            buf.append(text[i + 1])
            i += 2
            continue
        if c == chr(39) and not dq:                     # single quote
            sq = not sq
            buf.append(c)
            i += 1
            continue
        if c == chr(34) and not sq:                     # double quote
            dq = not dq
            buf.append(c)
            i += 1
            continue
        if not sq and not dq:
            two = text[i:i + 2]
            if two in ("&&", "||", ";;"):
                out.append("".join(buf)); buf = []; i += 2; continue
            if two == "$(":
                out.append("".join(buf)); buf = []; i += 2; continue
            if c in ";|&\n()" or c == chr(96):
                out.append("".join(buf)); buf = []; i += 1; continue
        buf.append(c)
        i += 1
    out.append("".join(buf))
    return [s.strip() for s in out if s.strip()]

def tokens(seg):
    try:
        return shlex.split(seg, posix=True)
    except ValueError:
        # Unbalanced quotes. Fall back to whitespace splitting with quotes stripped,
        # so a malformed command cannot slip past by being malformed.
        q = chr(34) + chr(39)
        return [t.strip(q) for t in seg.split() if t.strip(q)]

def basename(tok):
    return re.split(r"[\\\\/]", tok)[-1]

def check_git(args):
    """args = everything after the `git` token."""
    i = 0
    while i < len(args):
        a = args[i]
        if a in GIT_OPT_WITH_VALUE:
            i += 2
            continue
        if any(a.startswith(o + "=") for o in GIT_OPT_WITH_VALUE):
            i += 1
            continue
        if a in GIT_OPT_BARE:
            i += 1
            continue
        if a.startswith("-C") and len(a) > 2:
            i += 1
            continue
        if a.startswith("-c") and len(a) > 2:
            i += 1
            continue
        break
    if i >= len(args):
        return None  # bare `git`, prints usage
    sub = args[i]
    rest = " ".join(args[i + 1:])
    if sub in GIT_READONLY:
        return None
    if sub in GIT_CONDITIONAL:
        if not rest.strip():
            if sub in GIT_BARE_UNSAFE:
                return "bare %r writes repo state" % ("git " + sub)
            return None
        if GIT_CONDITIONAL[sub].match(rest.strip()):
            return None
        return "git %s %s writes repo state" % (sub, rest.strip().split()[0])
    return "git subcommand %r is not on the read-only allowlist" % sub

def walk(seg, depth=0):
    if depth > 6:
        return None
    tok = tokens(seg)
    if not tok:
        return None
    # Peel leading VAR=value assignments.
    while tok and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", tok[0]):
        tok = tok[1:]
    if not tok:
        return None
    head = basename(tok[0])
    args = tok[1:]

    if head in WRAPPER_ALL_ARGS:
        # Re-analyse everything that follows as a command in its own right.
        for a in args:
            for sub in split_segments(a):
                r = walk(sub, depth + 1)
                if r:
                    return r
        return walk(" ".join(args), depth + 1) if args else None

    if head in WRAPPER_FLAG:
        flags = WRAPPER_FLAG[head]
        for j, a in enumerate(args):
            if a in flags and j + 1 < len(args):
                payload = args[j + 1]
                for sub in split_segments(payload):
                    r = walk(sub, depth + 1)
                    if r:
                        return r
                # A shell payload can be parsed as shell. A python/node/perl payload
                # cannot - `subprocess.run(["git","commit"])` is not a shell command,
                # so the walk above sees nothing. Deciding what arbitrary code will
                # execute is undecidable, so the rule is coarse on purpose: an
                # interpreter payload may not mention git at all.
                if head in INTERPRETER and re.search(r"\bgit\b", payload):
                    return "%s payload mentions git - run git directly so the guard can read it" % head
        # A wrapper invoked without its eval flag is an ordinary command.

    if head == "git":
        return check_git(args)

    if head in FORBIDDEN_PM:
        return "this is a bun-only project - use bun equivalents (saw %r)" % head

    if head == "rm":
        joined = " ".join(args)
        if re.search(r"(^|\s)(/|~|\$HOME)(\s|$)", joined) or "--no-preserve-root" in joined:
            return "destructive rm against a root or home path"

    return None

for segment in split_segments(CMD):
    reason = walk(segment)
    if reason:
        emit(reason)

sys.exit(0)
' 2>/dev/null)

# If python3 is unavailable the guard cannot reason about the command. Refuse rather
# than allow: an unenforced rule is the failure mode this hook exists to prevent.
if [ $? -ne 0 ] && [ -z "$VERDICT" ]; then
  echo "BLOCKED by .claude/hooks/pre-bash-guard.sh: guard could not run (python3 missing?)" >&2
  echo "Rationale: this hook fails closed - fix the guard rather than bypassing it." >&2
  exit 2
fi

if [ -n "$VERDICT" ]; then
  echo "BLOCKED by .claude/hooks/pre-bash-guard.sh: $VERDICT" >&2
  echo "Rationale: repo contract - agents produce paste-ready commit blocks; the user runs them." >&2
  echo "Read-only git is allowed (status, diff, log, show, rev-parse, ls-files, ...)." >&2
  exit 2
fi

exit 0
