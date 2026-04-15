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
 *   - description   — user-facing label in the overlay
 *   - group         — overlay column grouping
 *   - hardcodedAliases — additional event.key values that always match
 *                        this action regardless of the user chord
 *                        (ArrowDown/ArrowUp/Enter/Escape conventions)
 *
 * Chord strings are normalized via the same `buildChordsFromEvent`
 * helper that drives the workspace shortcut loop, so modifier math
 * and dead-key handling stay consistent across contexts.
 */

import { useSyncExternalStore } from 'react';
import { buildChordsFromEvent } from '@/rules/hooks/useWorkspaceShortcuts';
import { get as getSetting, subscribeKey } from '@/rules/settings/store';
import type { SettingKey } from '@/rules/settings/types';

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
  | 'toggle-recording'
  | 'toggle-rules-pause'
  | 'cycle-theme'
  | 'toggle-compact-mode'
  | 'open-workspace'
  | 'open-settings'
  | 'tab-this-page'
  | 'tab-all-rules'
  | 'tab-collections';

export type PopupShortcutGroup = 'navigation' | 'actions' | 'row' | 'browser';

export interface PopupShortcutDef {
  id: PopupShortcutId;
  settingKey: SettingKey;
  description: string;
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
    description: 'This Page tab',
    group: 'navigation',
  },
  {
    id: 'tab-all-rules',
    settingKey: 'keyboard.popup.tabAllRules',
    description: 'All Rules tab',
    group: 'navigation',
  },
  {
    id: 'tab-collections',
    settingKey: 'keyboard.popup.tabCollections',
    description: 'Collections tab',
    group: 'navigation',
  },
  {
    id: 'focus-search',
    settingKey: 'keyboard.popup.focusSearch',
    description: 'Focus search',
    group: 'navigation',
  },
  {
    id: 'prev-page',
    settingKey: 'keyboard.popup.prevPage',
    description: 'Previous page',
    group: 'navigation',
  },
  {
    id: 'next-page',
    settingKey: 'keyboard.popup.nextPage',
    description: 'Next page',
    group: 'navigation',
  },

  // Actions
  {
    id: 'add-rule',
    settingKey: 'keyboard.popup.addRule',
    description: 'Add new rule',
    group: 'actions',
  },
  {
    id: 'open-workspace',
    settingKey: 'keyboard.popup.openWorkspace',
    description: 'Open workspace',
    group: 'actions',
  },
  {
    id: 'open-settings',
    settingKey: 'keyboard.popup.openSettings',
    description: 'Open settings',
    group: 'actions',
  },
  {
    id: 'toggle-recording',
    settingKey: 'keyboard.popup.toggleRecording',
    description: 'Toggle recording',
    group: 'actions',
  },
  {
    id: 'toggle-rules-pause',
    settingKey: 'keyboard.popup.toggleRulesPause',
    description: 'Pause / resume rules',
    group: 'actions',
  },
  {
    id: 'toggle-options-menu',
    settingKey: 'keyboard.popup.toggleOptionsMenu',
    description: 'Options menu',
    group: 'actions',
  },
  {
    id: 'cycle-theme',
    settingKey: 'keyboard.popup.cycleTheme',
    description: 'Cycle theme',
    group: 'actions',
  },
  {
    id: 'toggle-compact-mode',
    settingKey: 'keyboard.popup.toggleCompactMode',
    description: 'Compact mode',
    group: 'actions',
  },
  {
    id: 'toggle-shortcuts-help',
    settingKey: 'keyboard.popup.toggleShortcutsHelp',
    description: 'This panel',
    group: 'actions',
  },

  // Table row actions
  {
    id: 'move-down',
    settingKey: 'keyboard.popup.moveDown',
    description: 'Move down',
    group: 'row',
    hardcodedAliases: ['ArrowDown'],
  },
  {
    id: 'move-up',
    settingKey: 'keyboard.popup.moveUp',
    description: 'Move up',
    group: 'row',
    hardcodedAliases: ['ArrowUp'],
  },
  {
    id: 'expand-row',
    settingKey: 'keyboard.popup.expandRow',
    description: 'Expand / enter sub-rows',
    group: 'row',
    hardcodedAliases: ['ArrowRight', 'Enter'],
  },
  {
    id: 'collapse-row',
    settingKey: 'keyboard.popup.collapseRow',
    description: 'Collapse / exit sub-rows',
    group: 'row',
    hardcodedAliases: ['ArrowLeft'],
  },
  {
    id: 'toggle-row',
    settingKey: 'keyboard.popup.toggleRow',
    description: 'Toggle on / off',
    group: 'row',
  },
  {
    id: 'edit-row',
    settingKey: 'keyboard.popup.editRow',
    description: 'Edit rule',
    group: 'row',
  },
  {
    id: 'copy-value',
    settingKey: 'keyboard.popup.copyValue',
    description: 'Copy value',
    group: 'row',
  },
  {
    id: 'delete-row',
    settingKey: 'keyboard.popup.deleteRow',
    description: 'Delete (press twice)',
    group: 'row',
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
  if (hardcoded && hardcoded.includes(event.key)) return true;

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
