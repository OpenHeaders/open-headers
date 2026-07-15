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
import { getCurrentHost } from '../../../shared/host-vocabulary';
import { isMac } from '../../../shared/platform';
import { registerSetting } from '../registry';

// Permissive chord validator: empty, or zero-or-more known modifiers
// followed by a final key token. The key token is any non-whitespace
// non-`+` sequence so punctuation (`,` `/` `[` `\`) and named keys
// (`left`, `right`, `escape`) all parse.
const chordSchema = v.pipe(
  v.string(),
  v.regex(/^$|^(?:(?:mod|shift|alt|ctrl)\+)*[^\s+]+$/i, 'Must be a chord like "mod+k" or empty'),
);

// Per-host chord default. The extension workbench lives in a browser
// tab where the classic chords (Cmd/Ctrl+W, +T, +N, +O) are
// browser-reserved and never reach the page, so its defaults fall back
// to the Alt cluster. The desktop host owns its whole keyboard, so it
// ships the native-app conventions. Resolved via `getDefault` — lazily,
// after the entry point has installed the host — never at registration.
function hostChord(desktopChord: string, browserChord: string): () => string {
  return () => (getCurrentHost() === 'desktop' ? desktopChord : browserChord);
}

// Per-platform chord default. Editor-scoped bindings mirror Monaco's
// own defaults, and some of those split by platform rather than by
// host (Replace is ⌥⌘F on macOS, Ctrl+H elsewhere).
function platformChord(macChord: string, otherChord: string): () => string {
  return () => (isMac ? macChord : otherChord);
}

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'keyboard.toggleDebugMode': string;
    'keyboard.commandPalette': string;
    'keyboard.openSettings': string;
    'keyboard.toggleLeftSidebar': string;
    'keyboard.toggleBottomPanel': string;
    'keyboard.toggleRightSidebar': string;
    'keyboard.toggleActivityFeed': string;
    'keyboard.newRule': string;
    'keyboard.newTab': string;
    'keyboard.import': string;
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
    'keyboard.find': string;
    'keyboard.replace': string;
    'keyboard.formatCode': string;
  }
}

// Cross-surface: the one shortcut wired on every surface that mounts the
// Debug mode control (popup, side panel, workbench, DevTools panel).
registerSetting({
  key: 'keyboard.toggleDebugMode',
  type: 'keybinding',
  default: 'shift+d',
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.toggleDebugMode.label',
  descriptionKey: 'workbench.settings.def.keyboard.toggleDebugMode.description',
  category: 'keyboard',
  subcategory: 'global',
  tags: ['debug', 'devtools', 'inspection', 'cdp'],
  scope: 'user',
  requiresCapability: 'cdpInspection',
  capabilityUnavailableHintKey: 'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint',
});

registerSetting({
  key: 'keyboard.commandPalette',
  type: 'keybinding',
  default: 'mod+k',
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.commandPalette.label',
  descriptionKey: 'workbench.settings.def.keyboard.commandPalette.description',
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
  labelKey: 'workbench.settings.def.keyboard.openSettings.label',
  descriptionKey: 'workbench.settings.def.keyboard.openSettings.description',
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
  labelKey: 'workbench.settings.def.keyboard.toggleLeftSidebar.label',
  descriptionKey: 'workbench.settings.def.keyboard.toggleLeftSidebar.description',
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
  labelKey: 'workbench.settings.def.keyboard.toggleRightSidebar.label',
  descriptionKey: 'workbench.settings.def.keyboard.toggleRightSidebar.description',
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
  labelKey: 'workbench.settings.def.keyboard.toggleBottomPanel.label',
  descriptionKey: 'workbench.settings.def.keyboard.toggleBottomPanel.description',
  category: 'keyboard',
  subcategory: 'workbench-layout',
  tags: ['bottom', 'panel', 'layout', 'console'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.toggleActivityFeed',
  type: 'keybinding',
  // NOT mod+shift+a — that chord belongs to keyboard.tabSearch; two
  // actions on one default meant the later-registered handler silently
  // won and "Search tabs" opened the Activity Feed instead.
  default: 'shift+alt+a',
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.toggleActivityFeed.label',
  descriptionKey: 'workbench.settings.def.keyboard.toggleActivityFeed.description',
  category: 'keyboard',
  subcategory: 'workbench-layout',
  tags: ['activity', 'feed', 'inbound', 'notifications'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.newRule',
  type: 'keybinding',
  // Browser: `mod+n` opens a new browser window, so the extension falls
  // back to `alt+n`. Desktop owns the chord.
  default: 'alt+n',
  getDefault: hostChord('mod+n', 'alt+n'),
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.newRule.label',
  descriptionKey: 'workbench.settings.def.keyboard.newRule.description',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['new', 'rule', 'request', 'item', 'create'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.newTab',
  type: 'keybinding',
  // Browser: `mod+t` opens a new browser tab, so the extension falls
  // back to `alt+t`. Desktop owns the chord.
  default: 'alt+t',
  getDefault: hostChord('mod+t', 'alt+t'),
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.newTab.label',
  descriptionKey: 'workbench.settings.def.keyboard.newTab.description',
  category: 'keyboard',
  subcategory: 'workbench-tabs',
  tags: ['new', 'tab', 'request', 'draft'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.import',
  type: 'keybinding',
  // Browser: `mod+o` opens the browser's file picker, so the extension
  // falls back to `alt+o`. Desktop owns the chord.
  default: 'alt+o',
  getDefault: hostChord('mod+o', 'alt+o'),
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.import.label',
  descriptionKey: 'workbench.settings.def.keyboard.import.description',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['import', 'curl', 'har', 'open'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.save',
  type: 'keybinding',
  default: 'mod+s',
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.save.label',
  descriptionKey: 'workbench.settings.def.keyboard.save.description',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['save', 'persist'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.closeTab',
  type: 'keybinding',
  // Browser: `mod+w` (Cmd/Ctrl+W) is browser-reserved — it closes the
  // BROWSER TAB, not just the in-app editor tab, so the binding never
  // reaches the page. `alt+w` (Option+W on macOS, Alt+W on
  // Windows/Linux) is unreserved on all three platforms and matches
  // what VS Code Web does for the same reason. Desktop owns `mod+w`.
  // Users can rebind in Settings → Keyboard.
  default: 'alt+w',
  getDefault: hostChord('mod+w', 'alt+w'),
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.closeTab.label',
  descriptionKey: 'workbench.settings.def.keyboard.closeTab.description',
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
  labelKey: 'workbench.settings.def.keyboard.previousTab.label',
  descriptionKey: 'workbench.settings.def.keyboard.previousTab.description',
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
  labelKey: 'workbench.settings.def.keyboard.nextTab.label',
  descriptionKey: 'workbench.settings.def.keyboard.nextTab.description',
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
  labelKey: 'workbench.settings.def.keyboard.tabSearch.label',
  descriptionKey: 'workbench.settings.def.keyboard.tabSearch.description',
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
  labelKey: 'workbench.settings.def.keyboard.focusSidebarFilter.label',
  descriptionKey: 'workbench.settings.def.keyboard.focusSidebarFilter.description',
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
  labelKey: 'workbench.settings.def.keyboard.focusLeftSidebar.label',
  descriptionKey: 'workbench.settings.def.keyboard.focusLeftSidebar.description',
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
  labelKey: 'workbench.settings.def.keyboard.focusEditor.label',
  descriptionKey: 'workbench.settings.def.keyboard.focusEditor.description',
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
  labelKey: 'workbench.settings.def.keyboard.focusRightSidebar.label',
  descriptionKey: 'workbench.settings.def.keyboard.focusRightSidebar.description',
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
  labelKey: 'workbench.settings.def.keyboard.focusBottomPanel.label',
  descriptionKey: 'workbench.settings.def.keyboard.focusBottomPanel.description',
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
  labelKey: 'workbench.settings.def.keyboard.showShortcutHelp.label',
  descriptionKey: 'workbench.settings.def.keyboard.showShortcutHelp.description',
  category: 'keyboard',
  subcategory: 'workbench-general',
  tags: ['help', 'shortcuts', 'cheatsheet'],
  scope: 'user',
});

// Editor-scoped bindings — dispatched inside the focused code editor
// (Monaco keybinding registration, see components/monaco/
// editor-keybindings.ts), never by the window shortcut loop. Defaults
// mirror Monaco's own so a fresh install behaves like stock Monaco.
registerSetting({
  key: 'keyboard.find',
  type: 'keybinding',
  default: 'mod+f',
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.find.label',
  descriptionKey: 'workbench.settings.def.keyboard.find.description',
  category: 'keyboard',
  subcategory: 'workbench-editor',
  tags: ['find', 'search', 'editor'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.replace',
  type: 'keybinding',
  // Monaco's Replace default splits by platform, not host: ⌥⌘F on
  // macOS, Ctrl+H elsewhere.
  default: 'mod+h',
  getDefault: platformChord('mod+alt+f', 'mod+h'),
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.replace.label',
  descriptionKey: 'workbench.settings.def.keyboard.replace.description',
  category: 'keyboard',
  subcategory: 'workbench-editor',
  tags: ['replace', 'find', 'search', 'editor'],
  scope: 'user',
});

registerSetting({
  key: 'keyboard.formatCode',
  type: 'keybinding',
  default: 'shift+alt+f',
  schema: chordSchema,
  labelKey: 'workbench.settings.def.keyboard.formatCode.label',
  descriptionKey: 'workbench.settings.def.keyboard.formatCode.description',
  category: 'keyboard',
  subcategory: 'workbench-editor',
  tags: ['format', 'prettier', 'editor', 'prettify'],
  scope: 'user',
});
