# Open Headers — Permissions Justification

This file lists every permission this extension requests, with a written
justification for each one. It is shipped inside the published extension
so store reviewers and security-conscious users can verify what we ask
for and why.

**Every new permission added to the manifest requires a corresponding
entry in this file at PR time.** If a permission lands without a
justification, the PR is incomplete.

**Trust commitment**: this extension is local-first. It sends no
telemetry, makes no network calls except the ones the user explicitly
triggers, and stores no data outside the user's browser profile.
`credentials: 'omit'` is hardcoded at the wire level for user-triggered
requests — the browser's cookie jar is only attached when a user opts in
per-request.

---

## Required permissions

| Permission | Why we ask for it |
|---|---|
| `storage` | `chrome.storage.local`, `.session`, and `.sync` hold the extension's entire persistent state: rules, requests, collections, environments, vault secrets, pause markers, UI preferences, and view-mode. Without this we have nowhere to put anything. |
| `alarms` | Periodic `keepAlive` tick (30 s) prevents the MV3 service worker from idling mid-batch during heavy rule edits, and the `updateBadge` tick (2 s) refreshes the extension icon badge. No calendar, schedule, or user-visible timers. |
| `declarativeNetRequest` | The header / redirect / block / query-param rules engine runs through Chrome's native DNR API. Without it we cannot modify traffic. All rule actions are declared at rule-save time — extension JS never inspects or modifies live traffic at request time. |
| `declarativeNetRequestWithHostAccess` | Required to run DNR rules that modify headers on arbitrary hosts. The user's `<all_urls>` grant (see host permissions) authorizes DNR to touch those hosts. |
| `declarativeNetRequestFeedback` | `onRuleMatchedDebug` emits "this rule fired" events that drive the verdict engine + DevTools panel telemetry. Users see whether their rule actually fired on real traffic. No data leaves the extension. |
| `tabs` | Read tab URLs + titles to: (a) match rules against the current tab for the popup's "This Page" view, (b) compute per-tab request tracker state, (c) target session-scoped DNR rules at a specific tab during test runs. We do not read tab contents. |
| `webRequest` | `onBeforeRequest` / `onCompleted` / `onErrorOccurred` listeners for request tracking + the verdict engine. Used only to observe whether requests matched user rules — no blocking on Chrome (MV3 DNR handles modification). |
| `webNavigation` | `onCommitted` events drive our MAIN-world script/CSS injection on navigation: we wait for the commit, then ask `chrome.scripting` to inject the user's inject-rule code at the right lifecycle point. |
| `activeTab` | User-gesture access to the current tab for: DevTools panel's "Save this request to workspace" handoff, recording flows the user explicitly starts from the popup. We never invoke tab access without a user gesture. |
| `scripting` | `chrome.scripting.executeScript` + `registerContentScripts` run the user's own inject-rule code (MAIN-world or ISOLATED world per user choice) and attach the delay-simulation shim. Only runs when an enabled, matching rule triggers. |
| `downloads` | `chrome.downloads.download` for the "Export to .har", "Export rules", "Export logs" flows. User-initiated; nothing is saved without a click. |
| `cookies` | Read-only `chrome.cookies.getAll` in the DevTools panel's cookie inspector — users can see which cookies were in scope for a captured request. We never write cookies or upload them anywhere. |
| `browsingData` | `chrome.browsingData.remove({ origins })` is called by the cache invalidator when a user's rules change. Clearing the HTTP cache for affected origins is the only way to guarantee a stale cached response doesn't mask a rule that would have fired. Scoped to specific origins — never a global wipe. |
| `system.display` *(Chrome/Edge only)* | `chrome.system.display.getInfo` powers the popup's "pop out into its own window" view-mode — we pick a sensible screen on multi-monitor setups. Not used on Firefox. |
| `windows` *(Chrome/Edge only)* | `chrome.windows.create` / `.get` for the pop-out window view-mode. Not used on Firefox. |
| `sidePanel` *(Chrome/Edge only)* | `chrome.sidePanel.setPanelBehavior` enables the persistent side-panel surface (one of four UI modes the user can pick). Firefox uses `sidebar_action`; Safari uses its own sidebar path. |

### Firefox-only

| Permission | Why |
|---|---|
| `webRequestBlocking` | Firefox still supports blocking webRequest in MV3; used for the narrow set of request-time modifications that DNR can't express (dynamic body mods where the value is computed from the request body). Chrome's MV3 disallows this entirely, so Chrome falls back to DNR + scripting-based paths. |

---

## Host permissions

| Host pattern | Why we ask for it |
|---|---|
| `<all_urls>` | This extension is a traffic-modification + API-testing tool: users author rules that act on arbitrary third-party hosts, and they test API requests against any URL they control. Asking for per-host grants on every rule creation would be unusable. In exchange for this broad permission: no telemetry, no background network activity, content scripts run in the ISOLATED world only, user-triggered fetches default to `credentials: 'omit'` (no implicit cookie-jar attachment), and the `withHostAccess(url, fn)` choke point in the codebase (`apps/extension/src/shared/fetch/with-host-access.ts`) is the single place a future "request hosts on first use" mode would plug in. |
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
| `workflow-recorder` | Only while the user has an active recording session (rrweb session capture). Explicitly started + stopped by the user via the popup. Recordings stay in `chrome.storage.local` on this machine; we never upload them. |
| User inject-rule code | Only when the user created an inject-rule and a matching URL loads. Runs in whichever world (ISOLATED or MAIN) the user's rule specifies. |

---

## What this extension NEVER does

- No telemetry. No analytics pings. No crash reports sent off-device. The "Export logs" button exists so bug reports can be file-attached manually when the user chooses.
- No background network activity. The service worker only makes HTTP calls in response to an explicit user action (send a request, run a test, rebuild DNR rules from the configured refresh schedule).
- No reading of page DOM or page `window` globals from content scripts running in the ISOLATED world.
- No writing of cookies. We only read them (in the DevTools cookie inspector), never set, delete, or mutate.
- No data leaves the user's browser profile. The workspace manifest, request collections, rule definitions, vault secrets — all of it stays in `chrome.storage.local` / IndexedDB / OPFS on this machine.
