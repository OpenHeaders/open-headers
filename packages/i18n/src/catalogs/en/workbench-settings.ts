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
} as const satisfies Catalog;
