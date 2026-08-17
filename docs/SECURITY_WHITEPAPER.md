# Open Headers — Security Whitepaper

**Published: July 11, 2026**

Open Headers is a browser development toolkit: a desktop app, browser
extensions, a multi-user daemon, a CLI, and an MCP server. This
document describes the security architecture those components share.
The source code is public under the Apache-2.0 license; the guarantees
below hold because of how the software is built, and each one is
stated so it can be verified both from the code and from the outside.

## 1. Principles

1. **Local-first.** Your configurations, rules, workspaces, recordings,
   and secrets live on your machine, in your browser profile, or in
   Git remotes you choose. There is no vendor cloud and no account with
   us; nothing you create ever transits our infrastructure.
2. **Anonymous by construction.** The only usage data is anonymous
   feature counting over a typed event allowlist compiled into the
   app — closed unions only, no free-form strings, so URLs, headers,
   traffic, and identity are inexpressible. It is disclosed in the
   privacy policy, the store listings, and the setting itself;
   inspectable byte for byte in-app; off with one switch; and the
   server surfaces (daemon, served web app, MCP server) never send it
   at all. No crash reports, no stack traces, no third-party analytics
   SDK.
3. **Verifiable, not trusted.** Every OpenHeaders-bound network call —
   telemetry included — is specified byte-for-byte in the published
   wire-transparency document and checkable with browser DevTools or a
   system-level packet capture — you never have to take our word.
4. **Failure is never lockout.** No licensing or network condition can
   withhold your data or lock out existing users.

## 2. Network surface

The full outbound surface of the software is:

| Call | Who makes it | Payload | Off switch |
|---|---|---|---|
| License refresh (`POST license.openheaders.io/refresh`) | desktop main process, daemon | `{licenseKey, appVersion, platform}` — nothing else | no license / `offline` license / `licenseRefresh: false` |
| Update check (`GET updates.openheaders.io` feed) | packaged desktop builds, the `oh` CLI, the daemon on `ohd status` or opt-in | plain `GET`s, no payload | `updates.check: off` / `oh autoupdate off` |
| Severity manifest (`GET updates.openheaders.io/versions/stable.json`) | same surfaces, only as part of an update check | plain `GET` of a static file | same as update check |
| Anonymous telemetry (`POST telemetry.openheaders.io/v1/events`) | extension, desktop app, CLI — never the daemon, served web app, or MCP server | typed event allowlist — closed unions only, no free-form strings | Settings → General toggle / `OH_TELEMETRY=0` |

Everything else leaving the process is operator-configured: your OIDC
issuer, your Git remotes, your SIEM collector, and the HTTP requests
your own rules, sources, and workflows define. The browser extension's
only OpenHeaders-bound call is the telemetry channel above. The exact
bytes of each call above are published in the wire-transparency
specification; a request not listed there is a bug we treat as a
vulnerability.

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
- **Updates:** an available update may download in the background
  (default on, one switch to off), but it is only ever applied by an
  explicit "Update & Restart" or a quit that happens anyway — a running
  app is never restarted without your action.

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

- We do not claim that being open-source by itself makes the software
  secure. Source access is one audit channel; verifiable behavior
  (documented wire surface, static bundling, local-first storage) and
  independent observability stand alongside it.
- We do not claim immunity from compromise. We publish this document
  so that our guarantees are falsifiable, and we treat any deviation
  from it as a security bug.
