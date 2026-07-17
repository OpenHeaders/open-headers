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

- **Endpoint**: the update feed,
  `GET https://updates.openheaders.io/desktop/stable/latest.yml`
  (`latest-mac.yml` / `latest-linux.yml` per platform) — a static
  pointer file read by electron-updater's generic provider. Only after
  the user chooses to download, the installer artifact itself is
  fetched from the URL the pointer file carries — the feed's own
  `dl/<tag>/` path on the same host. The entire update lifecycle
  reaches exactly one first-party domain (`updates.openheaders.io`,
  served by Cloudflare, subject to its hosting logs); GitHub hosts a
  redundant human-browsable copy but is never contacted by the app.
- **Request body**: none. These are plain HTTP `GET`s; no identifier,
  license, or machine information is attached beyond what any HTTP
  client sends.
- **Cadence**: at most once a day (±10 min jitter) plus explicit
  "Check now" clicks. Downloads happen only on user action (or with the
  user's opt-in `updates.autoDownload`); installs only on explicit
  restart-to-install or natural app quit.
- **Off switch**: `updates.check: off` in Settings → Updates (also
  `security-only` to limit notifications), `OH_DISABLE_UPDATE_CHECKS=1`
  for test rigs.

## 3. Severity manifest

A small static severity manifest published to the update feed on each
release — `{ latest, tag, severity, minimumSafeVersion }` per app, so a
security release can escalate loudly (red badge, entry banner).
Severity is authored by a human before each release, never derived
from anything about your install.

- **Endpoint**: `GET https://updates.openheaders.io/versions/stable.json`
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
- **Request body** — a batch envelope, exactly these six fields:

```json
{
  "schemaVersion": 2,
  "sessionId": "c0ffee00c0ffee00c0ffee00c0ffee00",
  "installId": "feedface00feedface00feedface0000",
  "sinceInstall": "2-7",
  "sentAt": 1760000000000,
  "events": [
    { "name": "first_run", "channel": "chrome-store" },
    { "name": "session_start", "host": "extension", "appVersion": { "year": 2026, "month": 7, "patch": 2 },
      "platform": "mac", "browser": "firefox", "locale": "en", "rules": "1-5", "workspaces": "0" },
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
    events and nothing else.
  - `installId` — 32 hex chars minted at random on first run and kept
    by the host. **Random by law**: never derived from hardware, the
    network, an account, or any real-world fact — it identifies this
    install, not you, and cannot be traced back to either. Turning the
    telemetry toggle off **deletes** it — a later re-enable mints a
    new one unlinkable to history, so the toggle doubles as a reset.
  - `sinceInstall` — how old the install is, only ever as one of five
    coarse buckets (`0`, `1`, `2-7`, `8-30`, `31+` days); precise ages
    are inexpressible.
  - `events` — only the seven event shapes above exist, and every
    field value comes from a closed union checked into the repository
    (`host` can only ever be `desktop`/`extension`/`cli` — the daemon,
    served web app, and MCP server are hard-off and have no vocabulary
    member). `appVersion` is the CalVer version as three integers.
    `first_run` fires once per install and carries only the
    distribution channel (which store or package manager the build
    shipped through — a static fact of the build, never sniffed from
    traffic). `rules`/`workspaces` are the same coarse buckets as
    `sinceInstall` (`0`, `1-5`, `6-20`, `21+`), never exact counts.
- **Response**: `202` when the envelope validates, `4xx` otherwise.
  The client never acts on the status either way — failures are
  silent, the batch simply rides the next flush, and nothing ever
  retries aggressively, blocks, or degrades the app.
- **Storage**: the worker validates against the same compiled schema
  and writes one Cloudflare Workers Analytics Engine data point per
  event, carrying only the vocabulary values, the session id, the
  install id, and one caller-derived value: the **coarse two-letter
  country code** Cloudflare resolves at its edge (`cf-ipcountry`).
  The IP address it derives from is never read into a data point, and
  no other request header is either; no third-party analytics SDK or
  processor is involved (Cloudflare already hosts the license worker
  and is the only processor named in the privacy policy). Monthly
  aggregate snapshots (counts only — ids are aggregated away) are
  committed to the repository as the long-term metrics ledger.
- **Uninstall ping (extension only)**: the extension registers
  `GET https://telemetry.openheaders.io/v1/uninstall?i=<installId>`
  as its browser uninstall URL — the page the browser opens when the
  extension is removed. It carries only the install id, counts one
  departure, and redirects to `https://openheaders.io/`. It is
  registered only while the telemetry toggle is on and an install id
  exists; toggling off clears it (no id, no ping).
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
