/**
 * Workbench settings — the setting-definition corpus for the keyboard
 * category (keymap actions and their descriptions). Chord notation
 * (⌘K, Alt+C, …) rides raw inside keyed values; localized key names
 * are Phase I.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
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
  'workbench.settings.def.keyboard.terminalNewTab.label': 'New Terminal Tab',
  'workbench.settings.def.keyboard.terminalNewTab.description':
    'Open the Terminal tool window and start a fresh terminal tab. Desktop app only.',
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
} as const satisfies Catalog;
