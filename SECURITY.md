# Security Policy

Open Headers takes the security of its users seriously. This policy
explains how to report vulnerabilities and what you can expect from us.
It applies to the desktop app, the browser extensions, the daemon, the
CLI, the MCP server, the web application, and the
`license.openheaders.com` and `telemetry.openheaders.com` services.

## Reporting a vulnerability

Email **security@openheaders.com** with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept helps but is not required),
- the affected component and version.

Please use email rather than public issue trackers for anything
exploitable. If the report contains sensitive details, ask for an
encrypted channel in a first plain email and we will arrange one.

## What to expect

- Reports go straight to the maintainer, not a ticket queue. You will
  get a reply confirming receipt, and follow-up as the issue is
  assessed and fixed. Confirmed vulnerabilities are prioritized ahead
  of all other work.
- Security fixes ship as releases flagged through the app's update
  notifications (staged in the background by default; a running app is
  never restarted to apply one without your action).

We do not operate a paid bounty program at this time.

## Verifying releases

Releases that include the standalone `oh` (CLI) and `ohd` (daemon)
binaries ship a `SHA256SUMS.txt` checksums manifest with a detached GPG
signature (`SHA256SUMS.txt.asc`). The signing key is published at
<https://openheaders.com/gpg> and attached to each signed release as
`openheaders-release-key.asc`:

- **User ID:** `OpenHeaders Release Signing <security@openheaders.io>`
- **Fingerprint:** `867B 1FF4 CD09 AC02 6417 B00A C55F BF5E 1E1E E683`

```sh
gpg --import openheaders-release-key.asc
gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
shasum -a 256 --check --ignore-missing SHA256SUMS.txt
```

The fingerprint here and the one on <https://openheaders.com/gpg> must
agree; if they ever disagree, trust neither and report it. Installers
carry platform trust roots on top: Windows artifacts are
Authenticode-signed, macOS artifacts are Developer ID-signed and
notarized, and the browser extensions install only through the official
stores.

## Safe harbor

We will not pursue legal action for good-faith security research that
respects user data (test against your own installations, not other
people's), avoids service disruption, and gives us reasonable time to
fix before public disclosure. The End User License Agreement's
reverse-engineering restrictions do not apply to good-faith security
research conducted under this policy.

## Scope notes

- The software is local-first: your configurations, rules, workspaces,
  and secrets stay on your machine. The only usage data is anonymous
  feature counting over a typed event allowlist — inspectable in-app
  and off with one switch. Every OpenHeaders-bound network call,
  telemetry included, is specified byte-for-byte in the published
  [wire-transparency documentation](https://openheaders.com/wire-transparency);
  a request the software makes that is not documented there is a valid
  finding on its own.
- The license system is designed so that its failure is never lockout:
  circumventing seat limits on your own deployment is a licensing
  matter, not a security vulnerability — but any way a *third party*
  could tamper with someone else's license state is in scope.
