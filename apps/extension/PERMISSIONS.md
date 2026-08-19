# Open Headers — Permissions Justification

This file lists every permission this extension requests, with a written
justification for each one. It is shipped inside the published extension
so store reviewers and security-conscious users can verify what we ask
for and why.

**Every new permission added to the manifest requires a corresponding
entry in this file at PR time.** If a permission lands without a
justification, the PR is incomplete.

**Trust commitment**: this extension is local-first. Its
OpenHeaders-bound calls are the documented anonymous product-telemetry
channel (typed feature counts, disclosed on first run, inspectable
byte-for-byte in Settings, off with one switch) and two anonymous
on-demand reads of static first-party files — the What's New release
notes when you open that section, and the latest-desktop-version
manifest that fills in the optional "get the desktop app" download
link — plain GETs with no identifier or payload; beyond those it makes
no network calls except the ones the user explicitly triggers, and
stores no data outside the user's browser profile.
`credentials: 'omit'` is hardcoded at the wire level for user-triggered
requests — the browser's cookie jar is only attached when a user opts in
per-request.

---

## Required permissions

| Permission | Why we ask for it |
|---|---|
| `storage` | `chrome.storage.local`, `.session`, and `.sync` hold the extension's entire persistent state: rules, requests, collections, environments, vault secrets, pause markers, UI preferences, and view-mode. Without this we have nowhere to put anything. |
| `alarms` | Two alarms: `updateBadge` (2 s, always on) refreshes the extension icon badge; `wsReconnect` (30 s, only when desktop auto-connect is enabled) retries the websocket handshake to the desktop companion. No calendar, schedule, or user-visible timers. Users who don't use desktop sync get zero extra wake-ups from the reconnect alarm. |
| `declarativeNetRequest` | The header / redirect / block / query-param rules engine runs through Chrome's native DNR API. Without it we cannot modify traffic. All rule actions are declared at rule-save time — extension JS never inspects or modifies live traffic at request time. |
| `declarativeNetRequestWithHostAccess` | Required to run DNR rules that modify headers on arbitrary hosts. The user's `<all_urls>` grant (see host permissions) authorizes DNR to touch those hosts. |
| `declarativeNetRequestFeedback` | `onRuleMatchedDebug` emits "this rule fired" events that drive the verdict engine + DevTools panel telemetry. Users see whether their rule actually fired on real traffic. No data leaves the extension. |
| `tabs` | Read tab URLs + titles to: (a) match rules against the current tab for the popup's "This Page" view, (b) compute per-tab request tracker state, (c) target session-scoped DNR rules at a specific tab during test runs. We do not read tab contents. |
| `tabGroups` *(Chrome, Edge & Firefox manifests; not on Safari)* | Visual transparency for desktop observation: while the paired desktop app (or an AI agent working through it, always on the user's own machine) is observing a tab's traffic, the extension places that tab in a blue tab group titled "OpenHeaders" so the user can SEE the observation directly in the tab strip; when observation ends the tab's prior grouping is restored. We only ever create/dissolve our own group — pre-existing user groups are never modified, and a tab the user pulls out of the group is left alone. No browsing data is read through this API. |
| `webRequest` | `onBeforeRequest` / `onCompleted` / `onErrorOccurred` listeners for request tracking + the verdict engine. Used only to observe whether requests matched user rules — no blocking on Chrome (MV3 DNR handles modification). |
| `webNavigation` | `onCommitted` events drive our MAIN-world script/CSS injection on navigation: we wait for the commit, then ask `chrome.scripting` to inject the user's inject-rule code at the right lifecycle point. |
| `debugger` *(Chrome/Edge only)* | Powers the opt-in **Debug mode** of the DevTools panel: `chrome.debugger.attach` on the inspected tab feeds CDP `Network.*` / `Page.*` events into the request-lifecycle correlator, surfacing what `webRequest` alone cannot (memory-cache serves, exact timings, response bodies on demand via `Network.getResponseBody`). Master switch is the `inspection.cdpEnabled` setting, **OFF by default** — attaching is always an explicit user choice, and the browser's own "started debugging this browser" banner stays visible on every attached tab for the duration. The service worker is the sole owner of the API; scope is limited to tabs the user is actively inspecting (per the Debug-mode scope setting). All captured data stays local. Not requested on Firefox/Safari (no CDP there). |
| `activeTab` | User-gesture access to the current tab for the DevTools panel's "Save this request to workspace" handoff. We never invoke tab access without a user gesture. |
| `scripting` | `chrome.scripting.executeScript` + `registerContentScripts` run the user's own inject-rule code (MAIN-world or ISOLATED world per user choice) and attach the delay-simulation shim. Only runs when an enabled, matching rule triggers. |
| `userScripts` *(Chrome/Edge only)* | `chrome.userScripts.execute` runs an inject-rule's own JavaScript when — and only when — that rule has **Bypass CSP** enabled, so a strict page Content-Security-Policy (including a `<meta>` CSP that no header strip can reach) cannot block the user's own script. This is the browser-sanctioned path for user-authored code and is strictly safer than the alternative of stripping the page's CSP wholesale. Availability is gated by the browser's user-scripts toggle (or the `UserScriptsAllowed` enterprise policy); when unavailable we fall back to the `<script>`-tag path. Never used for a rule without Bypass CSP. |
| `cookies` | Two user-facing surfaces: `chrome.cookies.getAll` powers the DevTools panel's cookie inspector (which cookies were in scope for a captured request), and the Storage panel's cookie editor lets the user set, edit, or delete cookies for a site they are inspecting (`chrome.cookies.set`/`remove`). Every write is an explicit user edit in that panel — the extension never modifies cookies on its own, and cookies are never uploaded anywhere. |
| `browsingData` | `chrome.browsingData.remove({ origins })` is called by the cache invalidator when a user's rules change. Clearing the HTTP cache for affected origins is the only way to guarantee a stale cached response doesn't mask a rule that would have fired. Scoped to specific origins — never a global wipe. |
| `windows` *(Chrome/Edge only)* | `chrome.windows.create` / `.get` for the pop-out window view-mode. Not used on Firefox. |
| `sidePanel` *(Chrome/Edge only)* | `chrome.sidePanel.setPanelBehavior` enables the persistent side-panel surface (one of four UI modes the user can pick). Firefox uses `sidebar_action`; Safari uses its own sidebar path. |
| `identity` | `chrome.identity.launchWebAuthFlow` + `getRedirectURL()` power the OAuth 2.0 / OIDC auth subsystem (ARCHITECTURE §18). Only invoked when the user clicks the "Authorize" button on a request's OAuth config. The authorization window opens against the provider's own endpoint; tokens are exchanged at the provider's token endpoint via the same `withHostAccess` fetch path every user request uses. Redirect URI is `https://<extension-id>.chromiumapp.org/` — pinned stable by the pre-registered manifest `key` (§Phase 1). |
| `offscreen` *(Chrome/Edge only)* | `chrome.offscreen.createDocument({ reason: 'IFRAME_SCRIPTING' })` hosts the script sandbox for pre-request / test scripts (ARCHITECTURE §19). User-provided JavaScript runs inside a sandboxed iframe (declared via the manifest's `sandbox.pages`, served with its own opaque origin and a CSP that allows `'unsafe-eval'` strictly within that iframe). The sandbox has no `chrome.*` access; every side-effecting operation (`oh.variables.get/set`, `oh.vault.get`, `oh.sendRequest`) crosses a postMessage boundary to the SW where it's checked + dispatched against the active workspace only. The offscreen doc is torn down after 30 s of idle. Firefox has no `chrome.offscreen`; script-using requests surface an "unsupported on this browser" hint per-request. |
| `proxy` *(Chrome, Edge & Firefox manifests; not on Safari)* | Powers the optional traffic-capture integration with the paired Open Headers desktop app. When the user explicitly enables capture for sites they choose, Chromium gets a locally generated PAC script (`chrome.proxy.settings.set`) that routes ONLY those user-selected hosts to the desktop app's capture proxy on `127.0.0.1`, with a DIRECT failover so browsing survives a dead proxy; Firefox answers the same decision per-request via `proxy.onRequest`. Everything out of scope goes DIRECT. We never configure a remote proxy, never route traffic off the user's machine, and never fight another controller — if proxy settings are held by another extension or policy we report the conflict and do nothing. The setting is cleared the moment capture is disabled or the desktop disconnects; without the desktop pairing the API is never invoked. |
| `favicon` *(Chrome/Edge only)* | Read-only access to the browser's own favicon cache via the `_favicon` extension endpoint, used to show each tab's site icon next to that tab in the tab inventory the extension shares with the paired desktop app (its tab picker and traffic views). Reading the local cache means zero extra network requests — it returns the exact icon the tab strip already shows, keyed by page URL, downscaled to 32 px and converted locally to a small `data:` URI (capped at 24 KB). Icons travel only over the loopback connection to the user's own desktop app, never to any server, and only for tabs already in that inventory while a desktop connection is active. |

| `nativeMessaging` *(Chrome, Edge & Firefox manifests; Brave and Chrome Beta load the Chrome build; not on Safari)* | `chrome.runtime.sendNativeMessage` to the Open Headers desktop app's bootstrap host (`io.openheaders.nm_bootstrap`) — ONE tiny message per pairing that hands the extension a short-lived session token, replacing the manual copy-paste pairing gesture when the desktop app is installed. The desktop side verifies the calling browser's code signature before releasing a token. Token handoff only: no page data, no traffic, and no other payload ever crosses this channel; the regular loopback WebSocket carries everything after bootstrap. Without the desktop app installed the API is never invoked. |

### Firefox-only

| Permission | Why |
|---|---|
| `webRequestBlocking` | Firefox still supports blocking webRequest in MV3; used for the narrow set of request-time modifications that DNR can't express (dynamic body mods where the value is computed from the request body). Chrome's MV3 disallows this entirely, so Chrome falls back to DNR + scripting-based paths. |

---

## Host permissions

| Host pattern | Why we ask for it |
|---|---|
| `<all_urls>` | This extension is a traffic-modification + API-testing tool: users author rules that act on arbitrary third-party hosts, and they test API requests against any URL they control. Asking for per-host grants on every rule creation would be unusable. In exchange for this broad permission: browsing traffic never leaves the extension (the only analytics is the documented anonymous product-telemetry channel — typed feature counts where URLs, headers, and traffic are inexpressible, off with one switch), no other background network activity, content scripts run in the ISOLATED world only, user-triggered fetches default to `credentials: 'omit'` (no implicit cookie-jar attachment), and the `withHostAccess(url, fn)` choke point in the codebase (`apps/extension/src/shared/fetch/with-host-access.ts`) is the single place a future "request hosts on first use" mode would plug in. |
| `file:///*` | So users can load + inspect rules against `file://` URLs — useful when testing a local HTML page, a locally-served API, or offline content. |

---

## Content scripts

### Always-on (declared in `manifest.content_scripts`)

Injected at `document_start` on every page, via `matches: ["<all_urls>"]`, in the **ISOLATED** world (cannot touch page globals or observe page DOM beyond what's explicitly listed):

| Script | What it does |
|---|---|
| `fire-bridge` | Listens for CustomEvents dispatched by MAIN-world user scripts (inject-rule code the user themselves authored) and forwards them to the service worker as typed messages. Does NOT access page DOM, does NOT touch page `window` globals, does NOT read page content. It is a typed message bus between the two JavaScript worlds on the same tab. |
| `perf-observer` | Subscribes to `PerformanceObserver` entries for resource timings so we can detect cached / bfcache-served responses (which don't trigger webRequest). Resource URLs + timing numbers only; no bodies, no headers, no page content. |

### On-demand (injected by `chrome.scripting`, not manifest-declared)

| Script | When it runs |
|---|---|
| User inject-rule code | Only when the user created an inject-rule and a matching URL loads. Runs in whichever world (ISOLATED or MAIN) the user's rule specifies. |

---

## Content Security Policy

`manifest.content_security_policy.extension_pages` governs what the
extension's pages + service worker can connect to or load. Our policy:

```
default-src 'self';
connect-src 'self' http: https: ws: wss: data: blob:;
style-src 'self' 'unsafe-inline';
script-src 'self';
font-src 'self' data:;
img-src 'self' data: blob:;
```

### Why `connect-src` is broad

This extension is an API-testing tool. The request executor runs in
the MV3 service worker and has to fire `fetch()` against arbitrary
third-party hosts on the user's behalf — the same category as
Postman / Insomnia / Thunder Client. MV3 applies the `extension_pages`
`connect-src` policy to the service worker too, so the policy must
authorize every scheme the user can legitimately test:

- `http:` / `https:` — API requests (the 99% case).
- `ws:` / `wss:` — native WebSocket testing + the optional
  desktop-sync channel (`ws://127.0.0.1:8137` by default).
- `data:` — DNR redirect targets for mocked responses (§22) and
  future inline fixtures.
- `blob:` — OPFS-spilled response bodies streamed back into the
  renderer (§17 future work).

The trust commitment stays the same: no undisclosed network, no
cookie changes the user didn't make themselves. The CSP authorizes
the user's own requests; it is
not a license for the extension to talk to the internet on its own.
Every outbound fetch either:
- Is a direct response to a user action (Send, test run, rule
  refresh schedule the user configured), OR
- Is the documented anonymous product-telemetry batch flush to
  `telemetry.openheaders.com` (typed event allowlist, disclosed on
  first run, one-switch off), OR
- Is one of the two anonymous static-file reads from
  `updates.openheaders.com` (What's New release notes when that
  section is opened; the latest-desktop-version manifest behind the
  optional desktop-download link) — plain GETs, no identifier or
  payload, documented in the wire-transparency spec, OR
- Routes through `withHostAccess(url, fn)` in
  `apps/extension/src/shared/fetch/with-host-access.ts` — the single
  choke point a future "request hosts on first use" minimal-
  permissions SKU would plug in.

### Why `style-src 'unsafe-inline'`

Ant Design (our UI library) injects component styles via runtime
CSS-in-JS — the generated `<style>` tags are inline by design. Every
React / Ant-Design extension that doesn't use a strict-CSP-compatible
styling library needs this. No external stylesheet sources are
allowed (`'self'` only) — `unsafe-inline` applies to tag-embedded
styles emitted by our own bundle.

### Why `font-src 'self' data:`

`'self'` covers fonts bundled into the extension package. `data:`
covers base-64 inlined font fixtures (common pattern for small
glyph sets). No external font sources are authorized.

### Why `script-src 'self'`

The strictest reasonable value for an extension. No remote scripts,
no `eval` (MV3 would reject `'unsafe-eval'` anyway). User-authored
inject-rule code runs through `chrome.scripting.executeScript` which
is NOT governed by this CSP — it uses the host page's world, not
ours.

## What this extension NEVER does

- No undisclosed data collection. The only analytics is the documented anonymous product-telemetry channel: typed feature counts (closed unions, no free-form strings — URLs, headers, and traffic are inexpressible), disclosed on first run, inspectable byte-for-byte in Settings, off with one switch. No crash reports sent off-device. The "Export logs" button exists so bug reports can be file-attached manually when the user chooses.
- No background network activity beyond that telemetry flush. The service worker otherwise only makes HTTP calls in response to an explicit user action (send a request, run a test, rebuild DNR rules from the configured refresh schedule).
- No reading of page DOM or page `window` globals from content scripts running in the ISOLATED world.
- No autonomous writing of cookies. Cookies are read in the DevTools cookie inspector, and written or deleted only when the user explicitly edits them in the Storage panel's cookie editor — never by the extension on its own, and never uploaded.
- No user data leaves the browser profile. The workspace manifest, request collections, rule definitions, vault secrets — all of it stays in `chrome.storage.local` / IndexedDB / OPFS on this machine.
