# Security Policy

## Supported versions

Flare is versioned in lockstep across the whole `@flare-engine/*` scope. Security
fixes land on the latest minor line only.

| Version                     | Supported          |
| --------------------------- | ------------------ |
| latest published minor      | :white_check_mark: |
| any earlier pre-1.0 minor   | :x:                |

The line is deliberately not pinned to a number: the scope ships in lockstep and
pre-1.0 minors supersede each other, so a pinned table goes stale on every
release. Earlier minors were pre-1.0 previews. Please upgrade to the latest
published minor before reporting.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through GitHub's built-in private vulnerability reporting:

1. Go to the [Security tab](https://github.com/grzott/flare-engine/security) of
   this repository.
2. Click **"Report a vulnerability"** and fill in the advisory form.

This opens a private channel visible only to the maintainer. If you cannot use
GitHub's reporting, email grzott@gmail.com with the details.

Please include:

- The affected package(s) and version(s).
- A description of the vulnerability and its impact.
- Steps to reproduce, or a minimal proof-of-concept, where possible.

## What to expect

- We aim to acknowledge a report within **7 days**.
- We will work with you to confirm the issue and determine its severity.
- Once a fix is ready, we will publish a patched release and a GitHub Security
  Advisory crediting the reporter (unless you prefer to remain anonymous).

Thank you for helping keep Flare and its users safe.
