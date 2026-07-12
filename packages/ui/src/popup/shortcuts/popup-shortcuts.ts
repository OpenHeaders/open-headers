/**
 * Popup shortcut registry — single source of truth for what every
 * rebindable popup key does.
 *
 * The dispatch hook (`useKeyboardDispatch`) consults this registry when
 * deciding whether a keypress matches an action. The shortcuts overlay
 * (`KeyboardShortcutsOverlay`) renders its label column from the same
 * registry so the two can't drift apart. Settings → Keyboard
 * (`rules/settings/schema/keyboard-popup.ts`) defines each chord
 * setting and exposes the rebinding UI.
 *
 * A shortcut entry defines:
 *   - id            — stable identifier for lookups
 *   - settingKey    — chord storage location (editable in Settings)
 *   - descriptionKey — catalog key of the user-facing overlay label
 *   - group         — overlay column grouping
 *   - hardcodedAliases — additional event.key values that always match
 *                        this action regardless of the user chord
 *                        (ArrowDown/ArrowUp/Enter/Escape conventions)
 *
 * Chord strings are normalized via the same `buildChordsFromEvent`
 * helper that drives the workspace shortcut loop, so modifier math
 * and dead-key handling stay consistent across contexts.
 */

import type { MessageKey } from '@openheaders/i18n';
import { buildChordsFromEvent } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import type { SettingKey } from '@openheaders/ui/workbench/settings/types';
import { useSyncExternalStore } from 'react';

export type PopupShortcutId =
  | 'toggle-shortcuts-help'
  | 'toggle-options-menu'
  | 'focus-search'
  | 'prev-page'
  | 'next-page'
  | 'move-down'
  | 'move-up'
  | 'expand-row'
  | 'collapse-row'
  | 'toggle-row'
  | 'edit-row'
  | 'copy-value'
  | 'delete-row'
  | 'add-rule'
  | 'toggle-rules-pause'
  | 'toggle-pause-focused'
  | 'cycle-theme'
  | 'toggle-compact-mode'
  | 'open-workspace'
  | 'open-settings'
  | 'tab-this-page'
  | 'tab-all-rules'
  | 'tab-collections'
  | 'toggle-surface'
  | 'open-tour-guide';

export type PopupShortcutGroup = 'navigation' | 'actions' | 'row' | 'browser' | 'tourGuide';

export interface PopupShortcutDef {
  id: PopupShortcutId;
  settingKey: SettingKey;
  descriptionKey: MessageKey;
  group: PopupShortcutGroup;
  /**
   * Additional `event.key` values that always match this action, even
   * when the user has rebound the primary chord. Used for universal
   * conventions (ArrowDown, Enter, Escape) that shouldn't disappear
   * when someone rebinds the vim-style letter key.
   */
  hardcodedAliases?: readonly string[];
}

export const POPUP_SHORTCUTS: readonly PopupShortcutDef[] = [
  // Navigation
  {
    id: 'tab-this-page',
    settingKey: 'keyboard.popup.tabThisPage',
    descriptionKey: 'popup.shortcuts.tabThisPage',
    group: 'navigation',
  },
  {
    id: 'tab-all-rules',
    settingKey: 'keyboard.popup.tabAllRules',
    descriptionKey: 'popup.shortcuts.tabAllRules',
    group: 'navigation',
  },
  {
    id: 'tab-collections',
    settingKey: 'keyboard.popup.tabCollections',
    descriptionKey: 'popup.shortcuts.tabCollections',
    group: 'navigation',
  },
  {
    id: 'focus-search',
    settingKey: 'keyboard.popup.focusSearch',
    descriptionKey: 'popup.shortcuts.focusSearch',
    group: 'navigation',
  },
  {
    id: 'prev-page',
    settingKey: 'keyboard.popup.prevPage',
    descriptionKey: 'popup.shortcuts.prevPage',
    group: 'navigation',
  },
  {
    id: 'next-page',
    settingKey: 'keyboard.popup.nextPage',
    descriptionKey: 'popup.shortcuts.nextPage',
    group: 'navigation',
  },

  // Actions
  {
    id: 'add-rule',
    settingKey: 'keyboard.popup.addRule',
    descriptionKey: 'popup.shortcuts.addRule',
    group: 'actions',
  },
  {
    id: 'open-workspace',
    settingKey: 'keyboard.popup.openWorkspace',
    descriptionKey: 'popup.shortcuts.openWorkspace',
    group: 'actions',
  },
  {
    id: 'open-settings',
    settingKey: 'keyboard.popup.openSettings',
    descriptionKey: 'popup.shortcuts.openSettings',
    group: 'actions',
  },
  {
    id: 'toggle-surface',
    settingKey: 'keyboard.popup.toggleSurface',
    descriptionKey: 'popup.shortcuts.toggleSurface',
    group: 'actions',
  },
  {
    id: 'toggle-rules-pause',
    settingKey: 'keyboard.popup.toggleRulesPause',
    descriptionKey: 'popup.shortcuts.toggleRulesPause',
    group: 'actions',
  },
  {
    id: 'toggle-pause-focused',
    settingKey: 'keyboard.popup.togglePauseFocused',
    descriptionKey: 'popup.shortcuts.togglePauseFocused',
    group: 'row',
  },
  {
    id: 'toggle-options-menu',
    settingKey: 'keyboard.popup.toggleOptionsMenu',
    descriptionKey: 'popup.shortcuts.toggleOptionsMenu',
    group: 'actions',
  },
  {
    id: 'cycle-theme',
    settingKey: 'keyboard.popup.cycleTheme',
    descriptionKey: 'popup.shortcuts.cycleTheme',
    group: 'actions',
  },
  {
    id: 'toggle-compact-mode',
    settingKey: 'keyboard.popup.toggleCompactMode',
    descriptionKey: 'popup.shortcuts.toggleCompactMode',
    group: 'actions',
  },
  {
    id: 'toggle-shortcuts-help',
    settingKey: 'keyboard.popup.toggleShortcutsHelp',
    descriptionKey: 'popup.shortcuts.toggleShortcutsHelp',
    group: 'actions',
  },

  // Table row actions
  {
    id: 'move-down',
    settingKey: 'keyboard.popup.moveDown',
    descriptionKey: 'popup.shortcuts.moveDown',
    group: 'row',
    hardcodedAliases: ['ArrowDown'],
  },
  {
    id: 'move-up',
    settingKey: 'keyboard.popup.moveUp',
    descriptionKey: 'popup.shortcuts.moveUp',
    group: 'row',
    hardcodedAliases: ['ArrowUp'],
  },
  {
    id: 'expand-row',
    settingKey: 'keyboard.popup.expandRow',
    descriptionKey: 'popup.shortcuts.expandRow',
    group: 'row',
    hardcodedAliases: ['ArrowRight', 'Enter'],
  },
  {
    id: 'collapse-row',
    settingKey: 'keyboard.popup.collapseRow',
    descriptionKey: 'popup.shortcuts.collapseRow',
    group: 'row',
    hardcodedAliases: ['ArrowLeft'],
  },
  {
    id: 'toggle-row',
    settingKey: 'keyboard.popup.toggleRow',
    descriptionKey: 'popup.shortcuts.toggleRow',
    group: 'row',
  },
  {
    id: 'edit-row',
    settingKey: 'keyboard.popup.editRow',
    descriptionKey: 'popup.shortcuts.editRow',
    group: 'row',
  },
  {
    id: 'copy-value',
    settingKey: 'keyboard.popup.copyValue',
    descriptionKey: 'popup.shortcuts.copyValue',
    group: 'row',
  },
  {
    id: 'delete-row',
    settingKey: 'keyboard.popup.deleteRow',
    descriptionKey: 'popup.shortcuts.deleteRow',
    group: 'row',
  },

  // Tour guide
  {
    id: 'open-tour-guide',
    settingKey: 'keyboard.popup.openTourGuide',
    descriptionKey: 'popup.shortcuts.openTourGuide',
    group: 'tourGuide',
  },
];

const BY_ID: Record<PopupShortcutId, PopupShortcutDef> = Object.fromEntries(
  POPUP_SHORTCUTS.map((def) => [def.id, def]),
) as Record<PopupShortcutId, PopupShortcutDef>;

export function getPopupShortcut(id: PopupShortcutId): PopupShortcutDef {
  return BY_ID[id];
}

function readChord(settingKey: SettingKey): string {
  try {
    const value = getSetting(settingKey);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/**
 * True if `event` matches the shortcut identified by `id`. The event
 * matches when:
 *   1. Its chord (computed via `buildChordsFromEvent`) equals the user
 *      chord stored in settings, OR
 *   2. Its `event.key` is one of the hardcoded universal aliases
 *      (ArrowDown, Enter, Escape, …) for that action.
 *
 * Consumers should call this instead of `event.key === 'j'` so
 * rebinding in Settings → Keyboard flows through automatically.
 */
export function matchesPopupShortcut(event: KeyboardEvent, id: PopupShortcutId): boolean {
  const def = BY_ID[id];
  if (!def) return false;

  const hardcoded = def.hardcodedAliases;
  if (hardcoded?.includes(event.key)) return true;

  const chord = readChord(def.settingKey);
  if (!chord) return false;

  const eventChords = buildChordsFromEvent(event);
  return eventChords.includes(chord);
}

/** Current chord for a shortcut id. Empty string if unbound. */
export function popupShortcutChord(id: PopupShortcutId): string {
  const def = BY_ID[id];
  if (!def) return '';
  return readChord(def.settingKey);
}

/**
 * Live chord snapshot for every popup shortcut, keyed by id. The
 * overlay consumes this via `useSyncExternalStore` so it repaints when
 * any popup chord is rebound in Settings → Keyboard, without needing
 * one `useSetting` call per entry (which would fight React's rules of
 * hooks when the registry grows).
 */
export type PopupShortcutChords = Readonly<Record<PopupShortcutId, string>>;

function buildChordSnapshot(): PopupShortcutChords {
  const snap: Record<string, string> = {};
  for (const def of POPUP_SHORTCUTS) {
    snap[def.id] = readChord(def.settingKey);
  }
  return snap as PopupShortcutChords;
}

let cachedSnapshot: PopupShortcutChords = buildChordSnapshot();

function chordsEqual(a: PopupShortcutChords, b: PopupShortcutChords): boolean {
  for (const def of POPUP_SHORTCUTS) {
    if (a[def.id] !== b[def.id]) return false;
  }
  return true;
}

function subscribeChords(listener: () => void): () => void {
  const unsubs = POPUP_SHORTCUTS.map((def) =>
    subscribeKey(def.settingKey, () => {
      const next = buildChordSnapshot();
      if (!chordsEqual(cachedSnapshot, next)) {
        cachedSnapshot = next;
        listener();
      }
    }),
  );
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

function getChordSnapshot(): PopupShortcutChords {
  return cachedSnapshot;
}

export function usePopupShortcutChords(): PopupShortcutChords {
  return useSyncExternalStore(subscribeChords, getChordSnapshot, getChordSnapshot);
}

// ── Display formatting ─────────────────────────────────────────────

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const MOD_DISPLAY_MAC: Record<string, string> = {
  mod: '\u2318',
  shift: '\u21E7',
  alt: '\u2325',
  ctrl: '\u2303',
};

const MOD_DISPLAY_WIN: Record<string, string> = {
  mod: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
};

const KEY_DISPLAY: Record<string, string> = {
  // Spacebar is stored as the word-mnemonic `space` (see
  // `buildChordsFromEvent` in `useWorkspaceShortcuts.ts`) so the
  // validation regex `[^\s+]+` accepts it.
  space: 'Space',
  arrowup: '\u2191',
  arrowdown: '\u2193',
  arrowleft: '\u2190',
  arrowright: '\u2192',
  escape: 'Esc',
  enter: '\u21B5',
};

function formatChord(chord: string): string {
  if (!chord) return '';
  const parts = chord.split('+');
  const key = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1).map((m) => (IS_MAC ? MOD_DISPLAY_MAC[m] : MOD_DISPLAY_WIN[m]) ?? m);
  const label = KEY_DISPLAY[key] ?? (key.length === 1 ? key : key.charAt(0).toUpperCase() + key.slice(1));
  if (mods.length === 0) return label;
  return IS_MAC ? `${mods.join('')}${label}` : `${mods.join('+')}+${label}`;
}

/**
 * Non-reactive platform-appropriate display label for a popup shortcut.
 * Safe to call inside event handlers or memoized derivations. For JSX
 * that should react to live rebinding, prefer `usePopupShortcutLabel`.
 */
export function popupShortcutLabel(id: PopupShortcutId): string {
  return formatChord(popupShortcutChord(id));
}

/** Live display label — repaints when the user rebinds the chord. */
export function usePopupShortcutLabel(id: PopupShortcutId): string {
  const chords = usePopupShortcutChords();
  return formatChord(chords[id] ?? '');
}
