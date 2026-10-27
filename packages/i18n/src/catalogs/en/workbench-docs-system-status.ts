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
    "is a live snapshot of the extension's health. The workbench footer shows it as an eight-pill row — one pill per subsystem, each with its own colored dot. The popup and side-panel collapse it down to a single",
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
    'Eight subsystem states fold into one composite via max — red beats yellow beats green.',
  'workbench.docs.body.systemStatus.popover1':
    'Clicking any pill opens the same details popover. Rows sit under four titled groups — Connection, Browser Interceptor, API Requests and Application — in a fixed order. A row is grey until its subsystem reports for the first time this service-worker lifetime and colored after. Full history lives in the Observability log — export from',
  'workbench.docs.body.systemStatus.settingsExportPath': 'Application › Data › Export Diagnostic Log',
  'workbench.docs.body.systemStatus.popover1Suffix': '.',
  'workbench.docs.body.systemStatus.popoverCaption':
    'Four titled groups in a fixed order; a row turns colored on its first report and keeps its place.',
  'workbench.docs.body.systemStatus.stateGreenLabel': 'green',
  'workbench.docs.body.systemStatus.stateYellowLabel': 'yellow',
  'workbench.docs.body.systemStatus.stateRedLabel': 'red',
  'workbench.docs.body.systemStatus.syncName': 'Sync',
  'workbench.docs.body.systemStatus.syncSubtitle': 'Back-end connections',
  'workbench.docs.body.systemStatus.sync1Prefix':
    'Rolls every back-end this surface is a client of — the desktop app on this machine (',
  'workbench.docs.body.systemStatus.sync1Suffix':
    ') and any OpenHeaders Server — into one row: the worst connection wins the tag, and each back-end gets its own row beneath it in the popover. With no back-end configured the row reads "Running in this browser" — the extension is its own back-end.',
  'workbench.docs.body.systemStatus.syncTopologyCaption':
    'One WebSocket per back-end — the desktop app on localhost shown; a server is the same link over the network.',
  'workbench.docs.body.systemStatus.sync2':
    'Each wire reports two layers. The socket: connecting, reconnecting with exponential backoff after a drop, connected — periodic pings catch silent disconnects behind strict corporate proxies. The handshake on top of it: handshaking, catching up on the changes missed while away, synced. Within one back-end the latest report wins; across back-ends the worst state wins.',
  'workbench.docs.body.systemStatus.syncLifecycleCaption':
    'Disabled, Connected and Synced are green; Connecting, Reconnecting, Catching up and URL rejected are yellow.',
  'workbench.docs.body.systemStatus.sync3':
    "A desktop app or server is a back-end for others too, and that role joins the same roll-up: the extension pipe's bind — red when another instance holds the port, yellow while it starts — and, once bound, how many extensions are connected and whether from this device or the LAN. A git-bound workspace adds its uncommitted-change count.",
  'workbench.docs.body.systemStatus.syncGreenSynced': 'Synced with back-end',
  'workbench.docs.body.systemStatus.syncGreenConnected': 'Connected to back-end',
  'workbench.docs.body.systemStatus.syncGreenDisabled': 'Back-end sync disabled',
  'workbench.docs.body.systemStatus.syncGreenRunningHere': 'Running in this browser',
  'workbench.docs.body.systemStatus.syncGreenExplain':
    '— the handshake completed, the socket is up with the handshake still pending, auto-connect is off, or no back-end is configured. A host that serves reports its peers instead:',
  'workbench.docs.body.systemStatus.syncGreenIdle': 'Idle — no extensions connected',
  'workbench.docs.body.systemStatus.syncGreenPeers': 'Connected to N extensions on this device',
  'workbench.docs.body.systemStatus.syncGreenSuffix': '(or on LAN).',
  'workbench.docs.body.systemStatus.syncYellowConnecting': 'Connecting to back-end…',
  'workbench.docs.body.systemStatus.syncYellowReconnecting': 'Reconnecting (attempt N)',
  'workbench.docs.body.systemStatus.syncYellowHandshaking': 'Handshaking with back-end…',
  'workbench.docs.body.systemStatus.syncYellowCatchingUp': 'Catching up changes…',
  'workbench.docs.body.systemStatus.syncYellowRejected': 'Desktop URL rejected by settings',
  'workbench.docs.body.systemStatus.syncYellowOff': "<back-end> is off — its workspaces aren't syncing",
  'workbench.docs.body.systemStatus.syncYellowExplain':
    '— a socket on its way up or back, a handshake in flight, a record with no usable URL, or a joined back-end turned off. A host that serves adds',
  'workbench.docs.body.systemStatus.syncYellowPipe': 'Starting extension pipe…',
  'workbench.docs.body.systemStatus.syncYellowGit': 'N uncommitted changes',
  'workbench.docs.body.systemStatus.syncYellowSuffix': 'for a git-bound workspace.',
  'workbench.docs.body.systemStatus.syncRedRejected': 'Back-end rejected handshake',
  'workbench.docs.body.systemStatus.syncRedTimedOut': "Back-end didn't respond to handshake — retrying",
  'workbench.docs.body.systemStatus.syncRedCatchUp': 'Catch-up failed',
  'workbench.docs.body.systemStatus.syncRedExplain':
    '— the server refused the handshake (a protocol mismatch, an unknown workspace, missing authentication; the row names the reason), never answered it, or the catch-up replay failed. A host that serves adds',
  'workbench.docs.body.systemStatus.syncRedPipe': 'Extension pipe offline — port N is already in use',
  'workbench.docs.body.systemStatus.syncRedSuffix': 'when another instance holds the port.',
  'workbench.docs.body.systemStatus.activityName': 'Activity',
  'workbench.docs.body.systemStatus.activitySubtitle': 'Activity feed',
  'workbench.docs.body.systemStatus.activity1':
    "Counts the unread entries in the active workspace's activity feed — the changes that arrived over sync: an entity created, edited, deleted or moved, a local edit superseded, a sensitive field rotated, a permission scope widened, an AI agent observing traffic.",
  'workbench.docs.body.systemStatus.activity2':
    "Only the active workspace counts. Entries for another workspace still land in that workspace's feed, and switching to it re-reads the count from the log, so no workspace carries another's badge.",
  'workbench.docs.body.systemStatus.activityGreenLabel': 'Activity up to date',
  'workbench.docs.body.systemStatus.activityGreenSuffix': '— nothing unread in the active workspace.',
  'workbench.docs.body.systemStatus.activityYellowLabel': 'N new · <headline>',
  'workbench.docs.body.systemStatus.activityYellowMiddle':
    '— unread entries, headlined by the latest one, until the feed is read.',
  'workbench.docs.body.systemStatus.activityRed': 'Reserved; no code path emits this today.',
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
  'workbench.docs.body.systemStatus.debugModeName': 'Debug mode',
  'workbench.docs.body.systemStatus.debugModeSubtitle': 'Debugger attach state',
  'workbench.docs.body.systemStatus.debugMode1':
    'Mirrors the debugger that Debug mode attaches to tabs for exact request correlation. Off reports green — a fault is moot while the switch is off. On, the row counts the attached tabs; a tab the browser refused to attach turns it red, and a tab that fell back to the heuristic path turns it yellow.',
  'workbench.docs.body.systemStatus.debugMode2':
    'Browsers without a debugger API never install this reporter, so the row stays grey there and the heuristic path is the only one.',
  'workbench.docs.body.systemStatus.debugModeGreenOff': 'Off',
  'workbench.docs.body.systemStatus.debugModeGreenOr': 'or',
  'workbench.docs.body.systemStatus.debugModeGreenOn': 'On · N tabs',
  'workbench.docs.body.systemStatus.debugModeGreenSuffix':
    '— the switch is off, or on with every attached tab healthy.',
  'workbench.docs.body.systemStatus.debugModeYellowLabel': 'Tab N fell back to heuristic',
  'workbench.docs.body.systemStatus.debugModeYellowMiddle':
    '— the debugger detached from that tab (a cancelled banner, for instance) and the tab correlates by the heuristic path until it re-attaches.',
  'workbench.docs.body.systemStatus.debugModeRedLabel': 'Tab N attach failed',
  'workbench.docs.body.systemStatus.debugModeRedMiddle':
    '— the browser refused the attach, usually because another debugger already holds the tab.',
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
} as const satisfies Catalog;
