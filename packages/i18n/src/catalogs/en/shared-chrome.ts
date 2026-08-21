/**
 * Shared chrome family — the footer / topbar controls mounted by every
 * surface from `packages/ui/src/shared/`: the Debug mode pill and its
 * dormant-notice chip, the System Status pill (+ product extras), the
 * update dialog, the settings gear menu, the background-tasks
 * (Processes) slot, the layout-donor pill, and the lifecycle pill.
 *
 * Raw by design inside keyed sentences: browser + brand proper nouns
 * (Chrome / Edge / DevTools / Open Headers), the browser's own banner
 * text quoted verbatim (“OH started debugging this browser” — parity
 * vocabulary, the browser renders it in its own language), technical
 * plane vocabulary (nav / worker / OOPIF, xhr/fetch, `{{ref}}`
 * reference syntax, `boot.interactive` sample names), and {version} /
 * {unit} / {target} holes carrying versions, host vocabulary, and URLs.
 */

import type { Catalog } from '../../types';

export const sharedChrome = {
  // ── Debug mode pill + dormant notice ───────────────────────────────
  'shared.chrome.debug.title': 'Debug mode',
  'shared.chrome.debug.titleShort': 'Debug',
  'shared.chrome.debug.unavailableHint': 'Debug mode is available in Chrome and Edge.',
  'shared.chrome.debug.toggleAria': 'Toggle debug mode',
  'shared.chrome.debug.aboutTooltip': 'About debug mode',
  'shared.chrome.debug.openDocsAria': 'Open debug mode documentation',
  'shared.chrome.debug.controlsAria': 'Debug mode controls',
  'shared.chrome.debug.turnOn': 'Turn on debug mode',
  'shared.chrome.debug.turnOff': 'Turn off debug mode',
  'shared.chrome.debug.scopeDevtools': 'Where DevTools is open',
  'shared.chrome.debug.scopeActive': 'The focused tab',
  'shared.chrome.debug.scopeBoth': 'Both',
  'shared.chrome.debug.attachTo': 'Attach to',
  'shared.chrome.debug.includeThisTab': 'Include this browser tab',
  'shared.chrome.debug.pinThisTabAria': 'Pin this browser tab',
  'shared.chrome.debug.attachedTabs': 'Attached tabs',
  'shared.chrome.debug.noTabsAttached': 'No tabs attached yet',
  'shared.chrome.debug.bannerNote':
    "While debug mode is on, the browser's banner “OH started debugging this browser” shows on every tab — not just the ones it's attached to.",
  'shared.chrome.debug.tabNumber': 'Tab #{number}',
  'shared.chrome.debug.tabFallback': 'Tab {id}',
  'shared.chrome.debug.onThisTab': "You're on this tab",
  'shared.chrome.debug.switchTo': 'Switch to {target}',
  'shared.chrome.debug.dormantTooltip':
    "Debug mode is on, but this tab is outside its scope — your debug-tier rules' nav / worker / OOPIF effects are dormant here. Bring it into scope from Debug mode (change the scope or pin this tab). They still run over page requests (xhr/fetch).",
  'shared.chrome.debug.tabOutOfScope': 'Tab out of scope',

  // ── System Status pill ─────────────────────────────────────────────
  'shared.chrome.status.title': 'System',
  'shared.chrome.status.aria': 'System status: {summary}',
  'shared.chrome.status.aboutTooltip': 'About this panel',
  'shared.chrome.status.openDocsAria': 'Open system status documentation',
  'shared.chrome.status.healthy': 'Healthy',
  'shared.chrome.status.failure': 'Failure',
  'shared.chrome.status.issues': 'Issues',
  'shared.chrome.status.noEvents': 'No events yet',
  'shared.chrome.status.subsystemSync': 'Sync',
  'shared.chrome.status.subsystemRules': 'Rules',
  'shared.chrome.status.subsystemRequests': 'Requests',
  'shared.chrome.status.subsystemPermissions': 'Permissions',
  'shared.chrome.status.subsystemSecrets': 'Secrets',
  'shared.chrome.status.subsystemLive': 'Live',
  'shared.chrome.status.subsystemActivity': 'Activity',
  'shared.chrome.status.subsystemDebugMode': 'Debug mode',
  'shared.chrome.status.buildLine': 'Open Headers · {version}',
  'shared.chrome.status.versionBeta': '{version} (beta)',
  'shared.chrome.status.buildNumber': 'build {build}',

  // ── Status popover product extras ──────────────────────────────────
  'shared.chrome.status.relaunchApp': 'Relaunch app',
  'shared.chrome.status.backendOff': 'Off',
  'shared.chrome.status.backendConnecting': 'Connecting…',
  'shared.chrome.status.companionDesktopApp': 'Desktop app',
  'shared.chrome.status.companionExtensions': 'Extensions',
  'shared.chrome.status.companionConnected': 'Connected',
  'shared.chrome.status.companionNotConnected': 'Not connected',
  'shared.chrome.status.companionInstalledNotConnected': 'Installed · not connected',
  'shared.chrome.status.companionNotInstalled': 'Not installed',
  'shared.chrome.status.companionDownload': 'Download',
  'shared.chrome.status.companionPeersConnected': '{count} connected',
  'shared.chrome.status.companionNoPeers': 'None connected',
  'shared.chrome.status.companionConnect': 'Connect',
  'shared.chrome.status.companionOpenApp': 'Open app',
  'shared.chrome.addons.title': 'Add-ons',
  'shared.chrome.addons.cli': 'CLI',
  'shared.chrome.addons.server': 'Server',
  'shared.chrome.addons.cliSetUp': 'Set up',
  'shared.chrome.addons.cliNotSetUp': 'Not set up',
  'shared.chrome.addons.cliStale': 'Token revoked — set up again',
  'shared.chrome.addons.cliExternal': 'External config',
  'shared.chrome.addons.cliMalformed': 'Config malformed',
  'shared.chrome.addons.cliProvision': 'Set up',
  'shared.chrome.addons.mcp': 'MCP',
  'shared.chrome.addons.mcpOn': 'On',
  'shared.chrome.addons.mcpTurnOn': 'Turn on',
  'shared.chrome.addons.notConfigured': 'Not configured',
  'shared.chrome.addons.requiresDesktop': 'Requires the desktop app',
  'shared.chrome.addons.cliViaDesktop': 'Set up from the desktop app',
  'shared.chrome.status.coldStart': 'Cold start',
  'shared.chrome.status.coldStartMessage': 'Performance regression detected — see diagnostic export',
  'shared.chrome.status.coldStartTooltip':
    'Three consecutive cold wakes exceeded baseline by ≥20%. Recent boot.interactive samples (ms): {samples}.',

  // ── Update dialog ──────────────────────────────────────────────────
  'shared.chrome.updates.title': 'Update',
  'shared.chrome.updates.downloading': 'Downloading…',
  'shared.chrome.updates.downloadingPercent': 'Downloading… {percent}%',
  'shared.chrome.updates.updateAndRestart': 'Update & Restart',
  'shared.chrome.updates.ignore': 'Ignore This Update',
  'shared.chrome.updates.remindLater': 'Remind Me Later',
  'shared.chrome.updates.nowAvailableSuffix': 'is now available!',
  'shared.chrome.updates.moreDetailsPrefix': 'For more details, see the',
  'shared.chrome.updates.releaseNotes': 'release notes',
  'shared.chrome.updates.updatingTo': 'Updating {from} to {to}.',
  'shared.chrome.updates.configure': 'Configure updates…',

  // ── Settings gear menu ─────────────────────────────────────────────
  'shared.chrome.gearMenu.downloadVersion': 'Download {version}',
  'shared.chrome.gearMenu.versionAvailable': '{version} Available…',
  'shared.chrome.gearMenu.updateAndRestartVersion': 'Update to {version} & Restart',
  'shared.chrome.gearMenu.downloadingVersion': 'Downloading {version}…',
  'shared.chrome.gearMenu.restartToInstallVersion': 'Restart to Install {version}',
  'shared.chrome.gearMenu.settings': 'Settings…',
  'shared.chrome.gearMenu.keyboardShortcuts': 'Keyboard Shortcuts…',
  'shared.chrome.gearMenu.appearance': 'Appearance…',
  'shared.chrome.gearMenu.about': 'About Open Headers',
  'shared.chrome.gearMenu.tourGuide': 'Tour guide',
  'shared.chrome.gearMenu.signOut': 'Sign out',
  'shared.chrome.gearMenu.searchPlaceholder': 'Search',
  'shared.chrome.gearMenu.noMatches': 'No matches',
  'shared.chrome.gearMenu.settingsTooltip': 'Settings',
  'shared.chrome.gearMenu.settingsMenuAria': 'Settings menu',

  // ── Background tasks (Processes) ───────────────────────────────────
  'shared.chrome.tasks.processes': 'Processes',
  'shared.chrome.tasks.hidePanelAria': 'Hide processes panel',
  'shared.chrome.tasks.allCompleted': 'All background tasks completed',
  'shared.chrome.tasks.aboutNoteAria': 'About this note',
  'shared.chrome.tasks.stop': 'Stop',
  'shared.chrome.tasks.keepRunning': 'Keep running',
  'shared.chrome.tasks.stopTaskAria': 'Stop background task',
  'shared.chrome.tasks.hideTaskAria': 'Hide background task',
  'shared.chrome.tasks.hideProcesses': 'Hide processes',
  'shared.chrome.tasks.hideProcessesCount': 'Hide processes ({count})',

  // ── Layout-donor pill ──────────────────────────────────────────────
  'shared.chrome.donor.defaultTooltip': 'Default {unit} — new {units} inherit layout from here.',
  'shared.chrome.donor.nonDefaultTooltip': 'Another {unit} is the default donor — new {units} inherit from there.',
  'shared.chrome.donor.isDonorBody': 'This {unit} is the current default. New {units} inherit this layout.',
  'shared.chrome.donor.nonDonorBody':
    'Another {unit} is the current default. New {units} inherit that {unit}’s layout.',
  'shared.chrome.donor.reset': 'Reset layout to defaults',
  'shared.chrome.donor.defaultAria': 'Default {unit} for new-{unit} inheritance',
  'shared.chrome.donor.nonDefaultAria': 'Not the default {unit} for new-{unit} inheritance',
  'shared.chrome.donor.defaultLabel': 'Default {unit}',
  'shared.chrome.donor.inheritsLabel': 'Inherits layout',

  // ── Lifecycle pill ─────────────────────────────────────────────────
  'shared.chrome.lifecycle.title': 'Lifecycle states',
  'shared.chrome.lifecycle.scratch': 'Scratch',
  'shared.chrome.lifecycle.scratchBody': 'Unsaved draft. Nothing is persisted until you Save.',
  'shared.chrome.lifecycle.unresolved': 'Unresolved',
  'shared.chrome.lifecycle.unresolvedBody': 'Has {{ref}}s that don’t resolve in the active scope.',
  'shared.chrome.lifecycle.draft': 'Draft',
  'shared.chrome.lifecycle.draftBody': 'Saved but not Live yet — missing required fields, or not yet published.',
  'shared.chrome.lifecycle.live': 'Live',
  'shared.chrome.lifecycle.liveBody': 'Published and active.',
} as const satisfies Catalog;
