# bench-web

Headless CanvasKit runner for the render microbench suite, driven by Playwright
(`bun run bench:web`, see `scripts/run.ts`). Private app, not published.

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
