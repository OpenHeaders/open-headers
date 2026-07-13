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

import type { MessageKey } from '@openheaders/i18n';
import * as v from 'valibot';
import { registerSetting } from '../registry';

const chordSchema = v.pipe(
  v.string(),
  v.regex(/^$|^(?:(?:mod|shift|alt|ctrl)\+)*[^\s+]+$/i, 'Must be a chord like "mod+k" or empty'),
);

declare module '@openheaders/ui/workbench/settings/types' {
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
    'keyboard.popup.toggleRulesPause': string;
    'keyboard.popup.togglePauseFocused': string;
    'keyboard.popup.cycleTheme': string;
    'keyboard.popup.toggleCompactMode': string;
    'keyboard.popup.openWorkspace': string;
    'keyboard.popup.openSettings': string;
    'keyboard.popup.tabThisPage': string;
    'keyboard.popup.tabAllRules': string;
    'keyboard.popup.tabCollections': string;
    'keyboard.popup.toggleSurface': string;
    'keyboard.popup.openTourGuide': string;
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
    | 'keyboard.popup.toggleRulesPause'
    | 'keyboard.popup.togglePauseFocused'
    | 'keyboard.popup.cycleTheme'
    | 'keyboard.popup.toggleCompactMode'
    | 'keyboard.popup.openWorkspace'
    | 'keyboard.popup.openSettings'
    | 'keyboard.popup.tabThisPage'
    | 'keyboard.popup.tabAllRules'
    | 'keyboard.popup.tabCollections'
    | 'keyboard.popup.toggleSurface'
    | 'keyboard.popup.openTourGuide';
  default: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  tags: string[];
  subcategory: 'popup-general' | 'popup-navigation' | 'popup-rows' | 'popup-tabs';
}

const POPUP_KEYS: readonly PopupKeySpec[] = [
  {
    key: 'keyboard.popup.toggleShortcutsHelp',
    // Stored as `shift+?` because `?` is produced by Shift+/ on every
    // common layout — `buildChordsFromEvent` prepends the active shift
    // modifier to the chord, so a bare `?` default never matches a
    // real keypress.
    default: 'shift+?',
    labelKey: 'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description',
    tags: ['popup', 'help', 'cheatsheet'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.toggleOptionsMenu',
    default: 'o',
    labelKey: 'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description',
    tags: ['popup', 'menu', 'options'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.focusSearch',
    default: '/',
    labelKey: 'workbench.settings.def.keyboard.popup.focusSearch.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.focusSearch.description',
    tags: ['popup', 'search', 'filter'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.prevPage',
    default: '[',
    labelKey: 'workbench.settings.def.keyboard.popup.prevPage.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.prevPage.description',
    tags: ['popup', 'pagination'],
    subcategory: 'popup-navigation',
  },
  {
    key: 'keyboard.popup.nextPage',
    default: ']',
    labelKey: 'workbench.settings.def.keyboard.popup.nextPage.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.nextPage.description',
    tags: ['popup', 'pagination'],
    subcategory: 'popup-navigation',
  },
  {
    key: 'keyboard.popup.moveDown',
    default: 'j',
    labelKey: 'workbench.settings.def.keyboard.popup.moveDown.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.moveDown.description',
    tags: ['popup', 'navigation', 'vim'],
    subcategory: 'popup-navigation',
  },
  {
    key: 'keyboard.popup.moveUp',
    default: 'k',
    labelKey: 'workbench.settings.def.keyboard.popup.moveUp.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.moveUp.description',
    tags: ['popup', 'navigation', 'vim'],
    subcategory: 'popup-navigation',
  },
  {
    key: 'keyboard.popup.expandRow',
    default: 'l',
    labelKey: 'workbench.settings.def.keyboard.popup.expandRow.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.expandRow.description',
    tags: ['popup', 'navigation', 'expand'],
    subcategory: 'popup-navigation',
  },
  {
    key: 'keyboard.popup.collapseRow',
    default: 'h',
    labelKey: 'workbench.settings.def.keyboard.popup.collapseRow.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.collapseRow.description',
    tags: ['popup', 'navigation', 'collapse'],
    subcategory: 'popup-navigation',
  },
  {
    key: 'keyboard.popup.toggleRow',
    // Stored as the word-mnemonic `space`, not the raw ` ` character:
    // the validation regex rejects whitespace, and the dispatcher's
    // `buildChordsFromEvent` normalizes spacebar presses to `space`
    // before matching. Consistent with `enter` / `escape` / arrow-key
    // mnemonics.
    default: 'space',
    labelKey: 'workbench.settings.def.keyboard.popup.toggleRow.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.toggleRow.description',
    tags: ['popup', 'toggle', 'rules'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.editRow',
    default: 'e',
    labelKey: 'workbench.settings.def.keyboard.popup.editRow.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.editRow.description',
    tags: ['popup', 'edit'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.copyValue',
    default: 'c',
    labelKey: 'workbench.settings.def.keyboard.popup.copyValue.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.copyValue.description',
    tags: ['popup', 'copy', 'clipboard'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.deleteRow',
    default: 'd',
    labelKey: 'workbench.settings.def.keyboard.popup.deleteRow.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.deleteRow.description',
    tags: ['popup', 'delete'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.addRule',
    default: 'a',
    labelKey: 'workbench.settings.def.keyboard.popup.addRule.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.addRule.description',
    tags: ['popup', 'new', 'create'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.toggleRulesPause',
    // Global pause is the "bigger hammer" so it sits on a modified
    // chord to stay out of the way of per-collection pause.
    default: 'shift+p',
    labelKey: 'workbench.settings.def.keyboard.popup.toggleRulesPause.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.toggleRulesPause.description',
    tags: ['popup', 'pause', 'global'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.togglePauseFocused',
    default: 'p',
    labelKey: 'workbench.settings.def.keyboard.popup.togglePauseFocused.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.togglePauseFocused.description',
    tags: ['popup', 'pause', 'collection', 'folder'],
    subcategory: 'popup-rows',
  },
  {
    key: 'keyboard.popup.cycleTheme',
    default: 't',
    labelKey: 'workbench.settings.def.keyboard.popup.cycleTheme.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.cycleTheme.description',
    tags: ['popup', 'theme'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.toggleCompactMode',
    default: 'm',
    labelKey: 'workbench.settings.def.keyboard.popup.toggleCompactMode.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.toggleCompactMode.description',
    tags: ['popup', 'density'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.openWorkspace',
    default: 'w',
    labelKey: 'workbench.settings.def.keyboard.popup.openWorkspace.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.openWorkspace.description',
    tags: ['popup', 'workspace'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.openSettings',
    default: 'mod+,',
    labelKey: 'workbench.settings.def.keyboard.popup.openSettings.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.openSettings.description',
    tags: ['popup', 'settings', 'preferences'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.tabThisPage',
    default: '1',
    labelKey: 'workbench.settings.def.keyboard.popup.tabThisPage.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.tabThisPage.description',
    tags: ['popup', 'tab'],
    subcategory: 'popup-tabs',
  },
  {
    key: 'keyboard.popup.tabAllRules',
    default: '2',
    labelKey: 'workbench.settings.def.keyboard.popup.tabAllRules.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.tabAllRules.description',
    tags: ['popup', 'tab'],
    subcategory: 'popup-tabs',
  },
  {
    key: 'keyboard.popup.tabCollections',
    default: '3',
    labelKey: 'workbench.settings.def.keyboard.popup.tabCollections.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.tabCollections.description',
    tags: ['popup', 'tab'],
    subcategory: 'popup-tabs',
  },
  {
    key: 'keyboard.popup.toggleSurface',
    // Shift-modified so the bare `l` remains the tree-expand alias in
    // the row-navigation mode.
    default: 'shift+l',
    labelKey: 'workbench.settings.def.keyboard.popup.toggleSurface.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.toggleSurface.description',
    tags: ['popup', 'surface', 'sidepanel', 'layout'],
    subcategory: 'popup-general',
  },
  {
    key: 'keyboard.popup.openTourGuide',
    // Shift-modified so bare `t` stays free for the cycle-theme binding.
    default: 'shift+t',
    labelKey: 'workbench.settings.def.keyboard.popup.openTourGuide.label',
    descriptionKey: 'workbench.settings.def.keyboard.popup.openTourGuide.description',
    tags: ['popup', 'tour', 'onboarding', 'help'],
    subcategory: 'popup-general',
  },
];

for (const spec of POPUP_KEYS) {
  registerSetting({
    key: spec.key,
    type: 'keybinding',
    default: spec.default,
    schema: chordSchema,
    labelKey: spec.labelKey,
    descriptionKey: spec.descriptionKey,
    category: 'keyboard',
    subcategory: spec.subcategory,
    tags: spec.tags,
    scope: 'user',
  });
}
