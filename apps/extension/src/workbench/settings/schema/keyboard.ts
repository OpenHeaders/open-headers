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
    'keyboard.toggleSidebar': string;
    'keyboard.toggleBottomPanel': string;
    'keyboard.toggleInspector': string;
    'keyboard.newRule': string;
    'keyboard.save': string;
    'keyboard.closeTab': string;
    'keyboard.nextTab': string;
    'keyboard.previousTab': string;
    'keyboard.tabSearch': string;
    'keyboard.focusSidebarFilter': string;
    'keyboard.focusLeftPanel': string;
    'keyboard.focusEditor': string;
    'keyboard.focusRightPanel': string;
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
  tags: ['settings', 'preferences'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.toggleSidebar',
  type: 'keybinding',
  default: 'mod+b',
  schema: chordSchema,
  label: 'Toggle Sidebar',
  description: 'Show or hide the left sidebar.',
  category: 'keyboard',
  tags: ['sidebar', 'layout', 'panels'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.toggleBottomPanel',
  type: 'keybinding',
  default: 'mod+j',
  schema: chordSchema,
  label: 'Toggle Bottom Panel',
  description: 'Show or hide the bottom panel.',
  category: 'keyboard',
  tags: ['panel', 'layout', 'console'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.toggleInspector',
  type: 'keybinding',
  default: 'mod+\\',
  schema: chordSchema,
  label: 'Toggle Inspector',
  description: 'Show or hide the right-side inspector panel.',
  category: 'keyboard',
  tags: ['inspector', 'layout', 'panels'],
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
  tags: ['save', 'persist'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.closeTab',
  type: 'keybinding',
  default: 'mod+w',
  schema: chordSchema,
  label: 'Close Tab',
  description: 'Close the focused editor tab.',
  category: 'keyboard',
  tags: ['tab', 'close'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.previousTab',
  type: 'keybinding',
  default: 'mod+[',
  schema: chordSchema,
  label: 'Previous Tab',
  description: 'Focus the previous editor tab.',
  category: 'keyboard',
  tags: ['tab', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.nextTab',
  type: 'keybinding',
  default: 'mod+]',
  schema: chordSchema,
  label: 'Next Tab',
  description: 'Focus the next editor tab.',
  category: 'keyboard',
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
  tags: ['tab', 'search'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusSidebarFilter',
  type: 'keybinding',
  default: '/',
  schema: chordSchema,
  label: 'Focus Sidebar Filter',
  description: 'Move focus to the sidebar filter input.',
  category: 'keyboard',
  tags: ['focus', 'filter', 'sidebar'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusLeftPanel',
  type: 'keybinding',
  default: 'alt+1',
  schema: chordSchema,
  label: 'Focus Left Panel',
  description: 'Move keyboard focus to the left activity/sidebar region.',
  category: 'keyboard',
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
  tags: ['focus', 'navigation'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.focusRightPanel',
  type: 'keybinding',
  default: 'alt+3',
  schema: chordSchema,
  label: 'Focus Right Panel',
  description: 'Move keyboard focus to the right inspector panel.',
  category: 'keyboard',
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
  tags: ['format', 'prettier', 'editor', 'prettify'],
  scope: 'user',
});
