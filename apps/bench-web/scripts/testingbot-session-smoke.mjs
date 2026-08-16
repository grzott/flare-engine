/**
 * testingbot-session-smoke -- the cheap entitlement smoke test for C6 Step 2
 * (docs/plans/web-bench-2026-08-tasks.md "Task C6"): opens exactly ONE real-browser session on
 * the TestingBot grid, reads back the browser identity, and quits immediately.
 *
 * Why this exists and what it does NOT answer: `testingbot-probe.mjs` (the sibling script)
 * proved the account's credentials are valid and that the public catalogue *advertises* desktop
 * Chrome -- neither proves a session will actually *start* under this plan, because catalogue and
 * account-info entitlement do not always match session-launch entitlement on cloud grids. Only
 * launching a session (or the TestingBot dashboard) settles that. This script is that one
 * launch -- and only one: it must never be wrapped in a retry loop by a caller, because every
 * session this account opens permanently consumes a small, non-renewable balance.
 *
 * Connection choice -- plain WebDriver HTTP over `fetch()`, not Playwright's `SELENIUM_REMOTE_URL`:
 * Playwright's Selenium-grid relay mode targets Selenium Grid 4's own `se:cdp` relay capability,
 * a specific Grid-4-node feature -- not something a generic cloud WebDriver hub is guaranteed to
 * implement, and it was not documented for TestingBot's hub. A plain WebDriver client over
 * `fetch()` needs no new dependency, has a transport that is fully visible and inspectable at
 * every step, and turns "did the session start" into a single HTTP status code instead of an
 * opaque Playwright connection failure -- the right shape for a one-shot, no-retry call against a
 * paid budget.
 *
 * Capability shape (verified against TestingBot's current W3C docs, 2026-08-16, not guessed):
 * `browserName: "chrome"` + `platformName` + `browserVersion` are the standard W3C fields;
 * TestingBot's vendor extension is `tb:options` (NOT `testingbot:options`), which carries `name`
 * plus `key`/`secret` as a second, redundant auth path alongside the `Authorization: Basic`
 * header every request also carries (the same header shape `testingbot-probe.mjs` already proved
 * works against the account REST API). Belt-and-suspenders on purpose: this call cannot be
 * retried if the wrong one of two documented auth mechanisms turns out to be the one TestingBot's
 * hub actually honors.
 *
 * Every command carries a hard per-request timeout, and the session is deleted in a `finally` no
 * matter how the run ends, so a mid-sequence failure cannot strand a live (billable) session
 * beyond this process's own bounded run.
 *
 * Usage:
 *   node --env-file=apps/bench-web/.env.testingbot apps/bench-web/scripts/testingbot-session-smoke.mjs
 *
 * Exit codes: 0 = a session opened, the browser identity was read back, and it was closed
 * cleanly · 1 = missing credentials, or any step failed (reported, not retried).
 *
 * This script never prints, logs, writes, or caches TESTINGBOT_KEY/TESTINGBOT_SECRET: `wd()`
 * below only ever logs the parsed response, never the request `body` that carries them.
 */
import { Buffer } from 'node:buffer';

const HUB_URL = 'https://hub.testingbot.com/wd/hub';
/** A trivial same-origin-free page: no server, no localhost reachability required -- this smoke
 *  test exists specifically to answer the entitlement question without depending on the app's
 *  dev server being reachable from TestingBot's cloud (a separate, unresolved question). */
const NAVIGATE_URL = 'data:text/html,<title>flare-engine bench-web smoke</title>';
const SESSION_NAME = 'flare-engine bench-web entitlement smoke (C6 stage 1)';
const REQUEST_TIMEOUT_MS = 30_000;

/** @param {string[]} missing */
function missingCredentialsMessage(missing) {
  return [
    `testingbot-session-smoke: missing required environment variable(s): ${missing.join(', ')}.`,
    '',
    '  node --env-file=apps/bench-web/.env.testingbot apps/bench-web/scripts/testingbot-session-smoke.mjs',
    '',
    'Credentials are read from the environment only, for the lifetime of this process -- this',
    'script never prints, logs, writes, or caches them anywhere.',
  ].join('\n');
}

function readCredentials() {
  const key = process.env.TESTINGBOT_KEY;
  const secret = process.env.TESTINGBOT_SECRET;
  const missing = [];
  if (!key) missing.push('TESTINGBOT_KEY');
  if (!secret) missing.push('TESTINGBOT_SECRET');
  if (missing.length > 0 || !key || !secret) {
    console.error(missingCredentialsMessage(missing));
    return null;
  }
  return { key, secret };
}

/** @param {string} key @param {string} secret */
function buildAuthHeader(key, secret) {
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

/**
 * One WebDriver HTTP command. Never logs `body` (it may carry credentials via `tb:options`) --
 * only ever logs the parsed, already-sanitized response.
 * @param {'POST' | 'DELETE'} method
 * @param {string} path
 * @param {{ key: string, secret: string }} credentials
 * @param {unknown} [body]
 */
async function wd(method, path, credentials, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(`${HUB_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: buildAuthHeader(credentials.key, credentials.secret),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`network error calling ${method} ${path}: ${reason}`);
    }

    const text = await response.text();
    /** @type {unknown} */
    let data;
    try {
      data = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        `${method} ${path} returned HTTP ${response.status} with a non-JSON body: ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      const value =
        data !== null && typeof data === 'object'
          ? /** @type {Record<string, unknown>} */ (data).value
          : undefined;
      const message =
        value !== null && typeof value === 'object'
          ? /** @type {Record<string, unknown>} */ (
              value.message ?? /** @type {Record<string, unknown>} */ (value).error
            )
          : undefined;
      throw new Error(
        `${method} ${path} returned HTTP ${response.status} ${response.statusText}${message ? `: ${message}` : ''}`,
      );
    }

    return /** @type {{ value?: unknown, sessionId?: string }} */ (data ?? {});
  } finally {
    clearTimeout(timer);
  }
}

/** @param {{ key: string, secret: string }} credentials */
async function createSession(credentials) {
  const body = {
    capabilities: {
      alwaysMatch: {
        browserName: 'chrome',
        browserVersion: 'latest',
        platformName: 'WIN11',
        'tb:options': {
          name: SESSION_NAME,
          key: credentials.key,
          secret: credentials.secret,
        },
      },
    },
  };
  const created = await wd('POST', '/session', credentials, body);
  const value = /** @type {Record<string, unknown> | undefined} */ (
    created.value && typeof created.value === 'object' ? created.value : undefined
  );
  const sessionId =
    (typeof value?.sessionId === 'string' ? value.sessionId : undefined) ?? created.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error(`session creation response carried no sessionId: ${JSON.stringify(created)}`);
  }
  const capabilities =
    value?.capabilities && typeof value.capabilities === 'object' ? value.capabilities : {};
  return { sessionId, capabilities: /** @type {Record<string, unknown>} */ (capabilities) };
}

async function main() {
  const credentials = readCredentials();
  if (credentials === null) {
    process.exitCode = 1;
    return;
  }

  const t0 = Date.now();
  console.log(`testingbot-session-smoke: opening ONE session on ${HUB_URL} (browserName=chrome)`);

  let session;
  try {
    session = await createSession(credentials);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`testingbot-session-smoke: session creation FAILED -- ${reason}`);
    console.error('testingbot-session-smoke: STOPPING. This script does not retry.');
    process.exitCode = 1;
    return;
  }

  console.log(`testingbot-session-smoke: session opened -- sessionId=${session.sessionId}`);
  console.log(`  capabilities reported: ${JSON.stringify(session.capabilities)}`);

  let userAgent = null;
  let stepError = null;
  try {
    await wd('POST', `/session/${session.sessionId}/url`, credentials, { url: NAVIGATE_URL });
    console.log('testingbot-session-smoke: navigated to the smoke data: URL');

    const uaResult = await wd('POST', `/session/${session.sessionId}/execute/sync`, credentials, {
      script: 'return navigator.userAgent;',
      args: [],
    });
    userAgent = typeof uaResult.value === 'string' ? uaResult.value : null;
    console.log(`testingbot-session-smoke: navigator.userAgent = ${userAgent ?? '(not a string)'}`);
  } catch (err) {
    stepError = err instanceof Error ? err.message : String(err);
    console.error(`testingbot-session-smoke: FAILED after session open -- ${stepError}`);
  } finally {
    try {
      await wd('DELETE', `/session/${session.sessionId}`, credentials, undefined);
      console.log('testingbot-session-smoke: session closed');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        `testingbot-session-smoke: WARNING -- session delete failed (${reason}); it will expire on ` +
          "TestingBot's own idle timeout rather than staying open indefinitely.",
      );
    }
  }

  const elapsedMs = Date.now() - t0;
  console.log(`testingbot-session-smoke: elapsed ${elapsedMs}ms`);

  if (stepError !== null || userAgent === null) {
    process.exitCode = 1;
    return;
  }

  console.log(
    'testingbot-session-smoke: PASSED -- a real Chrome session started under this plan, was ' +
      'driven, and closed cleanly.',
  );
}

main().catch((err) => {
  const reason = err instanceof Error ? err.message : String(err);
  console.error(`testingbot-session-smoke: unexpected error -- ${reason}`);
  process.exitCode = 1;
});
