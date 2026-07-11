# Open Headers — Security Whitepaper

**Status: draft for review — publish alongside the first release under
the EULA.**

Open Headers is a browser development toolkit: a desktop app, browser
extensions, a multi-user daemon, a CLI, and an MCP server. This
document describes the security architecture those components share.
It makes no claim that proprietary licensing is itself a security
property; the guarantees below hold because of how the software is
built, and each one is stated so it can be verified from the outside.

## 1. Principles

1. **Local-first.** Your configurations, rules, workspaces, recordings,
   and secrets live on your machine, in your browser profile, or in
   Git remotes you choose. There is no vendor cloud and no account with
   us; nothing you create ever transits our infrastructure.
2. **No telemetry, ever.** The software collects no usage data, crash
   reports, or analytics. This is a product law, not a default.
3. **Verifiable, not trusted.** Every OpenHeaders-bound network call is
   specified byte-for-byte in the published wire-transparency document.
   The claim "no telemetry" is checkable with browser DevTools or a
   system-level packet capture — you never have to take our word.
4. **Failure is never lockout.** No licensing or network condition can
   withhold your data or lock out existing users.

## 2. Network surface

The full outbound surface of the software is:

| Call | Who makes it | Payload | Off switch |
|---|---|---|---|
| License refresh (`POST license.openheaders.io/refresh`) | desktop main process, daemon | `{licenseKey, appVersion, platform}` — nothing else | no license / `offline` license / `licenseRefresh: false` |
| Update check (GitHub releases repo) | packaged desktop builds | plain `GET`s, no payload | `updates.check: off` |
| Severity manifest (planned) | packaged desktop builds | plain `GET` of a static file | same as update check |

Everything else leaving the process is operator-configured: your OIDC
issuer, your Git remotes, your SIEM collector, and the HTTP requests
your own rules, sources, and workflows define. The browser extension
makes no OpenHeaders-bound calls at all. The exact bytes of each call
above are published in the wire-transparency specification; a request
not listed there is a bug we treat as a vulnerability.

The software is fully functional with every OpenHeaders endpoint
unreachable — offline use is a supported mode, not a degraded one.

## 3. Licensing security model

The app only ever validates **offline-signed license files** (Ed25519,
verified against a public-key ring compiled into the binary). The
online layer never validates anything; it only delivers fresh signed
files. Consequences:

- No phone-home is required to run. Air-gapped deployments use
  long-lived files and never make a network call.
- The license server holds no database and stores nothing about
  deployments; subscription state lives with the merchant of record.
- A lapsed subscription degrades gently: grace period, then free-tier
  seat limits on **new** user creation only. Existing users always
  sign in; existing data is always accessible and exportable.
- There is no machine binding, no hardware fingerprinting, and no
  anti-tamper instrumentation.

## 4. Local architecture

- **Desktop ↔ extension:** the desktop app runs a WebSocket server
  bound to `127.0.0.1` only; the extension connects as a client. The
  protocol never leaves the loopback interface.
- **Storage:** browser-side state lives in the extension's own storage
  area; desktop/daemon state lives in the OS user-data directory.
  Sensitive values (vault secrets) are encrypted at rest behind a
  passphrase.
- **Static bundling:** every dependency is packed into the build at
  compile time. The software loads no code at runtime from CDNs or any
  remote source, so its behavior cannot change between the build you
  audited and the build you run.
- **Updates:** check-and-notify only. The app never downloads or
  installs updates without explicit user action.

## 5. Multi-user daemon

Team deployments run the daemon with SSO/OIDC, role-based access
control, an append-only audit log with JSONL export, and optional
SIEM forwarding — all available on the free tier, because security
features are never upsells. Administrative operations are gated
per-frame on the wire and audited.

## 6. Disclosure

Vulnerabilities: see `SECURITY.md` (published as our disclosure
policy) and `security.txt` on openheaders.io. Good-faith research is
protected by the safe-harbor terms there, including an explicit
carve-out from the EULA's reverse-engineering restrictions.

## 7. What we deliberately do not claim

- We do not claim that being closed-source makes the software more
  secure. Source access is one audit channel; we substitute verifiable
  behavior (documented wire surface, static bundling, local-first
  storage) and independent observability for it.
- We do not claim immunity from compromise. We publish this document
  so that our guarantees are falsifiable, and we treat any deviation
  from it as a security bug.
