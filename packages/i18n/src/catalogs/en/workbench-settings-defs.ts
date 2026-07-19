/**
 * Workbench settings — the setting-definition corpus for the app-side
 * categories (general / appearance / editor / data / rules engine /
 * workspace / backend / requests / updates / about / mcp / …), keys
 * derived from the setting key
 * (`workbench.settings.def.<category>.<setting>.*`). The devpanel and
 * keyboard categories live in the sibling
 * `workbench-settings-defs-*.ts` files. Grows with the settings
 * registry (`packages/ui/src/workbench/settings/schema/`).
 *
 * Brand and platform vocabulary (Chrome / Firefox / Edge, window
 * titles) rides raw inside keyed values per the S48 settings-station
 * decisions.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefs = {
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
  'workbench.settings.def.terminal.profiles.label': 'Profiles',
  'workbench.settings.def.terminal.profiles.description':
    'Shells the terminal can open a tab with. Plain new tabs use the default; the arrow next to + in the tab row picks a specific profile.',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.label': 'Confirm Closing a Running Process',
  'workbench.settings.def.terminal.confirmCloseRunningProcess.description':
    'Ask before closing a terminal tab whose shell still has a running process. Idle shells always close silently.',
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
  'workbench.settings.def.appearance.fontFamilyPreset.option.jetbrains-mono.description':
    'Monospace UI matching the built-in terminal font — a developer-tool look throughout the chrome. Bundled — always available.',
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
  'workbench.settings.def.requests.sseEventsGroupRowLimit.label': 'SSE Events: Rows per Group',
  'workbench.settings.def.requests.sseEventsGroupRowLimit.description':
    'When grouping by event name, show only this many of each group’s newest events — the window slides as new events arrive, so several groups stay watchable at once. 0 shows every event. The list toolbar changes this same setting.',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.label': 'gRPC Messages: Newest First',
  'workbench.settings.def.requests.grpcMessagesNewestFirst.description':
    'Order of the gRPC message timeline — newest messages at the top. Turn off to read oldest first. The timeline toolbar changes this same setting.',
  'workbench.settings.def.requests.grpcMessagesShowTypes.label': 'gRPC Messages: Show Message Types',
  'workbench.settings.def.requests.grpcMessagesShowTypes.description':
    'Tag every timeline row with its declared protobuf message type. Off by default — an rpc’s types are fixed per direction, so the direction badge already tells rows apart. The timeline toolbar changes this same setting.',
  'workbench.settings.def.requests.grpcMessagesGroupByType.label': 'gRPC Messages: Group by Message Type',
  'workbench.settings.def.requests.grpcMessagesGroupByType.description':
    'Cluster the gRPC message timeline under collapsible message-type headers, arrival order kept within each group. The timeline toolbar changes this same setting.',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.label': 'gRPC Messages: Rows per Group',
  'workbench.settings.def.requests.grpcMessagesGroupRowLimit.description':
    'When grouping by message type, show only this many of each group’s newest messages — the window slides as new messages arrive, so several groups stay watchable at once. 0 shows every message. The timeline toolbar changes this same setting.',
  'workbench.settings.def.requests.wsMessagesNewestFirst.label': 'WebSocket Messages: Newest First',
  'workbench.settings.def.requests.wsMessagesNewestFirst.description':
    'Order of the WebSocket message timeline — newest messages at the top. Turn off to read oldest first. The timeline toolbar changes this same setting.',
  'workbench.settings.def.requests.grpcSendInvalidMessage.label': 'gRPC: Send Invalid Messages',
  'workbench.settings.def.requests.grpcSendInvalidMessage.description':
    'When the gRPC message is not valid JSON, invoke anyway with an empty message and let the server answer — usually INVALID_ARGUMENT. Off by default: the invoke fails before the wire with the exact parse error.',

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
  'workbench.settings.def.updates.channel.label': 'Update channel',
  'workbench.settings.def.updates.channel.description':
    'Which release line update checks follow. Beta gets new features earlier but may be less polished. Switching back to Stable never downgrades — you keep the installed version until the next stable release overtakes it. Security notices always follow the stable line on either channel.',
  'workbench.settings.def.updates.channel.option.stable.label': 'Stable',
  'workbench.settings.def.updates.channel.option.beta.label': 'Beta',
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
