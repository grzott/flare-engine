# Pan Tvardowski — Android Keystore & Signing Guide

## Android keystore generation (local fallback only)

EAS Credentials manages the keystore automatically for production builds. Use the
`keytool` command below only when you need a local keystore for ad-hoc signing or
disaster-recovery rehearsal.

```bash
keytool -genkeypair \
  -alias pan-tvardowski \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -keystore pan-tvardowski.keystore \
  -storepass CHANGEME \
  -keypass CHANGEME \
  -dname "CN=Pan Tvardowski, OU=Flare, O=FlareEngine, L=Warsaw, ST=Mazovia, C=PL"
```

## EAS Credentials storage rule

- Run `eas credentials` to let EAS generate and store the keystore in Expo's
  encrypted vault. Never commit the `.keystore` file to git.
- Add the following line to `apps/pan-tvardowski/.gitignore`:

```
*.keystore
```

- The EAS-managed keystore is tied to the `projectId` in `app.json` `extra.eas`.
  Replace the `TODO` placeholder with the real project ID before the first
  `eas build --profile production` run.

## iOS signing

Use Expo's auto-managed signing. When running:

```bash
eas build --platform ios --profile production
```

EAS will provision the Distribution Certificate and Provisioning Profile
automatically via your Apple Developer account. No manual `.p12` handling is
needed unless you opt out of managed signing.

## Recovery procedure — lost keystore

A lost production Android keystore **cannot be recovered**. The SHA-1 fingerprint
is permanently embedded in the Play Console app record.

If the keystore is lost:

1. The existing Play app listing must be abandoned.
2. Create a new app in Play Console with a new package name (e.g., append `.v2`).
3. Migrate all users via in-app messaging; Play cannot transfer reviews or history.
4. Submit the new listing with a fresh keystore managed by EAS.

To prevent loss: ensure `eas credentials` is used exclusively (vault-backed) and
never stored locally outside of a secure secrets manager.

## Version-bump policy

| Situation | `version` in `app.json` | EAS `autoIncrement` |
|---|---|---|
| Internal test build | `0.0.x` (bump x each build) | handled by `autoIncrement: true` in production profile |
| First public release | `0.1.0` | yes |
| Hotfix to live release | `0.1.x` (patch bump) | yes |
| Content update / new zone | `0.y.0` (minor bump) | yes |
| Major redesign / breaking change | `1.0.0` | yes |

### Rules

- `version` in `app.json` is the human-visible version string (semver).
  Bump it manually before tagging a release commit.
- `versionCode` (Android) and `buildNumber` (iOS) are managed automatically by
  EAS `autoIncrement: true` in the `production` build profile. Never set them by
  hand in `app.json`.
- `runtimeVersion` policy is `"appVersion"`, meaning OTA updates are only
  delivered to devices on the same `version` string. A `version` bump forces
  a full store update; a patch OTA is impossible across minor versions.
- During `0.0.x` development, `distribution: internal` (preview profile) is used.
  The preview profile does NOT set `autoIncrement`, so `versionCode` is fixed at 1
  until a production build is cut.

## Play Console: create the app listing

Before a production build can be submitted, a Google Play app listing must exist.
These are external-action steps performed by the developer in a browser; they cannot
be scripted.

**External action — 10 steps:**

1. Go to <https://play.google.com/console> and sign in with the account that paid the
   one-time $25 developer registration fee.
2. Click **Create app**.
3. Set **App name** to `Pan Tvardowski` (EN). The PL name (`Pan Twardowski`) is added
   as a translation in the Store listing step.
4. Choose **App** (not Game — Play may re-classify after IARC rating).
5. Choose **Free** for the base pricing (in-app purchases cover monetisation).
6. Accept all developer programme policies and US export laws declarations.
7. Click **Create app** to confirm. The package name (`pl.flareengine.pantvardowski`) is
   set during the first upload, not here — leave it at default for now.
8. In the left sidebar, open **Testing → Internal testing** and click
   **Create new release** to open the internal track (required before the first upload
   will be accepted by `eas submit`).
9. Under **Testers**, add at least one Google account to the internal-test group so
   Play accepts the initial upload.
10. Record the **App ID** (numeric, shown in the URL as `.../app/<number>/...`) — you
    will need it if you ever configure `ascAppId` or link RevenueCat to Play.

## EAS project init

Run once, in the repo root or from the app directory, to link the local project to
your Expo account and write the `projectId` into `app.json`:

```bash
cd apps/pan-tvardowski
eas init
```

When prompted, choose **Create a new project** and enter the slug
`pan-tvardowski`. EAS writes `extra.eas.projectId` into `app.json` automatically.
Commit the updated `app.json` — the project ID is not a secret.

If `eas init` is not available, install the EAS CLI globally first:

```bash
bun add -g eas-cli
```

## Android keystore via EAS credentials

After `eas init` has written a real `projectId`, run:

```bash
eas credentials --platform android
```

Choose **Set up a new keystore** → **Let EAS generate a keystore**. EAS creates the
keystore, stores it in Expo's encrypted vault, and associates it with the project.

**Never download the keystore file to disk** unless you intend to store it in a
hardware-backed secrets manager (1Password, Bitwarden Secrets, etc.). The local
fallback `keytool` command at the top of this file is for disaster-recovery rehearsal
only.

Verify the keystore is registered by running:

```bash
eas credentials --platform android --non-interactive
```

The output should show the SHA-1 and SHA-256 fingerprints. Copy the **SHA-1** into
Play Console → **Setup → App signing** → **Upload key certificate** if Play App
Signing is enabled (recommended).

## Service-account JSON for `eas submit`

`eas submit` requires a Google service-account key to upload the AAB to Play on your
behalf. This key is **never committed to the repo**. Instead:

1. In Google Cloud Console (<https://console.cloud.google.com>), open the project
   linked to your Play Console account.
2. Go to **IAM & Admin → Service accounts** → **Create service account**.
3. Name it `eas-submit`; grant the role **Service Account User** (minimum).
4. In Play Console → **Users and permissions → Invite new users**, paste the service
   account email and grant **Release manager** permissions for the PT app.
5. Back in Cloud Console, open the service account → **Keys → Add key → Create new
   key (JSON)**. Download the `.json` file.
6. Store the file **outside the repo** (e.g. `~/.secrets/pan-tvardowski-sa.json` or
   in 1Password as a secure note).
7. Export the path as an environment variable before running `eas submit`:

```bash
export GOOGLE_SERVICE_ACCOUNT_KEY="/path/to/pan-tvardowski-sa.json"
eas submit --platform android --profile production
```

`eas.json` already reads `$GOOGLE_SERVICE_ACCOUNT_KEY` for the production submit
profile (updated session #105). In CI, inject this variable via a repository secret
(GitHub Actions: `secrets.GOOGLE_SERVICE_ACCOUNT_KEY`).

## Internal-track submission

Once the Play Console listing exists, EAS credentials are set, and
`GOOGLE_SERVICE_ACCOUNT_KEY` is exported:

```bash
# 1. Build a production AAB (triggers EAS cloud build, ~10–15 min)
eas build --platform android --profile production

# 2. Submit the latest build to the internal track
eas submit --platform android --profile production
```

The `track: "internal"` field in `eas.json` routes the AAB to the internal testing
track (not production). Promote to alpha/beta/production in the Play Console UI after
smoke-testing the internal build.

**Promotion path:** Internal → Closed testing (beta) → Open testing → Production.
Do not skip straight to Production for the first release.

## Apple Developer enrollment

To submit any iOS app, you must be enrolled in the Apple Developer Program
($99/yr, individual or organisation) at <https://developer.apple.com/enroll/>.
iOS apps cannot be submitted without active enrollment.

Once enrolled, the **Team ID** — a 10-character alphanumeric string — is visible
at developer.apple.com → Membership. The **Apple ID** is the email address used
to enroll. Organisation enrollment requires a D-U-N-S number and can take ~2
weeks for Apple to verify; individual enrollment is faster but lists the
developer's legal name publicly on the App Store.

## App Store Connect listing — create the app record

Before an iOS build can be submitted, an app record must exist in App Store
Connect. These are external-action steps performed in a browser.

**External action — 9 steps:**

1. Sign in at <https://appstoreconnect.apple.com> with the enrolled Apple ID.
2. Click **My Apps** → **+** → **New App**.
3. Set **Platforms** to iOS. (tvOS, macOS, and visionOS are not in scope at
   0.1.0.)
4. Set **Name** to `Pan Tvardowski` (EN). The PL name (`Pan Twardowski`) is
   added as a localisation under the App Information page.
5. Set **Primary Language** to English (U.S.).
6. Set **Bundle ID** to `dev.flare.pantvardowski` (must match
   `app.json` `expo.ios.bundleIdentifier`). Register the bundle ID at
   developer.apple.com → Certificates, Identifiers & Profiles → Identifiers
   first if it is not already in the dropdown.
7. Set **SKU** to `pan-tvardowski` (developer-facing, never visible to users).
8. Set **User Access** to **Full Access** unless restricting per-user.
9. Click **Create**. Record the **Apple ID** (numeric, shown in the App Store
   Connect URL as `/apps/<number>/`) — this becomes `ascAppId` in `eas.json`.

## iOS managed signing via EAS Credentials

After `eas init` writes a real `projectId`, run:

```bash
eas credentials --platform ios
```

Choose **Set up a new build credential** → **Let EAS handle the process**. EAS
auto-provisions:

- Distribution Certificate (.p12)
- Provisioning Profile
- APNs key (push notifications — unused at 0.1.0 but provisioned anyway)

All three are stored in Expo's encrypted vault and tied to `projectId` +
`bundleIdentifier`. Verify with:

```bash
eas credentials --platform ios --non-interactive
```

The output should list the certificate fingerprint and profile UUID.

Unlike Android, iOS distribution certificates are revocable and reissuable from
the Apple Developer portal — losing the EAS-managed cert is not catastrophic.
The cert is auto-revoked-and-reissued on demand.

### App Store Connect API key for `eas submit`

`eas submit --platform ios` requires an **App Store Connect API key** (not the
Apple ID password) to upload IPAs on your behalf.

In ASC: **Users and Access** → **Integrations** → **App Store Connect API** →
**Generate API Key**. Set the role to **App Manager** (minimum).

Download the `.p8` private-key file immediately after creation — it is a
one-time download and can never be re-issued. Store it in 1Password or a
hardware-backed vault. Note the **Issuer ID** (UUID) and **Key ID**
(10-character).

Three environment variables are required at submit time:

- `APPLE_ID` — the developer Apple ID email.
- `ASC_APP_ID` — the numeric app ID from step 9 above.
- `APPLE_TEAM_ID` — the 10-character Team ID from the Membership page.

`eas.json` (updated session #106) reads all three from the environment. In CI,
inject them as repository secrets: `APPLE_ID`, `ASC_APP_ID`, `APPLE_TEAM_ID`.

## TestFlight internal-tester flow

After a production iOS build is uploaded via `eas submit --platform ios
--profile production`, the IPA appears in **TestFlight → iOS Builds**. Apple
runs the binary through static analysis; allow 10–20 min for the build to reach
**Ready to Submit** status.

Once ready, the build can be added to:

- **Internal Testing** group — up to 100 testers (App Store Connect users
  only); no external review needed; live within 5 min of adding the build.
- **External Testing** group — up to 10 000 testers; requires Apple's Beta App
  Review (~24 h first time, faster on subsequent submissions).

For 0.1.0 internal smoke testing, Internal Testing is sufficient. External
TestFlight is gated until #65 PT-Ship.

Run sequence:

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

**Promotion path:** Internal TestFlight → External TestFlight (Beta App Review)
→ App Store production (App Review). Do not skip straight to production for the
first release.

## Deferred to later sessions

The following items are not part of session #105 or #106 and are tracked in
their own rows:

- **#54 PT-Store-3** — Google Play product IDs (`pan_tvardowski.full_game`,
  `pan_tvardowski.supporter_pack`) + matching App Store Connect product IDs.
- **#57 PT-Legal-3** — IARC age-rating questionnaire (required before any
  public track on Play; App Store rating likewise).
- **#61 PT-Content-1** — store-page copy (short + long descriptions, promo
  text) in EN + PL.
- **#62-#64 PT-Assets-1..3** — app icon, Play feature graphic (1024 × 500),
  Play screenshots (8 × 1080×1920), App Store screenshots (10 per device class)
  + 30-s preview.
- **#65 PT-Ship** — production-track promotion after internal smoke-test passes;
  RevenueCat entitlement linking (maps Play + ASC product IDs to RevenueCat
  entitlements).
