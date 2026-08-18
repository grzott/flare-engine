# bench-web

Headless CanvasKit runner for the render microbench suite, driven by Playwright
(`bun run bench:web`, see `scripts/run.ts`). Private app, not published.

## On-device Android lane

`bun run bench:web:android` runs the same 18 render scenarios on a USB-attached Android phone and
writes `benchmarks/results/web-android.json` + `web-android-history.ndjson`.

**Requirements**

- Exactly one device listed as `device` in `adb devices`. The lane refuses zero, and refuses to pick
  between several — a capture that silently chose a phone has provenance nobody can check. States
  other than `device` (`unauthorized`, `offline`, `no permissions`) are ignored, so an unaccepted RSA
  prompt reads as "no device" up front rather than failing mid-capture.
- USB debugging enabled and the RSA prompt accepted.
- Screen unlocked for the whole run (roughly a minute).

**How it connects.** The bench server runs on the host; `adb reverse tcp:<port> tcp:<port>` makes
`localhost:<port>` on the phone resolve back to it. The driver then attaches to the phone's Chrome
through its `@chrome_devtools_remote` abstract socket via `adb forward` + `connectOverCDP`.

Chrome is **attached to, never launched.** `playwright._android`'s `launchBrowser()` was tried first
and hangs indefinitely against retail Chrome here. Because the browser belongs to whoever is holding
the phone, the driver closes only the page it opened; the CDP session close leaves Chrome running
with its pid intact (verified on-device). Both adb tunnels are removed on the way out, including
after a failure.

**Provenance comes from the hardware.** `ro.product.model` / `ro.product.device` / `ro.soc.model` /
`ro.build.version.release` are read via `getprop` at capture time and recorded on every row, so a
capture names the phone it actually ran on. The driver also refuses to write a result whose
`UNMASKED_RENDERER_WEBGL` reads as a software rasterizer — the same guard the desktop GPU lane uses.

**Known flake:** Bun can panic with `integer overflow` during process teardown after a run
completes. Observed once in two runs; it is a Bun bug (its own crash message says so), it happens
*after* every result file is written, and re-running is clean. If the exit code is non-zero, check
whether the three result files were written before assuming the capture was lost.

## TestingBot probe

`scripts/testingbot-probe.mjs` verifies the owner's TestingBot account/plan/device catalogue
**before** any TestingBot CI workflow, device matrix, or scenario wiring is written — the
required first step per `docs/plans/perf-measurement-2026-07.md` §11.7 (the "B21 ordering"): a
previous device lane in this project failed at exactly this step, silently, for eleven days.

The account is known to cover native Android device runs (used by a different repo). What is
unknown, and what this script answers, is whether the same account's plan also covers
real-browser (Selenium/WebDriver) automation — desktop and mobile — which bench-web needs.

Run it with Node (not Bun):

```
$env:TESTINGBOT_KEY="<your-testingbot-key>"
$env:TESTINGBOT_SECRET="<your-testingbot-secret>"
node apps/bench-web/scripts/testingbot-probe.mjs
```

It runs two checks, because one endpoint cannot answer the B21 question alone:

1. `GET /v1/browsers` — the public browser/device catalogue. TestingBot documents this as its
   one *unauthenticated* endpoint, confirmed directly (an unfiltered request 200s with or
   without valid credentials). Classifies the returned records into desktop browsers / mobile
   browsers (with a real-hardware sub-count) / native-device-only entries, prints a short
   sample, and reports whether Chrome is present. This proves the grid *advertises* these
   browsers — it does **not** prove the account can use them.
2. `GET /v1/user` — genuinely auth-gated (401 without valid credentials). A 401 here with
   credentials set means the key/secret pair is wrong, distinct from a network failure. A 200
   means the credentials are valid for this account; the response is inspected generically
   (every top-level field listed, anything key/secret/password/token/auth-named redacted
   unconditionally) since its real shape has never been observed by this script, and any
   field that looks plan/entitlement-related by name is called out — or the script says
   plainly that plan tier is not exposed, rather than guessing.

The final verdict keeps these three claims separate: what the public catalogue proves, what the
authenticated call proves, and what neither proves — that a real-browser session will actually
start under this plan, which only the TestingBot dashboard or one real session launch can settle.

Credentials are read from `TESTINGBOT_KEY` / `TESTINGBOT_SECRET` in the environment only; the
script never prints, logs, writes, or caches them anywhere. See the file's header comment for
the full investigation notes (the `?type=` query param, the catalogue's actual record shape, the
real-vs-emulated-device distinction, and the sensitive-field redaction rule).
