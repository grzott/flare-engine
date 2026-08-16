/**
 * testingbot-probe -- TestingBot account/plan/device-catalogue verification.
 *
 * Why this exists: docs/plans/perf-measurement-2026-07.md §11.7 (PERF-7, "B21 ordering")
 * requires verifying the TestingBot account/plan/device catalogue BEFORE any CI workflow,
 * device matrix, or scenario wiring gets written -- a previous device lane in this project
 * (B3/B21, Pan Tvardowski's native-Android cron) failed at exactly that step, silently, for
 * eleven days, masked green by `continue-on-error`. This script is that verification step
 * for the *browser* lane: the owner's TestingBot account is known to cover native Android
 * device runs (used by a different repo); whether the same account's plan also covers
 * real-browser (Selenium/WebDriver) automation -- desktop and mobile -- is unknown, and this
 * is the definitive check. It does not write a workflow, a device matrix, or any CI wiring;
 * that is deliberately out of scope until this question has an answer.
 *
 * Usage:
 *   $env:TESTINGBOT_KEY="<your-testingbot-key>"
 *   $env:TESTINGBOT_SECRET="<your-testingbot-secret>"
 *   node apps/bench-web/scripts/testingbot-probe.mjs
 *
 * Exit codes: 0 = both checks below completed AND the credentials proved valid · 1 = missing
 * credentials, invalid credentials, an HTTP error from either endpoint, a network failure, or
 * an unexpected response shape.
 *
 * --- Two checks, because one endpoint cannot answer the B21 question alone ---
 *
 * 1. `GET /v1/browsers` (unauthenticated in practice -- see caveat below): the public browser
 *    catalogue. Proves the grid *advertises* desktop and mobile browsers, including Chrome.
 *    Does NOT prove this account can use them.
 * 2. `GET /v1/user`: genuinely auth-gated (verified: no credentials, and deliberately wrong
 *    credentials, both return HTTP 401 with the identical body
 *    `{"error":"401 Unauthorized. Please supply the correct API key and API secret"}`). A 401
 *    here with real credentials set means the key/secret pair is wrong -- a distinct,
 *    unambiguous failure from a network error. A 200 means the credentials are valid for this
 *    account, and the response body is account/plan data -- inspected generically below, since
 *    its shape was never observed (no valid credentials were available while writing this).
 *
 * Neither check can prove a real-browser *session* will actually start under this plan --
 * catalogue-list and account-info entitlement do not always match session-launch entitlement
 * on cloud grids. Only launching one session (or reading the TestingBot dashboard) settles
 * that, and this script deliberately does not attempt it.
 *
 * --- Investigation notes (recorded here, not assumed) ---
 *
 * `?type=` filter on `/v1/browsers`: the API DOES validate a `type` query parameter
 * server-side (an unfiltered request 200s; `?type=<anything>` tried below all 400 with
 * `{"error":"type does not have a valid value"}`) but its accepted enum is undocumented and
 * was not discoverable by probing common candidates (`browser`, `mobile`, `desktop`, `device`,
 * `app`, `appium`, `real`, `selenium`, `web`, `native`, `ios`, `android`, `automate`, `live`,
 * `manual`, `realdevice`, `simulator`, `emulator`, `all`, `grid`, `screenshot`, `visual`,
 * `api`, `chrome`, `firefox`, `safari`, `edge`, `tablet`, `phone`). This script deliberately
 * omits `type` and fetches the unfiltered list, then classifies client-side from the fields
 * the records actually carry -- per the task, not an assumed filter value.
 *
 * Record shape (verified against a live response, 2026-08-16): every record carries
 * `selenium_name`, `name`, `platform`, `browser_id`, `version`, `long_version`. Records for a
 * mobile browser context additionally carry `deviceName` (e.g. "Pixel 9", "iPhone 12") and
 * `platformName` ("Android" | "iOS"); desktop entries carry neither. Desktop Chrome is named
 * `googlechrome`, not `chrome` -- `chrome` is the mobile-Android browser name. Every record
 * observed carried a usable `name`/`selenium_name`, i.e. this endpoint is the WebDriver
 * browser-grid catalogue specifically; a genuinely native-app-only device slot (no browser
 * identity at all) was never seen but is classified for defensively below, in case an
 * account-scoped response ever differs from the shape above.
 *
 * Real vs. emulated mobile devices: `deviceName` alone does not mean real hardware -- the
 * SAME device name appears under both `platform: "ANDROID"` (emulator) and
 * `platform: "REAL_ANDROID"` (physical device) in the live catalogue, e.g. "Pixel 9" appears
 * as both. Only a `platform` value starting with `REAL_` is treated as confirmed physical
 * hardware below; `deviceName` by itself is not (verified against the full 5,273-record
 * catalogue, not a single sample, precisely because a single sample was misleading here once).
 *
 * IMPORTANT caveat this script's verdict repeats: TestingBot's own docs state `/v1/browsers`
 * is the one endpoint that does NOT require authentication, and that was confirmed directly --
 * a request with deliberately invalid Basic-auth credentials returned the identical HTTP 200
 * catalogue as a request with none, and also as no `Authorization` header at all. A successful
 * response here proves the catalogue exists and lists these browsers; it does NOT by itself
 * prove this account's paid plan is entitled to *start a session* against them -- entitlement
 * on cloud grids like this is commonly enforced at session launch, not at catalogue-list time.
 * This is exactly why check 2 (`/v1/user`) exists: it is the one call in this script that
 * actually depends on the credentials being right.
 *
 * Sensitive-field handling: the `/v1/user` response shape is unknown (no valid credentials
 * were available to observe a real 200 body). Some account-info APIs echo the caller's own API
 * key back as a field. Every value under a key name that looks like `key`/`secret`/`password`/
 * `token`/`auth` (case-insensitive) is redacted before anything is printed, unconditionally --
 * see `redact()`. This does not depend on knowing the real field names in advance.
 */
import { Buffer } from 'node:buffer';

const BROWSERS_URL = 'https://api.testingbot.com/v1/browsers';
const USER_URL = 'https://api.testingbot.com/v1/user';
const MAX_SAMPLE_LINES = 10;
const SENSITIVE_FIELD_PATTERN = /key|secret|password|token|auth/i;
const ENTITLEMENT_FIELD_PATTERN =
  /plan|subscription|package|tier|concurren|trial|limit|quota|seat|session|device|browser|selenium|real|credit|status|active|expire/i;

/**
 * @typedef {{
 *   selenium_name?: string,
 *   name?: string,
 *   platform?: string,
 *   browser_id?: number,
 *   version?: string | number,
 *   long_version?: string | number | null,
 *   deviceName?: string,
 *   platformName?: string,
 * }} CatalogueRecord
 */

/**
 * @typedef {{
 *   total: number,
 *   desktop: CatalogueRecord[],
 *   mobile: CatalogueRecord[],
 *   mobileRealDevice: CatalogueRecord[],
 *   nativeOnly: CatalogueRecord[],
 *   unclassified: CatalogueRecord[],
 * }} Classification
 */

/** @typedef {{ ok: true, records: CatalogueRecord[] } | { ok: false, message: string }} CatalogueResult */

/**
 * @typedef {{ ok: true, keys: string[], entitlementFields: [string, unknown][], redacted: unknown }
 *   | { ok: false, authInvalid: boolean, message: string }} AccountResult
 */

/** @param {string[]} missing */
function missingCredentialsMessage(missing) {
  return [
    `testingbot-probe: missing required environment variable(s): ${missing.join(', ')}.`,
    '',
    'Set them for this PowerShell session, then re-run:',
    '',
    '  $env:TESTINGBOT_KEY="<your-testingbot-key>"',
    '  $env:TESTINGBOT_SECRET="<your-testingbot-secret>"',
    '  node apps/bench-web/scripts/testingbot-probe.mjs',
    '',
    'Find your key and secret on the TestingBot dashboard (Account > API Key).',
    'Credentials are read from the environment only, for the lifetime of this process -- this',
    'script never prints, logs, writes, or caches them anywhere.',
  ].join('\n');
}

/** Reads and validates credentials from the environment. Never prompts. */
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

/**
 * Builds the `Authorization: Basic ...` header value. Never returned or logged by itself --
 * callers only ever pass this straight into a `fetch()` headers object.
 * @param {string} key
 * @param {string} secret
 */
function buildAuthHeader(key, secret) {
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

/**
 * Fetches the unfiltered browser/device catalogue with HTTP Basic auth. Never includes the
 * Authorization header, or the key/secret, in any returned message.
 * @param {string} key
 * @param {string} secret
 * @returns {Promise<CatalogueResult>}
 */
async function fetchCatalogue(key, secret) {
  let response;
  try {
    response = await fetch(BROWSERS_URL, {
      headers: { Authorization: buildAuthHeader(key, secret) },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `network error contacting ${BROWSERS_URL}: ${reason}` };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `TestingBot API returned HTTP ${response.status} ${response.statusText} for ${BROWSERS_URL}`,
    };
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `TestingBot API returned HTTP ${response.status} but the body was not valid JSON: ${reason}`,
    };
  }

  if (!Array.isArray(data)) {
    return {
      ok: false,
      message: `TestingBot API returned HTTP ${response.status} with an unexpected shape: expected a JSON array, got ${typeof data}`,
    };
  }

  return { ok: true, records: data };
}

/**
 * Recursively redacts any value whose key name matches {@link SENSITIVE_FIELD_PATTERN},
 * unconditionally -- this does not depend on knowing the real `/v1/user` field names.
 * @param {unknown} value
 * @returns {unknown}
 */
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [fieldName, fieldValue] of Object.entries(value)) {
      out[fieldName] = SENSITIVE_FIELD_PATTERN.test(fieldName) ? '[REDACTED]' : redact(fieldValue);
    }
    return out;
  }
  return value;
}

/**
 * Fetches account info from the one genuinely auth-gated TestingBot endpoint used here. A 401
 * with credentials supplied means the credentials are wrong -- reported as `authInvalid: true`,
 * distinct from a network failure or an unrelated HTTP error. The response shape was never
 * observed live (no valid credentials were available while writing this), so success is
 * handled generically: every top-level key is listed, sensitive-looking values are redacted
 * unconditionally, and keys that look entitlement-related by name are surfaced separately --
 * nothing is inferred about a field this script has never actually seen.
 * @param {string} key
 * @param {string} secret
 * @returns {Promise<AccountResult>}
 */
async function fetchAccount(key, secret) {
  let response;
  try {
    response = await fetch(USER_URL, { headers: { Authorization: buildAuthHeader(key, secret) } });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      authInvalid: false,
      message: `network error contacting ${USER_URL}: ${reason}`,
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      authInvalid: true,
      message:
        'TestingBot rejected the credentials (HTTP 401) -- TESTINGBOT_KEY/TESTINGBOT_SECRET are wrong.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      authInvalid: false,
      message: `TestingBot API returned HTTP ${response.status} ${response.statusText} for ${USER_URL}`,
    };
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      authInvalid: false,
      message: `TestingBot API returned HTTP ${response.status} but the body was not valid JSON: ${reason}`,
    };
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      authInvalid: false,
      message: `TestingBot API returned HTTP ${response.status} with an unexpected shape: expected a JSON object, got ${Array.isArray(data) ? 'array' : typeof data}`,
    };
  }

  const keys = Object.keys(data);
  const redacted = redact(data);
  /** @type {[string, unknown][]} */
  const entitlementFields =
    redacted !== null && typeof redacted === 'object'
      ? Object.entries(redacted).filter(([fieldName]) => ENTITLEMENT_FIELD_PATTERN.test(fieldName))
      : [];
  return { ok: true, keys, entitlementFields, redacted };
}

/** @param {unknown} value */
function isPresentString(value) {
  return typeof value === 'string' && value.length > 0;
}

/** @param {CatalogueRecord} record */
function hasDevice(record) {
  return isPresentString(record.deviceName);
}

/** @param {CatalogueRecord} record */
function hasBrowserIdentity(record) {
  return isPresentString(record.name) || isPresentString(record.selenium_name);
}

/**
 * A `platform` value starting with `REAL_` is the only field observed to reliably mark
 * physical hardware -- `deviceName` alone does not, since the same device name (e.g.
 * "Pixel 9") appears under both `platform: "ANDROID"` (emulator) and
 * `platform: "REAL_ANDROID"` (real device) in the live catalogue.
 * @param {CatalogueRecord} record
 */
function isConfirmedRealDevice(record) {
  return typeof record.platform === 'string' && /^real[_-]/i.test(record.platform);
}

/**
 * Splits the catalogue into desktop browsers, mobile browsers (with a real-hardware sub-count),
 * native-device-only entries (a device slot with no browser identity -- not observed live, kept
 * as a defensive bucket), and anything that fits neither shape, so a future account-scoped
 * response cannot silently vanish into the wrong bucket.
 * @param {CatalogueRecord[]} records
 * @returns {Classification}
 */
function classify(records) {
  /** @type {Classification} */
  const result = {
    total: records.length,
    desktop: [],
    mobile: [],
    mobileRealDevice: [],
    nativeOnly: [],
    unclassified: [],
  };
  for (const record of records) {
    const device = hasDevice(record);
    const browser = hasBrowserIdentity(record);
    if (device && browser) {
      result.mobile.push(record);
      if (isConfirmedRealDevice(record)) result.mobileRealDevice.push(record);
    } else if (!device && browser) result.desktop.push(record);
    else if (device && !browser) result.nativeOnly.push(record);
    else result.unclassified.push(record);
  }
  return result;
}

/**
 * Desktop Chrome is named `googlechrome` in this catalogue; mobile/Android Chrome is `chrome`.
 * @param {CatalogueRecord} record
 */
function isChromeRecord(record) {
  if (record.name === 'googlechrome' || record.name === 'chrome') return true;
  return typeof record.selenium_name === 'string' && /^chrome/i.test(record.selenium_name);
}

/** @param {CatalogueRecord} record */
function formatRecordLine(record) {
  const parts = [
    record.name ?? '(no name)',
    record.version != null ? `v${record.version}` : '(no version)',
    record.platform ?? '(no platform)',
  ];
  if (isPresentString(record.deviceName)) parts.push(`device=${record.deviceName}`);
  return parts.join(' / ');
}

/** @param {Classification} classification */
function buildSample(classification) {
  /** @param {CatalogueRecord[]} list @param {number} n */
  const take = (list, n) => list.slice(0, n);
  const lines = [
    ...take(classification.desktop, 4).map((r) => `desktop      ${formatRecordLine(r)}`),
    ...take(classification.mobile, 4).map((r) => `mobile       ${formatRecordLine(r)}`),
    ...take(classification.nativeOnly, 2).map((r) => `native-only  ${formatRecordLine(r)}`),
  ];
  return lines.slice(0, MAX_SAMPLE_LINES);
}

/**
 * Three-part verdict: what the public catalogue proves, what the authenticated call proves,
 * and what neither proves -- kept separate on purpose so success on one never gets read as
 * success on the other.
 * @param {Classification | null} classification
 * @param {AccountResult | null} account
 */
function buildVerdict(classification, account) {
  const lines = [];

  if (classification === null) {
    lines.push(
      'PUBLIC CATALOGUE: could not be fetched -- see the error above. Not proven either way.',
    );
  } else {
    const chromeDesktop = classification.desktop.filter(isChromeRecord).length;
    const chromeMobile = classification.mobile.filter(isChromeRecord).length;
    const realBrowserAvailable =
      classification.desktop.length > 0 || classification.mobile.length > 0;
    lines.push(
      realBrowserAvailable
        ? `PUBLIC CATALOGUE proves: the grid advertises ${classification.desktop.length} desktop + ${classification.mobile.length} mobile browser entries (${classification.mobileRealDevice.length} of the mobile entries confirmed real hardware via platform="REAL_*"), including Chrome (${chromeDesktop} desktop "googlechrome" + ${chromeMobile} mobile "chrome"). This is true of the catalogue regardless of which account asks.`
        : 'PUBLIC CATALOGUE: no desktop or mobile browser entries found -- unexpected; re-check the response shape before trusting this run.',
    );
  }

  if (account === null) {
    lines.push('AUTHENTICATED CHECK: not run.');
  } else if (!account.ok) {
    lines.push(
      account.authInvalid
        ? `AUTHENTICATED CHECK proves: credentials are INVALID for this account (HTTP 401). ${account.message}`
        : `AUTHENTICATED CHECK: could not complete -- ${account.message}. Credential validity not established either way.`,
    );
  } else {
    lines.push(
      `AUTHENTICATED CHECK proves: credentials ARE valid for this TestingBot account (HTTP 200 from ${USER_URL}).`,
    );
    if (account.entitlementFields.length > 0) {
      const fields = account.entitlementFields
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ');
      lines.push(`  Plan/entitlement-looking fields found: ${fields}`);
    } else {
      lines.push(
        '  Plan tier is NOT exposed by this response under any recognisable field name --' +
          ` confirm on the TestingBot dashboard. Full field list: ${account.keys.join(', ')}.`,
      );
    }
  }

  lines.push(
    'NEITHER CHECK proves: that a real-browser session will actually start under this plan --',
    'catalogue-list and account-info entitlement do not always match session-launch',
    'entitlement on cloud grids. Confirm with the TestingBot dashboard or one real session',
    'launch before wiring any CI lane on this -- see docs/plans/perf-measurement-2026-07.md',
    '§11.7 (B21 ordering).',
  );

  return lines.join('\n');
}

async function main() {
  const credentials = readCredentials();
  if (credentials === null) {
    process.exitCode = 1;
    return;
  }

  let failed = false;

  const catalogueResult = await fetchCatalogue(credentials.key, credentials.secret);
  /** @type {Classification | null} */
  let classification = null;
  if (!catalogueResult.ok) {
    console.error(`testingbot-probe: catalogue check FAILED -- ${catalogueResult.message}`);
    failed = true;
  } else {
    classification = classify(catalogueResult.records);
    console.log(
      'TestingBot browser/device catalogue -- apps/bench-web/scripts/testingbot-probe.mjs',
    );
    console.log(`  endpoint:            ${BROWSERS_URL}`);
    console.log(`  total entries:       ${classification.total}`);
    console.log(`  desktop browsers:    ${classification.desktop.length}`);
    console.log(
      `  mobile browsers:     ${classification.mobile.length} (${classification.mobileRealDevice.length} confirmed real device)`,
    );
    console.log(`  native-device-only:  ${classification.nativeOnly.length}`);
    if (classification.unclassified.length > 0) {
      console.log(
        `  unclassified:        ${classification.unclassified.length} (neither a device nor a browser identity field -- inspect manually)`,
      );
    }
    console.log('');
    console.log('Sample entries (name / version / platform[, device]):');
    for (const line of buildSample(classification)) console.log(`  ${line}`);
  }

  console.log('');
  const accountResult = await fetchAccount(credentials.key, credentials.secret);
  if (!accountResult.ok) {
    console.error(`testingbot-probe: authenticated check FAILED -- ${accountResult.message}`);
    failed = true;
  } else {
    console.log(`TestingBot account check -- HTTP 200 from ${USER_URL}`);
    console.log(`  top-level fields: ${accountResult.keys.join(', ') || '(none)'}`);
    console.log('  full response (any key/secret/password/token/auth-named field redacted):');
    for (const line of JSON.stringify(accountResult.redacted, null, 2).split('\n')) {
      console.log(`    ${line}`);
    }
  }

  console.log('');
  console.log(buildVerdict(classification, accountResult));

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  const reason = err instanceof Error ? err.message : String(err);
  console.error(`testingbot-probe: unexpected error -- ${reason}`);
  process.exitCode = 1;
});
