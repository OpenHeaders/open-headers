# Security Policy

Open Headers takes the security of its users seriously. This policy
explains how to report vulnerabilities and what you can expect from us.
It applies to the desktop app, the browser extensions, the daemon, the
CLI, the MCP server, the web application, and the
`license.openheaders.io` and `telemetry.openheaders.io` services.

## Reporting a vulnerability

Email **security@openheaders.io** with:

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
  [wire-transparency documentation](https://openheaders.io/wire-transparency);
  a request the software makes that is not documented there is a valid
  finding on its own.
- The license system is designed so that its failure is never lockout:
  circumventing seat limits on your own deployment is a licensing
  matter, not a security vulnerability — but any way a *third party*
  could tamper with someone else's license state is in scope.
