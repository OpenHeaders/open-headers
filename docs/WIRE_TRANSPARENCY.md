# Wire transparency — every outbound call, byte for byte

Outbound connections from the apps are limited to the documented
OpenHeaders endpoints below, plus targets the operator configures
themselves (IdP issuer for SSO, Git remotes, an audit/SIEM collector,
and whatever requests the user's own rules/workflows make). This
document is the published specification of every phone-home payload; if
a request is not listed here, the app does not make it. The app is
fully functional with all of these unreachable or disabled — see the
per-endpoint off switches.

The only usage data that ever leaves is the anonymous telemetry channel
of section 4 (TELEMETRY_PLAN.md, amending LICENSING_PLAN.md §1): a typed
allowlist of feature-usage counts, structurally incapable of carrying
URLs, headers, traffic, or identity, default-on for desktop/extension/CLI
with a one-switch opt-out (the CLI additionally prints a one-time notice
on its first enabled run), and hard-off for the daemon, served web app,
and MCP server. The license system itself remains
telemetry-free: license endpoints and telemetry never share identifiers,
payloads, or deployments.

The extension's only OpenHeaders-bound call is that telemetry channel
(section 4); browser store distribution owns its updates.

## 1. License refresh

Self-serve subscription renewal (LICENSING_PLAN.md §3.2). Node hosts only
(desktop main process and the daemon — never the extension). The agent
only ever *delivers* files: the response is verified offline against the
compiled-in Ed25519 trust ring before anything persists; no online
validation path exists.

- **Endpoint**: `POST https://license.openheaders.io/refresh`
- **Request headers**: `content-type: application/json`
- **Request body** — exactly these three fields, nothing else:

```json
{
  "licenseKey": "oh-license.<base64url payload>.<base64url signature>",
  "appVersion": "2026.7.10",
  "platform": "darwin"
}
```

  - `licenseKey` — the currently installed license artifact, verbatim.
    It contains what the license file contains: licensee name/org/email,
    seat count, validity window, key id, and an opaque subscription
    reference (`subscriptionRef`) the control plane stamped at purchase
    and uses to look the subscription up. Nothing about the deployment
    (users, workspaces, hostnames, usage) is derivable from it.
  - `appVersion` — the host's own version string.
  - `platform` — the Node `process.platform` value (`darwin`, `win32`,
    `linux`).
- **Response**: `200` with the fresh signed license artifact as the body.
  `4xx` means the subscription lapsed; the host stops asking until a
  different license is installed. Anything else is retried silently on
  the next cycle.
- **Cadence**: checked every 6 hours (±10 min jitter), but a request is
  only actually sent while the installed license is inside its renewal
  window (`validUntil − now < 30 days`) or grace period. A healthy
  deployment POSTs here roughly four times a day for the last two weeks
  of each 45-day file; outside the window, nothing leaves.
- **Individual seats**: a daemon whose directory holds users admitted by
  their own individual-seat licenses renews those artifacts through this
  same call — one request per distinct license, same body shape (the
  individual-seat artifact as `licenseKey`), same window/latch rules. No
  other data is added.
- **Off switches**: no license installed → never called. `offline: true`
  (enterprise/air-gapped) licenses → never called. Daemon config
  `licenseRefresh: false` / `OH_LICENSE_REFRESH=0` → never called.
- **Failure is never lockout**: refreshes stopping only means the file
  lapses into its grace period and then free-tier limits on *new* user
  creation. Existing users always log in; data is never hostage.

## 2. Update check

Check-and-notify only — the app never self-installs
(docs/UPDATES_PLAN.md). Desktop packaged builds on macOS/Windows and
Linux AppImage; dev builds, deb/rpm installs, and the daemon make no
update requests.

- **Endpoint**: the public releases repository,
  `https://github.com/OpenHeaders/open-headers-releases` — standard
  electron-updater GitHub-provider `GET`s: the latest-release metadata
  (`latest.yml` / `latest-mac.yml` / `latest-linux.yml`) and, only after
  the user chooses to download, the installer artifact itself.
- **Request body**: none. These are plain HTTP `GET`s; no identifier,
  license, or machine information is attached beyond what any HTTP
  client sends (the served host is GitHub, subject to GitHub's own
  logging).
- **Cadence**: at most once a day (±10 min jitter) plus explicit
  "Check now" clicks. Downloads happen only on user action (or with the
  user's opt-in `updates.autoDownload`); installs only on explicit
  restart-to-install or natural app quit.
- **Off switch**: `updates.check: off` in Settings → Updates (also
  `security-only` to limit notifications), `OH_DISABLE_UPDATE_CHECKS=1`
  for test rigs.

## 3. Severity manifest

A small static severity manifest (`versions.json`) published alongside
each release on the same public releases repository —
`{ latest, severity, minimumSafeVersion }` per app, so a security
release can escalate loudly (red badge, entry banner). Severity is
authored by a human before each release, never derived from anything
about your install.

- **Endpoint**: `GET https://github.com/OpenHeaders/open-headers-releases/releases/latest/download/versions.json`
- **Request body**: none — a plain HTTP `GET` of a static file; no
  identifier, license, or machine information is attached. The
  comparison against your running version happens locally.
- **Cadence**: fetched only as part of an update check (section 2) —
  the same daily schedule and explicit "Check now" clicks; never on its
  own timer.
- **Off switch**: the same as the update check — `updates.check: off`
  disables both, `OH_DISABLE_UPDATE_CHECKS=1` for test rigs. If the
  manifest is unreachable, the app simply treats severity as unknown.

## 4. Anonymous telemetry

Anonymous usage counting (TELEMETRY_PLAN.md) — which features get used,
nothing more. The event vocabulary is a typed allowlist compiled into
the app (`packages/core/src/telemetry/`): every payload property is a
closed union, boolean, or number; free-form strings are banned by a
guard test, so URLs, hostnames, header names or values, rule contents,
request/response data, and file paths are inexpressible. The in-app
inspector (Settings → General → View telemetry events) shows every
event of the current session byte for byte, sent or suppressed.

- **Endpoint**: `POST https://telemetry.openheaders.io/v1/events`
- **Request headers**: `content-type: application/json`
- **Request body** — a batch envelope, exactly these four fields:

```json
{
  "schemaVersion": 1,
  "sessionId": "c0ffee00c0ffee00c0ffee00c0ffee00",
  "sentAt": 1760000000000,
  "events": [
    { "name": "session_start", "host": "extension", "appVersion": { "year": 2026, "month": 7, "patch": 2 },
      "platform": "mac", "browser": "firefox", "locale": "en" },
    { "name": "feature_used", "feature": "workflow-editor" },
    { "name": "rule_created", "ruleType": "header" },
    { "name": "import_run", "source": "postman", "ok": true },
    { "name": "workflow_run", "ok": true },
    { "name": "error_beacon", "code": "ws-connect-failed" }
  ]
}
```

  - `sessionId` — 32 hex chars minted at random per process launch,
    held in memory only, never persisted. It groups one session's
    events and nothing else: there is no install id, no account
    identity, no fingerprint, so sessions cannot be joined across
    launches.
  - `events` — only the six event shapes above exist, and every field
    value comes from a closed union checked into the repository
    (`host` can only ever be `desktop`/`extension`/`cli` — the daemon,
    served web app, and MCP server are hard-off and have no vocabulary
    member). `appVersion` is the CalVer version as three integers.
- **Response**: `202` when the envelope validates, `4xx` otherwise.
  The client never acts on the status either way — failures are
  silent, the batch simply rides the next flush, and nothing ever
  retries aggressively, blocks, or degrades the app.
- **Storage**: the worker validates against the same compiled schema
  and writes one Cloudflare Workers Analytics Engine data point per
  event, carrying only the vocabulary values and the session id.
  IP addresses and geo are never written; no third-party analytics
  SDK or processor is involved (Cloudflare already hosts the license
  worker and is the only processor named in the privacy policy).
- **Cadence**: batched — the host flushes the in-memory queue on an
  interval and best-effort on quit.
- **Off switches**: Settings → General → telemetry toggle (extension
  and desktop), `OH_TELEMETRY=0` env var or config key (CLI). The
  daemon, served web app, and MCP server never send telemetry and have
  no toggle to misconfigure. Off means off: the channel goes silent
  entirely, with no "essential telemetry" residue.
- **Strict channel separation**: no license id, subscription ref,
  licensee email, seat data, or OIDC subject can appear in an event —
  the vocabulary has no such fields — and the telemetry worker is a
  separate deployment sharing no secrets or code paths with the
  license worker beyond the published schema.

---

Anything else leaving the process is operator-configured, not
OpenHeaders-bound: the OIDC issuer you set, the Git remotes you sync,
the SIEM collector you point audit streaming at, and the HTTP requests
your own rules, sources, and workflows define.
