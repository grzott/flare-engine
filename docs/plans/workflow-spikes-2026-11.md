# Agent PR workflow: spikes and pilot (2026-11)

Results for [A2](a2-agent-workflow-2026-11-tasks.md): the Task 7 spikes (S1 Bun in a cloud session,
S3 phone approval under Remote Control, S5 the identity of a cloud-session PR) and the Task 9 pilot.
The spikes have not run yet. Their sections land here when they do.

## Pilot (Task 9)

Milestone `Workflow pilot` (due 2026-11-09), phase issue #22, run 2026-11-02 to 2026-11-03. The
three planned issues went through the chain: P1 #23, P2 #24 and P3 #25. A fourth, #26, joined
mid-pilot: Dependabot's #21 had merged two CLI dependency majors with no changeset, and
`check:changeset` counts only `src/**`.

| Step | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Milestone, phase issue, `status:ready` issues | Pass | milestone 1, #22, #23–#26 |
| 2 | P1, workstation on: bot-authored, `ci` and `risk-gate` ran, review comment carries a verdict marker, `risk:auto`, merges by itself, branch deleted | Pass | #27 from the local `loop.sh`: opened 15:55, auto-merged 16:01, no `claude/*` branch left on origin |
| 3 | P2, workstation off: `runner.yml` opens it and it merges by itself | Partial | #32, opened by the scheduled run 41552182335 after #28–#31. `ci` failed `check:perf-bytes` on the CLI size ceiling. Raising a ceiling is an owner edit, and the owner commit made the PR held. The approval then stuck behind a stale check suite until #34. Merged by auto-merge after approval |
| 4 | Concurrency: a runner that starts while a bot PR is open opens nothing | Pass, `runner.yml` side | scheduled run 41633674511 started while #42 was open: probe `inflight`, session skipped. The local `loop.sh` variant was not run. One false positive was found and fixed: the version PR counted as in flight (#37) |
| 5 | Held tap: `risk:held` and a review request, one approval, merge, runner prints `QUEUE EMPTY`, phase comment | Pass after fixes | #36: held, review requested, approved, merged 45 s later. The chain then stalled on #35 (#37) and on #26 (#39–#41). Run 41634078285 after #42 printed `RUNNER: QUEUE EMPTY`, commented `phase Workflow pilot complete` on #22 and closed it |
| 6 | Fork PR: no statuses, nothing fails loudly | Not run | |
| 7 | A bot push to `main` is rejected by the ruleset | Not run | |

The release path ran as well. `release.yml` opened the version PR #35 as the bot. Since #38 its
`ci` and `gate` runs report on every re-push instead of waiting at `action_required`.

### Incidents fixed on the way

| PR | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| #28 | Two runners could take one issue; PR bodies outside the repo were refused | No claim staleness rule; temp files outside the workspace | A claim counts as stale after 2 h; the PR body goes to a gitignored file in the repo |
| #29–#31 | The workstation-off runner ended "success" with 10–14 permission denials and never claimed #24 | A fresh Actions checkout is an untrusted folder: Claude Code runs the project's hooks but ignores its `permissions.allow`. The hand-written tool list was also narrower, and unquoted, so rules with a space split | Pass `.claude/settings.json` allow and deny lists as quoted CLI flags, which trust does not gate; send the literal `/start next` |
| #33 | #32 failed `check:perf-bytes` only after the PR was open; a held PR and a broken PR both showed a bare red check | `verify.sh` had no size check; the gate printed no reason | `check:perf-bytes` in `verify.sh`; gate annotations "Held", "Blocked", "Waiting" |
| #34 | An owner approval left held PRs blocked (#19–#21, #32) | The review event started a second `gate` run. The first run's failed `risk-gate` on the same commit kept the required check red | `gate-review.yml` re-runs the PR's own `risk-gate` job |
| #37 | The runner skipped every run after #36 | The in-flight probe counted the bot's version PR #35 | Only bot PRs on `claude/*` branches count |
| #38 | #35's checks sat at `action_required` after its first update | `actions/checkout` persisted the default token as an HTTP header that overrode the bot's `.netrc`, so the push came from `github-actions[bot]` | `persist-credentials: false` |
| #39–#41 | The runner claimed #26 and stopped silently three times: no branch, no comment, no sentinel | `Bash(bun run check:*)` is a word-boundary prefix and never matches `check:bump`. The session also used compound commands with `echo`, and ended its turn on a question. Then the gate outlived Bash's 2-minute timeout, moved to the background and died with the headless turn | Block the issue on any stop and print the denied calls and the last message (#39); one command per call, no questions in runner mode (#40); `check*` rules and `BASH_DEFAULT_TIMEOUT_MS=900000` (#41) |
| #44, #45 | The runner's gate for #26 was red at `test` on three iap-revenuecat tests | claude-code-action installs its own Bun 1.4.4 into the same `~/.bun/bin` as the 1.3.11 pin, and the tests counted two microtask ticks after a dynamic import | The tests wait on the listener; the runner puts the pinned Bun first on the session's PATH, and `verify.sh` fails first on a Bun mismatch |

### Verdict

The chain works end to end. An auto-class PR merges with no owner action (#27, #42). A held PR needs
exactly one approval (#36). The workstation-off runner opens PRs and chains on merges (#32, #42).
Between the first issue and the last, the pilot needed 13 fix PRs (#28–#31, #33, #34, #37–#41,
#44, #45). Each fix came from a log that the previous fix made readable.

Still open:

- Steps 6 and 7 (fork PR, bot push to `main`).
- The runner Bun pin (#45) is unproven until the next runner session that runs the gate.
- `/start` never removes `status:in-review`, so closed issues keep it (#23–#26).
- Every PR from the owner's own session is held as "not authored by the agent bot" and merges with
  the admin bypass, even when the classifier alone would say auto.
