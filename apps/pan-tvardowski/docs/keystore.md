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
