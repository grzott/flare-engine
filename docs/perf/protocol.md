# Perf Benchmark Protocol

Operational reference for the Tier-E benchmark harness (rows E1–E8) and the
A→D optimization tiers gated behind it.

---

## Tier gate definitions

Each tier ships only after the prior tier's expected uplift is confirmed on
**Pixel 6a** (primary gate) and **Galaxy A54** (secondary gate) via this
harness. Do not escalate without numbers.

| Tier | Description | Gate metric | Gate threshold |
|------|-------------|-------------|----------------|
| E (baseline) | Establish pre-optimization numbers; commit to `bench-results.ndjson` | — | — |
| A | Skia API hygiene (replace 256× drawRect, cache child shader, collapse double applyPostFx) | `shadowRebuildMs.p95` | ↓ ≥ 60% on Pixel 6a in `boss-smok-full` |
| B | GPU-side rework (analytical-SDF shadow-rim in SkSL, single composite shader) | `postfxPassMs.p95` | ↓ ≥ 40% on Pixel 6a in `boss-lucyper-z8` |
| C | Reanimated worklets (move rebuildShadowTexture to UI-thread useFrameCallback) | JS-thread p99 | ↓ ≥ 50% in `zone-transitions` |
| D | Native C++ fallback (last resort; TurboModule + Skia C++ SkRuntimeShaderBuilder) | Sustained avg fps | < 60 on Pixel 6a after A+B+C |

**Honesty rule.** If a run is noisy (AVD jitter, cold-start GC spike, CI
container throttling), discard the outlier row from `bench-results.ndjson`
rather than averaging it away — annotate the dropped row with `"dropped": true`
and a `"dropReason"` string so the omission is auditable.

---

## TestingBot cost model

No standing free tier exists. The 14-day trial is the only free path.

| Plan | Price | Automated minutes | Parallel sessions | Real devices |
|------|-------|-------------------|-------------------|--------------|
| Live (monthly) | €20/mo | 0 | 1 | Yes |
| Automated (annual) | €50/mo (billed yearly) | 1 000 min/mo | 1 | Yes |
| PAYG | €0.06/min | Unlimited | 1 | Yes |

**Recommendation:** PAYG at ~€0.06/min for the E-arc. Projected usage is
~180 min/month (3 mid-gate devices × 5 scenarios × 30 s × 4 runs/mo × 2 for
setup/teardown overhead), totalling ~€11/month. The Automated annual plan
(€50/mo) only becomes cheaper above ~833 minutes/month. The Live plan
(€20/mo) has zero automated minutes and cannot run Maestro flows — exclude it.

---

## Artifact-pull discipline

`bench-cloud.sh` defaults to `--download-artifacts failures-only`.

Use `--download-artifacts all` only in these two cases:
1. **E8 baseline capture** — full audit trail needed for the pre-A commit.
2. **First Tier-A / Tier-B landing** — confirm the perf change is real before
   merging the optimization PR.

Pulling videos + logcat on every passing green run wastes:
- Wall-clock time (TestingBot network round-trip per device: ~30–90 s).
- TestingBot artifact retention storage (standard plan: 30-day window; large
  video archives count against the limit).

On `workflow_dispatch` runs the CI workflow passes `--download-artifacts all`
**only** when the operator explicitly sets `download_artifacts: all` in the
input (see `.github/workflows/perf-bench.yml`). PR and cron triggers always
use the default `failures-only`.

---

## CI APK source

The workflow has no EAS build step and does not need `EXPO_TOKEN`.

| Trigger | APK source |
|---------|------------|
| `workflow_dispatch` | `BENCH_APK_URL` input (operator supplies at trigger time) |
| Nightly cron (`schedule`) | `vars.BENCH_APK_URL` GitHub repo variable |
| PR label `perf-bench` or path trigger | `vars.BENCH_APK_URL` GitHub repo variable |

**Required setup for cron + label triggers to work:** set `vars.BENCH_APK_URL`
in GitHub → Settings → Variables → Repository variables. Point it at the most
recent internal-distribution APK from `eas build --profile bench`. Re-update
this variable after each bench APK rebuild.

If `BENCH_APK_URL` is absent the `bench` job will error early with a clear
message rather than silently skipping — the `continue-on-error: true` flag on
the bench job (Risk 4) means the CI status stays green so a missing variable
does not block PRs.

---

## `.perf-baseline.json` schema

Located at the repo root. Loaded by `regression-check.ts` to override the
default 5% regression threshold per-device or per-scenario.

```jsonc
{
  // Global threshold multiplier (default 1.05 = 5% allowed regression)
  "threshold": 1.05,

  // Per-device overrides — keyed by devices.json `id`
  "perDevice": {
    "galaxy-a54": 1.10
  },

  // Per-scenario overrides — keyed by scenario stem (e.g. "boot", "boss-smok-full")
  "perScenario": {
    "zone-transitions": 1.08
  }
}
```

Resolution order: `perDevice` → `perScenario` → `threshold` → `DEFAULT_THRESHOLD`.

An empty `{}` is valid and uses all defaults. The file is committed at the
repo root so it is discoverable but starts empty — populate only when a
scenario has known legitimate variance.

---

## Rolling baseline window

`regression-check.ts` computes the 7-day rolling median of `p95` values for
each `device×scenario×metric` tuple. The window is configurable via
`--window-days`. The first E8 baseline run will have no prior window data;
`regression-check.ts` treats a tuple with zero historical rows as
`baselineMedian = currentP95` (ratio = 1, no regression flagged).

---

## `bench-results.ndjson` schema

One JSON object per line (NDJSON). Append-only; never edit existing rows.

```jsonc
{
  "device": "pixel-6a",          // devices.json id
  "scenario": "boss-smok-full",  // scenario stem
  "metric": "shadowRebuildMs",   // metric name from PerfReport
  "p95": 4.12,                   // p95 value in ms (or fps for frame-time)
  "capturedAt": "2026-05-24T14:30:00Z"  // ISO 8601 UTC
}
```

The `commit-back` CI job appends rows from the bench run to `bench-results.ndjson`
and commits to main only when the `bench` job succeeds and the trigger is
`refs/heads/main` (i.e., nightly cron or direct workflow_dispatch on main).
PR runs do not commit back — they check against the existing baseline only.
