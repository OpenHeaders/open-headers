/**
 * Workbench settings — shell chrome: category nav labels +
 * descriptions, the settings surface shell (search, tabs, modal),
 * generic field widgets and rows, and the updates/telemetry rows.
 * The setting-definition corpus lives in `workbench-settings-defs.ts`
 * and the custom panes in `workbench-settings-panes.ts`; all merge
 * under `workbench.settings.*` in `index.ts`.
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
  'workbench.settings.row.managed': 'Managed by your organization',
  'workbench.settings.row.managedBadge': 'Managed',
  'workbench.settings.row.disabledManagedAria': 'Disabled — managed by your organization',
  'workbench.settings.row.run': 'Run',

  // ── Categories ─────────────────────────────────────────────────────
  'workbench.settings.category.backend.label': 'Backend',
  'workbench.settings.category.backend.description':
    'Where your workspaces, rules, vault, and history live. Pick the host that matches your reach — local-only either way.',
  'workbench.settings.category.backend.sub.connection': 'Connection',
  'workbench.settings.category.backend.sub.reliability': 'Reliability',
  'workbench.settings.category.backend.sub.notifications': 'Notifications',
  'workbench.settings.category.backend.sub.lan-peers': 'LAN peers',
  'workbench.settings.category.mcp.label': 'AI · MCP Server',
  'workbench.settings.category.mcp.description':
    'Let AI agents and other MCP clients read and control this app. Access is tiered — reading, writing, executing, and secret reveal are separate switches, all off by default.',
  'workbench.settings.category.general.label': 'General',
  'workbench.settings.category.general.description': 'App-wide behavior, startup, and locale.',
  'workbench.settings.category.appearance.label': 'Appearance',
  'workbench.settings.category.appearance.description': 'Theme, density and visual presentation.',
  'workbench.settings.category.workspaceLayout.label': 'Workspace Layout',
  'workbench.settings.category.workspaceLayout.description': 'Footer affordances and tool-window shell behavior.',
  'workbench.settings.category.terminal.label': 'Terminal',
  'workbench.settings.category.terminal.description': 'Behavior of the integrated Terminal tool window.',
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
  'workbench.settings.category.trafficMonitor.label': 'Traffic',
  'workbench.settings.category.trafficMonitor.description':
    'Defaults for the start-observing gesture in the Traffic panel, and the disk budget of the session archive.',
  'workbench.settings.category.editor.label': 'Code Editor',
  'workbench.settings.category.editor.description': 'Font, indentation, and view options for code editing surfaces.',
  'workbench.settings.category.requests.label': 'API Requests',
  'workbench.settings.category.requests.description': 'Request sending and response handling per protocol.',
  'workbench.settings.category.requests.sub.http': 'HTTP',
  'workbench.settings.category.requests.sub.sse': 'SSE',
  'workbench.settings.category.requests.sub.grpc': 'gRPC',
  'workbench.settings.category.requests.sub.websocket': 'WebSocket',
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
  'workbench.settings.category.git.label': 'Git',
  'workbench.settings.category.git.description':
    'Bind this workspace to an on-disk folder — a live, git-friendly YAML tree.',
  'workbench.settings.category.proxy.label': 'Proxy',
  'workbench.settings.category.proxy.description':
    'This device’s outbound proxy — how requests reach the network — and trust setup for the capture proxy.',
  'workbench.settings.category.proxyOutbound.label': 'Proxy · Outbound Requests',
  'workbench.settings.category.proxyOutbound.navLabel': 'Outbound Requests',
  'workbench.settings.category.proxyOutbound.description':
    'This device’s outbound proxy — how requests, WebSocket sessions, and gRPC calls reach the network.',
  'workbench.settings.category.proxyTrust.label': 'Proxy · System',
  'workbench.settings.category.proxyTrust.navLabel': 'System Proxy',
  'workbench.settings.category.proxyTrust.description':
    'The certificate authority and trust stores that let HTTPS traffic be decrypted for inspection — created on this machine, removable here.',
  'workbench.settings.category.data.label': 'Data',
  'workbench.settings.category.data.description': 'Diagnostics, import/export, and destructive maintenance.',
  'workbench.settings.category.license.label': 'License',
  'workbench.settings.category.license.description':
    'Everything in Open Headers today is included on every tier — paid plans cover team seats. The free tier admits up to 6 active users per server.',
  'workbench.settings.category.updates.label': 'Updates',
  'workbench.settings.category.updates.description': 'Update checks, channel, and download behavior.',
  'workbench.settings.category.about.label': 'About',
  'workbench.settings.category.about.description': 'Version, licenses and build information.',

  // ── App-update row (updates.state custom editor) ───────────────────
  'workbench.settings.updatesRow.unsupported': 'Updates are handled by your install channel in this build.',
  'workbench.settings.updatesRow.checking': 'Checking for updates…',
  'workbench.settings.updatesRow.securityFix': 'Version {version} fixes a security issue affecting this version.',
  'workbench.settings.updatesRow.available': 'Version {version} is available.',
  'workbench.settings.updatesRow.packageManager': 'Install it via your Linux package manager.',
  'workbench.settings.updatesRow.updateAndRestart': 'Update & Restart',
  'workbench.settings.updatesRow.downloading': 'Downloading {version}…',
  'workbench.settings.updatesRow.readyToInstall': 'Version {version} is ready to install.',
  'workbench.settings.updatesRow.restartToInstall': 'Restart to install',
  'workbench.settings.updatesRow.checkFailed': 'Update check failed: {message}',
  'workbench.settings.updatesRow.retry': 'Retry',
  'workbench.settings.updatesRow.upToDate': "You're on the latest version ({version}).",
  'workbench.settings.updatesRow.checkNow': 'Check now',
  'workbench.settings.updatesRow.releaseNotes': 'Release notes',
  'workbench.settings.updatesRow.lastChecked': 'Last checked {when}',

  // ── Terminal profiles row ──────────────────────────────────────────
  'workbench.settings.terminalProfiles.systemDefault': 'System default shell',
  'workbench.settings.terminalProfiles.add': 'Add Profile',
  'workbench.settings.terminalProfiles.edit': 'Edit profile',
  'workbench.settings.terminalProfiles.remove': 'Remove profile',
  'workbench.settings.terminalProfiles.addTitle': 'Add Terminal Profile',
  'workbench.settings.terminalProfiles.editTitle': 'Edit Terminal Profile',
  'workbench.settings.terminalProfiles.name': 'Name',
  'workbench.settings.terminalProfiles.shell': 'Shell path',
  'workbench.settings.terminalProfiles.args': 'Arguments',
  'workbench.settings.terminalProfiles.cwd': 'Starting directory',
  'workbench.settings.terminalProfiles.cwdPlaceholder': 'Home directory',
  'workbench.settings.terminalProfiles.save': 'Save',

  // ── Settings field widgets ─────────────────────────────────────────
  'workbench.settings.fields.files.renameTooltip': 'Rename file',
  'workbench.settings.fields.files.renameMissing': 'File no longer exists in this workspace',
  'workbench.settings.fields.files.renameFailed': 'Could not rename file',
  'workbench.settings.fields.files.renameFailedReason': 'Could not rename file: {message}',
  'workbench.settings.fields.files.colFilename': 'Filename',
  'workbench.settings.fields.files.colSize': 'Size',
  'workbench.settings.fields.files.colMime': 'MIME',
  'workbench.settings.fields.files.colHash': 'Hash',
  'workbench.settings.fields.files.colActions': 'Actions',
  'workbench.settings.fields.files.download': 'Download',
  'workbench.settings.fields.files.deleteTitle': 'Delete {filename}?',
  'workbench.settings.fields.files.deleteWarning': 'Multipart parts referencing this file will error on send.',
  'workbench.settings.fields.files.loading': 'Loading files…',
  'workbench.settings.fields.files.empty': 'No files yet — use the Upload File action above.',
  'workbench.settings.fields.keyValue.keyPlaceholder': 'key',
  'workbench.settings.fields.keyValue.valuePlaceholder': 'value',
  'workbench.settings.fields.keyValue.addEntry': 'Add entry',
  'workbench.settings.fields.keybinding.pressCombo': 'Press a key combo…',
  'workbench.settings.fields.keybinding.record': 'Record',
  'workbench.settings.fields.keybinding.cancel': 'Cancel',

  // ── Product-telemetry toggle row ───────────────────────────────────
  'workbench.settings.telemetryRow.viewEvents': 'View events',
  'workbench.settings.telemetryRow.modalTitle': 'Telemetry events this session',
  'workbench.settings.telemetryRow.sessionOn': 'Session {sessionId} — counting is on',
  'workbench.settings.telemetryRow.sessionOff': 'Session {sessionId} — counting is off',
  'workbench.settings.telemetryRow.install': 'Install {installId} (random — identifies this install, not you)',
  'workbench.settings.telemetryRow.noInstall': 'No install identifier — counting is off',
  'workbench.settings.telemetryRow.empty': 'No telemetry events recorded this session.',
  'workbench.settings.telemetryRow.confirmTitle': 'Turn off anonymous usage counting?',
  'workbench.settings.telemetryRow.confirmHeading': 'Your privacy is already protected',
  'workbench.settings.telemetryRow.confirmIntro':
    'A random identifier counts this install — never you. No personal data is ever collected. Here is what counting does:',
  'workbench.settings.telemetryRow.confirmPointFeatures': 'Shows which features deserve continued work',
  'workbench.settings.telemetryRow.confirmPointScope': 'Counts only feature usage, platform, and app version',
  'workbench.settings.telemetryRow.confirmPointInspect': 'Every event stays visible byte for byte in "View events"',
  'workbench.settings.telemetryRow.confirmBadgePersonal': 'No personal data',
  'workbench.settings.telemetryRow.confirmBadgeUrls': 'No URLs or headers',
  'workbench.settings.telemetryRow.confirmBadgeContent': 'No request content',
  'workbench.settings.telemetryRow.confirmKeep': 'Keep counting on',
  'workbench.settings.telemetryRow.confirmDisable': 'Turn off anyway',
} as const satisfies Catalog;
