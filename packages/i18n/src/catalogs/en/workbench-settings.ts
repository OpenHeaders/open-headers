/**
 * Workbench settings namespace — the settings shell chrome, the
 * category registry, and the per-setting definition text.
 *
 * Key conventions (Phase C registry idiom):
 *   workbench.settings.shell.*                       — modal/shell chrome
 *   workbench.settings.row.*                         — shared field-row chrome
 *   workbench.settings.category.<id>.label           — category label
 *   workbench.settings.category.<id>.navLabel        — short nav-tree label
 *   workbench.settings.category.<id>.description     — category blurb
 *   workbench.settings.category.<id>.sub.<subId>     — subcategory label
 *   workbench.settings.def.<settingKey>.label        — setting label
 *   workbench.settings.def.<settingKey>.description  — setting description
 *   workbench.settings.def.<settingKey>.option.<value>.label / .description
 *                                                    — enum option text
 *   workbench.settings.def.<settingKey>.action.label — action button label
 *   workbench.settings.def.<settingKey>.confirm      — confirm prompt of a
 *                                                      destructive action
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettings = {
  // ── Shell chrome ───────────────────────────────────────────────────
  'workbench.settings.shell.title': 'Settings',
  'workbench.settings.shell.openInEditor': 'Open in Editor',
  'workbench.settings.shell.openInEditorSoon': 'Open in Editor (coming soon)',
  'workbench.settings.shell.maximize': 'Maximize',
  'workbench.settings.shell.restoreWindow': 'Restore',
  'workbench.settings.shell.hint.search': 'Search',
  'workbench.settings.shell.hint.navigate': 'Navigate',
  'workbench.settings.shell.hint.select': 'Select',
  'workbench.settings.shell.hint.clearClose': 'Clear / Close',
  'workbench.settings.shell.noneRegistered': 'No settings registered.',
  'workbench.settings.shell.resetAll': 'Reset all',
  'workbench.settings.shell.resetAllCount': 'Reset all ({count})',
  'workbench.settings.shell.resetAllTitle': 'Reset all settings?',
  'workbench.settings.shell.resetAllNone': 'Nothing to reset — all settings are at their defaults.',
  'workbench.settings.shell.resetAllDescription': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restore {count} setting to its default value.',
      other: 'Restore {count} settings to their default values.',
    }),
  'workbench.settings.shell.resetConfirm': 'Reset',
  'workbench.settings.shell.searchResults': 'Search results',
  'workbench.settings.shell.matchesFor': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} match for', other: '{count} matches for' }),
  'workbench.settings.shell.noMatchesFor': 'No settings match',
  'workbench.settings.shell.jumpToCategory': 'Jump to category',
  'workbench.settings.shell.navAria': 'Settings categories',
  'workbench.settings.shell.showCategoryNames': 'Show Category Names',
  'workbench.settings.shell.otherGroup': 'Other',

  // ── Shared field-row chrome ────────────────────────────────────────
  'workbench.settings.row.modified': 'Modified from default',
  'workbench.settings.row.modifiedAria': 'modified',
  'workbench.settings.row.resetToDefault': 'Reset to default',
  'workbench.settings.row.experimental': 'Experimental',
  'workbench.settings.row.desktopBadge': 'Desktop',
  'workbench.settings.row.desktopTip':
    'Requires a live connection to the Open Headers desktop app. The desktop app stores the authoritative value.',
  'workbench.settings.row.capabilityUnavailable': 'This browser doesn’t support this setting.',
  'workbench.settings.row.connectionRequired': 'Connect the desktop app to change this setting.',
  'workbench.settings.row.aboutAria': 'About {label}',
  'workbench.settings.row.disabledCapabilityAria': 'Disabled — unavailable on this browser',
  'workbench.settings.row.disabledConnectionAria': 'Disabled — requires desktop connection',
  'workbench.settings.row.run': 'Run',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Backend',
  'workbench.settings.category.backend.description':
    'Where your workspaces, rules, vault, and history live. Pick the host that matches your reach — local-only either way.',
  'workbench.settings.category.backend.sub.connection': 'Connection',
  'workbench.settings.category.backend.sub.reliability': 'Reliability',
  'workbench.settings.category.backend.sub.notifications': 'Notifications',
  'workbench.settings.category.backend.sub.lan-peers': 'LAN peers',
  'workbench.settings.category.mcp.label': 'MCP',
  'workbench.settings.category.mcp.description':
    'Let AI agents and other MCP clients read and control this app. Access is tiered — reading, writing, executing, and secret reveal are separate switches, all off by default.',
  'workbench.settings.category.general.label': 'General',
  'workbench.settings.category.general.description': 'App-wide behavior, startup, and locale.',
  'workbench.settings.category.appearance.label': 'Appearance',
  'workbench.settings.category.appearance.description': 'Theme, density and visual presentation.',
  'workbench.settings.category.workspaceLayout.label': 'Workspace Layout',
  'workbench.settings.category.workspaceLayout.description': 'Footer affordances and tool-window shell behavior.',
  'workbench.settings.category.devpanel.label': 'DevTools Panel',
  'workbench.settings.category.devpanel.description':
    'Defaults for the browser DevTools panel — the tool-window shell and each tab of the requests surface.',
  'workbench.settings.category.devpanelLayout.label': 'DevTools Panel · Layout',
  'workbench.settings.category.devpanelLayout.navLabel': 'Layout',
  'workbench.settings.category.devpanelLayout.description':
    'Tool-window shell behavior for the browser DevTools panel.',
  'workbench.settings.category.devpanelNetwork.label': 'DevTools Panel · Network',
  'workbench.settings.category.devpanelNetwork.navLabel': 'Network',
  'workbench.settings.category.devpanelNetwork.description':
    'Defaults for the Network requests table in the DevTools panel — layout, sort, dot column.',
  'workbench.settings.category.devpanelHeaders.label': 'DevTools Panel · Headers',
  'workbench.settings.category.devpanelHeaders.navLabel': 'Headers',
  'workbench.settings.category.devpanelHeaders.description':
    'Defaults for the Headers tab in the DevTools panel — layout, sort, filters, suggestions.',
  'workbench.settings.category.devpanelInitiator.label': 'DevTools Panel · Initiator',
  'workbench.settings.category.devpanelInitiator.navLabel': 'Initiator',
  'workbench.settings.category.devpanelInitiator.description':
    'Defaults for the Initiator tab in the DevTools panel — sort, filters, suggestions.',
  'workbench.settings.category.devpanelCookies.label': 'DevTools Panel · Cookies',
  'workbench.settings.category.devpanelCookies.navLabel': 'Cookies',
  'workbench.settings.category.devpanelCookies.description':
    'Defaults for the Cookies tab in the DevTools panel — columns, sort, filters, suggestions.',
  'workbench.settings.category.devpanelTiming.label': 'DevTools Panel · Timing',
  'workbench.settings.category.devpanelTiming.navLabel': 'Timing',
  'workbench.settings.category.devpanelTiming.description':
    'Defaults for the Timing tab in the DevTools panel — which bands are visible.',
  'workbench.settings.category.inspection.label': 'Debug mode',
  'workbench.settings.category.inspection.description':
    'The opt-in path that attaches your browser’s debugging protocol — inspect and modify requests with the same depth as the built-in developer tools.',
  'workbench.settings.category.editor.label': 'Code Editor',
  'workbench.settings.category.editor.description': 'Font, indentation, and view options for code editing surfaces.',
  'workbench.settings.category.requests.label': 'API Requests',
  'workbench.settings.category.requests.description': 'HTTP request sending and response handling.',
  'workbench.settings.category.rulesEngine.label': 'Rules Engine',
  'workbench.settings.category.rulesEngine.description': 'How rules are evaluated, compiled, and arbitrated.',
  'workbench.settings.category.keyboard.label': 'Keyboard',
  'workbench.settings.category.keyboard.description': 'Customize keyboard shortcuts.',
  'workbench.settings.category.keyboard.sub.global': 'All Surfaces',
  'workbench.settings.category.keyboard.sub.workbench-general': 'Workbench',
  'workbench.settings.category.keyboard.sub.workbench-layout': 'Workbench · Layout',
  'workbench.settings.category.keyboard.sub.workbench-tabs': 'Workbench · Tabs',
  'workbench.settings.category.keyboard.sub.workbench-focus': 'Workbench · Focus',
  'workbench.settings.category.keyboard.sub.workbench-editor': 'Workbench · Editor',
  'workbench.settings.category.keyboard.sub.popup-general': 'Popup & Side Panel',
  'workbench.settings.category.keyboard.sub.popup-navigation': 'Popup & Side Panel · Navigation',
  'workbench.settings.category.keyboard.sub.popup-rows': 'Popup & Side Panel · Row Actions',
  'workbench.settings.category.keyboard.sub.popup-tabs': 'Popup & Side Panel · Tabs',
  'workbench.settings.category.workspaceSharing.label': 'Workspace Sharing',
  'workbench.settings.category.workspaceSharing.description':
    'Display preferences for the workspace-export import preview.',
  'workbench.settings.category.data.label': 'Data',
  'workbench.settings.category.data.description': 'Diagnostics, import/export, and destructive maintenance.',
  'workbench.settings.category.license.label': 'License',
  'workbench.settings.category.license.description':
    'Everything in Open Headers today is included on every tier — paid plans cover team seats. The free tier admits up to 10 active users per daemon.',
  'workbench.settings.category.about.label': 'About',
  'workbench.settings.category.about.description': 'Version, licenses and build information.',

  // ── Backend category defs ──────────────────────────────────────────
  'workbench.settings.def.backend.bindAddress.label': 'Sync with devices on your network',
  'workbench.settings.def.backend.bindAddress.description':
    'Lets other computers and browsers on the same network connect to this app and share its workspaces. Off by default — only this computer can reach it.',
  'workbench.settings.def.backend.bindAddress.option.loopback.label': 'Loopback only (127.0.0.1)',
  'workbench.settings.def.backend.bindAddress.option.loopback.description': 'Only this machine can connect. Default.',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.label': 'All interfaces (LAN)',
  'workbench.settings.def.backend.bindAddress.option.all-interfaces.description':
    'Other devices on the local network can connect. Requires the auth token from U3.2.',
  'workbench.settings.def.backend.bindPort.label': 'Daemon port',
  'workbench.settings.def.backend.bindPort.description':
    'The port this app binds for browsers and other devices to connect to. Change it only if something else already uses the default. Clients must point at the same port.',
  'workbench.settings.def.backend.serveWebApp.label': 'Serve the web app',
  'workbench.settings.def.backend.serveWebApp.description':
    'Serve the Workbench as a web page on the daemon port, so a browser tab can open it straight from this app — no extension needed. Anyone who can reach the port sees the login gate; a paired token is still required to access data.',
  'workbench.settings.def.backend.allowPeerExecute.label': 'Allow connected devices to send requests',
  'workbench.settings.def.backend.allowPeerExecute.description':
    'Let paired browsers and devices send API requests through this app — their workbench Send runs on this machine, with its network access. Off by default; each send still requires the sender to have write access to the workspace.',
  'workbench.settings.def.backend.reconnectDelayMs.label': 'Initial reconnect delay',
  'workbench.settings.def.backend.reconnectDelayMs.description':
    'How long to wait (ms) before the first reconnect attempt after a disconnect.',
  'workbench.settings.def.backend.maxReconnectDelayMs.label': 'Max reconnect delay',
  'workbench.settings.def.backend.maxReconnectDelayMs.description':
    'Upper bound (ms) on the exponential backoff between reconnect attempts.',
  'workbench.settings.def.backend.pingIntervalMs.label': 'Keep-alive interval',
  'workbench.settings.def.backend.pingIntervalMs.description':
    'How often (ms) to send a ping so the WebSocket stays open behind strict proxies.',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.label': 'Badge when disconnected',
  'workbench.settings.def.backend.showBadgeWhenDisconnected.description':
    'Show a red badge on the toolbar icon when the back-end link is down.',
  'workbench.settings.def.backend.showDiagrams.label': 'Show back-end diagrams',
  'workbench.settings.def.backend.showDiagrams.description':
    'Show the illustrated tier and data-flow panels in Backend settings.',

  // ── Backend pane body ──────────────────────────────────────────────
  'workbench.settings.backendPane.intro.whoLabel': 'Who:',
  'workbench.settings.backendPane.intro.whoText': 'processes and stores your data.',
  'workbench.settings.backendPane.intro.whereLabel': 'Where:',
  'workbench.settings.backendPane.intro.whereText': 'local or remote.',
  'workbench.settings.backendPane.showDiagrams': 'Show diagrams',
  'workbench.settings.backendPane.learnMore': 'Learn more',
  'workbench.settings.backendPane.subsection.reliability.blurb':
    'Auto-reconnection behavior over an unstable wire. Applies to every connection.',
  'workbench.settings.backendPane.subsection.notifications.blurb': 'Visual cues when a link is down.',
  'workbench.settings.backendPane.tierZero.title.extension': 'This browser',
  'workbench.settings.backendPane.tierZero.title.desktop': 'This app',
  'workbench.settings.backendPane.tierZero.title.web': 'This app',
  'workbench.settings.backendPane.tierZero.copy.extension':
    'The extension itself processes and stores your data — workspaces, rules, and vault live in this browser. Always on; no setup.',
  'workbench.settings.backendPane.tierZero.copy.desktop':
    'The desktop app process is the back-end. Other local clients connect into it; your data lives on this machine. Always on; no setup.',
  'workbench.settings.backendPane.tierZero.copy.web':
    'The app that served this page is the back-end. Your data lives on that host. Always on; no setup.',
  'workbench.settings.backendPane.tierZero.alwaysOn': 'Always on',
  'workbench.settings.backendPane.tierZero.adminTitle': 'Daemon administration',
  'workbench.settings.backendPane.tierZero.adminDescription':
    'Manage the user directory and per-workspace access grants.',
  'workbench.settings.backendPane.tierZero.adminOpen': 'Open admin console',
  'workbench.settings.backendPane.scenario.desktop-app.title': 'Desktop Application',
  'workbench.settings.backendPane.scenario.desktop-app.hint': 'The Open Headers app on this machine',
  'workbench.settings.backendPane.scenario.local-self-hosted.title': 'Local / LAN',
  'workbench.settings.backendPane.scenario.local-self-hosted.hint': 'A server on this machine or your network',
  'workbench.settings.backendPane.scenario.remote-self-hosted.title': 'Remote / WAN',
  'workbench.settings.backendPane.scenario.remote-self-hosted.hint': 'A server you self-host on your own VM',
  'workbench.settings.backendPane.wizard.step.scenario': 'Scenario',
  'workbench.settings.backendPane.wizard.step.connect': 'Connect',
  'workbench.settings.backendPane.wizard.step.pair': 'Pair',
  'workbench.settings.backendPane.wizard.step.turnOn': 'Turn on',
  'workbench.settings.backendPane.wizard.addTitle': 'Add back-end',
  'workbench.settings.backendPane.wizard.editTitle': 'Edit {label}',
  'workbench.settings.backendPane.wizard.back': 'Back',
  'workbench.settings.backendPane.wizard.next': 'Next',
  'workbench.settings.backendPane.wizard.comingSoon': 'Coming soon',
  'workbench.settings.backendPane.wizard.finishWithoutConnecting': 'Finish without connecting',
  'workbench.settings.backendPane.wizard.verifyConnect': 'Verify & connect',
  'workbench.settings.backendPane.wizard.scenarioIntro':
    'What kind of back-end is this? Pick a tile to see what the tier gives you.',
  'workbench.settings.backendPane.wizard.scenarioAria': 'Back-end scenario',
  'workbench.settings.backendPane.wizard.soonBadge': 'Soon',
  'workbench.settings.backendPane.wizard.connectIntro':
    'Where does this client dial the back-end? The connection stays off until the final step verifies it.',
  'workbench.settings.backendPane.wizard.pairIntro':
    'Prove this device to the back-end — pair with the code it displays, or paste a token. You can test the connection before turning it on.',
  'workbench.settings.backendPane.wizard.readyIntroPaired':
    'Ready: {label} at {url}, paired. Turning it on verifies reachability and authentication first; on success its workspaces sync down and stay usable offline.',
  'workbench.settings.backendPane.wizard.readyIntroNotPaired':
    'Ready: {label} at {url} — NOT paired yet. Turning it on verifies reachability and authentication first; on success its workspaces sync down and stay usable offline.',
  'workbench.settings.backendPane.wizard.additionalBackend':
    "This is an additional back-end. Its Orgs appear as new groups in the workspace switcher, the status popover gains a row per back-end, and each Org syncs from exactly one back-end — an Org already provided by another connection won't join twice.",
  'workbench.settings.backendPane.wizard.disableFirst':
    '{label} is connected. Editing the connection means moving a live wire, so it disconnects first — your settings and pairing are kept, and turning it back on verifies the new configuration before anything connects.',
  'workbench.settings.backendPane.wizard.disconnectEdit': 'Disconnect and edit',
  'workbench.settings.backendPane.wizard.testConnection': 'Test connection',

  // ── Backend pane: connections list ─────────────────────────────────
  'workbench.settings.backendPane.connections.title': 'Connections',
  'workbench.settings.backendPane.connections.blurbBrowser':
    'Back-ends this browser has joined. Their workspaces sync down and stay usable offline.',
  'workbench.settings.backendPane.connections.blurbApp':
    'Back-ends this app has joined. Their workspaces sync down and stay usable offline.',
  'workbench.settings.backendPane.connections.add': 'Add back-end',
  'workbench.settings.backendPane.connections.emptyBrowser':
    'No connections — everything runs in this browser. Add a back-end to sync workspaces from the desktop app or a self-hosted server.',
  'workbench.settings.backendPane.connections.emptyApp':
    'No connections — everything runs in this app. Add a back-end to sync workspaces from the desktop app or a self-hosted server.',
  'workbench.settings.backendPane.connections.status.connected': 'Connected',
  'workbench.settings.backendPane.connections.status.connecting': 'Connecting…',
  'workbench.settings.backendPane.connections.status.authRequired': 'Re-pair needed',
  'workbench.settings.backendPane.connections.status.error': 'Connection down',
  'workbench.settings.backendPane.connections.status.off': 'Off',
  'workbench.settings.backendPane.connections.repair': 'Re-pair',
  'workbench.settings.backendPane.connections.autoConnect': 'Auto-connect',
  'workbench.settings.backendPane.connections.editTooltipConnected': 'Edit (disconnects first)',
  'workbench.settings.backendPane.connections.editTooltip': 'Edit',
  'workbench.settings.backendPane.connections.editAria': 'Edit {label}',
  'workbench.settings.backendPane.connections.disconnectTooltip': 'Disconnect (settings are kept)',
  'workbench.settings.backendPane.connections.connectTooltip': 'Verify and connect',
  'workbench.settings.backendPane.connections.enabledAria': '{label} enabled',
  'workbench.settings.backendPane.connections.orgConflict':
    'Org “{org}” is already provided by {provider} — not joined',
  'workbench.settings.backendPane.connections.removedBackend': 'a removed back-end',

  // ── Backend pane: probe-gated enable ───────────────────────────────
  'workbench.settings.backendPane.enable.connectingTo': 'Connecting to {label}…',
  'workbench.settings.backendPane.enable.connected': 'Connected to {label}.',
  'workbench.settings.backendPane.enable.orgNotJoined':
    "{label} connected, but its Org wasn't joined — see the connection row.",

  // ── Backend pane: remove flow ──────────────────────────────────────
  'workbench.settings.backendPane.remove.confirmTitle': 'Remove {label}?',
  'workbench.settings.backendPane.remove.confirmBody':
    'Its address and pairing are forgotten. Nothing was synced from it yet.',
  'workbench.settings.backendPane.remove.aria': 'Remove {label}',
  'workbench.settings.backendPane.remove.removed': 'Removed {label}.',
  'workbench.settings.backendPane.remove.tooltip':
    'Remove this back-end — you choose what happens to its synced workspaces',
  'workbench.settings.backendPane.remove.workspaceCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} workspace', other: '{count} workspaces' }),
  'workbench.settings.backendPane.remove.body.prefix': 'This back-end provides',
  'workbench.settings.backendPane.remove.body.suffix':
    'with {workspaces} synced to this device. Its own data is never touched — choose what happens to the local copies.',
  'workbench.settings.backendPane.remove.outcomeAria': 'Removal outcome',
  'workbench.settings.backendPane.remove.recommendedBadge': 'Recommended',
  'workbench.settings.backendPane.remove.keep.title': 'Keep local copies',
  'workbench.settings.backendPane.remove.keep.description':
    '{orgs} stop syncing. The {workspaces} stay on this device as offline local data.',
  'workbench.settings.backendPane.remove.discard.title': 'Discard local copies',
  'workbench.settings.backendPane.remove.discard.description':
    'Each workspace is first backed up to a downloaded file, then deleted from this device. Re-joining the back-end later syncs them down again.',
  'workbench.settings.backendPane.remove.discard.includeSecrets':
    'Include vault secrets in the backup files (plaintext — keep the files safe)',
  'workbench.settings.backendPane.remove.removeBackend': 'Remove back-end',
  'workbench.settings.backendPane.remove.backupThenRemove': 'Back up, then remove',
  'workbench.settings.backendPane.remove.progress.removing': 'Removing back-end…',
  'workbench.settings.backendPane.remove.progress.preparing': 'Preparing backups…',
  'workbench.settings.backendPane.remove.progress.backingUp': 'Backing up "{name}"…',
  'workbench.settings.backendPane.remove.progress.deleting': 'Deleting "{name}"…',
  'workbench.settings.backendPane.remove.keepDone':
    'Removed {label}. {orgs} stopped syncing; {workspaces} stay on this device.',
  'workbench.settings.backendPane.remove.discardDone':
    'Removed {label}. Backed up and deleted {workspaces}; {orgs} unbound.',
  'workbench.settings.backendPane.remove.discardStayedTitle': ({ label, count }, locale) =>
    plural(locale, Number(count), {
      one: `Removed ${String(label)}, but {count} workspace stayed`,
      other: `Removed ${String(label)}, but {count} workspaces stayed`,
    }),
  'workbench.settings.backendPane.remove.discardStayedBody': 'Could not delete: {names}. They remain as local data.',
  'workbench.settings.backendPane.remove.backupFailedTitle': 'Backup of "{name}" failed',
  'workbench.settings.backendPane.remove.backupFailedBody': 'Export did not complete. Nothing was removed.',

  // ── Backend pane: pair with a code ─────────────────────────────────
  'workbench.settings.backendPane.pair.pairWithCode': 'Pair with a code',
  'workbench.settings.backendPane.pair.pasteTokenTitle': 'Paste a token',
  'workbench.settings.backendPane.pair.codeBlurb':
    "Enter the code the back-end displayed. We'll exchange it for an auth token and connect this browser.",
  'workbench.settings.backendPane.pair.tokenBlurb':
    "Paste the token the back-end displayed — a rotation shows the new secret once. It's saved as this browser's credential.",
  'workbench.settings.backendPane.pair.codePlaceholder': '6-digit code',
  'workbench.settings.backendPane.pair.deviceNamePlaceholder': 'Device name (optional)',
  'workbench.settings.backendPane.pair.codeRequired': 'Enter the pairing code shown on the back-end.',
  'workbench.settings.backendPane.pair.pasteTokenRequired': 'Paste the token the back-end displayed.',
  'workbench.settings.backendPane.pair.pairAction': 'Pair',
  'workbench.settings.backendPane.pair.saveToken': 'Save token',
  'workbench.settings.backendPane.pair.tokenSaved': 'Auth token saved.',
  'workbench.settings.backendPane.pair.pairedSaved': 'Paired — auth token saved.',
  'workbench.settings.backendPane.pair.switchToToken': 'Have a token? Paste it instead',
  'workbench.settings.backendPane.pair.switchToCode': 'Have a pairing code instead?',
  'workbench.settings.backendPane.pair.fail.unknown':
    'That code is unknown or has expired. Ask for a fresh code and try again.',
  'workbench.settings.backendPane.pair.fail.expired':
    'That pairing code has expired. Generate a new one on the back-end.',
  'workbench.settings.backendPane.pair.fail.consumed':
    'That code was already used. Generate a new one on the back-end.',
  'workbench.settings.backendPane.pair.fail.unreachable':
    "Couldn't reach the back-end at {url}. Is it running on that address?",
  'workbench.settings.backendPane.pair.fail.generic': 'Pairing failed. Try again.',

  // ── Backend pane: record field editors ─────────────────────────────
  'workbench.settings.backendPane.field.label.label': 'Name',
  'workbench.settings.backendPane.field.label.description':
    'What this back-end is called across the app. Defaults to its address.',
  'workbench.settings.backendPane.field.label.placeholder': 'Work VM',
  'workbench.settings.backendPane.field.label.aria': 'Back-end name',
  'workbench.settings.backendPane.field.url.label': 'Backend address',
  'workbench.settings.backendPane.field.url.description':
    'Where this client dials the back-end. `ws://` for local / LAN hosts, `wss://` for remote.',
  'workbench.settings.backendPane.field.url.schemeAria': 'Scheme',
  'workbench.settings.backendPane.field.url.addressAria': 'Address',
  'workbench.settings.backendPane.field.url.portAria': 'Port',
  'workbench.settings.backendPane.field.auth.label': 'Authentication',
  'workbench.settings.backendPane.field.auth.description':
    'How this device proves itself to the back-end. Pair with a code, or paste a token directly.',
  'workbench.settings.backendPane.field.auth.codeAria': 'Pairing code',
  'workbench.settings.backendPane.field.auth.tokenAria': 'Auth token',
  'workbench.settings.backendPane.field.auth.tokenPlaceholder': 'Paste a token',
  'workbench.settings.backendPane.field.auth.paired': 'Paired — access token saved',
  'workbench.settings.backendPane.field.auth.useToken': 'Use an auth token instead',
  'workbench.settings.backendPane.field.auth.useCode': 'Pair with a code instead',

  // ── Backend pane: port validation hints ────────────────────────────
  // The IANA boundary numbers (1024 / 49152 / 65535) are protocol
  // constants, embedded literally rather than interpolated.
  'workbench.settings.backendPane.port.missing': 'Enter a port.',
  'workbench.settings.backendPane.port.notInteger': 'Port must be a whole number.',
  'workbench.settings.backendPane.port.privileged':
    'Ports below 1024 are privileged and need elevated permissions — pick 1024 or higher.',
  'workbench.settings.backendPane.port.aboveMax': 'Port must be 65535 or below.',
  'workbench.settings.backendPane.port.ephemeral':
    'Ports 49152–65535 are the range the OS hands out for outgoing connections; a listener here can intermittently fail to bind. A port from 1024–49151 is more reliable.',

  // ── Backend pane: LAN-peers confirm ────────────────────────────────
  'workbench.settings.backendPane.lan.confirmTitle': 'Allow LAN peers?',
  'workbench.settings.backendPane.lan.confirmOk': 'Allow LAN peers',
  'workbench.settings.backendPane.lan.confirmCancel': 'Keep loopback only',
  'workbench.settings.backendPane.lan.confirmBody':
    'The desktop daemon will bind every local network interface so other devices on your network can connect. Every connection — LAN or loopback — must present a paired auth token; there is no token-free path. Devices pair with the code the daemon shows (or paste a token into Settings → Backend → Daemon auth token).',

  // ── Backend pane: offline fallback order ───────────────────────────
  'workbench.settings.backendPane.fallback.title': 'Offline fallback order',
  'workbench.settings.backendPane.fallback.blurb':
    "If the backend goes offline, the first reachable host on this list self-refreshes an exclusive workflow's credential. Hosts enlist automatically; drag to re-rank.",
  'workbench.settings.backendPane.fallback.empty':
    'No hosts have enlisted yet. A browser joins this list once it holds the seed for an exclusive Live Workflow in this workspace.',
  'workbench.settings.backendPane.fallback.saveFailed': 'Failed to save the new order',
  'workbench.settings.backendPane.fallback.removeFailed': 'Failed to remove the host',
  'workbench.settings.backendPane.fallback.dragAria': 'Drag to reorder',
  'workbench.settings.backendPane.fallback.selfTag': 'This browser',
  'workbench.settings.backendPane.fallback.pruneTitle': 'Remove this host?',
  'workbench.settings.backendPane.fallback.pruneBody':
    "It rejoins automatically if it still holds an exclusive workflow's seed.",

  // ── Backend pane: tier cards ────────────────────────────────────────
  // The tier registry (`backend-tier-data.ts`) renders inside a
  // fixed-geometry SVG card. Titles, capability bullets, and range-
  // category labels are keyed; IP ranges, URL patterns, and platform
  // proper nouns stay literal (technical plane). Networking vocabulary
  // inside keyed labels (loopback, RFC1918, mDNS, …) is
  // glossary-protected on translator handoff.
  'workbench.settings.backendPane.tier.cardAria': '{title} tier card',
  'workbench.settings.backendPane.tier.badge.today': 'Today',
  'workbench.settings.backendPane.tier.badge.roadmap': 'Roadmap',
  'workbench.settings.backendPane.tier.inheritsFrom': 'Inherits from {tier}',
  'workbench.settings.backendPane.tier.newInTier': '+ New in this tier',
  'workbench.settings.backendPane.tier.supports': 'Supports',
  'workbench.settings.backendPane.tier.in-browser.title': 'In-browser',
  'workbench.settings.backendPane.tier.in-browser.sub': 'extension service worker',
  'workbench.settings.backendPane.tier.desktop-app.title': 'Desktop app',
  'workbench.settings.backendPane.tier.desktop-app.sub': 'embedded server',
  'workbench.settings.backendPane.tier.local-self-hosted.title': 'Local server',
  'workbench.settings.backendPane.tier.local-self-hosted.sub': 'on your LAN',
  'workbench.settings.backendPane.tier.remote-self-hosted.title': 'Remote server',
  'workbench.settings.backendPane.tier.remote-self-hosted.sub': 'on the WAN',
  'workbench.settings.backendPane.tier.bullet.zeroSetup': 'zero setup',
  'workbench.settings.backendPane.tier.bullet.minimalSetup': 'minimal setup',
  'workbench.settings.backendPane.tier.bullet.standardSetup': 'standard setup',
  'workbench.settings.backendPane.tier.bullet.singleDevice': 'single device',
  'workbench.settings.backendPane.tier.bullet.multipleDevices': 'multiple devices',
  'workbench.settings.backendPane.tier.bullet.perBrowserInstance': 'per-browser instance',
  'workbench.settings.backendPane.tier.bullet.perAppInstance': 'per-app instance',
  'workbench.settings.backendPane.tier.bullet.multiBrowserInstances': 'multi-browser instances',
  'workbench.settings.backendPane.tier.bullet.multiAppInstances': 'multi-app instances',
  'workbench.settings.backendPane.tier.bullet.multiSurfaceEditing': 'multi-surface concurrent editing',
  'workbench.settings.backendPane.tier.bullet.multiWindowEditing': 'multi-window concurrent editing',
  'workbench.settings.backendPane.tier.bullet.localhostOnly': 'Localhost-only',
  'workbench.settings.backendPane.tier.bullet.localhostSupported': 'Localhost-supported',
  'workbench.settings.backendPane.tier.bullet.lanReachable': 'LAN-reachable',
  'workbench.settings.backendPane.tier.bullet.wanReachable': 'WAN/Internet-reachable',
  'workbench.settings.backendPane.tier.bullet.nativeFilesystem': 'native filesystem',
  'workbench.settings.backendPane.tier.bullet.yamlOnDisk': 'YAML on disk',
  'workbench.settings.backendPane.tier.bullet.gitIntegration': 'git integration (local/remote)',
  'workbench.settings.backendPane.tier.bullet.clients': 'browser ext · desktop app · CLI',
  'workbench.settings.backendPane.tier.bullet.headlessByDefault': 'headless by default · website opt-in',
  'workbench.settings.backendPane.tier.bullet.teamReady': 'team-ready',
  'workbench.settings.backendPane.tier.bullet.ssoAuth': 'SSO Auth',
  'workbench.settings.backendPane.tier.bullet.rbac': 'RBAC user management',
  'workbench.settings.backendPane.tier.bullet.auditLogs': 'audit logs & reports',
  'workbench.settings.backendPane.tier.note.soon': 'soon',
  'workbench.settings.backendPane.tier.group.allOs': 'All OS',
  'workbench.settings.backendPane.tier.group.embedded': 'Embedded',
  'workbench.settings.backendPane.tier.group.hyperscalers': 'Hyperscalers',
  'workbench.settings.backendPane.tier.group.euNative': 'EU-native',
  'workbench.settings.backendPane.tier.group.other': 'Other',
  'workbench.settings.backendPane.tier.group.enterprise': 'Enterprise',
  'workbench.settings.backendPane.tier.platform.yourCloud': 'Your cloud',
  'workbench.settings.backendPane.tier.platform.onPrem': 'On-prem',
  'workbench.settings.backendPane.tier.platform.homeServer': 'Home server',
  'workbench.settings.backendPane.tier.platform.oldLaptop': 'Old laptop',
  'workbench.settings.backendPane.tier.platform.miniPc': 'Mini PC',
  'workbench.settings.backendPane.tier.reach.none': 'N/A',
  'workbench.settings.backendPane.tier.reach.localhost': 'Localhost',
  'workbench.settings.backendPane.tier.reach.lan': 'Localhost/LAN',
  'workbench.settings.backendPane.tier.reach.wan': 'Internet/WAN',
  'workbench.settings.backendPane.tier.cat.whyNoWire': 'Why no wire?',
  'workbench.settings.backendPane.tier.cat.sameBrowserSurfaces': 'Same-browser surfaces',
  'workbench.settings.backendPane.tier.cat.perBrowserInstance': 'Per-browser instance',
  'workbench.settings.backendPane.tier.cat.ipv4Loopback': 'IPv4 loopback',
  'workbench.settings.backendPane.tier.cat.ipv6Loopback': 'IPv6 loopback',
  'workbench.settings.backendPane.tier.cat.defaultPort': 'Default port',
  'workbench.settings.backendPane.tier.cat.localhostLoopback': 'Localhost / loopback',
  'workbench.settings.backendPane.tier.cat.rfc1918': 'RFC1918 private IPv4',
  'workbench.settings.backendPane.tier.cat.ipv6Ula': 'IPv6 ULA',
  'workbench.settings.backendPane.tier.cat.cgnat': 'CGNAT / overlay',
  'workbench.settings.backendPane.tier.cat.zeroConfig': 'Zero-config / no-DHCP fallback',
  'workbench.settings.backendPane.tier.cat.mdns': 'mDNS hostnames',
  'workbench.settings.backendPane.tier.cat.publicDns': 'Public DNS hostname',
  'workbench.settings.backendPane.tier.cat.publicIpv4': 'Public IPv4',
  'workbench.settings.backendPane.tier.cat.publicIpv6': 'Public IPv6',
  'workbench.settings.backendPane.tier.cat.transport': 'Transport',
  'workbench.settings.backendPane.tier.rangeNote.backendIsSw':
    'no port to listen on, no IPC surface exposed to other devices',
  'workbench.settings.backendPane.tier.rangeNote.runtimeMessaging':
    'popup / workbench / DevTools / side-panel talk to the SW in-process',
  'workbench.settings.backendPane.tier.rangeNote.storageLocal':
    'Chrome ≠ Firefox ≠ Edge — separate data per browser, no cross-device, no cross-browser',
  'workbench.settings.backendPane.tier.rangeNote.typicalLoopback': 'typically 127.0.0.1',
  'workbench.settings.backendPane.tier.rangeNote.portOverride': 'override in Backend → Connection',
  'workbench.settings.backendPane.tier.rangeNote.daemonOwnBox': 'IPv4 — daemon on your own box (Docker, sidecar)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6': 'IPv6',
  'workbench.settings.backendPane.tier.rangeNote.ulaPractically': 'practically fd00::/8 — IPv6 private allocation',
  'workbench.settings.backendPane.tier.rangeNote.overlayVendors': 'Tailscale, etc.',
  'workbench.settings.backendPane.tier.rangeNote.ipv4LinkLocal': 'IPv4 link-local (APIPA)',
  'workbench.settings.backendPane.tier.rangeNote.ipv6LinkLocal': 'IPv6 link-local — every interface auto-assigns one',
  'workbench.settings.backendPane.tier.rangeNote.bonjour': 'Bonjour / Avahi',
  'workbench.settings.backendPane.tier.rangeNote.tlsCert': 'recommended — TLS cert',
  'workbench.settings.backendPane.tier.rangeNote.publicIpv4': 'anything outside RFC1918 / 100.64/10',
  'workbench.settings.backendPane.tier.rangeNote.globallyRoutable': 'globally routable',
  'workbench.settings.backendPane.tier.rangeNote.tlsRequired': 'required — clients refuse ws:// to a non-loopback host',

  // ── Backend pane: scene-diagram aria labels ────────────────────────
  // The topology scenes themselves stay literal English (illustration
  // plane, S3 glyph precedent); only their accessible names localize.
  'workbench.settings.backendPane.detail.aria.in-browser': 'In-browser back-end',
  'workbench.settings.backendPane.detail.aria.desktop-app': 'Desktop app back-end',
  'workbench.settings.backendPane.detail.aria.local-self-hosted': 'Local LAN daemon back-end',
  'workbench.settings.backendPane.detail.aria.remote-self-hosted': 'Remote self-hosted back-end',

  // ── Keymap pane body ───────────────────────────────────────────────
  'workbench.settings.keymapPane.searchPlaceholder': 'Search shortcuts',
  'workbench.settings.keymapPane.noMatches': 'No shortcuts match your search.',
  'workbench.settings.keymapPane.recording': 'Press keys…',
  'workbench.settings.keymapPane.unbound': 'Not bound',
  'workbench.settings.keymapPane.recordTip': 'Click to record a new shortcut',
  'workbench.settings.keymapPane.recordAria': 'Change shortcut for {label}',
  'workbench.settings.keymapPane.unbind': 'Remove shortcut',
  'workbench.settings.keymapPane.unbindAria': 'Remove shortcut for {label}',
  'workbench.settings.keymapPane.resetAria': 'Reset shortcut for {label}',
  'workbench.settings.keymapPane.conflictSummary': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} shortcut has a conflicting assignment',
      other: '{count} shortcuts have conflicting assignments',
    }),
  'workbench.settings.keymapPane.conflictShowOnly': 'Show conflicts',
  'workbench.settings.keymapPane.conflictShowAll': 'Show all shortcuts',
  'workbench.settings.keymapPane.conflictBadgeAria': 'Shortcut conflict',
  'workbench.settings.keymapPane.conflictTooltip': 'Also assigned to: {labels}',
  'workbench.settings.keymapPane.reservedBadgeAria': 'Reserved shortcut',
  'workbench.settings.keymapPane.reservedBrowser':
    'The browser reserves this shortcut — it may act on it before it reaches the app.',
  'workbench.settings.keymapPane.reservedSystem':
    'The operating system reserves this shortcut — it may act on it before it reaches the app.',
  'workbench.settings.keymapPane.lookupTip': 'Find actions by pressing their shortcut',
  'workbench.settings.keymapPane.lookupAria': 'Find action by shortcut',
  'workbench.settings.keymapPane.lookupEmpty': 'No action is bound to {chord}.',
  'workbench.settings.keymapPane.conflictPrompt': '{chord} is already assigned to: {labels}',
  'workbench.settings.keymapPane.conflictReassign': 'Reassign',
  'workbench.settings.keymapPane.conflictKeepBoth': 'Keep both',
  'workbench.settings.keymapPane.presetAria': 'Keymap preset',
  'workbench.settings.keymapPane.presetRestore': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Restore preset ({count} customization)',
      other: 'Restore preset ({count} customizations)',
    }),
  'workbench.settings.keymapPane.presetRestoreTip': 'Reset every customized shortcut to the active preset.',

  // ── Daemon token ledger (shared by Backend + MCP panes) ────────────
  'workbench.settings.daemonTokens.sectionTitle': 'Paired devices',
  'workbench.settings.daemonTokens.sectionBlurb':
    'Each device that connects to this daemon authenticates with an access token. Connected devices are highlighted; rotate a token to issue a fresh secret and retire the old one.',
  'workbench.settings.daemonTokens.labelPlaceholder': "Label (optional) — e.g. 'alice's phone'",
  'workbench.settings.daemonTokens.bindUserPlaceholder': 'Bind to user (optional)',
  'workbench.settings.daemonTokens.generate': 'Generate token',
  'workbench.settings.daemonTokens.pairDevice': 'Pair a device',
  'workbench.settings.daemonTokens.explainer.intro': 'Both add a token below.',
  'workbench.settings.daemonTokens.explainer.generateText':
    'shows you the secret to copy and paste into the device yourself.',
  'workbench.settings.daemonTokens.explainer.pairText':
    'shows a short code the device enters under Settings → Backend → Pair with a code (or opens a link, as a fallback) — use it when someone else sets up the device.',
  'workbench.settings.daemonTokens.empty':
    "No devices yet. Generate a token and paste it into the device's Settings → Backend, or pair a device and have it enter the code there.",
  'workbench.settings.daemonTokens.mintFailed': 'Failed to mint token: {message}',
  'workbench.settings.daemonTokens.rotateFailed': 'Failed to rotate: {message}',
  'workbench.settings.daemonTokens.revokeFailed': 'Failed to revoke: {message}',
  'workbench.settings.daemonTokens.revokedDevice': 'Token revoked. Any device using it was disconnected.',
  'workbench.settings.daemonTokens.revokedSession': 'Session revoked. The user was signed out.',
  'workbench.settings.daemonTokens.rotate': 'Rotate',
  'workbench.settings.daemonTokens.revoke': 'Revoke',
  'workbench.settings.daemonTokens.rotateConfirmTitle': 'Rotate this token?',
  'workbench.settings.daemonTokens.rotateConfirmBody':
    'A fresh secret is minted and the current one is revoked. The device must be given the new token before it can reconnect.',
  'workbench.settings.daemonTokens.revokeConfirmTitle': 'Revoke this token?',
  'workbench.settings.daemonTokens.revokeConfirmBody':
    "Any device currently using it is disconnected immediately and can't reconnect.",
  'workbench.settings.daemonTokens.revokeSessionConfirmTitle': 'Revoke this session?',
  'workbench.settings.daemonTokens.revokeSessionConfirmBody':
    'The user is signed out and disconnected immediately. They must log in through the identity provider again.',
  'workbench.settings.daemonTokens.revokedTag': 'Revoked {when}',
  'workbench.settings.daemonTokens.connectedTag': 'Connected',
  'workbench.settings.daemonTokens.expiredTag': 'Expired',
  'workbench.settings.daemonTokens.unlabeled': '(unlabeled)',
  'workbench.settings.daemonTokens.unbound': '(unbound)',
  'workbench.settings.daemonTokens.meta.device': 'id {id} · created {created} · last used {lastUsed}',
  'workbench.settings.daemonTokens.meta.boundUser': 'user {user}',
  'workbench.settings.daemonTokens.meta.session':
    'signed in {signedIn} · expires {expires} · last seen {lastSeen} · id {id}',
  'workbench.settings.daemonTokens.ssoTitle': 'SSO sessions',
  'workbench.settings.daemonTokens.ssoBlurb':
    'Each SSO login mints a session that expires on its own. Revoke one to sign the user out immediately — they must log in through the identity provider again.',
  'workbench.settings.daemonTokens.secretTitle': 'Copy this token now',
  'workbench.settings.daemonTokens.secretTitleRotated': 'Copy the rotated token now',
  'workbench.settings.daemonTokens.secretBody':
    'The daemon stores only a hash of this value. Once this dialog closes the secret cannot be recovered — if you lose it, revoke the token and mint a new one.',
  'workbench.settings.daemonTokens.secretBodyRotated':
    'The previous token is now revoked — give this new secret to the device so it can reconnect. The daemon stores only a hash of this value. Once this dialog closes the secret cannot be recovered — if you lose it, revoke the token and mint a new one.',
  'workbench.settings.daemonTokens.secretSaved': "I've saved it",

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.daemonTokens.pairModal.done': 'Done',
  'workbench.settings.daemonTokens.pairModal.allocating': 'Allocating code…',
  'workbench.settings.daemonTokens.pairModal.startFailed': 'Could not start pairing',
  'workbench.settings.daemonTokens.pairModal.expiredTitle': 'Pairing expired',
  'workbench.settings.daemonTokens.pairModal.expiredBody':
    'The 5-minute window elapsed without a confirmation. Close this dialog and click Pair a device again to start over.',
  'workbench.settings.daemonTokens.pairModal.pairedTitle': 'Paired',
  'workbench.settings.daemonTokens.pairModal.pairedBody':
    "The device confirmed the code. A fresh access token was issued and saved on that device; it appears in the list below. If the device can't connect, revoke the entry and pair again.",
  'workbench.settings.daemonTokens.pairModal.intro.part1': 'On the other device, open',
  'workbench.settings.daemonTokens.pairModal.intro.settingsPath': 'Settings → Backend',
  'workbench.settings.daemonTokens.pairModal.intro.part2': ', point its',
  'workbench.settings.daemonTokens.pairModal.intro.address': 'Backend address',
  'workbench.settings.daemonTokens.pairModal.intro.part3': 'at this app, then click',
  'workbench.settings.daemonTokens.pairModal.intro.part4': 'and enter:',
  'workbench.settings.daemonTokens.pairModal.codeLabel': 'Pairing code',
  'workbench.settings.daemonTokens.pairModal.expiresIn': 'expires in {remaining}',
  'workbench.settings.daemonTokens.pairModal.addressListLabel': 'Backend address for this app',
  'workbench.settings.daemonTokens.pairModal.fallback.prefix': 'No',
  'workbench.settings.daemonTokens.pairModal.fallback.suffix':
    'option on that device? Open one of these links there instead — it serves a page that hands over a token to paste by hand.',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported': 'Updates are handled by your install channel in this build.',
  'workbench.settings.updatesRow.checking': 'Checking for updates…',
  'workbench.settings.updatesRow.securityFix': 'Version {version} fixes a security issue affecting this version.',
  'workbench.settings.updatesRow.available': 'Version {version} is available.',
  'workbench.settings.updatesRow.download': 'Download',
  'workbench.settings.updatesRow.downloading': 'Downloading {version}…',
  'workbench.settings.updatesRow.readyToInstall': 'Version {version} is ready to install.',
  'workbench.settings.updatesRow.restartToInstall': 'Restart to install',
  'workbench.settings.updatesRow.checkFailed': 'Update check failed: {message}',
  'workbench.settings.updatesRow.retry': 'Retry',
  'workbench.settings.updatesRow.upToDate': "You're on the latest version ({version}).",
  'workbench.settings.updatesRow.checkNow': 'Check now',
  'workbench.settings.updatesRow.releaseNotes': 'Release notes',
  'workbench.settings.updatesRow.lastChecked': 'Last checked {when}',

  // ── MCP category defs ──────────────────────────────────────────────
  'workbench.settings.def.mcp.enabled.label': 'Enable MCP server',
  'workbench.settings.def.mcp.enabled.description':
    'Answer MCP clients on this app’s daemon port. While off, the endpoint does not exist. On, agents with an access token can read your workspaces.',
  'workbench.settings.def.mcp.allowWrite.label': 'Allow write tools',
  'workbench.settings.def.mcp.allowWrite.description':
    'Agents can create, edit, and delete rules, requests, environments, variables, and workflows. Every change lands in the Activity Feed and can be reverted.',
  'workbench.settings.def.mcp.allowExecute.label': 'Allow execute tools',
  'workbench.settings.def.mcp.allowExecute.description':
    'Agents can send saved requests and run workflows — real network traffic leaves this machine on their behalf.',
  'workbench.settings.def.mcp.allowSecrets.label': 'Allow secret reveal',
  'workbench.settings.def.mcp.allowSecrets.description':
    'Agents can read vault secret values in plain text. While off, every secret stays masked.',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.serverOff': 'The MCP server is off — clients can’t connect until you enable it.',
  'workbench.settings.mcpPane.connect.title': 'Connect a client',
  'workbench.settings.mcpPane.connect.blurb':
    'Pick your client, replace {token} with a token generated above, and adjust the app path if you installed somewhere else. The app must be running for clients to connect.',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle': 'claude_desktop_config.json — merge into the existing file',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'Run once in a terminal',
  'workbench.settings.mcpPane.snippet.cliTitle': 'Run once in a terminal — later oh runs need no flags',
  'workbench.settings.mcpPane.snippet.httpTitle': 'For clients that speak streamable HTTP directly',

  // ── License pane body ──────────────────────────────────────────────
  'workbench.settings.licensePane.invalid.malformed': 'The installed file is not a license key.',
  'workbench.settings.licensePane.invalid.schema-mismatch':
    'The installed license does not match any schema this version supports.',
  'workbench.settings.licensePane.invalid.unknown-kid':
    'The installed license is signed with a key this build does not trust.',
  'workbench.settings.licensePane.invalid.bad-signature':
    'The installed license failed signature verification — the text was altered after signing.',
  'workbench.settings.licensePane.installed': 'License installed',
  'workbench.settings.licensePane.removed': 'License removed — back on the free tier',
  'workbench.settings.licensePane.removeFailed': 'Failed to remove license: {message}',
  'workbench.settings.licensePane.freeTier.title': 'Free tier',
  'workbench.settings.licensePane.freeTier.body':
    'Everything in Open Headers today is included — the free tier admits up to {limit} active users per daemon. Install a license key to raise the seat limit.',
  'workbench.settings.licensePane.invalidAlert.title': 'Installed license is not usable',
  'workbench.settings.licensePane.invalidAlert.body':
    'The app keeps running on the free tier (up to {limit} active users). Paste a fresh key below or contact support.',
  'workbench.settings.licensePane.grace.title': 'License expired — grace period active',
  'workbench.settings.licensePane.grace.body':
    'This license expired on {expiredOn}. Renew before {graceEndsOn} — after that, creating or reactivating users falls back to the free limit of {limit}. Existing users keep logging in and no data is ever affected.',
  'workbench.settings.licensePane.expired.title': 'License and grace period have ended',
  'workbench.settings.licensePane.expired.body':
    'New user creation and reactivation now follow the free limit of {limit} active users. Existing users keep logging in, existing workspaces keep working, and no data is ever affected. Install a renewed key to restore the licensed seat count.',
  'workbench.settings.licensePane.detail.licensedTo': 'Licensed to',
  'workbench.settings.licensePane.detail.contact': 'Contact',
  'workbench.settings.licensePane.detail.seats': 'Seats',
  'workbench.settings.licensePane.detail.validUntil': 'Valid until',
  'workbench.settings.licensePane.detail.licenseId': 'License id',
  'workbench.settings.licensePane.tag.active': 'Active',
  'workbench.settings.licensePane.tag.offline': 'Offline license',
  'workbench.settings.licensePane.removeConfirm.title': 'Remove this license?',
  'workbench.settings.licensePane.removeConfirm.body':
    'The app reverts to the free tier (up to {limit} active users). No data is affected.',
  'workbench.settings.licensePane.removeConfirm.ok': 'Remove',
  'workbench.settings.licensePane.removeButton': 'Remove license',
  'workbench.settings.licensePane.replaceTitle': 'Replace license',
  'workbench.settings.licensePane.installTitle': 'Install a license',
  'workbench.settings.licensePane.pastePlaceholder': 'Paste your license key (oh-license.…)',
  'workbench.settings.licensePane.installButton': 'Install',
  'workbench.settings.licensePane.loadFromFile': 'Load from file…',

  // ── General category defs ──────────────────────────────────────────
  'workbench.settings.def.general.language.label': 'Language',
  'workbench.settings.def.general.language.description':
    'Display language for the interface. Applies immediately to every open surface — no reload. Technical vocabulary (header names, HTTP methods, protocol terms) stays in English in every language.',
  'workbench.settings.def.general.language.option.auto.label': 'Follow system',
  'workbench.settings.def.general.language.option.auto.description': 'Match your browser or operating system language',
  'workbench.settings.def.general.language.option.pseudo.description':
    'Accented, expanded English for spotting untranslated or truncated text',
  'workbench.settings.def.general.confirmOnDelete.label': 'Confirm Before Deleting',
  'workbench.settings.def.general.confirmOnDelete.description':
    'Show a confirmation dialog before deleting rules, folders, or collections.',
  'workbench.settings.def.general.showEmptyStateHints.label': 'Show Empty-State Hints',
  'workbench.settings.def.general.showEmptyStateHints.description':
    'Render guidance and tips in empty panels and onboarding areas.',
  'workbench.settings.def.general.restoreTabsOnStartup.label': 'Restore Tabs on Startup',
  'workbench.settings.def.general.restoreTabsOnStartup.description':
    'Re-open the editor tabs that were open at the end of the previous session.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.label': 'Collection Environment Switching',
  'workbench.settings.def.general.collectionEnvAutoSwitch.description':
    'How the active environment changes as you move between collections and the entities inside them (rules, requests, folders). Applies to both rule collections and API request collections. Collections can carry a default environment and pin a short list of recommended environments; this setting controls whether those defaults take over automatically.',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.label': 'Keep selected environment',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.keep-selection.description':
    "Whatever you have selected (including no environment) stays selected as you navigate between collections and their subfolders, rules, or requests. A collection's default only applies when no environment is selected.",
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.label': 'Apply collection defaults',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.apply-defaults.description':
    "A collection's default takes over while you're inside it (or any subfolder, rule, or request within). Your last manual pick is the base environment — restored whenever you leave a collection or enter one without a default. No per-collection memory.",
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.label': 'Follow each collection',
  'workbench.settings.def.general.collectionEnvAutoSwitch.option.follow-collection.description':
    "Opening a collection (or any subfolder, rule, or request inside it) with a default environment switches to that default. Picks you make inside a collection are remembered for that collection. Collections without a default don't auto-switch.",
  'workbench.settings.def.general.settingsOpenMode.label': 'Settings Open Mode',
  'workbench.settings.def.general.settingsOpenMode.description':
    'How the Settings page opens when launched from the toolbar, popup, or command palette.',
  'workbench.settings.def.general.settingsOpenMode.option.modal.label': 'Modal',
  'workbench.settings.def.general.settingsOpenMode.option.modal.description': 'Overlay centered on the current page',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.label': 'Modal (maximized)',
  'workbench.settings.def.general.settingsOpenMode.option.modal-maximized.description':
    'Overlay that fills most of the viewport',
  'workbench.settings.def.general.settingsOpenMode.option.tab.label': 'Editor tab',
  'workbench.settings.def.general.settingsOpenMode.option.tab.description':
    'Open as a full editor tab in the workspace',
  'workbench.settings.def.general.settingsShowCategoryLabels.label': 'Show Category Names in Settings Sidebar',
  'workbench.settings.def.general.settingsShowCategoryLabels.description':
    'Render text labels next to category icons in the Settings sidebar. Right-click the sidebar to toggle. Disable for an icon-only compact rail.',

  // ── Appearance category defs ───────────────────────────────────────
  'workbench.settings.def.appearance.theme.label': 'Color Theme',
  'workbench.settings.def.appearance.theme.description': 'Controls the overall color theme of the app.',
  'workbench.settings.def.appearance.theme.option.light.label': 'Light',
  'workbench.settings.def.appearance.theme.option.dark.label': 'Dark',
  'workbench.settings.def.appearance.theme.option.auto.label': 'Follow system',
  'workbench.settings.def.appearance.theme.option.auto.description': 'Match your operating system',
  'workbench.settings.def.appearance.lightVariant.label': 'Light Theme Variant',
  'workbench.settings.def.appearance.lightVariant.description': 'Palette used when the resolved color theme is light.',
  'workbench.settings.def.appearance.lightVariant.option.default.label': 'Default',
  'workbench.settings.def.appearance.lightVariant.option.default.description':
    'Balanced neutral light theme for everyday use.',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.label': 'High Contrast',
  'workbench.settings.def.appearance.lightVariant.option.highContrast.description':
    'Maximum legibility — pure white surfaces, near-black text, AAA contrast.',
  'workbench.settings.def.appearance.lightVariant.option.warm.label': 'Warm',
  'workbench.settings.def.appearance.lightVariant.option.warm.description':
    'Paper-like surfaces with warm neutrals and an amber accent — easier on the eyes for long sessions.',
  'workbench.settings.def.appearance.lightVariant.option.cool.label': 'Cool',
  'workbench.settings.def.appearance.lightVariant.option.cool.description':
    'Slate-blue tinted light theme — crisp surfaces with a steel-blue accent.',
  'workbench.settings.def.appearance.lightVariant.option.rose.label': 'Rose',
  'workbench.settings.def.appearance.lightVariant.option.rose.description':
    'Soft blush surfaces with a magenta accent — gentle warmth without the amber tone of Warm.',
  'workbench.settings.def.appearance.lightVariant.option.sepia.label': 'Sepia',
  'workbench.settings.def.appearance.lightVariant.option.sepia.description':
    'Saturated parchment palette with deep brown text — heaviest tinted light variant, ideal for prolonged reading.',
  'workbench.settings.def.appearance.darkVariant.label': 'Dark Theme Variant',
  'workbench.settings.def.appearance.darkVariant.description': 'Palette used when the resolved color theme is dark.',
  'workbench.settings.def.appearance.darkVariant.option.default.label': 'Default',
  'workbench.settings.def.appearance.darkVariant.option.default.description':
    'Balanced neutral dark theme for everyday use.',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.label': 'High Contrast',
  'workbench.settings.def.appearance.darkVariant.option.highContrast.description':
    'Maximum legibility — true black surfaces, bright text, AAA contrast.',
  'workbench.settings.def.appearance.darkVariant.option.dim.label': 'Dim',
  'workbench.settings.def.appearance.darkVariant.option.dim.description':
    'Soft slate-blue surfaces with lower glare — easier on the eyes in low-light environments.',
  'workbench.settings.def.appearance.darkVariant.option.midnight.label': 'Midnight',
  'workbench.settings.def.appearance.darkVariant.option.midnight.description':
    'Deep navy surfaces with a vivid blue accent — richer and more saturated than Dim.',
  'workbench.settings.def.appearance.darkVariant.option.forest.label': 'Forest',
  'workbench.settings.def.appearance.darkVariant.option.forest.description':
    'Green-tinted dark surfaces with an emerald accent — calm, vegetal palette.',
  'workbench.settings.def.appearance.darkVariant.option.arctic.label': 'Arctic',
  'workbench.settings.def.appearance.darkVariant.option.arctic.description':
    'Cool blue-gray dark theme with a frosty cyan accent — flatter and less saturated than Dim or Midnight.',
  'workbench.settings.def.appearance.uiScale.label': 'UI Scale',
  'workbench.settings.def.appearance.uiScale.description':
    'Scales the entire chrome — buttons, text, paddings, controls — without changing the editor font size.',
  'workbench.settings.def.appearance.uiScale.option.0.7.label': 'Tiny (70%)',
  'workbench.settings.def.appearance.uiScale.option.0.7.description':
    'Densest layout — useful when paired with the Press Start 2P UI font, which renders unusually tall and wide.',
  'workbench.settings.def.appearance.uiScale.option.0.8.label': 'Compact (80%)',
  'workbench.settings.def.appearance.uiScale.option.0.8.description':
    'Tighter chrome that still keeps comfortable click targets.',
  'workbench.settings.def.appearance.uiScale.option.0.9.label': 'Small (90%)',
  'workbench.settings.def.appearance.uiScale.option.0.9.description':
    'Slightly tighter than default — fits more on screen.',
  'workbench.settings.def.appearance.uiScale.option.1.label': 'Normal (100%)',
  'workbench.settings.def.appearance.uiScale.option.1.description': 'Default chrome size.',
  'workbench.settings.def.appearance.uiScale.option.1.1.label': 'Large (110%)',
  'workbench.settings.def.appearance.uiScale.option.1.1.description': 'Slightly enlarged for easier reading.',
  'workbench.settings.def.appearance.uiScale.option.1.25.label': 'Extra Large (125%)',
  'workbench.settings.def.appearance.uiScale.option.1.25.description': 'Maximum chrome scale — best for accessibility.',
  'workbench.settings.def.appearance.fontFamilyPreset.label': 'UI Font Family',
  'workbench.settings.def.appearance.fontFamilyPreset.description':
    "Curated sans-serif stacks for the app chrome. Default is Inter on Windows / Linux for cross-platform consistency, and System Sans on macOS to keep SF Pro's native optical sizing. Every option is bundled with the extension. Editor surfaces have their own font setting.",
  'workbench.settings.def.appearance.fontFamilyPreset.option.inter.description':
    'Bundled UI sans designed for screens — renders identically on every operating system, so the app looks the same on macOS, Windows, and Linux.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.system.description':
    'Operating-system default UI sans — San Francisco on macOS, Segoe UI on Windows, Roboto on Linux. Use this if you prefer the native look at the cost of cross-platform consistency.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.atkinson-hyperlegible.description':
    'Sans designed for low-vision readability — distinctive letterforms reduce character confusion. Bundled — always available.',
  'workbench.settings.def.appearance.fontFamilyPreset.option.press-start-2p.description':
    'The pixel-style display font we ship with the app. Bundled — always available. A novelty pick: legible but tall and wide; chrome paddings will look generous.',
  'workbench.settings.def.appearance.density.label': 'UI Density',
  'workbench.settings.def.appearance.density.description': 'Compact mode reduces padding in lists, tables and forms.',
  'workbench.settings.def.appearance.density.option.comfortable.label': 'Comfortable',
  'workbench.settings.def.appearance.density.option.compact.label': 'Compact',
  'workbench.settings.def.appearance.editorHeaderPosition.label': 'Editor Header Position',
  'workbench.settings.def.appearance.editorHeaderPosition.description':
    'Where each editor docks its title-and-actions row (name, enable toggle, Save). Bottom keeps the top of the editor lighter and the primary actions near the content you are editing.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.label': 'Top',
  'workbench.settings.def.appearance.editorHeaderPosition.option.top.description':
    'Classic placement above the editor content.',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.label': 'Bottom',
  'workbench.settings.def.appearance.editorHeaderPosition.option.bottom.description':
    'Docked below the editor content, above the status bar.',
  'workbench.settings.def.appearance.clockFormat.label': 'Clock Format',
  'workbench.settings.def.appearance.clockFormat.description':
    'How timestamps render across the app (notifications, logs). Explicit because the browser locale follows the browser language, not your system region format.',
  'workbench.settings.def.appearance.clockFormat.option.24h.label': '24-hour',
  'workbench.settings.def.appearance.clockFormat.option.12h.label': '12-hour',
  'workbench.settings.def.appearance.accentColor.label': 'Accent Color',
  'workbench.settings.def.appearance.accentColor.description':
    'The primary color used for buttons, links, and active highlights. Applies only to the Default theme variants — high-contrast and tinted variants pin their own accent.',

  // ── Workspace Layout category defs ─────────────────────────────────
  'workbench.settings.def.workspaceLayout.footerShowVersion.label': 'Show Version in Footer',
  'workbench.settings.def.workspaceLayout.footerShowVersion.description':
    'Display the extension version number in the workspace status bar.',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.label': 'Show Theme Switcher in Footer',
  'workbench.settings.def.workspaceLayout.footerShowThemeSwitcher.description':
    'Display the light/dark/auto theme dropdown in the workspace status bar.',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.label': 'Show Panel Toggles in Top Bar',
  'workbench.settings.def.workspaceLayout.topbarShowPanelToggles.description':
    'Display the left / bottom / right panel toggle icons in the workspace top bar.',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.label': 'Show Layout Menu in Top Bar',
  'workbench.settings.def.workspaceLayout.topbarShowLayoutMenu.description':
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the workspace top bar.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.label': 'Bottom Panel Alignment',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.description':
    'Where the bottom panel sits in the shell. Left/right aligns it under one sidebar + the editor; center nests it inside the middle column; justify spans the full viewport.',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.label': 'Center',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.center.description':
    'Bottom panel nested inside the middle column',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.label': 'Left',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.left.description':
    'Bottom spans left sidebar + editor',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.label': 'Right',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.right.description':
    'Bottom spans editor + right sidebar',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.label': 'Justify',
  'workbench.settings.def.workspaceLayout.bottomPanelAlignment.option.justify.description':
    'Bottom spans the full viewport width',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.label': 'Show Tool Window Labels',
  'workbench.settings.def.workspaceLayout.showToolWindowLabels.description':
    'Render text labels next to activity-bar and dock-tab icons. Disable for an icon-only compact shell.',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.label': 'Left Activity Bar Width',
  'workbench.settings.def.workspaceLayout.activityBarWidthLeft.description':
    'Width of the left activity bar when tool-window labels are visible. Locked to 36px in icon-only mode.',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.label': 'Right Activity Bar Width',
  'workbench.settings.def.workspaceLayout.activityBarWidthRight.description':
    'Width of the right activity bar when tool-window labels are visible. Locked to 36px in icon-only mode.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.label': 'Activity Bar Layout',
  'workbench.settings.def.workspaceLayout.sidebarLayout.description':
    'How the activity-bar splits the top and bottom tool-window groups.',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.label': 'Proportional',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.proportional.description':
    'Top and bottom groups split the activity bar 50/50',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.label': 'Compact',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.compact.description':
    'Top group sizes to content; bottom pinned to bottom',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.label': 'Stacked',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.stacked.description':
    'All groups clustered at the top with dividers between',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.label': 'Dynamic',
  'workbench.settings.def.workspaceLayout.sidebarLayout.option.dynamic.description':
    'Chip groups mirror their adjacent panel heights. Closed docks collapse to content and live neighbors absorb the space.',

  // ── DevTools Panel · Layout category defs ──────────────────────────
  'workbench.settings.def.devpanelLayout.footerShowVersion.label': 'Show Version in Footer',
  'workbench.settings.def.devpanelLayout.footerShowVersion.description':
    'Display the extension version number in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.label': 'Show Theme Switcher in Footer',
  'workbench.settings.def.devpanelLayout.footerShowThemeSwitcher.description':
    'Display the light/dark/auto theme dropdown in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowModified.label': 'Show Modified Count in Footer',
  'workbench.settings.def.devpanelLayout.footerShowModified.description':
    'Display how many requests your rules actually modified in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowFailed.label': 'Show Failed Count in Footer',
  'workbench.settings.def.devpanelLayout.footerShowFailed.description':
    'Display how many requests failed or returned an error status in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowCached.label': 'Show Cached Count in Footer',
  'workbench.settings.def.devpanelLayout.footerShowCached.description':
    'Display how many requests were served from cache in the DevTools panel status bar.',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.label': 'Show Current Page in Footer',
  'workbench.settings.def.devpanelLayout.footerShowPageContext.description':
    'Label the timing milestones with the page they describe in the DevTools panel status bar — useful with Preserve log across multiple navigations.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.label': 'Footer Timing Scope',
  'workbench.settings.def.devpanelLayout.footerTimingMode.description':
    'Which navigation the Finish / DOMContentLoaded / Load milestones in the DevTools panel status bar describe. Aggregate spans the whole preserve-log timeline from the first navigation (matches the browser); Current page reports only the latest navigation.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.label': 'Aggregate (all navigations)',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.aggregate.description':
    'Finish / DCL / Load span the whole timeline from the first navigation — the browser default.',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.label': 'Current page only',
  'workbench.settings.def.devpanelLayout.footerTimingMode.option.lastNav.description':
    'Finish / DCL / Load report only the latest navigation, anchored to when it started.',
  'workbench.settings.def.devpanelLayout.footerScope.label': 'Footer Summary Scope',
  'workbench.settings.def.devpanelLayout.footerScope.description':
    'What the DevTools panel status bar summarizes. Focused tool follows the tool window you are working in (Storage, Console, and Search get their own summary lines); Network tool only always shows the Network figures.',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.label': 'Focused tool',
  'workbench.settings.def.devpanelLayout.footerScope.option.focused.description':
    'The footer follows the focused tool window — Storage, Console, and Search show their own summaries; other tools fall back to the Network line.',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.label': 'Network tool only',
  'workbench.settings.def.devpanelLayout.footerScope.option.network.description':
    'The footer always shows the Network figures, whichever tool window has focus.',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.label': 'Show Panel Toggles in Top Bar',
  'workbench.settings.def.devpanelLayout.topbarShowPanelToggles.description':
    'Display the left / bottom / right panel toggle icons in the DevTools panel top bar.',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.label': 'Show Layout Menu in Top Bar',
  'workbench.settings.def.devpanelLayout.topbarShowLayoutMenu.description':
    'Display the layout dropdown (bottom full-width, tool-window labels, sidebar layout) in the DevTools panel top bar.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.label': 'Bottom Panel Alignment',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.description':
    'Where the bottom panel sits in the DevTools panel. Left/right aligns it under one sidebar + the editor; center nests it inside the middle column; justify spans the full width.',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.label': 'Center',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.center.description':
    'Bottom panel nested inside the middle column',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.label': 'Left',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.left.description':
    'Bottom spans left sidebar + editor',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.label': 'Right',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.right.description':
    'Bottom spans editor + right sidebar',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.label': 'Justify',
  'workbench.settings.def.devpanelLayout.bottomPanelAlignment.option.justify.description':
    'Bottom spans the full DevTools panel width',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.label': 'Show Tool Window Labels',
  'workbench.settings.def.devpanelLayout.showToolWindowLabels.description':
    'Render text labels next to activity-bar and dock-tab icons in the DevTools panel. Disabled by default because the panel is narrower than the workspace.',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.label': 'Left Activity Bar Width',
  'workbench.settings.def.devpanelLayout.activityBarWidthLeft.description':
    'Width of the left activity bar in the DevTools panel when tool-window labels are visible. Locked to 36px in icon-only mode.',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.label': 'Right Activity Bar Width',
  'workbench.settings.def.devpanelLayout.activityBarWidthRight.description':
    'Width of the right activity bar in the DevTools panel when tool-window labels are visible. Locked to 36px in icon-only mode.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.label': 'Activity Bar Layout',
  'workbench.settings.def.devpanelLayout.sidebarLayout.description':
    'How the activity-bar splits the top and bottom tool-window groups in the DevTools panel.',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.label': 'Proportional',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.proportional.description':
    'Top and bottom groups split the activity bar 50/50',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.compact.description':
    'Top group sizes to content; bottom pinned to bottom',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.label': 'Stacked',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.stacked.description':
    'All groups clustered at the top with dividers between',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.label': 'Dynamic',
  'workbench.settings.def.devpanelLayout.sidebarLayout.option.dynamic.description':
    'Chip groups mirror their adjacent panel heights. Closed docks collapse to content and live neighbors absorb the space.',

  // ── DevTools Panel · Network category defs ─────────────────────────
  'workbench.settings.def.devpanelNetwork.layout.label': 'Network Layout',
  'workbench.settings.def.devpanelNetwork.layout.description':
    'How the Network table absorbs horizontal space. Compact lets stretchy columns (Name, Waterfall) flex to fit the panel width so the table never scrolls horizontally; Wide caps those columns and scrolls horizontally for the rest.',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.layout.option.compact.description': 'Stretchy columns absorb panel width.',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.label': 'Wide',
  'workbench.settings.def.devpanelNetwork.layout.option.wide.description':
    'Capped widths, scrolls horizontally when needed.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.label': 'Messages Layout',
  'workbench.settings.def.devpanelNetwork.messagesLayout.description':
    'How the Messages frame grid absorbs horizontal space. Compact lets the Data column flex to fit the pane width so the grid never scrolls horizontally; Wide caps it and scrolls horizontally when needed.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.compact.description':
    'The Data column absorbs the pane width.',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.label': 'Wide',
  'workbench.settings.def.devpanelNetwork.messagesLayout.option.wide.description':
    'Capped widths, scrolls horizontally when needed.',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.label': 'Show Payload Preview',
  'workbench.settings.def.devpanelNetwork.messagesShowPreview.description':
    'Show the payload preview pane under the Messages / EventStream grids — the resizable split where the selected frame or event renders as a JSON tree, raw text, or binary viewer. Turn off to give the grid the whole pane.',
  'workbench.settings.def.devpanelNetwork.sortKind.label': 'Network Sort Source',
  'workbench.settings.def.devpanelNetwork.sortKind.description':
    'Which side of the sort state is active. `mode` runs one of the named compound sort modes (Failures first / Slowest first / …). `column` runs the single-column sort the user picked by clicking a column header. The panel switches automatically — clicking a column header sets this to `column`; picking a mode in the View menu sets it to `mode`.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.label': 'Mode',
  'workbench.settings.def.devpanelNetwork.sortKind.option.mode.description': 'Use a named compound sort mode.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.label': 'Column',
  'workbench.settings.def.devpanelNetwork.sortKind.option.column.description':
    'Use the single-column sort the user clicked.',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.label': 'Custom (nested)',
  'workbench.settings.def.devpanelNetwork.sortKind.option.customNested.description':
    'Use the user-built multi-key sort chain.',
  'workbench.settings.def.devpanelNetwork.sortMode.label': 'Network Sort Mode',
  'workbench.settings.def.devpanelNetwork.sortMode.description':
    'Named compound sort order — primary axis then arrival as tiebreak. Active when sort source = `mode`.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.label': 'Failures first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.failures.description':
    'Failed → pending → redirected → success.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.label': 'Slowest first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.slowest.description': 'Longest duration first.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.label': 'Largest first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.largest.description': 'Biggest wire bytes first.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.label': 'Browser priority',
  'workbench.settings.def.devpanelNetwork.sortMode.option.browserPriority.description':
    'Highest → Lowest reported priority.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.label': 'By resource type',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byType.description':
    'Grouped by resource type, arrival within.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.label': 'By domain',
  'workbench.settings.def.devpanelNetwork.sortMode.option.byDomain.description': 'Grouped by hostname, arrival within.',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.label': 'Rule-modified first',
  'workbench.settings.def.devpanelNetwork.sortMode.option.ruleModified.description':
    'Applied rules first, arrival within.',
  'workbench.settings.def.devpanelNetwork.sortBy.label': 'Network Sort By',
  'workbench.settings.def.devpanelNetwork.sortBy.description':
    'Which column drives the column-click sort. Active when sort source = `column`. Clicking a column header updates this value.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.label': 'Waterfall',
  'workbench.settings.def.devpanelNetwork.sortBy.option.waterfall.description':
    'Timeline by the active Waterfall metric (start time by default).',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.label': 'Request #',
  'workbench.settings.def.devpanelNetwork.sortBy.option.requestNumber.description':
    'Request number — the order requests were discovered.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.label': 'Method',
  'workbench.settings.def.devpanelNetwork.sortBy.option.method.description': 'HTTP method.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.label': 'Name',
  'workbench.settings.def.devpanelNetwork.sortBy.option.name.description': 'Final segment of the URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.label': 'Path',
  'workbench.settings.def.devpanelNetwork.sortBy.option.path.description': 'Pathname + query.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.label': 'URL',
  'workbench.settings.def.devpanelNetwork.sortBy.option.url.description': 'Full URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.label': 'Status',
  'workbench.settings.def.devpanelNetwork.sortBy.option.status.description': 'Response status code.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.label': 'Protocol',
  'workbench.settings.def.devpanelNetwork.sortBy.option.protocol.description': 'HTTP version.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.label': 'Scheme',
  'workbench.settings.def.devpanelNetwork.sortBy.option.scheme.description': 'http / https.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.label': 'Domain',
  'workbench.settings.def.devpanelNetwork.sortBy.option.domain.description': 'Host portion of the URL.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.label': 'Remote address',
  'workbench.settings.def.devpanelNetwork.sortBy.option.remoteAddress.description': 'Server IP.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.label': 'Type',
  'workbench.settings.def.devpanelNetwork.sortBy.option.type.description': 'Resource type.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.label': 'Initiator',
  'workbench.settings.def.devpanelNetwork.sortBy.option.initiator.description': 'What triggered the request.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.label': 'Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.cookies.description': 'Request-cookie count.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.label': 'Set Cookies',
  'workbench.settings.def.devpanelNetwork.sortBy.option.setCookies.description': 'Response Set-Cookie count.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.label': 'Size',
  'workbench.settings.def.devpanelNetwork.sortBy.option.size.description': 'Wire bytes.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.label': 'Time',
  'workbench.settings.def.devpanelNetwork.sortBy.option.time.description': 'Total request duration.',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.label': 'Priority',
  'workbench.settings.def.devpanelNetwork.sortBy.option.priority.description': 'Browser-assigned priority.',
  'workbench.settings.def.devpanelNetwork.sortDir.label': 'Network Sort Direction',
  'workbench.settings.def.devpanelNetwork.sortDir.description':
    'Ascending or descending order for the current Network sort column.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.label': 'Ascending',
  'workbench.settings.def.devpanelNetwork.sortDir.option.asc.description': 'Lowest first.',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.label': 'Descending',
  'workbench.settings.def.devpanelNetwork.sortDir.option.desc.description': 'Highest first.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.label': 'Waterfall Metric',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.description':
    'Which time the Waterfall column sorts and draws by. Start / Response / End time place bars on an absolute timeline; Total duration and Latency zero-align the bars so lengths compare directly.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.label': 'Start time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.startTime.description': 'When the request started.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.label': 'Response time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.responseTime.description':
    'When the first response byte arrived.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.label': 'End time',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.endTime.description': 'When the request finished.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.label': 'Total duration',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.duration.description':
    'How long the request took end to end.',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.label': 'Latency',
  'workbench.settings.def.devpanelNetwork.waterfallMetric.option.latency.description':
    'Time to the first response byte.',
  'workbench.settings.def.devpanelNetwork.showFireDots.label': 'Show Rule-fire Dots',
  'workbench.settings.def.devpanelNetwork.showFireDots.description':
    'Show the leading 14px column carrying the colored dot that marks rule matches (filled = a rule actually applied, hollow = inferred). Turn off to reclaim the horizontal pixels on dense panes.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.label': 'Waterfall Values',
  'workbench.settings.def.devpanelNetwork.waterfallValues.description':
    'When to print the active Waterfall metric’s value(s) on the bar — the Start / Response / End time chip for the timeline metrics, or the waiting / download labels for Total duration and Latency.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.label': 'Always',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.always.description': 'Keep the value chip visible.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.label': 'On hover',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.hover.description':
    'Reveal the value chip on row hover.',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.label': 'Off',
  'workbench.settings.def.devpanelNetwork.waterfallValues.option.off.description': 'Hide the value chip.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.label': 'Waterfall Value Format',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.description':
    'How a timeline metric’s value reads: Relative is the offset from the first request in view; Timestamp is the absolute wall-clock instant. Total duration and Latency are always durations regardless.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.label': 'Relative',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.relative.description':
    'Offset from the first request in view.',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.label': 'Timestamp',
  'workbench.settings.def.devpanelNetwork.waterfallValueFormat.option.timestamp.description':
    'Absolute wall-clock instant.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.label': 'Waterfall Timestamp Timezone',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.description':
    'Timezone for the Timestamp value format — local time or UTC.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.label': 'Local',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.local.description': 'Your local timezone.',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.label': 'UTC',
  'workbench.settings.def.devpanelNetwork.waterfallTimestampTz.option.utc.description': 'Coordinated Universal Time.',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.label': 'Explain Waterfall Value',
  'workbench.settings.def.devpanelNetwork.waterfallExplainValue.description':
    'In the Waterfall hover popover, badge and highlight the phase rows that make up the total and show their sum as a formula. Purely a visual aid — it changes no values.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.label': 'Waterfall Popover Layout',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.description':
    'Orientation of the Waterfall hover timing breakdown. Compact stacks the steps down the popover; Wide lays the same ladder on a time axis; Auto picks by panel width — wide on a bottom-docked panel, compact on a narrow (side-docked) one.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.label': 'Compact',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.vertical.description':
    'Steps stacked down the popover.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.label': 'Wide',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.horizontal.description':
    'Steps laid on a horizontal time axis.',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.label': 'Auto',
  'workbench.settings.def.devpanelNetwork.waterfallPopoverLayout.option.auto.description':
    'Wide when the panel is wide, else compact.',

  // ── DevTools Panel · Headers category defs ─────────────────────────
  'workbench.settings.def.devpanelHeaders.layout.label': 'Headers Layout',
  'workbench.settings.def.devpanelHeaders.layout.description':
    'How header rows are organised inside Request/Response sections. Grouped buckets rows by category (Auth, CORS, Caching, …); Flat renders one list in the chosen sort order.',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.label': 'Grouped',
  'workbench.settings.def.devpanelHeaders.layout.option.grouped.description': 'Rows bucketed by category.',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.label': 'Flat',
  'workbench.settings.def.devpanelHeaders.layout.option.flat.description':
    'Single list, no category headings (Chrome-style).',
  'workbench.settings.def.devpanelHeaders.sortMode.label': 'Headers Sort',
  'workbench.settings.def.devpanelHeaders.sortMode.description':
    'Row ordering within each list (and within each group, when grouped). Original preserves the order the server sent the headers (HAR order); A → Z sorts by name; Rule-modified first floats rule-modified rows to the top.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.sortMode.option.original.description': 'HAR order.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.az.description': 'Alphabetical.',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.label': 'Rule-modified first',
  'workbench.settings.def.devpanelHeaders.sortMode.option.rule-first.description': 'Rule-modified rows on top.',
  'workbench.settings.def.devpanelHeaders.nameCase.label': 'Header Name Case',
  'workbench.settings.def.devpanelHeaders.nameCase.description':
    'How header names are displayed. Train-Case canonicalises every name (`Content-Type`, `Set-Cookie`, `ETag`) to match Chrome/Firefox DevTools — easier to scan. Original keeps the raw casing the server sent (HTTP/2+ lowercases everything on the wire).',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.label': 'Original',
  'workbench.settings.def.devpanelHeaders.nameCase.option.original.description':
    'Exactly what the server sent (often lowercase on HTTP/2+).',
  'workbench.settings.def.devpanelHeaders.showChips.label': 'Show Value Tags',
  'workbench.settings.def.devpanelHeaders.showChips.description':
    'Show the per-value tags on header rows (Cache-Control / Set-Cookie / HSTS / JWT decode, …). Turn off for a tight, value-only view.',
  'workbench.settings.def.devpanelHeaders.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelHeaders.showInsights.description':
    'Display the actionable warning cards at the top of the Headers tab (CORS misconfigs, missing CSP/HSTS, insecure cookies, expired JWT, …).',
  'workbench.settings.def.devpanelHeaders.hideNoise.label': 'Hide Noise Headers',
  'workbench.settings.def.devpanelHeaders.hideNoise.description':
    'Fold low-signal headers (Accept-*, Sec-Fetch-*, Sec-CH-UA-*, User-Agent, Connection, …). The hint below each section lists the hidden names on hover.',
  'workbench.settings.def.devpanelHeaders.ruleOnly.label': 'Rule-modified Only',
  'workbench.settings.def.devpanelHeaders.ruleOnly.description':
    'Show only headers added, modified, or removed by an Open Headers rule.',
  'workbench.settings.def.devpanelHeaders.securityOnly.label': 'Security Headers Only',
  'workbench.settings.def.devpanelHeaders.securityOnly.description':
    'Show only security-related headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, …).',
  'workbench.settings.def.devpanelHeaders.overridableOnly.label': 'Overridable Headers Only',
  'workbench.settings.def.devpanelHeaders.overridableOnly.description':
    'Hide protected headers the browser will not let rules override (host, content-length, sec-ch-ua, …).',

  // ── DevTools Panel · Initiator category defs ───────────────────────
  'workbench.settings.def.devpanelInitiator.sortMode.label': 'Initiator Children Sort',
  'workbench.settings.def.devpanelInitiator.sortMode.description':
    'How child requests are ordered inside the initiator chain. Initiator order preserves the original initiator-graph traversal; Chronological orders by request time; Largest subtree puts the heaviest subtree first.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.label': 'Initiator order',
  'workbench.settings.def.devpanelInitiator.sortMode.option.initiator.description': 'As discovered.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.label': 'Chronological',
  'workbench.settings.def.devpanelInitiator.sortMode.option.chronological.description': 'By request time.',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.label': 'Largest subtree',
  'workbench.settings.def.devpanelInitiator.sortMode.option.largest.description': 'Heaviest subtrees first.',
  'workbench.settings.def.devpanelInitiator.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelInitiator.showInsights.description':
    'Display the actionable callouts at the top of the Initiator tab (failed subrequests, dominant host, third-party share, …).',
  'workbench.settings.def.devpanelInitiator.failuresOnly.label': 'Failures Only',
  'workbench.settings.def.devpanelInitiator.failuresOnly.description':
    'Show only failed or blocked rows in the initiator chain.',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.label': '3rd-party Only',
  'workbench.settings.def.devpanelInitiator.thirdPartyOnly.description':
    'Show only rows from origins different than the page origin.',

  // ── DevTools Panel · Cookies category defs ─────────────────────────
  'workbench.settings.def.devpanelCookies.sortMode.label': 'Cookies Sort',
  'workbench.settings.def.devpanelCookies.sortMode.description':
    'Row ordering inside each cookies section. Original preserves the order the server / request used; A → Z sorts by name; Size sorts by serialized cookie size; Expires sorts soonest-expiring first (Session last).',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.label': 'Original',
  'workbench.settings.def.devpanelCookies.sortMode.option.original.description': 'As sent / set.',
  'workbench.settings.def.devpanelCookies.sortMode.option.az.description': 'Alphabetical by name.',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.label': 'Size',
  'workbench.settings.def.devpanelCookies.sortMode.option.size.description': 'Largest cookie first.',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.label': 'Expires',
  'workbench.settings.def.devpanelCookies.sortMode.option.expires.description': 'Soonest expiry first.',
  'workbench.settings.def.devpanelCookies.expiresFormat.label': 'Expires Format',
  'workbench.settings.def.devpanelCookies.expiresFormat.description':
    'How cookie expiry is rendered. Relative shows "in 2d", "30s ago", "Session"; Absolute shows the parsed UTC date.',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.relative.label': 'Relative',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.label': 'Absolute',
  'workbench.settings.def.devpanelCookies.expiresFormat.option.absolute.description': 'UTC date.',
  'workbench.settings.def.devpanelCookies.showChips.label': 'Show Tags',
  'workbench.settings.def.devpanelCookies.showChips.description':
    'Show the role / lifecycle / context tags next to each cookie name (auth? / tracking? / pref / just set / dropped / 3rd-party / partitioned / …). Turn off for a tight, columns-only view.',
  'workbench.settings.def.devpanelCookies.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelCookies.showInsights.description':
    'Display the actionable warning cards at the top of the Cookies tab (SameSite=None without Secure, __Host- / __Secure- prefix violations, oversized cookies, expired-but-sent, …).',
  'workbench.settings.def.devpanelCookies.decodeValues.label': 'Decode URL-encoded Values',
  'workbench.settings.def.devpanelCookies.decodeValues.description':
    'Show cookie values with percent-encoding decoded ("Europe%2FMadrid" → "Europe/Madrid"). Hover the value to see the raw form.',
  'workbench.settings.def.devpanelCookies.groupByRole.label': 'Group by Role',
  'workbench.settings.def.devpanelCookies.groupByRole.description':
    'Group cookies by their inferred role inside each section — Auth & session first, then Functional, Preferences, Analytics & tracking. Heuristic-driven; the role chips (auth? / tracking? / pref) carry the question mark as a reminder.',
  'workbench.settings.def.devpanelCookies.showFilteredOut.label': 'Show Filtered-out Request Cookies',
  'workbench.settings.def.devpanelCookies.showFilteredOut.description':
    'Mirror Chrome\'s "show filtered out request cookies" toggle — also list jar cookies that were not sent on this request because of path / Secure / SameSite / expiry mismatch.',
  'workbench.settings.def.devpanelCookies.problemsOnly.label': 'Problems Only',
  'workbench.settings.def.devpanelCookies.problemsOnly.description':
    'Show only cookies that triggered a warning — missing Secure, prefix violation, expired-but-sent, …',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.label': '3rd-party Only',
  'workbench.settings.def.devpanelCookies.thirdPartyOnly.description':
    'Show only cookies whose domain is cross-site to the top-frame origin.',
  'workbench.settings.def.devpanelCookies.ruleOnly.label': 'Rule-modified Only',
  'workbench.settings.def.devpanelCookies.ruleOnly.description':
    'Show only cookies whose Cookie / Set-Cookie line was added, modified, or removed by a rule.',

  // ── DevTools Panel · Timing category defs ──────────────────────────
  'workbench.settings.def.devpanelTiming.showInsights.label': 'Show Suggestions',
  'workbench.settings.def.devpanelTiming.showInsights.description':
    'Display the bottleneck + per-phase warning cards at the top of the Timing tab. Turn off for a numbers-only view.',
  'workbench.settings.def.devpanelTiming.showContextStrip.label': 'Show Context Strip',
  'workbench.settings.def.devpanelTiming.showContextStrip.description':
    'Show the protocol / connection / cache / priority / started / server-IP chip row above the phase breakdown.',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.label': 'Show Phase Breakdown',
  'workbench.settings.def.devpanelTiming.showPhaseGroups.description':
    'Show the Resource Scheduling / Connection Start / Request-Response sections with per-phase millisecond rows.',
  'workbench.settings.def.devpanelTiming.showTimingBar.label': 'Show Timing Bar',
  'workbench.settings.def.devpanelTiming.showTimingBar.description':
    'Show the proportional segmented bar with the per-phase legend (and the Total row beneath it).',
  'workbench.settings.def.devpanelTiming.showServerTiming.label': 'Show Server-Timing',
  'workbench.settings.def.devpanelTiming.showServerTiming.description':
    'Show the parsed `Server-Timing` response-header metrics when the server sent any.',
  'workbench.settings.def.devpanelTiming.showRepeats.label': 'Show Repeats in Session',
  'workbench.settings.def.devpanelTiming.showRepeats.description':
    'Show the comparison against the fastest / median / slowest hit of this same URL within the current panel session.',
  'workbench.settings.def.devpanelTiming.showTransferRate.label': 'Show Transfer Rate',
  'workbench.settings.def.devpanelTiming.showTransferRate.description':
    'Show the effective Content-Download throughput (body bytes ÷ download time) when both the size and the receive leg are known.',

  // ── Debug mode (inspection) category defs ──────────────────────────
  'workbench.settings.def.inspection.cdpEnabled.label': 'Debug mode',
  'workbench.settings.def.inspection.cdpEnabled.description':
    'Inspect and modify requests with the same depth as your browser’s built-in developer tools — page loads, workers, and iframes, not just page-level fetches. The browser shows a debugging banner on each attached tab while this is on; it’s on by default in Chrome and Edge, and you can turn it off any time.',
  'workbench.settings.def.inspection.cdpEnabled.capabilityUnavailableHint':
    'Debug mode is available in Chrome and Edge.',
  'workbench.settings.def.inspection.cdpScope.label': 'Attach to which tabs',
  'workbench.settings.def.inspection.cdpScope.description':
    'Which tabs debug mode attaches to while it’s on. “Where DevTools is open” attaches to browser tabs with their developer tools open. “The focused tab” follows the active browser tab without needing developer tools open — switching to a new-tab or internal page leaves the prior tab attached rather than thrashing. “Both” combines the two. Individual browser tabs can also be pinned in from the footer regardless of this choice.',
  'workbench.settings.def.inspection.cdpScope.capabilityUnavailableHint': 'Debug mode is available in Chrome and Edge.',
  'workbench.settings.def.inspection.cdpScope.option.devtools.label': 'Where DevTools is open',
  'workbench.settings.def.inspection.cdpScope.option.devtools.description':
    'Browser tabs with their developer tools open.',
  'workbench.settings.def.inspection.cdpScope.option.active.label': 'The focused tab',
  'workbench.settings.def.inspection.cdpScope.option.active.description':
    'The active browser tab, following focus — no developer tools needed.',
  'workbench.settings.def.inspection.cdpScope.option.both.label': 'Both',
  'workbench.settings.def.inspection.cdpScope.option.both.description': 'DevTools tabs and the focused tab.',

  // ── Code Editor category defs ──────────────────────────────────────
  'workbench.settings.def.editor.fontSize.label': 'Font Size',
  'workbench.settings.def.editor.fontSize.description': 'Font size in pixels for editor surfaces.',
  'workbench.settings.def.editor.fontFamilyPreset.label': 'Font Family',
  'workbench.settings.def.editor.fontFamilyPreset.description':
    "Curated monospace stacks for the editor. Every option is bundled with the extension — no system install required. Default is JetBrains Mono on Windows / Linux for cross-platform consistency, and System Mono on macOS to keep SF Mono's native rendering.",
  'workbench.settings.def.editor.fontFamilyPreset.option.system.description':
    'Operating-system default monospace — SF Mono on macOS, Consolas on Windows, Liberation Mono on Linux.',
  'workbench.settings.def.editor.fontFamilyPreset.option.fira-code.description':
    'Monospace with programming ligatures. Bundled — always available.',
  'workbench.settings.def.editor.fontFamilyPreset.option.jetbrains-mono.description':
    'Monospace tuned for editors, with ligatures. Bundled — always available.',
  'workbench.settings.def.editor.fontFamilyPreset.option.cascadia-code.description':
    'Monospace with programming ligatures. Bundled — always available.',
  'workbench.settings.def.editor.fontFamilyPreset.option.source-code-pro.description':
    'Adobe monospace tuned for code. Bundled — always available.',
  'workbench.settings.def.editor.fontFamilyPreset.option.press-start-2p.description':
    'The pixel-style display font we ship with the app. Bundled — always available. A novelty pick: legible but tall and wide.',
  'workbench.settings.def.editor.fontLigatures.label': 'Font Ligatures',
  'workbench.settings.def.editor.fontLigatures.description':
    'Enable programming ligatures — combine character sequences like `=>` or `!=` into single glyphs. Requires a font with ligature support (e.g. Fira Code, JetBrains Mono).',
  'workbench.settings.def.editor.lineHeight.label': 'Line Height',
  'workbench.settings.def.editor.lineHeight.description':
    'Editor line height in pixels. 0 lets the editor pick a line height proportional to the font size; values 8 and above are interpreted as explicit pixels.',
  'workbench.settings.def.editor.tabSize.label': 'Tab Size',
  'workbench.settings.def.editor.tabSize.description': 'Number of columns a tab character occupies.',
  'workbench.settings.def.editor.insertSpaces.label': 'Insert Spaces',
  'workbench.settings.def.editor.insertSpaces.description':
    'Insert spaces instead of tab characters when pressing Tab.',
  'workbench.settings.def.editor.wordWrap.label': 'Word Wrap',
  'workbench.settings.def.editor.wordWrap.description': 'Whether long lines wrap to the next line in the editor.',
  'workbench.settings.def.editor.wordWrap.option.off.label': 'Off',
  'workbench.settings.def.editor.wordWrap.option.on.label': 'Viewport width',
  'workbench.settings.def.editor.wordWrap.option.bounded.label': 'Bounded column',
  'workbench.settings.def.editor.wordWrapColumn.label': 'Word Wrap Column',
  'workbench.settings.def.editor.wordWrapColumn.description':
    'Column at which lines wrap when Word Wrap is set to Bounded.',
  'workbench.settings.def.editor.lineNumbers.label': 'Line Numbers',
  'workbench.settings.def.editor.lineNumbers.description': 'Show line numbers in the left gutter.',
  'workbench.settings.def.editor.renderWhitespace.label': 'Render Whitespace',
  'workbench.settings.def.editor.renderWhitespace.description': 'Visually render whitespace characters.',
  'workbench.settings.def.editor.renderWhitespace.option.none.label': 'None',
  'workbench.settings.def.editor.renderWhitespace.option.boundary.label': 'Boundary only',
  'workbench.settings.def.editor.renderWhitespace.option.all.label': 'All',
  'workbench.settings.def.editor.formatOnSave.label': 'Format on Save',
  'workbench.settings.def.editor.formatOnSave.description':
    'Automatically format editor contents when you save a rule or template.',
  'workbench.settings.def.editor.bracketPairColorization.label': 'Bracket Pair Colorization',
  'workbench.settings.def.editor.bracketPairColorization.description':
    'Highlight matching brackets in different colors.',

  // ── API Requests category defs ─────────────────────────────────────
  'workbench.settings.def.requests.responseBodyCapMB.label': 'Response Body Limit (MB)',
  'workbench.settings.def.requests.responseBodyCapMB.description':
    'How much of a response body the executor keeps for display. Larger bodies are truncated at this limit — the full size is still measured and reported. Raising the limit increases memory use per open request tab.',
  'workbench.settings.def.requests.sseEventsNewestFirst.label': 'SSE Events: Newest First',
  'workbench.settings.def.requests.sseEventsNewestFirst.description':
    'Order of the Server-Sent Events list — newest events at the top. Turn off to read oldest first. The list toolbar changes this same setting.',
  'workbench.settings.def.requests.sseEventsGroupByName.label': 'SSE Events: Group by Event Name',
  'workbench.settings.def.requests.sseEventsGroupByName.description':
    'Cluster the Server-Sent Events list under collapsible event-name headers, arrival order kept within each group. The list toolbar changes this same setting.',

  // ── Rules Engine category defs ─────────────────────────────────────
  'workbench.settings.def.rulesEngine.paused.label': 'Pause Rule Execution',
  'workbench.settings.def.rulesEngine.paused.description':
    'Stop applying rules to live network requests. Rules remain editable.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.label': 'Evaluation Strategy',
  'workbench.settings.def.rulesEngine.evaluationStrategy.description':
    'How the engine chooses between rules when several match the same request.',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.label': 'First match',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.first-match.description':
    'Use the first rule in priority order',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.label': 'Closest match',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.closest-match.description':
    'Prefer the most specific matching rule',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.label': 'All matching',
  'workbench.settings.def.rulesEngine.evaluationStrategy.option.all-matching.description':
    'Apply every matching rule in order',
  'workbench.settings.def.rulesEngine.updateDebounceMs.label': 'Update Debounce',
  'workbench.settings.def.rulesEngine.updateDebounceMs.description':
    'Delay (ms) before rule edits are pushed to declarativeNetRequest.',
  'workbench.settings.def.rulesEngine.maxActiveRules.label': 'Max Active Rules',
  'workbench.settings.def.rulesEngine.maxActiveRules.description':
    'Maximum number of rules compiled into the dynamic rule set at once.',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.label': 'Visible Resource Types',
  'workbench.settings.def.rulesEngine.visibleResourceTypes.description':
    "Which request resource types appear in the popup's This Page view. Everything is always collected; this only changes what the UI shows. The inline chip row on the popup writes to the same setting.",
  'workbench.settings.def.rulesEngine.showShadowWarnings.label': 'Show Shadow Warnings',
  'workbench.settings.def.rulesEngine.showShadowWarnings.description':
    'Highlight rules whose effect is shadowed by a higher-priority rule (block, redirect, mock, delay, or header stacking conflict).',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.label': 'Warn On Large Rule Sets',
  'workbench.settings.def.rulesEngine.warnOnLargeRuleSets.description':
    'Surface a warning when the active rule count nears the browser cap.',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.label': 'Large Rule Set Threshold',
  'workbench.settings.def.rulesEngine.largeRuleSetThreshold.description':
    'Active rule count at which the warning fires.',
  'workbench.settings.def.rulesEngine.liveRulesMode.label': 'Live Rules Mode',
  'workbench.settings.def.rulesEngine.liveRulesMode.description':
    "Injects Cache-Control: no-cache on every request that matches one of your rules, forcing revalidation with the server so the rule's effect is always applied fresh. Prevents stale cached responses from hiding a rule — useful when a rule's value changes (like an auth token) but the page keeps serving the old response from cache.",
  'workbench.settings.def.rulesEngine.bypassHttpCache.label': 'Bypass HTTP Cache',
  'workbench.settings.def.rulesEngine.bypassHttpCache.description':
    "Adds Cache-Control: no-cache to every request on the inspected tab — forces revalidation with the server. Scope is the HTTP cache only; Chrome's own Disable Cache (Network tab) also bypasses the renderer memory cache. Rule-matched requests are always kept fresh automatically by Live Rules Mode.",
  'workbench.settings.def.rulesEngine.variableAutocomplete.label': 'Variable Autocomplete',
  'workbench.settings.def.rulesEngine.variableAutocomplete.description':
    'Suggest `{{env.X}}` / `{{vault.X}}` / `{{live.X}}` / `{{workspace.X}}` / `{{collection.X}}` / `{{step.X.Y}}` references as you type. Opens on `{{` in any rule-field value input and in JSON/GraphQL/XML/plaintext body editors. Disable if you prefer plain-text editing.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.label': 'Draft URL Strategy',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.description':
    'How pre-filled rules from the DevTools Inspector turn a captured URL into a url-filter pattern. Exact (default) keeps the URL verbatim so the rule matches only the inspected request. Path wildcard replaces the last path segment with * so sibling resources match. Host-only widens to the whole domain.',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.label': 'Exact URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.exact.description':
    'Match this URL verbatim, normalized (recommended)',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.label': 'Path wildcard',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.path-wildcard.description':
    'Wildcard the last path segment',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.label': 'Host only',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.host-only.description': 'Match every request on the host',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.label': 'Raw URL',
  'workbench.settings.def.rulesEngine.draftUrlStrategy.option.raw.description':
    'Match this URL verbatim without normalization',

  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'Toggle Debug Mode',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    'Turn debug mode on or off from any surface. Fires only when no text field is focused.',
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'Debug mode is available in Chrome and Edge.',
  'workbench.settings.def.keyboard.commandPalette.label': 'Open Command Palette',
  'workbench.settings.def.keyboard.commandPalette.description': 'Show the command palette overlay.',
  'workbench.settings.def.keyboard.openSettings.label': 'Open Settings',
  'workbench.settings.def.keyboard.openSettings.description': 'Open the settings modal.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': 'Toggle Left Sidebar',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': 'Show or hide the left sidebar.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': 'Toggle Right Sidebar',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': 'Show or hide the right sidebar.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': 'Toggle Bottom Panel',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': 'Show or hide the bottom panel.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': 'Toggle Activity Feed',
  'workbench.settings.def.keyboard.toggleActivityFeed.description': 'Show or hide the Activity Feed panel.',
  'workbench.settings.def.keyboard.newRule.label': 'Create Item',
  'workbench.settings.def.keyboard.newRule.description': 'Open the create menu for rules and API requests.',
  'workbench.settings.def.keyboard.newTab.label': 'New Tab',
  'workbench.settings.def.keyboard.newTab.description': 'Open a new draft API request tab.',
  'workbench.settings.def.keyboard.import.label': 'Import',
  'workbench.settings.def.keyboard.import.description': 'Open the import hub for curl, HAR, and workspace files.',
  'workbench.settings.def.keyboard.save.label': 'Save',
  'workbench.settings.def.keyboard.save.description': 'Save the active editor tab.',
  'workbench.settings.def.keyboard.closeTab.label': 'Close Tab',
  'workbench.settings.def.keyboard.closeTab.description': 'Close the focused editor tab.',
  'workbench.settings.def.keyboard.previousTab.label': 'Previous Tab',
  'workbench.settings.def.keyboard.previousTab.description': 'Focus the previous editor tab.',
  'workbench.settings.def.keyboard.nextTab.label': 'Next Tab',
  'workbench.settings.def.keyboard.nextTab.description': 'Focus the next editor tab.',
  'workbench.settings.def.keyboard.tabSearch.label': 'Search Tabs',
  'workbench.settings.def.keyboard.tabSearch.description': 'Open a search overlay across all open tabs.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'Focus Active Section Filter',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    "Move focus to the filter input of whichever sidebar section you're currently in.",
  'workbench.settings.def.keyboard.focusLeftSidebar.label': 'Focus Left Sidebar',
  'workbench.settings.def.keyboard.focusLeftSidebar.description': 'Move keyboard focus to the left sidebar.',
  'workbench.settings.def.keyboard.focusEditor.label': 'Focus Editor',
  'workbench.settings.def.keyboard.focusEditor.description': 'Move keyboard focus to the editor area.',
  'workbench.settings.def.keyboard.focusRightSidebar.label': 'Focus Right Sidebar',
  'workbench.settings.def.keyboard.focusRightSidebar.description': 'Move keyboard focus to the right sidebar.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': 'Focus Bottom Panel',
  'workbench.settings.def.keyboard.focusBottomPanel.description': 'Move keyboard focus to the bottom panel tab row.',
  'workbench.settings.def.keyboard.showShortcutHelp.label': 'Show Shortcut Help',
  'workbench.settings.def.keyboard.showShortcutHelp.description': 'Display the keyboard shortcut cheatsheet.',
  'workbench.settings.def.keyboard.find.label': 'Find in Editor',
  'workbench.settings.def.keyboard.find.description':
    'Open the find widget in the focused code editor. Only fires when the editor has focus — does not interfere with global shortcuts.',
  'workbench.settings.def.keyboard.replace.label': 'Replace in Editor',
  'workbench.settings.def.keyboard.replace.description':
    'Open the find-and-replace widget in the focused code editor. Only fires when the editor has focus — does not interfere with global shortcuts.',
  'workbench.settings.def.keyboard.formatCode.label': 'Format Code',
  'workbench.settings.def.keyboard.formatCode.description':
    'Format the focused code editor buffer. Only fires when the editor has focus — does not interfere with global shortcuts.',
  'workbench.settings.def.keyboard.preset.label': 'Keymap Preset',
  'workbench.settings.def.keyboard.preset.description':
    'The base set of shortcuts. Shortcuts you customize stay on top of the preset and survive switching it.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'OpenHeaders defaults',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'VS Code-style',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': 'Popup — Toggle Shortcuts Help',
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'Show or hide the popup keyboard-shortcut cheatsheet.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'Popup — Toggle Options Menu',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description': 'Open or close the footer options dropdown.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'Popup — Focus Search',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    'Move keyboard focus into the active tab’s search input.',
  'workbench.settings.def.keyboard.popup.prevPage.label': 'Popup — Previous Page',
  'workbench.settings.def.keyboard.popup.prevPage.description': 'Jump to the previous page of rules in the active tab.',
  'workbench.settings.def.keyboard.popup.nextPage.label': 'Popup — Next Page',
  'workbench.settings.def.keyboard.popup.nextPage.description': 'Jump to the next page of rules in the active tab.',
  'workbench.settings.def.keyboard.popup.moveDown.label': 'Popup — Move Down',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'Advance the focused row. ArrowDown is always available as an alias.',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'Popup — Move Up',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'Move the focus to the previous row. ArrowUp is always available as an alias.',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'Popup — Expand / Enter Sub-rows',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'Expand the focused row. ArrowRight and Enter are always available as aliases.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'Popup — Collapse / Exit Sub-rows',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'Collapse the focused row. ArrowLeft is always available as an alias.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'Popup — Toggle Row',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    'Toggle the focused rule on or off. Defaults to the spacebar.',
  'workbench.settings.def.keyboard.popup.editRow.label': 'Popup — Edit Row',
  'workbench.settings.def.keyboard.popup.editRow.description': 'Open the focused rule in the workspace editor.',
  'workbench.settings.def.keyboard.popup.copyValue.label': 'Popup — Copy Value',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'Copy the focused row’s primary value to the clipboard.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'Popup — Delete Row',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'Stage the focused row for deletion. Press again (or Enter) to confirm.',
  'workbench.settings.def.keyboard.popup.addRule.label': 'Popup — Add Rule',
  'workbench.settings.def.keyboard.popup.addRule.description': 'Create a new rule from the popup.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label': 'Popup — Toggle Rules Pause (global)',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'Pause or resume every rule across every collection.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label': 'Popup — Toggle Pause (focused collection/folder)',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    'Pause or resume the focused collection or folder in the Collections tab. Has no effect on individual rule rows — rules use the enabled toggle (Space) instead.',
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'Popup — Cycle Theme',
  'workbench.settings.def.keyboard.popup.cycleTheme.description': 'Rotate between light, dark, and auto themes.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'Popup — Toggle Compact Mode',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'Switch the popup between compact and comfortable density.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': 'Popup — Open Workspace',
  'workbench.settings.def.keyboard.popup.openWorkspace.description': 'Open the full workspace tab.',
  'workbench.settings.def.keyboard.popup.openSettings.label': 'Popup — Open Settings',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    'Open the settings page in a new workspace tab. Matches the workspace binding.',
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'Popup — This Page Tab',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': 'Activate the "This Page" rules tab.',
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'Popup — All Rules Tab',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': 'Activate the "All Rules" tab.',
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'Popup — Collections Tab',
  'workbench.settings.def.keyboard.popup.tabCollections.description': 'Activate the "Collections" tab.',
  'workbench.settings.def.keyboard.popup.toggleSurface.label': 'Popup — Toggle Surface (popup ↔ side panel)',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    'Switch between popup and side panel layouts from the popup header.',
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'Popup — Open Tour Guide',
  'workbench.settings.def.keyboard.popup.openTourGuide.description': 'Replay the welcome tour from any popup tab.',

  // ── Workspace Sharing category defs ────────────────────────────────
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.label':
    'Show merge strategy on import-preview rows',
  'workbench.settings.def.workspaceSharing.importPreviewShowMergeStrategy.description':
    "When on, each entity row in the import-preview's left sidebar shows the chosen merge strategy (Add as new, Replace, Skip, …) inline next to the line counts. Toggle off to free up row width on narrow panes.",
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.label': 'Import-preview diff viewer',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.description':
    'Render target vs incoming side by side or stacked inline. Auto-flips to unified when the diff pane is too narrow.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.side-by-side.label': 'Side-by-side',
  'workbench.settings.def.workspaceSharing.importPreviewDiffViewer.option.unified.label': 'Unified',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.label':
    'Import-preview diff whitespace handling',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.description':
    'Whether the diff treats whitespace-only changes as edits or hides them.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.none.label': 'Do not ignore',
  'workbench.settings.def.workspaceSharing.importPreviewDiffWhitespace.option.ignore.label': 'Ignore whitespaces',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.label':
    'Collapse unchanged regions in import-preview diff',
  'workbench.settings.def.workspaceSharing.importPreviewDiffCollapseUnchanged.description':
    'Hide runs of unchanged lines and replace them with a click-to-expand stub.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.label':
    'Show whitespace characters in import-preview diff',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowWhitespaces.description':
    'Render spaces and tabs as visible glyphs (·, →) in the diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.label':
    'Show line numbers in import-preview diff',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowLineNumbers.description':
    'Show the gutter line-number column next to each side of the diff.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.label':
    'Show indent guides in import-preview diff',
  'workbench.settings.def.workspaceSharing.importPreviewDiffShowIndentGuides.description':
    'Render vertical indent guides to make YAML nesting easier to scan.',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.label':
    'Soft-wrap long lines in import-preview diff',
  'workbench.settings.def.workspaceSharing.importPreviewDiffSoftWrap.description':
    'Wrap long lines onto the next visual line instead of horizontal scrolling.',

  // ── Data category defs ─────────────────────────────────────────────
  'workbench.settings.def.data.logLevel.label': 'Log Level',
  'workbench.settings.def.data.logLevel.description':
    'Verbosity of the extension logger. Higher levels include every level above them.',
  'workbench.settings.def.data.logLevel.option.error.label': 'Error',
  'workbench.settings.def.data.logLevel.option.error.description': 'Failures only',
  'workbench.settings.def.data.logLevel.option.warn.label': 'Warn',
  'workbench.settings.def.data.logLevel.option.warn.description': 'Anomalies and retries',
  'workbench.settings.def.data.logLevel.option.info.label': 'Info',
  'workbench.settings.def.data.logLevel.option.info.description': 'Operational events',
  'workbench.settings.def.data.logLevel.option.debug.label': 'Debug',
  'workbench.settings.def.data.logLevel.option.debug.description': 'Verbose internals',
  'workbench.settings.def.data.exportSettings.label': 'Export Settings',
  'workbench.settings.def.data.exportSettings.description': 'Download all settings as a JSON file.',
  'workbench.settings.def.data.exportSettings.action.label': 'Export',
  'workbench.settings.def.data.importSettings.label': 'Import Settings',
  'workbench.settings.def.data.importSettings.description': 'Load settings from a previously exported JSON file.',
  'workbench.settings.def.data.importSettings.action.label': 'Import…',
  'workbench.settings.def.data.exportObservabilityLog.label': 'Export Diagnostic Log',
  'workbench.settings.def.data.exportObservabilityLog.description':
    'Download the last 500 structured events (rule rebuilds, request errors, workspace switches) as JSON. Local-only; nothing leaves the device unless you attach the file to a bug report yourself.',
  'workbench.settings.def.data.exportObservabilityLog.action.label': 'Export log',
  'workbench.settings.def.data.clearObservabilityLog.label': 'Clear Diagnostic Log',
  'workbench.settings.def.data.clearObservabilityLog.description':
    'Drop every buffered event. Does not affect rules, requests, or any workspace data.',
  'workbench.settings.def.data.clearObservabilityLog.action.label': 'Clear',
  'workbench.settings.def.data.clearObservabilityLog.confirm':
    'Clear the diagnostic log? This drops every buffered event.',
  'workbench.settings.def.data.exportImportReports.label': 'Export Import Reports',
  'workbench.settings.def.data.exportImportReports.description':
    'Download the structured drop/transform reports for every import run (curl today; HAR / Postman / Insomnia next) as JSON. Lives per-workspace — 50 most recent imports per workspace. Never leaves the device unless you attach the file.',
  'workbench.settings.def.data.exportImportReports.action.label': 'Export reports',
  'workbench.settings.def.data.clearImportReports.label': 'Clear Import Reports',
  'workbench.settings.def.data.clearImportReports.description':
    'Drop every import report for the active workspace. Does not affect the requests themselves — only the audit log of what was dropped/transformed during import.',
  'workbench.settings.def.data.clearImportReports.action.label': 'Clear',
  'workbench.settings.def.data.clearImportReports.confirm':
    'Clear import reports for this workspace? This cannot be undone.',
  'workbench.settings.def.data.uploadFile.label': 'Upload File',
  'workbench.settings.def.data.uploadFile.description':
    'Add a file to the active workspace for use in multipart bodies and `{{file.X}}` references. Files are content-addressed (sha256) so re-uploading the same bytes stays as one blob. Storage is local IndexedDB; nothing leaves the device.',
  'workbench.settings.def.data.uploadFile.action.label': 'Upload…',
  'workbench.settings.def.data.exportFilesManifest.label': 'Export Files Manifest',
  'workbench.settings.def.data.exportFilesManifest.description':
    'Download the list of files in the active workspace (filename, hash, size, MIME type) as JSON. Bytes are NOT included — this is a manifest for audit and re-upload by teammates, not a backup of the content.',
  'workbench.settings.def.data.exportFilesManifest.action.label': 'Export manifest',
  'workbench.settings.def.data.filesBrowser.label': 'Files',
  'workbench.settings.def.data.filesBrowser.description':
    'Every uploaded blob in the active workspace. Download bytes, copy the short hash, or delete. File metadata (filename, size, MIME type, hash) is searchable across the settings index.',
  'workbench.settings.def.data.clearAllFiles.label': 'Clear All Files',
  'workbench.settings.def.data.clearAllFiles.description':
    'Delete every file blob in the active workspace. Requests that reference these files via multipart parts will error when executed; you will need to re-upload the files or edit those requests.',
  'workbench.settings.def.data.clearAllFiles.action.label': 'Clear all',
  'workbench.settings.def.data.clearAllFiles.confirm':
    'Delete every file in this workspace? Multipart parts referencing them will error on send.',
  'workbench.settings.def.data.resetAllSettings.label': 'Reset All Settings',
  'workbench.settings.def.data.resetAllSettings.description':
    'Return every setting in every category to its default value.',
  'workbench.settings.def.data.resetAllSettings.action.label': 'Reset to defaults',
  'workbench.settings.def.data.resetAllSettings.confirm': 'Reset every setting to its default? This cannot be undone.',

  // ── Updates defs (About category) ──────────────────────────────────
  'workbench.settings.def.updates.state.label': 'Software update',
  'workbench.settings.def.updates.state.description':
    'Current update status. Downloading and installing always take your explicit click.',
  'workbench.settings.def.updates.check.label': 'Check for updates',
  'workbench.settings.def.updates.check.description':
    'Look for new versions once a day and show a notification dot when one is available. The check downloads nothing and sends nothing about you or this install — it reads a public version listing and compares locally. "Security fixes only" stays silent unless a release fixes a security issue affecting the version you are running. Updates are never installed without your explicit action.',
  'workbench.settings.def.updates.check.option.all.label': 'All releases',
  'workbench.settings.def.updates.check.option.security-only.label': 'Security fixes only',
  'workbench.settings.def.updates.check.option.off.label': 'Off',
  'workbench.settings.def.updates.showWhatsNew.label': "Show What's New after updating",
  'workbench.settings.def.updates.showWhatsNew.description':
    'Open a tab with the release highlights the first time you open the workbench after a feature release. Patch releases never open it — they stay in the notifications timeline. The notes ship inside the app; nothing is fetched.',
  'workbench.settings.def.updates.autoDownload.label': 'Download updates automatically',
  'workbench.settings.def.updates.autoDownload.description':
    'When an update is found, fetch it in the background right away so installing is a single restart — useful if you want fixes staged as fast as possible. Off means you click Download yourself. Either way, nothing installs until you restart the app or choose to.',

  // ── About category defs ────────────────────────────────────────────
  'workbench.settings.def.about.version.label': 'Version',
  'workbench.settings.def.about.version.description': 'The currently installed extension version.',
  'workbench.settings.def.about.build.label': 'Build',
  'workbench.settings.def.about.build.description': 'Build number and date.',
  'workbench.settings.def.about.commit.label': 'Commit',
  'workbench.settings.def.about.commit.description': 'Git commit this build was produced from.',
  'workbench.settings.def.about.protocol.label': 'Protocol',
  'workbench.settings.def.about.protocol.description':
    'Wire-protocol version this extension speaks with the desktop app. Mismatched peers are rejected with a clear update prompt.',
  'workbench.settings.def.about.browser.label': 'Browser',
  'workbench.settings.def.about.browser.description': 'Detected browser and platform.',
} as const satisfies Catalog;
