/**
 * Keyboard category — user-rebindable shortcuts.
 *
 * Values are stored as normalized chord strings:
 *   - modifiers: `mod` (⌘ on Mac / Ctrl elsewhere), `shift`, `alt`, `ctrl`
 *   - joined with `+`, modifiers first, single key last
 *   - examples: `mod+b`, `mod+shift+a`, `alt+n`, `mod+,`, `mod+\`, `/`
 *
 * Defaults mirror the hardcoded SHORTCUTS table in
 * `rules/hooks/useWorkspaceShortcuts.ts` so that rebinding is purely
 * additive — a fresh install produces the exact bindings the app
 * already ships with. Consumer wiring that reads these settings can
 * replace the hardcoded table without changing user-visible behavior.
 *
 * An empty string unbinds the action.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

// Permissive chord validator: empty, or zero-or-more known modifiers
// followed by a final key token. The key token is any non-whitespace
// non-`+` sequence so punctuation (`,` `/` `[` `\`) and named keys
// (`left`, `right`, `escape`) all parse.
const chordSchema = v.pipe(
  v.string(),
  v.regex(/^$|^(?:(?:mod|shift|alt|ctrl)\+)*[^\s+]+$/i, 'Must be a chord like "mod+k" or empty'),
);

declare module '../types' {
  interface SettingsMap {
    'keyboard.commandPalette': string;
    'keyboard.openSettings': string;
    'keyboard.toggleLeftSidebar': string;
    'keyboard.toggleBottomPanel': string;
    'keyboard.toggleRightSidebar': string;
    'keyboard.newRule': string;
    'keyboard.save': string;
    'keyboard.closeTab': string;
    'keyboard.nextTab': string;
    'keyboard.previousTab': string;
    'keyboard.tabSearch': string;
    'keyboard.focusSidebarFilter': string;
    'keyboard.focusLeftSidebar': string;
    'keyboard.focusEditor': string;
    'keyboard.focusRightSidebar': string;
    'keyboard.focusBottomPanel': string;
    'keyboard.showShortcutHelp': string;
    'keyboard.formatCode': string;
  }
}

registerSetting({
  key: 'keyboard.commandPalette',
  type: 'keybinding',
  default: 'mod+k',
  schema: chordSchema,
  label: 'Open Command Palette',
  description: 'Show the command palette overlay.',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['palette', 'search', 'commands'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.openSettings',
  type: 'keybinding',
  default: 'mod+,',
  schema: chordSchema,
  label: 'Open Settings',
  description: 'Open the settings modal.',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['settings', 'preferences'],
  scope: 'user',
});

// Panel toggles cluster on three adjacent keys (`[` `]` `'`) so the
// fingers don't have to leave home row to move between left/right/bottom.
registerSetting({
  key: 'keyboard.toggleLeftSidebar',
  type: 'keybinding',
  default: 'mod+[',
  schema: chordSchema,
  label: 'Toggle Left Sidebar',
  description: 'Show or hide the left sidebar.',
  category: 'keyboard',
  subcategory: 'workbench-layout',
  tags: ['left', 'sidebar', 'layout', 'panels'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.toggleRightSidebar',
  type: 'keybinding',
  default: 'mod+]',
  schema: chordSchema,
  label: 'Toggle Right Sidebar',
  description: 'Show or hide the right sidebar.',
  category: 'keyboard',
  subcategory: 'workbench-layout',
  tags: ['right', 'sidebar', 'inspector', 'layout', 'panels'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.toggleBottomPanel',
  type: 'keybinding',
  default: "mod+'",
  schema: chordSchema,
  label: 'Toggle Bottom Panel',
  description: 'Show or hide the bottom panel.',
  category: 'keyboard',
  subcategory: 'workbench-layout',
  tags: ['bottom', 'panel', 'layout', 'console'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.newRule',
  type: 'keybinding',
  default: 'alt+n',
  schema: chordSchema,
  label: 'New Rule',
  description: 'Create a new rule in the current workspace.',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['new', 'rule', 'create'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.save',
  type: 'keybinding',
  default: 'mod+s',
  schema: chordSchema,
  label: 'Save',
  description: 'Save the active editor tab.',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['save', 'persist'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.closeTab',
  type: 'keybinding',
  // `mod+w` (Cmd/Ctrl+W) is browser-reserved — it closes the BROWSER
  // TAB, not just the in-app editor tab, so the binding never reaches
  // the page. `alt+w` (Option+W on macOS, Alt+W on Windows/Linux) is
  // unreserved on all three platforms and matches what VS Code Web
  // does for the same reason. Users can rebind in Settings → Keyboard.
  default: 'alt+w',
  schema: chordSchema,
  label: 'Close Tab',
  description: 'Close the focused editor tab.',
  category: 'keyboard',
  subcategory: 'workbench-tabs',
  tags: ['tab', 'close'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.previousTab',
  type: 'keybinding',
  // `mod+[` is reserved for the left sidebar — tab navigation moves to
  // the alt+bracket cluster, which doesn't conflict with the browser's
  // own back/forward chord either.
  default: 'alt+[',
  schema: chordSchema,
  label: 'Previous Tab',
  description: 'Focus the previous editor tab.',
  category: 'keyboard',
  subcategory: 'workbench-tabs',
  tags: ['tab', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.nextTab',
  type: 'keybinding',
  default: 'alt+]',
  schema: chordSchema,
  label: 'Next Tab',
  description: 'Focus the next editor tab.',
  category: 'keyboard',
  subcategory: 'workbench-tabs',
  tags: ['tab', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.tabSearch',
  type: 'keybinding',
  default: 'mod+shift+a',
  schema: chordSchema,
  label: 'Search Tabs',
  description: 'Open a search overlay across all open tabs.',
  category: 'keyboard',
  subcategory: 'workbench-tabs',
  tags: ['tab', 'search'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusSidebarFilter',
  type: 'keybinding',
  default: '/',
  schema: chordSchema,
  label: 'Focus Active Section Filter',
  description: "Move focus to the filter input of whichever sidebar section you're currently in.",
  category: 'keyboard',
  subcategory: 'workbench-focus',
  tags: ['focus', 'filter', 'sidebar'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusLeftSidebar',
  type: 'keybinding',
  default: 'alt+1',
  schema: chordSchema,
  label: 'Focus Left Sidebar',
  description: 'Move keyboard focus to the left sidebar.',
  category: 'keyboard',
  subcategory: 'workbench-focus',
  tags: ['focus', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusEditor',
  type: 'keybinding',
  default: 'alt+2',
  schema: chordSchema,
  label: 'Focus Editor',
  description: 'Move keyboard focus to the editor area.',
  category: 'keyboard',
  subcategory: 'workbench-focus',
  tags: ['focus', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusRightSidebar',
  type: 'keybinding',
  default: 'alt+3',
  schema: chordSchema,
  label: 'Focus Right Sidebar',
  description: 'Move keyboard focus to the right sidebar.',
  category: 'keyboard',
  subcategory: 'workbench-focus',
  tags: ['focus', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusBottomPanel',
  type: 'keybinding',
  default: 'alt+4',
  schema: chordSchema,
  label: 'Focus Bottom Panel',
  description: 'Move keyboard focus to the bottom panel tab row.',
  category: 'keyboard',
  subcategory: 'workbench-focus',
  tags: ['focus', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.showShortcutHelp',
  type: 'keybinding',
  default: 'shift+?',
  schema: chordSchema,
  label: 'Show Shortcut Help',
  description: 'Display the keyboard shortcut cheatsheet.',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['help', 'shortcuts', 'cheatsheet'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.formatCode',
  type: 'keybinding',
  default: 'shift+alt+f',
  schema: chordSchema,
  label: 'Format Code',
  description:
    'Format the focused code editor buffer. Only fires when the editor has focus — does not interfere with global shortcuts.',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['format', 'prettier', 'editor', 'prettify'],
  scope: 'user',
});
