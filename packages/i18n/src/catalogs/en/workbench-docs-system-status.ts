/**
 * Workbench Docs panel — the System Status section body. Subsystem
 * wire literals and state tokens ride raw (in `<code>` at the render
 * site) inside keyed prose.
 */

import type { Catalog } from '../../types';

export const workbenchDocsSystemStatus = {
  // ── Concepts: System Status ─────────────────────────────────────────
  'workbench.docs.body.systemStatus.term': 'System status',
  'workbench.docs.body.systemStatus.intro1':
    "is a live snapshot of the extension's health. The workbench footer shows it as a six-pill row — one " +
    'pill per subsystem, each with its own colored dot. The popup and side-panel collapse it down to a single',
  'workbench.docs.body.systemStatus.intro1Suffix':
    "entry in their bottom footer, with the dot's color tracking the worst-state subsystem.",
  'workbench.docs.body.systemStatus.workbenchCaption':
    'In the workbench, the row sits in the footer with one pill per subsystem.',
  'workbench.docs.body.systemStatus.popupCaption':
    "Click the toolbar icon, and the same status surfaces as a single labeled pill in the popup's footer.",
  'workbench.docs.body.systemStatus.worstLevel1':
    'Each subsystem reports a single state and the worst level wins: red > yellow > green. One red anywhere ' +
    'flips the composite dot red.',
  'workbench.docs.body.systemStatus.worstLevelCaption':
    'Six subsystem states fold into one composite via max — red beats yellow beats green.',
  'workbench.docs.body.systemStatus.popover1':
    'Clicking any pill opens the same details popover. Rows come in two groups: grey first (no events yet ' +
    'this service-worker lifetime) and colored after (have reported at least once). Within each group the ' +
    'canonical subsystem order is preserved. Full history lives in the Observability log — export from',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Settings → Data → Export Diagnostic Log',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Greys above the divider, coloreds below; on first report a row migrates once.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'green',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'yellow',
  'workbench.docs.body.systemStatus.stateRedLabel': 'red',
  'workbench.docs.body.systemStatus.syncName': 'Sync',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Desktop-app connection',
  'workbench.docs.body.systemStatus.sync1Prefix':
    "Mirrors the WebSocket connection between the extension's service worker and the OpenHeaders desktop " +
    'app running on your machine. The link is loopback-only (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') and carries dynamic variables, team workspace data, and presence — nothing leaves your device.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'Single WebSocket between the extension and the desktop app on localhost.',
  'workbench.docs.body.systemStatus.sync2':
    'The pill reflects the live connection state. A drop triggers exponential-backoff reconnects; periodic ' +
    'pings detect silent disconnects behind strict corporate proxies.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled and Connected are green; Connecting, Reconnecting, and URL rejected are yellow.',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to desktop',
  'workbench.docs.body.systemStatus.syncGreenMiddle': '(handshake succeeded) or',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Desktop sync disabled',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(auto-connect off).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowOr': ', or',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowSuffix': '.',
  'workbench.docs.body.systemStatus.syncRed':
    'Reserved for fatal desktop-sync failures; no code path emits this today.',
  'workbench.docs.body.systemStatus.rulesName': 'Rules',
  'workbench.docs.body.systemStatus.rulesSubtitle': 'declarativeNetRequest engine',
  'workbench.docs.body.systemStatus.rules1Prefix':
    'Reports on every DNR rebuild. Every save runs your rule through four stages before it goes live: ' +
    'compile to DNR JSON, resolve',
  'workbench.docs.body.systemStatus.rules1Middle':
    "references, enforce the active-rule cap, then apply through Chrome's",
  'workbench.docs.body.systemStatus.rules1Suffix': 'API. Each stage can flip the pill.',
  'workbench.docs.body.systemStatus.rulesPipelineCaption':
    'Four stages — each can emit a Status level if it goes sideways.',
  'workbench.docs.body.systemStatus.rules2':
    'The active-rule count maps to a state on a three-zone capacity bar. Rules over the cap are dropped in ' +
    'match-order (top wins), and the yellow message carries the dropped count.',
  'workbench.docs.body.systemStatus.rulesCapacityCaption':
    'Green up to the warn threshold, yellow up to the cap, red beyond — but truncation keeps you out of the ' +
    'red zone at runtime.',
  'workbench.docs.body.systemStatus.rulesGreenActive': 'N active DNR rule(s)',
  'workbench.docs.body.systemStatus.rulesGreenOr': 'or',
  'workbench.docs.body.systemStatus.rulesGreenPaused': 'Rule execution paused',
  'workbench.docs.body.systemStatus.rulesGreenSuffix': '.',
  'workbench.docs.body.systemStatus.rulesYellowPrefix': 'Unresolved',
  'workbench.docs.body.systemStatus.rulesYellowRefs': 'references (',
  'workbench.docs.body.systemStatus.rulesYellowMsgUnresolved': 'N unresolved variables in M rules',
  'workbench.docs.body.systemStatus.rulesYellowMiddle': '), the rule cap was exceeded (',
  'workbench.docs.body.systemStatus.rulesYellowMsgDropped': 'Dropped N rules over cap',
  'workbench.docs.body.systemStatus.rulesYellowMiddle2': "), or you're approaching DNR capacity (",
  'workbench.docs.body.systemStatus.rulesYellowMsgCapacity': 'Approaching DNR capacity (N ≥ threshold)',
  'workbench.docs.body.systemStatus.rulesYellowSuffix': ').',
  'workbench.docs.body.systemStatus.rulesRedPrefix':
    'Transport failure — Chrome rejected the dynamic or session rule update (',
  'workbench.docs.body.systemStatus.rulesRedMsg': 'Failed to apply [dynamic|session] DNR rules',
  'workbench.docs.body.systemStatus.rulesRedSuffix': ').',
  'workbench.docs.body.systemStatus.requestsName': 'Requests',
  'workbench.docs.body.systemStatus.requestsSubtitle': 'API request executor',
  'workbench.docs.body.systemStatus.requests1Prefix':
    "Reflects the last ad-hoc API request fired from the Request editor's",
  'workbench.docs.body.systemStatus.requestsSend': 'Send',
  'workbench.docs.body.systemStatus.requests1Middle': 'button. The pill flips green for',
  'workbench.docs.body.systemStatus.requestsAny': 'any',
  'workbench.docs.body.systemStatus.requests1Suffix':
    'HTTP response — including 4xx and 5xx — because "the request completed" is a separate question from ' +
    '"the server liked it." Only network-level failures with no response turn it yellow.',
  'workbench.docs.body.systemStatus.requestsOutcomesCaption':
    'Any status code = green. Yellow is reserved for failures with no response back.',
  'workbench.docs.body.systemStatus.requests2Prefix':
    "Background traffic doesn't update this pill: Live workflow refreshes pass",
  'workbench.docs.body.systemStatus.requests2Suffix':
    ', and webpage requests flow through the Rules engine, not the executor.',
  'workbench.docs.body.systemStatus.requestsScopeCaption':
    'Only ad-hoc Send-button traffic shapes this pill — everything else stays quiet.',
  'workbench.docs.body.systemStatus.requestsGreenLabel': 'Last request:',
  'workbench.docs.body.systemStatus.requestsGreenMiddle': '— any HTTP response (e.g.',
  'workbench.docs.body.systemStatus.requestsGreenSuffix': ').',
  'workbench.docs.body.systemStatus.requestsYellowLabel': 'Last request failed:',
  'workbench.docs.body.systemStatus.requestsYellowMiddle': '— network-level failure before a response (e.g.',
  'workbench.docs.body.systemStatus.requestsYellowSuffix': ', offline/DNS).',
  'workbench.docs.body.systemStatus.permissionsName': 'Permissions',
  'workbench.docs.body.systemStatus.permissionsSubtitle': 'Host permissions audit',
  'workbench.docs.body.systemStatus.permissions1Prefix':
    "DNR rules and content scripts targeting a host that's been revoked from",
  'workbench.docs.body.systemStatus.permissions1Middle':
    "don't error — they silently no-op. This audit's whole job is to surface that hidden state, since " +
    "otherwise you'd spend 30 minutes debugging a rule that",
  'workbench.docs.body.systemStatus.permissionsLooks': 'looks',
  'workbench.docs.body.systemStatus.permissions1Suffix': 'fine.',
  'workbench.docs.body.systemStatus.permissionsImpactCaption':
    'Granted: the rule fires. Narrowed: the rule silently no-ops and the header never arrives.',
  'workbench.docs.body.systemStatus.permissions2Prefix': 'The audit polls',
  'workbench.docs.body.systemStatus.permissions2Suffix':
    'on every service-worker wake. MV3 has no permission-change observer in Chromium, so poll-on-wake is ' +
    'the cheapest signal we can get.',
  'workbench.docs.body.systemStatus.permissionsAuditCaption':
    'One call, three branches — green for granted, red for narrowed, yellow if the API call itself fails.',
  'workbench.docs.body.systemStatus.permissionsGreenLabel': 'All host permissions granted',
  'workbench.docs.body.systemStatus.permissionsGreenSuffix': 'is still in scope.',
  'workbench.docs.body.systemStatus.permissionsYellowLabel': 'Could not audit host permissions',
  'workbench.docs.body.systemStatus.permissionsYellowMiddle': "— unusual; the browser didn't expose",
  'workbench.docs.body.systemStatus.permissionsYellowSuffix': '.',
  'workbench.docs.body.systemStatus.permissionsRedLabel': 'Host permissions narrowed',
  'workbench.docs.body.systemStatus.permissionsRedMiddle':
    '— some rules will silently no-op on revoked hosts until access is restored from',
  'workbench.docs.body.systemStatus.permissionsRedSuffix': '.',
  'workbench.docs.body.systemStatus.secretsName': 'Secrets',
  'workbench.docs.body.systemStatus.secretsSubtitle': 'Vault integrity',
  'workbench.docs.body.systemStatus.secrets1Prefix': 'Tracks the per-workspace encrypted vault blob in',
  'workbench.docs.body.systemStatus.secrets1Suffix':
    '. On every service-worker wake, each stored secret is validated against the current schema; entries ' +
    "that fail validation are dropped from the in-memory vault and the pill flips yellow until they're " +
    're-saved.',
  'workbench.docs.body.systemStatus.vaultHydrationCaption':
    'Hydrate loads the blob; the schema validator keeps matches, drops drifts, and reports yellow.',
  'workbench.docs.body.systemStatus.secrets2':
    '"Drift" usually means a stored entry was written by an older build (missing a field that\'s now ' +
    "required, or a field with the wrong type). The validator's job is to fail loud — silently inheriting " +
    'unknown shapes is what causes the bug six versions later.',
  'workbench.docs.body.systemStatus.vaultDriftCaption':
    'Same two fields side by side: a valid entry vs a drift entry with a missing cipher and a wrongly-typed ' +
    'createdAt.',
  'workbench.docs.body.systemStatus.secretsGreen': 'Default — no schema-drift events this service-worker lifetime.',
  'workbench.docs.body.systemStatus.secretsYellowLabel': 'Schema drift: dropped entry from',
  'workbench.docs.body.systemStatus.secretsYellowMiddle':
    "— at least one stored vault entry didn't match the current shape and was dropped on hydrate. Re-saving " +
    'from the Vault editor restores it.',
  'workbench.docs.body.systemStatus.secretsRed': 'Reserved for cipher decrypt failures; no code path emits this today.',
  'workbench.docs.body.systemStatus.liveName': 'Live',
  'workbench.docs.body.systemStatus.liveSubtitle': 'Live Variable workflow refresh',
  'workbench.docs.body.systemStatus.live1Prefix':
    'Each Live workflow refreshes on its own cadence. Per-workflow state turns on three checks: whether the ' +
    'last extractor succeeded, whether the run is within',
  'workbench.docs.body.systemStatus.live1Suffix':
    "its cadence, and how many failures it's had in a row. The three states fold into the pill via " + '"worst wins".',
  'workbench.docs.body.systemStatus.liveFreshnessCaption':
    'Fresh = clean run · stale = past 2× cadence or 1–4 failures · failing = ≥ 5 consecutive failures.',
  'workbench.docs.body.systemStatus.live2Prefix': 'Only the',
  'workbench.docs.body.systemStatus.liveActiveWorkspace': "active workspace's",
  'workbench.docs.body.systemStatus.live2Suffix':
    "workflows contribute. Inactive workspaces are excluded — you can't see or act on those rules right " +
    "now, so pilling on them would surface noise you can't reach. Switching workspaces recomputes the pill " +
    'against the new active set.',
  'workbench.docs.body.systemStatus.liveAggregationCaption':
    'Active-workspace workflows fold into one pill via max(); other workspaces are skipped.',
  'workbench.docs.body.systemStatus.liveGreenLabel': 'N workflows fresh',
  'workbench.docs.body.systemStatus.liveGreenMiddle':
    "— every active-workspace workflow's last run was OK and within 2× its cadence. Also shown as",
  'workbench.docs.body.systemStatus.liveGreenNone': 'No workflows configured',
  'workbench.docs.body.systemStatus.liveGreenSuffix': 'when there are none.',
  'workbench.docs.body.systemStatus.liveYellowLabel': 'N workflows stale or failing',
  'workbench.docs.body.systemStatus.liveYellowMiddle':
    '— at least one run is past 2× cadence, the last extractor failed, or there are 1–4 consecutive failures.',
  'workbench.docs.body.systemStatus.liveRedLabel': 'N workflows failing (5+ consecutive)',
  'workbench.docs.body.systemStatus.liveRedMiddle':
    '— any single workflow crossed five consecutive failures and is now considered failing.',
  'workbench.docs.body.systemStatus.desktopNoteTitle': 'Desktop App — product note',
  'workbench.docs.body.systemStatus.desktopNote1':
    'The desktop app is in development and ships after the extension stabilizes. Workspaces, variables, and ' +
    'team sync that integrate with the desktop app unlock then. The',
  'workbench.docs.body.systemStatus.desktopNote2':
    'subsystem flips from disabled to connecting automatically on first launch — no reinstall required.',
} as const satisfies Catalog;
