# Security Policy

Open Headers takes the security of its users seriously. This policy
explains how to report vulnerabilities and what you can expect from us.
It applies to the desktop app, the browser extensions, the daemon, the
CLI, the MCP server, the web application, and the
`license.openheaders.io` service.

## Reporting a vulnerability

Email **security@openheaders.io** with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept helps but is not required),
- the affected component and version,
- how you'd like to be credited, if at all.

Please use email rather than public issue trackers for anything
exploitable. If the report contains sensitive details, ask for an
encrypted channel in a first plain email and we will arrange one.

## What to expect

- **Acknowledgement within 3 business days.**
- An assessment and expected fix timeline within 10 business days.
- Security fixes ship as releases flagged through the app's update
  notifications (check-and-notify — the app never self-installs).
- Credit in the release notes if you want it.

We do not operate a paid bounty program at this time.

## Safe harbor

We will not pursue legal action for good-faith security research that
respects user data (test against your own installations, not other
people's), avoids service disruption, and gives us reasonable time to
fix before public disclosure. The End User License Agreement's
reverse-engineering restrictions do not apply to good-faith security
research conducted under this policy.

## Scope notes

- The software is local-first: it stores data on your machine and
  sends no personal data — the only usage data is the anonymous,
  typed telemetry channel. Every OpenHeaders-bound network call,
  telemetry included, is specified byte-for-byte in the published
  wire-transparency documentation; a request the software makes that
  is not documented there is a valid finding on its own.
- The license system is designed so that its failure is never lockout:
  circumventing seat limits on your own deployment is a licensing
  matter, not a security vulnerability — but any way a *third party*
  could tamper with someone else's license state is in scope.
