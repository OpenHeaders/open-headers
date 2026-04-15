/**
 * Keyboard/popup category — user-rebindable shortcuts for the popup UI.
 *
 * The popup and the workspace share a single settings store (see
 * `utils/settings-bootstrap.ts`), so these keys live alongside the
 * workspace keyboard settings in the same `keyboard` settings category.
 * The popup dispatcher (`hooks/useKeyboardDispatch.ts`) reads chords
 * from here at event-time, so rebinding in Settings → Keyboard takes
 * effect in the popup without a reload.
 *
 * Only the primary letter/punctuation bindings are rebindable.
 * Arrow keys (ArrowUp/Down/Left/Right), Enter, Escape, and Tab are
 * handled as hardcoded aliases alongside the primary binding — those
 * are universal conventions and rebinding them would regress more than
 * it would help. If a user wants a letter-only rebind, they change the
 * setting; the arrow-key fallback is always available.
 *
 * Single-key chord values (`j`, `a`, `/`) are the norm here; the popup
 * shortcut set is designed for fast one-handed navigation. An empty
 * string unbinds the action entirely.
 */

import * as v from 'valibot';
import { registerSetting } from '../registry';

const chordSchema = v.pipe(
  v.string(),
  v.regex(/^$|^(?:(?:mod|shift|alt|ctrl)\+)*[^\s+]+$/i, 'Must be a chord like "mod+k" or empty'),
);

declare module '../types' {
  interface SettingsMap {
    'keyboard.popup.toggleShortcutsHelp': string;
    'keyboard.popup.toggleOptionsMenu': string;
    'keyboard.popup.focusSearch': string;
    'keyboard.popup.prevPage': string;
    'keyboard.popup.nextPage': string;
    'keyboard.popup.moveDown': string;
    'keyboard.popup.moveUp': string;
    'keyboard.popup.expandRow': string;
    'keyboard.popup.collapseRow': string;
    'keyboard.popup.toggleRow': string;
    'keyboard.popup.editRow': string;
    'keyboard.popup.copyValue': string;
    'keyboard.popup.deleteRow': string;
    'keyboard.popup.addRule': string;
    'keyboard.popup.toggleRecording': string;
    'keyboard.popup.toggleRulesPause': string;
    'keyboard.popup.togglePauseFocused': string;
    'keyboard.popup.cycleTheme': string;
    'keyboard.popup.toggleCompactMode': string;
    'keyboard.popup.openWorkspace': string;
    'keyboard.popup.openSettings': string;
    'keyboard.popup.tabThisPage': string;
    'keyboard.popup.tabAllRules': string;
    'keyboard.popup.tabCollections': string;
  }
}

interface PopupKeySpec {
  key:
    | 'keyboard.popup.toggleShortcutsHelp'
    | 'keyboard.popup.toggleOptionsMenu'
    | 'keyboard.popup.focusSearch'
    | 'keyboard.popup.prevPage'
    | 'keyboard.popup.nextPage'
    | 'keyboard.popup.moveDown'
    | 'keyboard.popup.moveUp'
    | 'keyboard.popup.expandRow'
    | 'keyboard.popup.collapseRow'
    | 'keyboard.popup.toggleRow'
    | 'keyboard.popup.editRow'
    | 'keyboard.popup.copyValue'
    | 'keyboard.popup.deleteRow'
    | 'keyboard.popup.addRule'
    | 'keyboard.popup.toggleRecording'
    | 'keyboard.popup.toggleRulesPause'
    | 'keyboard.popup.togglePauseFocused'
    | 'keyboard.popup.cycleTheme'
    | 'keyboard.popup.toggleCompactMode'
    | 'keyboard.popup.openWorkspace'
    | 'keyboard.popup.openSettings'
    | 'keyboard.popup.tabThisPage'
    | 'keyboard.popup.tabAllRules'
    | 'keyboard.popup.tabCollections';
  default: string;
  label: string;
  description: string;
  tags: string[];
}

const POPUP_KEYS: readonly PopupKeySpec[] = [
  {
    key: 'keyboard.popup.toggleShortcutsHelp',
    // Stored as `shift+?` because `?` is produced by Shift+/ on every
    // common layout — `buildChordsFromEvent` prepends the active shift
    // modifier to the chord, so a bare `?` default never matches a
    // real keypress.
    default: 'shift+?',
    label: 'Popup — Toggle Shortcuts Help',
    description: 'Show or hide the popup keyboard-shortcut cheatsheet.',
    tags: ['popup', 'help', 'cheatsheet'],
  },
  {
    key: 'keyboard.popup.toggleOptionsMenu',
    default: 'o',
    label: 'Popup — Toggle Options Menu',
    description: 'Open or close the footer options dropdown.',
    tags: ['popup', 'menu', 'options'],
  },
  {
    key: 'keyboard.popup.focusSearch',
    default: '/',
    label: 'Popup — Focus Search',
    description: 'Move keyboard focus into the active tab’s search input.',
    tags: ['popup', 'search', 'filter'],
  },
  {
    key: 'keyboard.popup.prevPage',
    default: '[',
    label: 'Popup — Previous Page',
    description: 'Jump to the previous page of rules in the active tab.',
    tags: ['popup', 'pagination'],
  },
  {
    key: 'keyboard.popup.nextPage',
    default: ']',
    label: 'Popup — Next Page',
    description: 'Jump to the next page of rules in the active tab.',
    tags: ['popup', 'pagination'],
  },
  {
    key: 'keyboard.popup.moveDown',
    default: 'j',
    label: 'Popup — Move Down',
    description: 'Advance the focused row. ArrowDown is always available as an alias.',
    tags: ['popup', 'navigation', 'vim'],
  },
  {
    key: 'keyboard.popup.moveUp',
    default: 'k',
    label: 'Popup — Move Up',
    description: 'Move the focus to the previous row. ArrowUp is always available as an alias.',
    tags: ['popup', 'navigation', 'vim'],
  },
  {
    key: 'keyboard.popup.expandRow',
    default: 'l',
    label: 'Popup — Expand / Enter Sub-rows',
    description: 'Expand the focused row. ArrowRight and Enter are always available as aliases.',
    tags: ['popup', 'navigation', 'expand'],
  },
  {
    key: 'keyboard.popup.collapseRow',
    default: 'h',
    label: 'Popup — Collapse / Exit Sub-rows',
    description: 'Collapse the focused row. ArrowLeft is always available as an alias.',
    tags: ['popup', 'navigation', 'collapse'],
  },
  {
    key: 'keyboard.popup.toggleRow',
    default: ' ',
    label: 'Popup — Toggle Row',
    description: 'Toggle the focused rule on or off. Defaults to the spacebar.',
    tags: ['popup', 'toggle', 'rules'],
  },
  {
    key: 'keyboard.popup.editRow',
    default: 'e',
    label: 'Popup — Edit Row',
    description: 'Open the focused rule in the workspace editor.',
    tags: ['popup', 'edit'],
  },
  {
    key: 'keyboard.popup.copyValue',
    default: 'c',
    label: 'Popup — Copy Value',
    description: 'Copy the focused row’s primary value to the clipboard.',
    tags: ['popup', 'copy', 'clipboard'],
  },
  {
    key: 'keyboard.popup.deleteRow',
    default: 'd',
    label: 'Popup — Delete Row',
    description: 'Stage the focused row for deletion. Press again (or Enter) to confirm.',
    tags: ['popup', 'delete'],
  },
  {
    key: 'keyboard.popup.addRule',
    default: 'a',
    label: 'Popup — Add Rule',
    description: 'Create a new rule from the popup.',
    tags: ['popup', 'new', 'create'],
  },
  {
    key: 'keyboard.popup.toggleRecording',
    default: 'r',
    label: 'Popup — Toggle Recording',
    description: 'Start or stop the current recording session.',
    tags: ['popup', 'recording'],
  },
  {
    key: 'keyboard.popup.toggleRulesPause',
    // Global pause is the "bigger hammer" so it sits on a modified
    // chord to stay out of the way of per-collection pause.
    default: 'shift+p',
    label: 'Popup — Toggle Rules Pause (global)',
    description: 'Pause or resume every rule across every collection.',
    tags: ['popup', 'pause', 'global'],
  },
  {
    key: 'keyboard.popup.togglePauseFocused',
    default: 'p',
    label: 'Popup — Toggle Pause (focused row)',
    description: 'Pause or resume the focused collection, folder, or rule in the Collections tab.',
    tags: ['popup', 'pause', 'collection', 'folder'],
  },
  {
    key: 'keyboard.popup.cycleTheme',
    default: 't',
    label: 'Popup — Cycle Theme',
    description: 'Rotate between light, dark, and auto themes.',
    tags: ['popup', 'theme'],
  },
  {
    key: 'keyboard.popup.toggleCompactMode',
    default: 'm',
    label: 'Popup — Toggle Compact Mode',
    description: 'Switch the popup between compact and comfortable density.',
    tags: ['popup', 'density'],
  },
  {
    key: 'keyboard.popup.openWorkspace',
    default: 'w',
    label: 'Popup — Open Workspace',
    description: 'Open the full workspace tab.',
    tags: ['popup', 'workspace'],
  },
  {
    key: 'keyboard.popup.openSettings',
    default: 'mod+,',
    label: 'Popup — Open Settings',
    description: 'Open the settings page in a new workspace tab. Matches the workspace binding.',
    tags: ['popup', 'settings', 'preferences'],
  },
  {
    key: 'keyboard.popup.tabThisPage',
    default: '1',
    label: 'Popup — This Page Tab',
    description: 'Activate the "This Page" rules tab.',
    tags: ['popup', 'tab'],
  },
  {
    key: 'keyboard.popup.tabAllRules',
    default: '2',
    label: 'Popup — All Rules Tab',
    description: 'Activate the "All Rules" tab.',
    tags: ['popup', 'tab'],
  },
  {
    key: 'keyboard.popup.tabCollections',
    default: '3',
    label: 'Popup — Collections Tab',
    description: 'Activate the "Collections" tab.',
    tags: ['popup', 'tab'],
  },
];

for (const spec of POPUP_KEYS) {
  registerSetting({
    key: spec.key,
    type: 'keybinding',
    default: spec.default,
    schema: chordSchema,
    label: spec.label,
    description: spec.description,
    category: 'keyboard',
    tags: spec.tags,
    scope: 'user',
  });
}
