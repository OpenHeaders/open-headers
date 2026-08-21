# Wire transparency — every outbound call, byte for byte

Outbound connections from the apps are limited to the documented
OpenHeaders endpoints below, plus targets the operator configures
themselves (IdP issuer for SSO, Git remotes, an audit/SIEM collector,
user-initiated import pulls to a source tool's API, and whatever
requests the user's own rules/workflows make). This
document is the published specification of every phone-home payload; if
a request is not listed here, the app does not make it. The app is
fully functional with all of these unreachable or disabled — see the
per-endpoint off switches.

The only usage data that ever leaves is the anonymous telemetry channel
of section 4: a typed
allowlist of feature-usage counts, structurally incapable of carrying
URLs, headers, traffic, or identity, default-on for desktop/extension/CLI
with a one-switch opt-out, and hard-off for the daemon, served web app,
and MCP server. The license system itself remains
telemetry-free: license endpoints and telemetry never share identifiers,
payloads, or deployments.

The extension's OpenHeaders-bound calls are that telemetry channel
(section 4) and the anonymous static-file reads of section 5 (release
notes and the latest-version manifest behind the desktop-download
link); browser store distribution owns its updates.

## 1. License refresh

Self-serve subscription renewal. Node hosts only
(desktop main process and the daemon — never the extension). The agent
only ever *delivers* files: the response is verified offline against the
compiled-in Ed25519 trust ring before anything persists; no online
validation path exists.

- **Endpoint**: `POST https://license.openheaders.com/refresh`
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

Anonymous check, staging by default, and a restart that is never
unprompted: an available update
may download in the background (default on, one switch to off), but a
running app is only ever restarted by an explicit "Update & Restart"
click or a quit that happens anyway. The `oh` CLI additionally
self-updates between invocations on self-managed binary installs
(default on, `oh autoupdate off` to stop) — it swaps its own binary so
the next run launches the new version, restarting nothing. Who checks:
desktop packaged builds on macOS/Windows and Linux AppImage, the `oh`
CLI (daily cached), and the `ohd` daemon only on `ohd status` or its
default-off opt-in unattended mode. Dev builds, deb/rpm installs,
container images, and npm/brew installs make no update requests —
their owning channel updates them.

- **Endpoint**: the update feed,
  `GET https://updates.openheaders.com/desktop/stable/latest.yml`
  (`latest-mac.yml` / `latest-linux.yml` per platform) — a static
  pointer file read by electron-updater's generic provider. Only after
  the user chooses to download, the installer artifact itself is
  fetched from the URL the pointer file carries — the feed's own
  `dl/<tag>/` path on the same host. The entire update lifecycle
  reaches exactly one first-party domain (`updates.openheaders.com`,
  served by Cloudflare, subject to its hosting logs); GitHub hosts a
  redundant human-browsable copy but is never contacted by the app.
- **Request body**: none. These are plain HTTP `GET`s; no identifier,
  license, or machine information is attached beyond what any HTTP
  client sends.
- **Cadence**: at most once a day (±10 min jitter) plus explicit
  "Check now" clicks. A found update downloads in the background by
  default (`updates.autoDownload`, one switch to off) from the same
  first-party feed; applying it happens only on an explicit Update &
  Restart or a natural app quit — never mid-session.
- **Off switch**: `updates.check: off` in Settings → Updates (also
  `security-only` to limit notifications), `updates.autoDownload: off`
  to stop background downloads while keeping the check,
  `OH_DISABLE_UPDATE_CHECKS=1` for test rigs. CLI: `oh autoupdate off`
  and `OH_NO_UPDATE_CHECK`. Daemon: unattended mode stays off unless
  `updates.autoUpdate` is explicitly enabled.

Linux deb installs are the one case where the update traffic is the
system's, not the app's: installing the deb registers the OpenHeaders
apt repository (`/etc/apt/sources.list.d/openheaders.list`), so your
package manager's own `apt update` fetches the signed repository
indexes (`dists/…/InRelease`, `Packages`) and any upgrade's `.deb` from
`https://updates.openheaders.com/apt/<channel>/` on the schedule your
system already uses — the app itself makes no update requests. These
are plain `GET`s of static files, verified against the archive signing
key the package installs to
`/usr/share/keyrings/openheaders-archive-keyring.asc`. Opt out of the
registration by creating `/etc/default/openheaders` with
`OPENHEADERS_ADD_REPO="false"` before installing, or remove the
sources entry afterwards; uninstalling the package removes both files.

## 3. Severity manifest

A small static severity manifest published to the update feed on each
release — `{ latest, tag, severity, minimumSafeVersion }` per app, so a
security release can escalate loudly (red badge, entry banner).
Severity is authored by a human before each release, never derived
from anything about your install.

- **Endpoint**: `GET https://updates.openheaders.com/versions/stable.json`
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

Anonymous usage counting — which features get used,
nothing more. The event vocabulary is a typed allowlist compiled into
the app (`packages/core/src/telemetry/`): every payload property is a
closed union, boolean, or number; free-form strings are banned by a
guard test, so URLs, hostnames, header names or values, rule contents,
request/response data, and file paths are inexpressible. The in-app
inspector (Settings → General → View telemetry events) shows every
event of the current session byte for byte, sent or suppressed.

- **Endpoint**: `POST https://telemetry.openheaders.com/v1/events`
- **Request headers**: `content-type: application/json`
- **Request body** — a batch envelope, exactly these fields:

```json
{
  "schemaVersion": 2,
  "host": "extension",
  "channel": "chrome-store",
  "appVersion": { "year": 2026, "month": 8, "patch": 0 },
  "platform": "mac",
  "browser": "firefox",
  "locale": "en",
  "sessionId": "c0ffee00c0ffee00c0ffee00c0ffee00",
  "installId": "feedface00feedface00feedface0000",
  "sinceInstall": "2-7",
  "sessionAge": "1-8h",
  "sentAt": 1760000000000,
  "events": [
    { "name": "first_run" },
    { "name": "session_start", "rules": "1-5", "workspaces": "0" },
    { "name": "feature_used", "feature": "workflow-editor" },
    { "name": "rule_created", "ruleType": "header", "origin": "editor" },
    { "name": "rule_matched", "ruleType": "header" },
    { "name": "import_run", "source": "postman", "ok": true },
    { "name": "workflow_run", "ok": true },
    { "name": "error_beacon", "code": "ws-connect-failed" },
    { "name": "license_activated", "plan": "individual" },
    { "name": "paywall_hit", "surface": "seat-gate" },
    { "name": "upgrade_cta_shown", "surface": "license-pane" },
    { "name": "upgrade_cta_clicked", "surface": "grace-banner" },
    { "name": "mcp_client_connected", "client": "claude-code" }
  ]
}
```

  - `host` — which surface sent the batch, only ever
    `desktop`/`extension`/`cli` (the daemon, served web app, and MCP
    server are hard-off and have no vocabulary member). Clients built
    before 2026.8 carried it on `session_start` instead; the worker
    accepts both.
  - `channel`, `appVersion`, `platform`, `browser`, `locale` — the
    remaining per-process facts, hoisted to the envelope alongside
    `host` (2026-08 second rev) so every stored row is segmentable
    without joins. All closed unions or integers: `channel` is the
    static distribution fact (which store or package manager the build
    shipped through — never sniffed from traffic); `appVersion` is the
    CalVer version as integers, plus a `beta` iteration on pre-release
    builds; `platform` is omitted where the running OS has no
    vocabulary member; `browser` exists only on browser-hosted
    surfaces; `locale` is the resolved interface language from the
    shipped catalog, with anything outside it reported as `other` —
    never a raw language tag. Earlier schema-v2 clients carried these
    on `session_start`/`first_run` instead; the worker accepts both.
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
  - `sessionAge` — how long this session has been running at the
    moment the batch is sent, only ever as one of five coarse buckets
    (`0-9m`, `10-59m`, `1-8h`, `8-24h`, `24h+`); precise durations are
    inexpressible. Added 2026-08 (S17); earlier clients omit it.
  - `events` — only the thirteen event shapes above exist, and every
    field value comes from a closed union checked into the
    repository. `first_run` fires once per install; `session_start`
    fires once per session per UTC day (a long-running browser or tray
    process re-announces itself daily — same event, same fields, no
    extra data) and carries only the coarse scale-of-use buckets:
    `rules`/`workspaces` use coarse buckets
    (`0`, `1`, `2-5`, `6-20`, `21-100`, `100+` — clients built before
    2026-08 send the older `1-5` and `21+` spans, still accepted),
    never exact counts. `rule_created`
    carries `origin` — which in-app affordance created the rule, one of
    `editor`, `quick-editor`, `empty-state-nudge`. `rule_matched` fires
    at most once per rule type per session per UTC day when a rule of
    that type acts on a request — it carries the rule type and nothing
    about the request. The four monetization shapes (2026-08, S20)
    carry one closed-union value each: `license_activated` fires only
    on a license install you perform yourself (background license
    refreshes never emit) with `plan` as a coarse bucket
    (`free`/`individual`/`team`) — never a license id, key, licensee,
    or seat count; `paywall_hit` and the `upgrade_cta_*` pair carry
    only which in-app spot was involved (`seat-gate`, `license-pane`,
    `grace-banner`), with `upgrade_cta_shown` firing at most once per
    spot per session per UTC day. `mcp_client_connected` (2026-08, S21)
    fires from the desktop app at most once per client per session per
    UTC day when an AI tool completes the MCP `initialize` handshake
    against the app's embedded MCP server — it carries only which
    client family connected (`claude-code`, `claude-desktop`, `cursor`,
    `windsurf`, `vscode`, `other`); a client not on that list reports
    `other`, never its name, and nothing about the agent's session,
    tools, or data is expressible. (The MCP server itself still sends
    no telemetry — this is the desktop app counting that its MCP
    surface is in use, and a standalone server deployment counts
    nothing.) Every other per-process fact rides the envelope.
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
  and is the only processor named in the privacy policy). Stored
  column positions never change meaning; a column may be shared across
  event names carrying the same kind of fact (the external source id
  of `import_run`/`mcp_client_connected`), split by event name when
  queried. Storage is a two-member dataset family (2026-08, S25):
  events from installed apps land in the product dataset, while the
  two anonymous landing-page rows described below
  (`uninstall_reason`, `download_clicked`) land in a separate web
  dataset with its own columns — they are unjoinable to installs by
  construction, and the storage boundary now matches that identity
  boundary. Monthly
  aggregate snapshots (counts only — ids are aggregated away) are
  committed to the repository as the long-term metrics ledger.
- **Uninstall ping (extension only)**: the extension registers
  `GET https://telemetry.openheaders.com/v1/uninstall?i=<installId>&a=<sinceInstall>&c=<channel>`
  as its browser uninstall URL — the page the browser opens when the
  extension is removed. It carries the install id plus two coarse
  vocabulary values already described above — `a` is the `sinceInstall`
  bucket at registration time and `c` is the distribution channel —
  counts one departure, and redirects to the farewell page at
  `https://openheaders.com/uninstall/`, passing only the validated
  `a`/`c` values along (the install id never leaves the worker). The
  worker validates both context values against their closed unions and
  stores nothing for anything else. It is registered only while the
  telemetry toggle is on and an install id exists; toggling off clears
  it (no id, no ping).
- **Uninstall micro-survey (2026-08, S20)**: the landing page the
  redirect opens may offer one optional "why did you uninstall?"
  picklist. Tapping an answer submits
  `GET https://telemetry.openheaders.com/v1/uninstall-reason?r=<reason>&a=<sinceInstall>&c=<channel>`
  — the reason is one of seven fixed values (`not-needed`,
  `not-working`, `missing-feature`, `too-complex`, `privacy`,
  `switching`, `other`) and the coarse context is the same pair the
  redirect carried. The stored row is anonymous by construction:
  no install id, no session, nothing joinable back to an install —
  free-text is inexpressible and an off-list value stores nothing.
  Skipping the question sends nothing at all.
- **Download-click beacon (website only, 2026-08, S23)**: clicking a
  desktop-installer link on openheaders.com sends
  `GET https://telemetry.openheaders.com/v1/download?t=<platform>` —
  `t` is one of `mac`, `win`, `linux` (the same closed union the apps
  report) and nothing else is attached. The stored row is anonymous by
  the same construction as the micro-survey: no install id, no
  session, nothing joinable. It counts a click on the website, never a
  download or an install; the apps themselves never call this route.
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

## 5. Static feed reads (release notes & download link)

Two more anonymous reads of static files on the same first-party feed
host (`updates.openheaders.com`). Like the severity manifest, these are
plain HTTP `GET`s of published files: no request body, no identifier,
no license or machine information — nothing beyond what any HTTP
client sends. Both are enhancement-only: every failure reads as
"section hidden" or "generic link", never an error.

- **What's New release notes**:
  `GET https://updates.openheaders.com/changelog/<stream>.json` (the
  stream index) and
  `GET https://updates.openheaders.com/changelog/<stream>/<version>.json`
  (one entry's body), where `<stream>` is `desktop` or `extension`.
  Fetched by the desktop app (main process, answering the What's New
  tab) and by the extension (directly from the What's New surface) —
  strictly on demand, only when the user opens the What's New history
  section. The bundled current-release notes never depend on it.
- **Latest-desktop-version manifest**:
  `GET https://updates.openheaders.com/versions/stable.json` — the same
  static file as section 3, read here for a different purpose: on
  extension and served-web surfaces that offer the optional "get the
  desktop app" link, it resolves the latest installer version so the
  link can point at a direct download. At most one fetch per page
  load, and only on pages that show that link; unreachable simply
  means the link falls back to the website's install section.

---

Anything else leaving the process is operator-configured or
user-initiated, not OpenHeaders-bound: the OIDC issuer you set, the
Git remotes you sync, the SIEM collector you point audit streaming at,
the HTTP requests your own rules, sources, and workflows define, and —
when you explicitly run an import that pulls from the source tool's
own API (such as the Postman Data API, with your own API key) — that
tool's documented endpoint, dialed once per import you trigger.
