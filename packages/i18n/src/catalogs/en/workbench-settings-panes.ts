/**
 * Workbench settings — custom pane components: the backend pane
 * (wizard, tier cards, connections, device details), daemon tokens,
 * MCP pane, license pane, and keymap pane.
 */

import { formatMessage, plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchSettingsPanes = {
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
  'workbench.settings.backendPane.tierZero.adminTitle': 'Server administration',
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
  'workbench.settings.backendPane.wizard.autoPairFallback':
    "Automatic pairing with the desktop app didn't go through — it may not be running, or this browser could not be verified. Pair with the code or token instead.",
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
  'workbench.settings.backendPane.pair.nmRequired':
    'Manual pairing with the desktop app is turned off — this browser connects only through verified pairing. See the "Require verified pairing" setting.',

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
    'The desktop back-end will bind every local network interface so other devices on your network can connect. Every connection — LAN or loopback — must present a paired auth token; there is no token-free path. Devices pair with the code the app shows (or paste a token into Settings → Backend → Auth token).',

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
  'workbench.settings.backendPane.tier.rangeNote.serverOwnBox': 'IPv4 — server on your own box (Docker, sidecar)',
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
  'workbench.settings.backendPane.detail.aria.local-self-hosted': 'Local LAN server back-end',
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
  'workbench.settings.backendTokens.sectionTitle': 'Paired devices',
  'workbench.settings.backendTokens.sectionBlurb':
    'Each device that connects to this back-end authenticates with an access token. Connected devices are highlighted; rotate a token to issue a fresh secret and retire the old one.',
  'workbench.settings.backendTokens.labelPlaceholder': "Label (optional) — e.g. 'alice's phone'",
  'workbench.settings.backendTokens.bindUserPlaceholder': 'Bind to user (optional)',
  'workbench.settings.backendTokens.generate': 'Generate token',
  'workbench.settings.backendTokens.pairDevice': 'Pair a device',
  'workbench.settings.backendTokens.explainer.intro': 'Both add a token below.',
  'workbench.settings.backendTokens.explainer.generateText':
    'shows you the secret to copy and paste into the device yourself.',
  'workbench.settings.backendTokens.explainer.pairText':
    'shows a short code the device enters under Settings → Backend → Pair with a code (or opens a link, as a fallback) — use it when someone else sets up the device.',
  'workbench.settings.backendTokens.empty':
    "No devices yet. Generate a token and paste it into the device's Settings → Backend, or pair a device and have it enter the code there.",
  'workbench.settings.backendTokens.mintFailed': 'Failed to mint token: {message}',
  'workbench.settings.backendTokens.rotateFailed': 'Failed to rotate: {message}',
  'workbench.settings.backendTokens.revokeFailed': 'Failed to revoke: {message}',
  'workbench.settings.backendTokens.revokedDevice': 'Token revoked. Any device using it was disconnected.',
  'workbench.settings.backendTokens.revokedSession': 'Session revoked. The user was signed out.',
  'workbench.settings.backendTokens.rotate': 'Rotate',
  'workbench.settings.backendTokens.revoke': 'Revoke',
  'workbench.settings.backendTokens.rotateConfirmTitle': 'Rotate this token?',
  'workbench.settings.backendTokens.rotateConfirmBody':
    'A fresh secret is minted and the current one is revoked. The device must be given the new token before it can reconnect.',
  'workbench.settings.backendTokens.revokeConfirmTitle': 'Revoke this token?',
  'workbench.settings.backendTokens.revokeConfirmBody':
    "Any device currently using it is disconnected immediately and can't reconnect.",
  'workbench.settings.backendTokens.revokeSessionConfirmTitle': 'Revoke this session?',
  'workbench.settings.backendTokens.revokeSessionConfirmBody':
    'The user is signed out and disconnected immediately. They must log in through the identity provider again.',
  'workbench.settings.backendTokens.revokedTag': 'Revoked {when}',
  'workbench.settings.backendTokens.connectedTag': 'Connected',
  'workbench.settings.backendTokens.expiredTag': 'Expired',
  'workbench.settings.backendTokens.unlabeled': '(unlabeled)',
  'workbench.settings.backendTokens.unbound': '(unbound)',
  'workbench.settings.backendTokens.meta.device': 'id {id} · created {created} · last used {lastUsed}',
  'workbench.settings.backendTokens.meta.boundUser': 'user {user}',
  'workbench.settings.backendTokens.meta.session':
    'signed in {signedIn} · expires {expires} · last seen {lastSeen} · id {id}',
  'workbench.settings.backendTokens.ssoTitle': 'SSO sessions',
  'workbench.settings.backendTokens.ssoBlurb':
    'Each SSO login mints a session that expires on its own. Revoke one to sign the user out immediately — they must log in through the identity provider again.',
  'workbench.settings.backendTokens.secretTitle': 'Copy this token now',
  'workbench.settings.backendTokens.secretTitleRotated': 'Copy the rotated token now',
  'workbench.settings.backendTokens.secretBody':
    'The back-end stores only a hash of this value. Once this dialog closes the secret cannot be recovered — if you lose it, revoke the token and mint a new one.',
  'workbench.settings.backendTokens.secretBodyRotated':
    'The previous token is now revoked — give this new secret to the device so it can reconnect. The back-end stores only a hash of this value. Once this dialog closes the secret cannot be recovered — if you lose it, revoke the token and mint a new one.',
  'workbench.settings.backendTokens.secretSaved': "I've saved it",

  // ── Daemon pairing modal ────────────────────────────────────────────
  'workbench.settings.backendTokens.pairModal.done': 'Done',
  'workbench.settings.backendTokens.pairModal.allocating': 'Allocating code…',
  'workbench.settings.backendTokens.pairModal.startFailed': 'Could not start pairing',
  'workbench.settings.backendTokens.pairModal.expiredTitle': 'Pairing expired',
  'workbench.settings.backendTokens.pairModal.expiredBody':
    'The 5-minute window elapsed without a confirmation. Close this dialog and click Pair a device again to start over.',
  'workbench.settings.backendTokens.pairModal.pairedTitle': 'Paired',
  'workbench.settings.backendTokens.pairModal.pairedBody':
    "The device confirmed the code. A fresh access token was issued and saved on that device; it appears in the list below. If the device can't connect, revoke the entry and pair again.",
  'workbench.settings.backendTokens.pairModal.intro.part1': 'On the other device, open',
  'workbench.settings.backendTokens.pairModal.intro.settingsPath': 'Settings → Backend',
  'workbench.settings.backendTokens.pairModal.intro.part2': ', point its',
  'workbench.settings.backendTokens.pairModal.intro.address': 'Backend address',
  'workbench.settings.backendTokens.pairModal.intro.part3': 'at this app, then click',
  'workbench.settings.backendTokens.pairModal.intro.part4': 'and enter:',
  'workbench.settings.backendTokens.pairModal.codeLabel': 'Pairing code',
  'workbench.settings.backendTokens.pairModal.expiresIn': 'expires in {remaining}',
  'workbench.settings.backendTokens.pairModal.addressListLabel': 'Backend address for this app',
  'workbench.settings.backendTokens.pairModal.fallback.prefix': 'No',
  'workbench.settings.backendTokens.pairModal.fallback.suffix':
    'option on that device? Open one of these links there instead — it serves a page that hands over a token to paste by hand.',

  // ── Command-line access card (MCP pane) ────────────────────────────
  'workbench.settings.cliAccess.sectionTitle': 'Command-line access',
  'workbench.settings.cliAccess.sectionBlurb':
    'One click connects the oh command-line tool on this machine to the app — an access token is created and saved for it, no copying.',
  'workbench.settings.cliAccess.statusUnconfigured': 'The CLI on this machine is not connected yet.',
  'workbench.settings.cliAccess.statusConfigured': 'CLI connected as {label}.',
  'workbench.settings.cliAccess.statusStale':
    'The saved CLI token is no longer valid — set up access again to reconnect.',
  'workbench.settings.cliAccess.statusExternal':
    'The CLI is currently connected to a different back-end ({url}). Setting up access here points it at this app instead.',
  'workbench.settings.cliAccess.statusMalformed': 'The CLI config file can’t be read: {message}',
  'workbench.settings.cliAccess.pathNote': 'Saved in {path}',
  'workbench.settings.cliAccess.setUp': 'Set up CLI access',
  'workbench.settings.cliAccess.rotate': 'Rotate CLI access',
  'workbench.settings.cliAccess.connectHere': 'Connect to this app',
  'workbench.settings.cliAccess.provisioned': 'CLI access set up — oh now works in any terminal on this machine.',
  'workbench.settings.cliAccess.rotated': 'CLI token rotated — the previous token is revoked.',
  'workbench.settings.cliAccess.provisionFailed': 'CLI setup failed: {message}',

  // ── MCP pane body ──────────────────────────────────────────────────
  'workbench.settings.mcpPane.serverOff': 'The MCP server is off — clients can’t connect until you enable it.',
  'workbench.settings.mcpPane.connect.title': 'Connect a client',
  'workbench.settings.mcpPane.connect.blurb':
    'Pick your client, replace {token} with a token generated above, and adjust the app path if you installed somewhere else. The app must be running for clients to connect.',
  'workbench.settings.mcpPane.snippet.claudeDesktopTitle': 'claude_desktop_config.json — merge into the existing file',
  'workbench.settings.mcpPane.snippet.runOnceTitle': 'Run once in a terminal',
  'workbench.settings.mcpPane.snippet.cliTitle': 'Run once in a terminal — later oh runs need no flags',
  'workbench.settings.mcpPane.snippet.httpTitle': 'For clients that speak streamable HTTP directly',

  // ── MCP consent (Add-ons popover dialog + TUI-gate checkbox info) ──
  'workbench.settings.mcpConsent.title': 'Turn on the MCP server',
  'workbench.settings.mcpConsent.body':
    'Agent clients and the oh TUI talk to this app over the MCP server, which is currently off.',
  'workbench.settings.mcpConsent.info.title': 'MCP server',
  'workbench.settings.mcpConsent.info.summary':
    'MCP clients reach this app through the back-end’s /mcp endpoint (Model Context Protocol over streamable ' +
    'HTTP). The mcp.enabled setting gates that endpoint — while it’s off the endpoint returns 404. Clients ' +
    'authenticate with the same access tokens as every other connection.',
  'workbench.settings.mcpConsent.ok': 'Turn on',

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
    'Everything in Open Headers today is included — the free tier admits up to {limit} active users per server. Install a license key to raise the seat limit.',
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

  // ── Proxy trust pane body (PROXY_SECURITY.md §2.3 consent posture) ─
  'workbench.settings.proxyTrustPane.intro':
    'Decrypting HTTPS traffic needs a certificate authority created on this machine. Nothing is installed until you set up trust here, and everything installed here can be removed here.',
  'workbench.settings.proxyTrustPane.refresh': 'Re-check',
  'workbench.settings.proxyTrustPane.loadFailed': 'Trust state could not be read: {message}',
  'workbench.settings.proxyTrustPane.ca.title': 'Certificate authority',
  'workbench.settings.proxyTrustPane.ca.none':
    'No certificate authority exists yet. One is created on this machine the first time you set up trust — it is never shipped with the app and its private key never leaves this computer.',
  'workbench.settings.proxyTrustPane.ca.subject': 'Subject',
  'workbench.settings.proxyTrustPane.ca.fingerprint': 'SHA-256 fingerprint',
  'workbench.settings.proxyTrustPane.ca.validity': 'Valid',
  'workbench.settings.proxyTrustPane.ca.validityRange': '{from} until {until}',
  'workbench.settings.proxyTrustPane.ca.deleteButton': 'Delete certificate authority',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.title': 'Delete the certificate authority?',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.body':
    'The key pair is deleted from this machine. Setting up trust again creates a fresh authority.',
  'workbench.settings.proxyTrustPane.ca.deleteConfirm.ok': 'Delete',
  'workbench.settings.proxyTrustPane.ca.deleted': 'Certificate authority deleted',
  'workbench.settings.proxyTrustPane.ca.deleteFailed': 'Could not delete the certificate authority: {message}',
  'workbench.settings.proxyTrustPane.stores.title': 'Trust stores',
  'workbench.settings.proxyTrustPane.stores.loginKeychain': 'Login keychain',
  'workbench.settings.proxyTrustPane.stores.systemKeychain': 'System keychain',
  'workbench.settings.proxyTrustPane.stores.firefoxProfile': 'Firefox profile',
  'workbench.settings.proxyTrustPane.stores.state.trusted': 'Trusted',
  'workbench.settings.proxyTrustPane.stores.state.absent': 'Not installed',
  'workbench.settings.proxyTrustPane.stores.state.untrusted': 'Present, not trusted',
  'workbench.settings.proxyTrustPane.stores.state.mismatch': 'Different certificate',
  'workbench.settings.proxyTrustPane.stores.state.unavailable': 'Unreadable',
  'workbench.settings.proxyTrustPane.stores.state.covered': 'Covered via OS store',
  'workbench.settings.proxyTrustPane.stores.state.optedOut': 'Opted out in Firefox',
  'workbench.settings.proxyTrustPane.stores.empty': 'No trust stores are visible on this machine.',
  'workbench.settings.proxyTrustPane.mismatchAlert.title': 'A trust store holds a different certificate',
  'workbench.settings.proxyTrustPane.mismatchAlert.body':
    'A certificate carrying our authority’s name is installed, but its fingerprint is not this machine’s authority. This app did not install it and never uses it — review the store it lives in.',
  'workbench.settings.proxyTrustPane.recordedCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} recorded install',
      other: '{count} recorded installs',
    }),
  'workbench.settings.proxyTrustPane.installButton': 'Set up trust…',
  'workbench.settings.proxyTrustPane.wizard.title': 'Install the proxy certificate authority',
  'workbench.settings.proxyTrustPane.wizard.explain.whatTitle': 'What gets installed',
  'workbench.settings.proxyTrustPane.wizard.explain.whatBody':
    'A root certificate created on this machine, unique to this installation. Its private key is encrypted at rest and never sent anywhere.',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesTitle': 'What it enables',
  'workbench.settings.proxyTrustPane.wizard.explain.enablesBody':
    'Trust stores that hold it accept the capture proxy’s certificates, so it can decrypt HTTPS — only for hosts you explicitly scope. Everything else passes through untouched.',
  'workbench.settings.proxyTrustPane.wizard.explain.removeTitle': 'How it is removed',
  'workbench.settings.proxyTrustPane.wizard.explain.removeBody':
    'Every change is recorded, and one click on this page undoes exactly those changes. Uninstalling the app does the same.',
  'workbench.settings.proxyTrustPane.wizard.explain.next': 'Choose trust stores',
  'workbench.settings.proxyTrustPane.wizard.choose.blurb': 'Pick where to install. Nothing changes until you confirm.',
  'workbench.settings.proxyTrustPane.wizard.choose.loginNote': 'Apps running as you — no admin approval needed.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemNote': 'Every user on this machine — asks for admin approval.',
  'workbench.settings.proxyTrustPane.wizard.choose.systemUnavailable':
    'System-wide trust isn’t available in this build yet — it needs the OpenHeaders helper. Use the login keychain for now.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNote':
    'Firefox keeps its own trust store — installs into every profile found.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxNone': 'No Firefox profiles were found on this machine.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxUnavailable':
    'Firefox profiles were found, but certutil (NSS tools) is not installed — their trust stores cannot be managed from this machine.',
  'workbench.settings.proxyTrustPane.wizard.choose.firefoxOsNote':
    'Firefox trusts the OS store automatically (Firefox 120+) — the keychains above cover it.',
  'workbench.settings.proxyTrustPane.wizard.choose.confirm': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Install into {count} store',
      other: 'Install into {count} stores',
    }),
  'workbench.settings.proxyTrustPane.wizard.results.allOk': 'Trust is installed in every store you picked.',
  'workbench.settings.proxyTrustPane.wizard.results.partial':
    'Some stores were left unchanged. Nothing retries on its own — fix the cause and set up trust again, or remove trust to roll back.',
  'workbench.settings.proxyTrustPane.wizard.results.ok': 'Installed and trusted',
  'workbench.settings.proxyTrustPane.wizard.results.elevation':
    'Admin approval was declined — the store was left unchanged.',
  'workbench.settings.proxyTrustPane.wizard.results.residue':
    'The certificate was added but could not be trusted. Use “Remove trust” to clean it up.',
  'workbench.settings.proxyTrustPane.wizard.results.failed': 'Failed: {message}',
  'workbench.settings.proxyTrustPane.wizard.installFailed': 'Trust setup failed: {message}',
  'workbench.settings.proxyTrustPane.wizard.done': 'Done',
  'workbench.settings.proxyTrustPane.removeButton': 'Remove trust',
  'workbench.settings.proxyTrustPane.removeConfirm.title': 'Remove the certificate from every recorded store?',
  'workbench.settings.proxyTrustPane.removeConfirm.body':
    'Each recorded install is undone and verified clean before its record is dropped. The certificate authority itself is kept for a later re-install.',
  'workbench.settings.proxyTrustPane.removeConfirm.ok': 'Remove',
  'workbench.settings.proxyTrustPane.removed': 'Trust removed — every recorded store is verified clean.',
  'workbench.settings.proxyTrustPane.removePartial':
    'Some stores could not be verified clean. Their records are kept — run removal again once the cause is fixed.',
  'workbench.settings.proxyTrustPane.removeFailed': 'Removal failed: {message}',
  'workbench.settings.proxyTrustPane.helper.title': 'Privileged helper',
  'workbench.settings.proxyTrustPane.helper.blurb':
    'System-keychain trust rides a signed helper registered with macOS as a background item. It only moves certificate bytes — every trust decision still goes through the macOS admin dialog.',
  'workbench.settings.proxyTrustPane.helper.notPresent': 'Not included in this build — packaged macOS builds only.',
  'workbench.settings.proxyTrustPane.helper.registrationLabel': 'Registration',
  'workbench.settings.proxyTrustPane.helper.serverLabel': 'Server',
  'workbench.settings.proxyTrustPane.helper.state.enabled': 'Registered',
  'workbench.settings.proxyTrustPane.helper.state.requiresApproval': 'Waiting for approval',
  'workbench.settings.proxyTrustPane.helper.state.notRegistered': 'Not registered',
  'workbench.settings.proxyTrustPane.helper.state.notFound': 'Not found — install the app in Applications first',
  'workbench.settings.proxyTrustPane.helper.state.unknown': 'Unknown',
  'workbench.settings.proxyTrustPane.helper.probe.ok': 'Responding',
  'workbench.settings.proxyTrustPane.helper.probe.down': 'Not responding',
  'workbench.settings.proxyTrustPane.helper.approvalHint':
    'macOS is waiting for approval: enable OpenHeaders under Login Items › “Allow in the Background”, then check again.',
  'workbench.settings.proxyTrustPane.helper.registerButton': 'Register',
  'workbench.settings.proxyTrustPane.helper.unregisterButton': 'Unregister',
  'workbench.settings.proxyTrustPane.helper.loginItemsButton': 'Open Login Items',
  'workbench.settings.proxyTrustPane.helper.actionFailed': 'Helper action failed: {message}',

  // ── Backend-details scene pills ────────────────────────────────────
  // Architecture component names (sync-engine · rule-engine · oracle ·
  // vault) are glossary vocabulary and ride raw inside the pills; only
  // the connective text keys here.
  'workbench.settings.backendDetails.backEndTitle': 'Back-end = {engine}',
  'workbench.settings.backendDetails.servedOn': 'served on {via}',
  'workbench.settings.backendDetails.apiClientsTitle': 'API clients = {count}',
  'workbench.settings.backendDetails.frontEndTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Front-end = {count} hosted surface',
      other: 'Front-end = {count} hosted surfaces',
    }),
  'workbench.settings.backendDetails.optIn': '(opt-in)',

  // ── Backend-details device-frame labels ────────────────────────────
  // The scene diagrams' device-container labels are user-facing scene
  // vocabulary and key here. Inner window corners ("Browser" / "CLI"),
  // the CI/CD YAML mock, prompt glyphs, and engine/where pill args stay
  // raw as diagram internals. Browser window titles (Chrome / Firefox /
  // Edge) are glossary proper nouns; the in-browser combined title keys
  // with the brand vocabulary raw inside the value.
  'workbench.settings.backendDetails.device.laptop': 'Laptop',
  'workbench.settings.backendDetails.device.desktop': 'Desktop',
  'workbench.settings.backendDetails.device.workstation': 'Workstation',
  'workbench.settings.backendDetails.device.localServer': 'Local server',
  'workbench.settings.backendDetails.device.remoteServer': 'Remote server',
  'workbench.settings.backendDetails.device.yourDevice': 'Your device',
  'workbench.settings.backendDetails.inBrowserTitle': 'Open Headers — Chrome / Edge / Firefox',

  // ── Git pane (workspace-tree binding card, GIT_PLAN.md §9) ─────────
  'workbench.settings.gitPane.notBound.title': 'No folder bound',
  'workbench.settings.gitPane.notBound.body':
    'Bind this workspace to a folder to keep a live YAML tree of every rule, request, and environment — ready for backups, diffs, hand edits, and (soon) git.',
  'workbench.settings.gitPane.pathPlaceholder': 'Absolute folder path',
  'workbench.settings.gitPane.chooseFolder': 'Choose Folder…',
  'workbench.settings.gitPane.bindButton': 'Bind Folder',
  'workbench.settings.gitPane.bound': 'Folder bound.',
  'workbench.settings.gitPane.boundInitialized': 'Folder initialized as a new workspace tree.',
  'workbench.settings.gitPane.boundTitle': 'Bound folder',
  'workbench.settings.gitPane.boundBody':
    'Edits materialize to this folder continuously; changes made to the files land back in the app.',
  'workbench.settings.gitPane.unbindButton': 'Unbind',
  'workbench.settings.gitPane.unbindConfirm.title': 'Unbind this folder?',
  'workbench.settings.gitPane.unbindConfirm.body':
    'The folder stays a valid workspace tree on disk; the app just stops reading and writing it.',
  'workbench.settings.gitPane.unbindConfirm.ok': 'Unbind',
  'workbench.settings.gitPane.unbound': 'Folder unbound.',
  'workbench.settings.gitPane.issuesTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} file could not be read and is left untouched',
      other: '{count} files could not be read and are left untouched',
    }),
  'workbench.settings.gitPane.refusal.locked':
    'This folder is already bound to another running engine (process {pid}).',
  'workbench.settings.gitPane.refusal.uuidCollision':
    'This folder holds a workspace that already exists on this host via another source.',
  'workbench.settings.gitPane.refusal.identityMismatch': 'This folder belongs to a different workspace ({uid}).',
  'workbench.settings.gitPane.refusal.invalidManifest': 'The folder’s workspace.yaml could not be read: {message}',
  'workbench.settings.gitPane.refusal.alreadyBound': 'This workspace is already bound to a folder.',
  'workbench.settings.gitPane.refusal.unknownWorkspace': 'No active workspace to bind.',
  'workbench.settings.gitPane.git.title': 'Git',
  'workbench.settings.gitPane.git.missing.title': 'Git is not installed',
  'workbench.settings.gitPane.git.missing.body':
    'Install git to commit this folder’s history. Everything else keeps working without it.',
  'workbench.settings.gitPane.git.belowFloor.body':
    'The installed git ({version}) is too old for this feature. Update git to enable commits.',
  'workbench.settings.gitPane.git.dirtyCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} uncommitted change',
      other: '{count} uncommitted changes',
    }),
  'workbench.settings.gitPane.git.clean': 'Working tree clean',
  'workbench.settings.gitPane.git.indexBusy': 'Auto-commit is paused while your own git index has staged changes.',
  'workbench.settings.gitPane.git.messagePlaceholder': 'Commit message',
  'workbench.settings.gitPane.git.commitButton': 'Commit',
  'workbench.settings.gitPane.git.committed': 'Committed {sha}.',
  'workbench.settings.gitPane.git.nothingToCommit': 'Nothing to commit — the tree matches the last commit.',
  'workbench.settings.gitPane.git.commitFailed': 'Commit failed: {detail}',
  'workbench.settings.gitPane.git.cadenceLabel': 'Auto-commit',
  'workbench.settings.gitPane.git.cadenceOff': 'Off — commit manually',
  'workbench.settings.gitPane.git.cadenceAuto': 'After quiet edits',
  'workbench.settings.gitPane.git.cadenceOnBlur': 'When focus leaves the app',
  'workbench.settings.gitPane.git.cadenceEvery': 'Every {minutes} minutes',
  'workbench.settings.gitPane.git.bypassHooksLabel': 'Bypass git hooks (--no-verify)',
  'workbench.settings.gitPane.git.bypassHooksWarning':
    'Engine commits skip your pre-commit and commit-msg hooks while this is on.',
  'workbench.settings.gitPane.git.remoteInSync': '{upstream}: in sync',
  'workbench.settings.gitPane.git.remoteStatus': '{upstream}: {ahead} ahead, {behind} behind',
  'workbench.settings.gitPane.git.noUpstream':
    'No remote configured — add one with git remote add and git push -u to enable Pull.',
  'workbench.settings.gitPane.git.pullButton': 'Pull',
  'workbench.settings.gitPane.git.pulled': 'Merged {sha}.',
  'workbench.settings.gitPane.git.upToDate': 'Already up to date.',
  'workbench.settings.gitPane.git.pullFailed': 'Pull failed: {detail}',
  'workbench.settings.gitPane.git.pushButton': 'Push',
  'workbench.settings.gitPane.git.pushed': 'Pushed {sha}.',
  'workbench.settings.gitPane.git.nothingToPush': 'Nothing to push — already in sync.',
  'workbench.settings.gitPane.git.pushFailed': 'Push failed: {detail}',
  'workbench.settings.gitPane.git.pushRejected': 'The remote has new commits — pull first, then push again.',
  'workbench.settings.gitPane.git.pushNoPermission.title': 'No push access',
  'workbench.settings.gitPane.git.pushNoPermission.body':
    'This remote is read-only for you. Your commits stay local; you can publish them as a new branch and open a merge request from your git host.',
  'workbench.settings.gitPane.git.exportBranchPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.exportBranchButton': 'Push as New Branch',
  'workbench.settings.gitPane.git.exportedBranch': 'Pushed branch {branch}.',
  'workbench.settings.gitPane.git.autoPushLabel': 'Push after every commit',
  'workbench.settings.gitPane.git.branch.title': 'Branches',
  'workbench.settings.gitPane.git.branch.current': 'On branch {branch}',
  'workbench.settings.gitPane.git.branch.detached': 'Detached HEAD — create a branch to keep this history.',
  'workbench.settings.gitPane.git.branch.switchLabel': 'Switch to',
  'workbench.settings.gitPane.git.branch.switched': 'Switched to {branch}.',
  'workbench.settings.gitPane.git.branch.switchFailed': 'Switch failed: {detail}',
  'workbench.settings.gitPane.git.branch.dirtyTitle': 'You have uncommitted changes',
  'workbench.settings.gitPane.git.branch.dirtyBody': ({ count, branch }, locale) =>
    formatMessage(
      plural(locale, Number(count), {
        one: 'Commit, stash, or discard {count} uncommitted change before switching to {branch}.',
        other: 'Commit, stash, or discard {count} uncommitted changes before switching to {branch}.',
      }),
      { branch: String(branch) },
    ),
  'workbench.settings.gitPane.git.branch.dirtyCommit': 'Commit and switch',
  'workbench.settings.gitPane.git.branch.dirtyStash': 'Stash and switch',
  'workbench.settings.gitPane.git.branch.dirtyDiscard': 'Discard changes',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title': 'Discard uncommitted changes?',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body':
    'Every uncommitted change is deleted, including new files. This cannot be undone.',
  'workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok': 'Discard',
  'workbench.settings.gitPane.git.branch.createPlaceholder': 'new-branch-name',
  'workbench.settings.gitPane.git.branch.createButton': 'Create & Switch',
  'workbench.settings.gitPane.git.branch.created': 'Created branch {branch}.',
  'workbench.settings.gitPane.git.branch.createFailed': 'Could not create branch: {detail}',
  'workbench.settings.gitPane.git.branch.mergeLabel': 'Merge into current',
  'workbench.settings.gitPane.git.branch.mergeButton': 'Merge',
  'workbench.settings.gitPane.git.branch.merged': 'Merged {sha}.',
  'workbench.settings.gitPane.git.branch.mergeUpToDate': 'Already up to date.',
  'workbench.settings.gitPane.git.branch.mergeFailed': 'Merge failed: {detail}',
  'workbench.settings.gitPane.git.forcePush.title': 'Remote history was rewritten',
  'workbench.settings.gitPane.git.forcePush.body':
    'The remote branch no longer contains the history you last synced ({sha}). Choose how to proceed — nothing changes until you decide.',
  'workbench.settings.gitPane.git.forcePush.abandon': 'Abandon local changes',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.title': 'Abandon local changes?',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.body':
    'Local commits since the last sync are discarded and the rewritten remote history becomes the workspace state.',
  'workbench.settings.gitPane.git.forcePush.abandonConfirm.ok': 'Abandon',
  'workbench.settings.gitPane.git.forcePush.rescue': 'Preserve on a rescue branch',
  'workbench.settings.gitPane.git.forcePush.reapply': 'Re-apply on top',
  'workbench.settings.gitPane.git.forcePush.resolved': 'Rewritten history accepted ({sha}).',
  'workbench.settings.gitPane.git.forcePush.rescued': 'Local history preserved on {branch}.',
  'workbench.settings.gitPane.git.forcePush.failed': 'Could not resolve: {detail}',
  'workbench.settings.gitPane.git.history.title': 'History',
  'workbench.settings.gitPane.git.history.show': 'Show History',
  'workbench.settings.gitPane.git.history.hide': 'Hide',
  'workbench.settings.gitPane.git.history.empty': 'No commits yet.',
  'workbench.settings.gitPane.git.history.loadFailed': 'Could not read history: {detail}',
  'workbench.settings.gitPane.git.history.authorLine': '{author} · {date}',
  'workbench.settings.gitPane.git.history.coAuthors': 'Co-authored by {authors}',
  'workbench.settings.gitPane.git.history.fileTitle': 'History — {path}',
  'workbench.settings.gitPane.git.history.fileEmpty': 'No commits touch this file yet.',
} as const satisfies Catalog;
