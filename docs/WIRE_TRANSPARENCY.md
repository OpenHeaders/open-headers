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

The only usage data that ever leaves is the two anonymous telemetry
channels of section 4: a typed allowlist of feature-usage counts, and a
grammar-pinned report of crashes and unexpected errors (the kind of
failure and where in our own code it happened — never the message),
each structurally incapable of carrying URLs, headers, traffic, or
identity, each default-on for desktop/extension/CLI with its own
one-switch opt-out, and both hard-off for the daemon, served web app,
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
  The feed keeps a release's bytes while a pointer names it, plus the
  previous stable release; a download link to an older release
  redirects to that same copy on GitHub, blockmaps excepted — the
  app's own requests answer from the feed or not at all, so the
  pruning of old releases never adds a second domain to this path.
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

Linux deb/rpm installs are the one case where the update traffic is
the system's, not the app's: installing the package registers the
OpenHeaders repository — apt via
`/etc/apt/sources.list.d/openheaders.list`, dnf via
`/etc/yum.repos.d/openheaders.repo` — so your package manager's own
`apt update` / `dnf check-update` fetches the signed repository
indexes (`dists/…/InRelease` and `Packages`, or `repodata/repomd.xml`
with its detached signature) and any upgrade's package from
`https://updates.openheaders.com/apt/<channel>/` or `…/rpm/<channel>/`
on the schedule your system already uses — the app never downloads or
installs an update itself there. These are plain `GET`s of static
files, verified against the archive signing key the package installs
to `/usr/share/keyrings/openheaders-archive-keyring.asc` (deb) or
`/etc/pki/rpm-gpg/RPM-GPG-KEY-openheaders` (rpm). Opt out of the
registration by creating `/etc/default/openheaders` with
`OPENHEADERS_ADD_REPO="false"` before installing, or remove the
repository entry afterwards; uninstalling the package removes both
files.

The app's own traffic on deb/rpm installs is check-and-notify only:
the daily check `GET`s the static
`https://updates.openheaders.com/versions/<channel>.json` pointer file
(the same file and posture as the severity manifest, section 3 — no
identifier, no body, comparison local) so the UI can say a newer
version exists and point at your package manager. It never fetches an
artifact. The same off switches apply: `updates.check: off` and
`OH_DISABLE_UPDATE_CHECKS=1` silence it entirely.

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

Two channels, one worker, one switch each. **Anonymous usage
counting** — which features get used. The event vocabulary is a typed
allowlist compiled into the app (`packages/core/src/telemetry/`): every
payload property is a closed union, boolean, or number; free-form
strings are banned by a guard test, so URLs, hostnames, header names or
values, rule contents, request/response data, and file paths are
inexpressible. **Crash and error reports** (2026-10, the second
channel, documented after the usage channel below) — what kind of
failure happened and where in our own code, never the message. The
in-app inspector (Settings → General → "View events" / "View reports")
shows every event and every report of the current session byte for
byte, sent or suppressed.

- **Endpoint**: `POST https://telemetry.openheaders.com/v1/events`
- **Request headers**: `content-type: application/json`
- **Request body** — a batch envelope, exactly these fields:

```json
{
  "schemaVersion": 3,
  "host": "extension",
  "channel": "chrome-store",
  "appVersion": { "year": 2026, "month": 10, "patch": 3 },
  "platform": "mac",
  "arch": "arm64",
  "browser": "firefox",
  "locale": "en",
  "osVersion": 15,
  "browserVersion": 131,
  "sessionId": "c0ffee00c0ffee00c0ffee00c0ffee00",
  "installId": "feedface00feedface00feedface0000",
  "sinceInstall": "2-7",
  "sessionAge": "1-8h",
  "sentAt": 1760000000000,
  "state": {
    "stage": "activated",
    "rules": "2-5",
    "requests": "1",
    "workspaces": "1",
    "sync": "local",
    "role": "none",
    "team": "1",
    "profile": "both",
    "activeDays": "4-9",
    "migratedFrom": "postman"
  },
  "events": [
    { "name": "first_run" },
    { "name": "session_start" },
    { "name": "milestone", "kind": "first_rule_created" },
    { "name": "feature_used", "feature": "workflow-editor" },
    { "name": "rule_created", "ruleType": "header", "origin": "editor" },
    { "name": "rule_matched", "ruleType": "header" },
    { "name": "request_sent", "protocol": "http" },
    { "name": "import_run", "source": "postman", "ok": true },
    { "name": "workflow_run", "ok": true },
    { "name": "share_sent", "route": "server-admin", "role": "editor", "members": "2-5" },
    { "name": "share_accepted", "route": "server", "role": "editor" },
    { "name": "error_beacon", "code": "ws-connect-failed" },
    { "name": "license_activated", "plan": "individual" },
    { "name": "limit_hit", "limit": "seats" },
    { "name": "upgrade_cta_shown", "surface": "license-pane" },
    { "name": "upgrade_cta_clicked", "surface": "grace-banner" },
    { "name": "mcp_client_connected", "client": "claude-code" },
    { "name": "viewport_seen", "surface": "workbench", "width": 1280, "height": 800 }
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
  - `arch` — the CPU architecture the process runs as, only ever
    `x64`, `arm64`, or `x64-on-arm64` (an x64 build running translated
    on an arm64 machine — Rosetta on a Mac, the Windows on Arm
    emulation layer); omitted where the architecture is anything else.
    The desktop app reads the translation fact from its runtime, the
    extension reports its browser's architecture, the command-line
    tool its own binary's. Added 2026-10 (S34); earlier clients omit
    it.
  - `osVersion`, `browserVersion` — the operating-system and browser
    MAJOR versions as people know them (macOS 15, Windows 11, Chrome
    130), each a single small integer: never a build number, never a
    dotted version string. Both are omitted wherever the major cannot
    be read reliably: the OS on Linux everywhere (a kernel number says
    nothing about the product), the OS on Firefox and Safari (their
    user-agent strings freeze it), and `browserVersion` on anything but
    a browser-hosted surface. The desktop app reads its runtime's
    system version (Windows 11 is told from Windows 10 by build), the
    extension reads the browser's own version token and, on Chromium,
    the Client Hints platform version; the command-line tool maps the
    kernel release. Added 2026-10 (S35); earlier clients omit both.
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
  - `state` (schema 3, 2026-10) — one snapshot of the install's
    slowly-changing facts, read when the batch is sent and stamped on
    every event in it (an event queued before a change carries the
    state at send time, not at the moment it happened). Every member is
    a word from a closed list or a coarse bucket, never a count. `stage`
    is how far the install has got on a fixed ladder — `installed`
    (nothing saved), `configured` (a rule or a saved request exists),
    `activated` (a rule has matched or a request has been sent, ever),
    `retained` (activated and active on three distinct days), `team` (a
    workspace role, or a shared workspace accepted) — the highest
    reached. `rules`, `requests`, `workspaces` are the scale buckets
    `session_start` used to carry (`0`, `1`, `2-5`, `6-20`, `21-100`,
    `100+`), `requests` counting saved requests across every workspace
    and protocol; `sync` is `local`, `server` or `git` as before. `plan`
    is the install's own license as `free`, `individual` or `team` —
    stamped by the desktop app from its license file; the extension and
    the command-line tool carry none. `role` is the highest workspace
    role this install's person holds in the directory it runs — `none`,
    `owner`, `editor`, `viewer`; `team` is the member count of the
    largest workspace the install belongs to, as one of `1`, `2-5`,
    `6-10`, `11-50`, `51+` — buckets, never a seat count. `profile`
    says which half of the product has ever been used — `none`,
    `interceptor`, `api-client`, `both`. `activeDays` is how many
    distinct UTC days of the last 28 the install was active, as `1`,
    `2-3`, `4-9`, `10+`, kept as a 28-bit mask on the device.
    `migratedFrom` is the source of the first import that succeeded
    (`postman`, `insomnia`, `bruno`, `modheader`, `requestly`, `har`,
    `openapi`, `other`), `none` until one does, `unknown` on installs
    older than this schema. `rules`, `requests`, `workspaces`, `sync`,
    `plan`, `role` and `team` are omitted wherever a host cannot read
    the fact (the command-line tool reads no workspace; a client joined
    to a server it does not run knows neither its role nor the team's
    size, because the server holds its grant) — never guessed. The
    block is the install's own description of itself, not our
    definition: the warehouse derives the same stages from the events
    and compares the two. Clients built before 2026.10 send
    `schemaVersion: 2` with no block; the worker accepts both.
  - `events` — only the shapes above exist, and every field value
    comes from a closed union checked into the repository. `first_run`
    fires once per install; `session_start` fires once per session per
    UTC day (a long-running browser or tray process re-announces itself
    daily — same event, same fields, no extra data) and, since schema 3,
    carries nothing — the measurements it used to carry (`rules`,
    `workspaces`, `sync`, the same buckets) ride the envelope's `state`
    block; schema-2 clients still send them on the event (clients built
    before 2026-08 send the older `1-5` and `21+` spans, still accepted;
    one configured server connection anywhere reads `server` — the
    desktop app's own loopback wire is pairing, not a server — never a
    URL, a host name, or a count). `milestone` (2026-10) fires once per
    install per `kind` — `first_rule_created`, `first_rule_matched`,
    `first_request_sent`, `first_import`, `first_workflow_run`,
    `first_share_sent`, `first_share_accepted`,
    `first_server_connected`, `first_mcp_client`, `first_license` — a
    once-ever bit per kind kept on the device, so the envelope's
    `sinceInstall` on that row says how long a first took, in buckets;
    an install that already had rules or requests when this schema
    reached it marks the firsts it has evidently passed without sending
    them. `rule_created` carries `origin` — which in-app affordance
    created the rule, one of `editor`, `quick-editor`,
    `empty-state-nudge`. `rule_matched` fires at most once per rule
    type per session per UTC day when a rule of that type acts on a
    request — it carries the rule type and nothing about the request.
    `request_sent` (2026-10) fires at most once per protocol per
    session per UTC day when a request leaves the API client — `http`,
    `graphql`, `grpc`, `ws`, `sse`, `mqtt` — and carries nothing about
    the request. `import_run` carries the source format and whether it
    succeeded; `workflow_run` whether it succeeded. `share_sent`
    (2026-10) fires when this install grants someone access to a
    workspace — `route` is how (`server-admin` today; `server-owner`,
    `git` and `export` are defined for later), `role` the role granted
    (`owner`, `editor`, `viewer`), `members` the workspace's size after
    the grant as a scale bucket — never who. `share_accepted` fires once
    per workspace per install when a workspace shared with this install
    first syncs down over a network connection — `route` is `server`
    (`idp` and `git` are defined for later), `role` is added once the
    server has said it; the once-per-workspace latch is kept on the
    device and the workspace's id never rides. The monetization shapes
    carry one closed-union value each: `license_activated` fires only
    on a license install you perform yourself (background license
    refreshes never emit) with `plan` as a coarse bucket
    (`free`/`individual`/`team`) — never a license id, key, licensee,
    or seat count; `limit_hit` (2026-10) says which ceiling an install
    ran into — `seats`, `service-accounts`, `dnr-rules` — and replaces
    `paywall_hit` and the `dnr-rule-limit` error code on current
    clients (both still accepted from older ones); the `upgrade_cta_*`
    pair carries only which in-app spot was involved (`seat-gate`,
    `license-pane`, `grace-banner`, `service-gate`), with
    `upgrade_cta_shown` firing at most once per spot per session per
    UTC day. `mcp_client_connected` (2026-08, S21)
    fires from the desktop app at most once per client per session per
    UTC day when an AI tool completes the MCP `initialize` handshake
    against the app's embedded MCP server — it carries only which
    client family connected (`claude-code`, `claude-desktop`, `cursor`,
    `windsurf`, `vscode`, `other`); a client not on that list reports
    `other`, never its name, and nothing about the agent's session,
    tools, or data is expressible. (The MCP server itself still sends
    no telemetry — this is the desktop app counting that its MCP
    surface is in use, and a standalone server deployment counts
    nothing.) `viewport_seen` (2026-10, S35) fires at most once per UI
    surface per session per UTC day when a surface opens and carries
    which surface it was (`popup`, `sidepanel`, `devpanel`,
    `workbench`) and its size class as two coarse floors — `width` is
    one of `0`, `360`, `480`, `640`, `800`, `1024`, `1280`, `1600`,
    `1920` and `height` one of `0`, `400`, `600`, `800`, `1000`,
    `1200`, each meaning "at least this, under the next" — so an exact
    window size is inexpressible. The same slice added one
    `feature_used` value, `extension-paired`, which the desktop app
    records when a browser extension completes the sync handshake
    against it (the desktop and the extension are in use together);
    it carries nothing about the extension. Every other per-process
    fact rides the envelope.
- **Response**: `202` when the envelope validates, `4xx` otherwise.
  The client never acts on the status either way — failures are
  silent, the batch simply rides the next flush, and nothing ever
  retries aggressively, blocks, or degrades the app.
- **Storage**: the worker validates against the same compiled schema
  and keeps each accepted envelope as it arrived (2026-10) — one
  immutable object per batch in a Cloudflare R2 bucket in the EU
  jurisdiction, under a key made of the UTC day, the hour and a random
  name — adding exactly two values of its own: the time it was received
  and the **coarse two-letter country code** Cloudflare resolves at its
  edge (`cf-ipcountry`). The IP address it derives from is never read
  into the object, and no other request header is either; no
  third-party analytics SDK or processor is involved (Cloudflare already
  hosts the license worker and is the only processor named in the
  privacy policy). The bucket's lifecycle rule deletes every object
  thirteen months after it was written; that rule is the retention law.
  Once a day, a loader we run ourselves reads the closed day's objects
  into a Postgres warehouse — one row per event, exactly the columns of
  the table below, generated from the same registry as the table —
  where SQL views derive the aggregates we read (installs by stage,
  weekly cohorts, daily counts, each ratio beside its bases); the raw
  rows follow the same thirteen-month schedule and the aggregates, which
  carry no identifier, are kept. The two anonymous landing-page rows
  described below (`uninstall_reason`, `download_clicked`) ride the same
  archive as envelope-less records with no install id and no session —
  unjoinable to installs by construction. During the changeover the
  worker also still writes one Cloudflare Workers Analytics Engine data
  point per event — the previous store, whose rows expire after about
  ninety days — until the dashboard that read it retires; the data is
  the same either way.
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
  interval and best-effort on quit. The command-line tool's process
  ends with its command, so an envelope its quit flush could not
  deliver in time is sealed into `telemetry-outbox.json` beside its
  config file and sent at the start of the next command (2026-10); a
  channel turned off deletes what it sealed, and the warehouse ignores
  a redelivery of a batch that did land the first time.
- **Off switches**: Settings → General → "Anonymous usage counting"
  (extension and desktop), `OH_TELEMETRY=0` env var or the `telemetry`
  config key (CLI). The daemon, served web app, and MCP server never
  send telemetry and have no toggle to misconfigure. Off means off: the
  channel goes silent entirely, with no "essential telemetry" residue.
- **Strict channel separation**: no license id, subscription ref,
  licensee email, seat data, or OIDC subject can appear in an event —
  the vocabulary has no such fields — and the telemetry worker is a
  separate deployment sharing no secrets or code paths with the
  license worker beyond the published schema.

### What the warehouse keeps, column by column

One row per event. `From` names the wire field in this document's
words — `envelope.*` the batch fields above, `event.*` the event's
own, `edge.*` the two values the worker adds, `row.*` the archive
object's identity (its key and the event's position in it), `web.*`
the landing-page records; `Rows` names the events that declare a
column, which is empty on every other row. Generated from the
warehouse's column registry — the table and the schema are one
definition.

| Column | Type | From | Rows |
|---|---|---|---|
| `object_key` | text | `row.objectKey` | every row |
| `line_index` | integer | `row.lineIndex` | every row |
| `provenance` | text | `row.provenance` | every row |
| `sample_interval` | integer | `row.sampleInterval` | every row |
| `received_at` | timestamptz | `edge.receivedAt` | every row |
| `day` | date | `edge.receivedAt (UTC day)` | every row |
| `name` | text | `event.name` | every row |
| `schema_version` | integer | `envelope.schemaVersion` | every row |
| `host` | text | `envelope.host` | every row |
| `channel` | text | `envelope.channel` | every row |
| `platform` | text | `envelope.platform` | every row |
| `browser` | text | `envelope.browser` | every row |
| `locale` | text | `envelope.locale` | every row |
| `country` | text | `edge.country` | every row |
| `version_year` | integer | `envelope.appVersion.year` | every row |
| `version_month` | integer | `envelope.appVersion.month` | every row |
| `version_patch` | integer | `envelope.appVersion.patch` | every row |
| `version_beta` | integer | `envelope.appVersion.beta` | every row |
| `app_version` | text | `envelope.appVersion (CalVer label)` | every row |
| `arch` | text | `envelope.arch` | every row |
| `os_version` | integer | `envelope.osVersion` | every row |
| `browser_version` | integer | `envelope.browserVersion` | every row |
| `install_id` | text | `envelope.installId` | every row |
| `session_id` | text | `envelope.sessionId` | every row |
| `since_install` | text | `envelope.sinceInstall` | every row |
| `session_age` | text | `envelope.sessionAge` | every row |
| `stage` | text | `envelope.state.stage` | every row |
| `rules` | text | `envelope.state.rules (schema 2: session_start.rules)` | every row |
| `requests` | text | `envelope.state.requests` | every row |
| `workspaces` | text | `envelope.state.workspaces (schema 2: session_start.workspaces)` | every row |
| `sync` | text | `envelope.state.sync (schema 2: session_start.sync)` | every row |
| `plan` | text | `envelope.state.plan` | every row |
| `role` | text | `envelope.state.role` | every row |
| `team` | text | `envelope.state.team` | every row |
| `profile` | text | `envelope.state.profile` | every row |
| `active_days` | text | `envelope.state.activeDays` | every row |
| `migrated_from` | text | `envelope.state.migratedFrom` | every row |
| `milestone` | text | `event.kind` | milestone |
| `rule_type` | text | `event.ruleType` | rule_created, rule_matched |
| `origin` | text | `event.origin` | rule_created |
| `protocol` | text | `event.protocol` | request_sent |
| `import_source` | text | `event.source` | import_run |
| `ok` | boolean | `event.ok` | import_run, workflow_run |
| `route` | text | `event.route` | share_sent, share_accepted |
| `share_role` | text | `event.role` | share_sent, share_accepted |
| `share_members` | text | `event.members` | share_sent |
| `tool` | text | `event.tool (schema 2: feature_used.feature)` | tool_used |
| `surface` | text | `event.surface` | surface_opened |
| `width` | integer | `event.width (floor)` | surface_opened |
| `height` | integer | `event.height (floor)` | surface_opened |
| `cta_id` | text | `event.id` | cta |
| `cta_action` | text | `event.action` | cta |
| `spot` | text | `event.spot (schema 2: the monetization surface)` | cta, limit_hit |
| `limit_kind` | text | `event.limit` | limit_hit |
| `license_plan` | text | `event.plan` | license_activated |
| `mcp_client` | text | `event.client` | mcp_client_connected |
| `peer` | text | `event.peer` | peer_connected |
| `help_topic` | text | `event.topic` | help_opened |
| `code` | text | `event.code` | error_beacon |
| `reason` | text | `web.reason` | uninstall_reason |
| `sent_at` | timestamptz | `envelope.sentAt` | every row |

### Crash and error reports (2026-10)

When the app crashes or hits an error it did not expect — a render
error a containment boundary caught, an uncaught exception, an
unhandled promise rejection, a renderer or GPU process gone, a window
that stopped responding, a previous run that never reached a clean
quit — it reports **what kind of failure it was and where in the app's
own code it happened**. The message never travels: a report carries the
error's class name and the *template* its message matched, the
positions of the frames in Open Headers' own bundles, and the React
component names on the path. Every string on this channel is admitted
only under a pinned grammar that cannot express a URL, a path, a header,
whitespace, or a quote (the grammar table below); a guard test asserts
every string field carries its pin.

- **Endpoint**: `POST https://telemetry.openheaders.com/v1/errors`
- **Request headers**: `content-type: application/json`
- **Request body** — a batch envelope, exactly these fields (the usage
  envelope's per-process facts, minus the install identity and the
  events, plus the reports):

```json
{
  "schemaVersion": 1,
  "host": "desktop",
  "channel": "github-release",
  "appVersion": { "year": 2026, "month": 10, "patch": 2 },
  "platform": "mac",
  "arch": "arm64",
  "locale": "en",
  "osVersion": 15,
  "sessionId": "c0ffee00c0ffee00c0ffee00c0ffee00",
  "sessionAge": "10-59m",
  "sentAt": 1760000000000,
  "reports": [
    {
      "kind": "render-error",
      "process": "renderer",
      "surface": "request-edit",
      "errorName": "TypeError",
      "template": "cannot-read-property",
      "frames": [
        { "file": "index-abc123.js", "line": 1, "col": 48213, "fn": "renderRows" },
        { "external": true }
      ],
      "componentStack": ["RequestEditor", "WorkbenchTabBody"],
      "fingerprint": "0123456789abcdef",
      "count": 1
    },
    { "kind": "renderer-gone", "process": "renderer", "reason": "oom", "exitCode": 5, "reopenCount": 0,
      "frames": [], "fingerprint": "89abcdef01234567", "count": 1 },
    { "kind": "abnormal-exit", "process": "main", "frames": [], "fingerprint": "fedcba9876543210", "count": 1 }
  ]
}
```

  - `host`, `channel`, `appVersion`, `platform`, `arch`, `browser`,
    `locale`, `osVersion`, `browserVersion`, `sessionAge` — the usage
    envelope's per-process facts, same closed unions and integers, so a
    stability read segments the way a usage read does.
  - `sessionId` — the SAME random per-launch id the usage channel
    mints, held in memory only. **No install identifier** on this
    channel, by design: a report cannot be joined to an install, only
    to the launch it happened in. Crash-free sessions and distinct
    sessions per fingerprint read without any durable identity.
  - `reports` — one to ten per envelope. Each carries:
    - `kind` — one of `render-error`, `uncaught-exception`,
      `unhandled-rejection`, `renderer-gone`, `child-process-gone`,
      `unresponsive`, `abnormal-exit`.
    - `process` — one of `main`, `renderer`, `service-worker`, `popup`,
      `sidepanel`, `devtools-panel`, `offscreen`, `gpu`, `utility`,
      `cli`.
    - `surface` — for a render error, the workbench unit whose
      containment boundary caught it: a tab mode or a tool-window id
      from the closed list compiled into the app (`request-edit`,
      `http-rules`, …). Never a title, a name, a URL.
    - `errorName` — the built-in class: `TypeError`, `RangeError`,
      `ReferenceError`, `SyntaxError`, `URIError`, `DOMException`,
      `AggregateError`, `Error`, or `other` for anything else.
    - `template` — which engine message *template* the message matched,
      never a character of the message itself: `cannot-read-property`,
      `cannot-set-property`, `not-a-function`, `not-a-constructor`,
      `not-defined`, `not-iterable`, `access-before-init`,
      `assign-to-constant`, `max-call-stack`, `invalid-array-length`,
      `json-parse`, `out-of-memory`, `react-minified` (with the React
      error number as `reactError`, an integer), one of the
      DOMException spec names (`AbortError`, `NotFoundError`, …), or
      `other`. The identifier inside a message (the `'foo'` in
      `reading 'foo'`) is dropped — the frames already pinpoint the
      line.
    - `code` — for a failure one of our own typed errors raised, its
      code from a closed list (today one member, `bridge-call-failed`).
    - `reason`, `exitCode`, `reopenCount` — for a gone or hung process,
      the runtime's own typed reason (`clean-exit`, `abnormal-exit`,
      `killed`, `crashed`, `oom`, `launch-failed`, `integrity-failure`,
      `memory-eviction`), its exit code, and how many automatic reopens
      preceded it. No memory snapshot of any kind is ever taken.
    - `frames` — the stack, at most twenty entries. A frame is named
      (`file`, `line`, `col`, optional `fn`) **only when it comes from
      Open Headers' own bundle**: a file under the app's own origin
      (the extension's own URL, the desktop app's own package, the
      command-line tool's own script) whose name is a built bundle
      (`name.js` / `name.mjs`). Every other frame — a user script, an
      `eval`, another extension's content script, the runtime's
      internals, a development source file — is the single marker
      `{ "external": true }`, and a run of them folds into one. Code
      outside our bundles can therefore never contribute an identifier.
    - `componentStack` — for a render error, the React component names
      on the path, innermost first, at most sixteen.
    - `fingerprint` — sixteen hex chars of a hash over the kind, the
      class, the template, our code, the reason and the first four own
      frames: a group key, not an identity.
    - `count` — occurrences of this fingerprint folded into one report
      since the last flush. A storm is a count, not a flood.
  - **The grammar table** — every string this channel can carry and
    the regular expression that pins it:

    | Field | Grammar |
    |---|---|
    | `fn`, each `componentStack` entry | `^[A-Za-z_$][\w$]{0,63}$` — an identifier: no dot, no slash, no space, no quote |
    | `file` | `^[\w.-]{1,80}\.m?js$` — a bundle basename: no directory, no query, no `.tsx` source |
    | `fingerprint` | `^[0-9a-f]{16}$` |
    | `sessionId` | `^[0-9a-f]{32}$` |
    | everything else | a closed union, an integer, or a boolean — no string type at all |

- **Bounded**: one report per fingerprint, process and surface per
  session per UTC day (a repeat in the same place is counted, not
  re-sent; the same fingerprint in another process or surface is its
  own report, so a group says everywhere it was seen), at most twenty
  new reports per day, ten reports per envelope, one report at most
  3 KB serialized — anything larger is dropped and shown as dropped in
  the inspector, never truncated.
- **Response**: `202` when the envelope validates against the same
  compiled schema, `4xx` otherwise. Failures are silent; the batch
  rides the next flush.
- **Storage**: a third member of the dataset family
  (`openheaders_telemetry_errors_v1`), its own column layout, **indexed
  by fingerprint** — a storm of one fingerprint samples itself while
  rare fingerprints stay whole. It carries the vocabulary values, the
  session id and the coarse edge country code described above; no
  install id exists to store.
- **Cadence**: a report flushes the moment it is recorded (a crash is
  not a thing to batch for a minute); the usage interval is the retry
  cadence and the quit flush the last chance.
- **Off switch**: Settings → General → "Crash and error reports"
  (extension and desktop), independent of usage counting — either
  switch can be off alone; `OH_TELEMETRY=0` silences both on the
  command-line tool, and the `errorReports` config key silences this
  one. Hard-off on the daemon, the served web app and the MCP server:
  they contain containment and nothing to report with. Off stops
  recording and sending, nothing more: a report queued before the
  switch went off was recorded with consent and never left the device,
  so it is held — still `pending` in the inspector, delivered only if
  the switch comes back on in the same session, gone with the session
  otherwise. This is the runtime crash reporters' convention (upload
  paused, nothing purged); usage counting's switch discards its unsent
  queue, because a usage log is discarded on opt-out and a crash
  report is paused.
- **No minidumps, no logs, no breadcrumbs**: the runtime's crash
  reporter (process-memory snapshots) is never started — for an
  interception tool that holds header values in memory, a memory
  snapshot would be traffic by construction — and log lines never ride
  a report.

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
