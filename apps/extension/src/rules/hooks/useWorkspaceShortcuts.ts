/**
 * useWorkspaceShortcuts — global keyboard shortcuts for workspace.html.
 *
 * Shortcut chords are resolved at event-time from the settings store
 * (`keyboard.*` keys), so rebinding a shortcut in Settings > Keyboard
 * takes effect immediately without touching this file.
 *
 * Design constraints:
 *   - Browser tab context: some shortcuts (Ctrl+Tab, Cmd+T, Cmd+1-9) are
 *     intercepted by the browser before JS runs — can't override, don't try.
 *   - Follows VS Code conventions for panel toggles and tab management.
 *   - Cmd+K follows web-app convention for command palette.
 *   - Single-char shortcuts (/, ?) only fire when no input/textarea is focused.
 *   - Cmd+W only preventDefault when there's a tab to close — if no tabs, let
 *     the browser close the page (matches VS Code web behavior).
 *   - macOS Alt+letter produces dead keys, so chord matching also tries a
 *     code-derived key (KeyN → "n", Digit1 → "1") as a fallback.
 */

import { useCallback } from 'react';
import { useShellKeyDown } from '../events/shell-event-bus';
import { useSettingValue } from '../settings/hooks';
import { get as getSetting } from '../settings/store';
import type { SettingKey } from '../settings/types';

// ── Platform detection ─────────────────────────────────────────────

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

// ── Focus region type (local; kept stable for callers) ───────────

export type FocusRegion = 'left' | 'editor' | 'right' | 'bottom';

// ── Callbacks interface ───────────────────────────────────────────

export interface WorkspaceShortcutHandlers {
  onToggleSidebar: () => void;
  onToggleBottomPanel: () => void;
  onToggleInspector: () => void;
  onCloseTab: () => void;
  onPrevTab: () => void;
  onNextTab: () => void;
  onTabSearch: () => void;
  onSave: () => void;
  onNewRule: () => void;
  onFocusFilter: () => void;
  onCommandPalette: () => void;
  onShowShortcuts: () => void;
  onOpenSettings: () => void;
  /**
   * Move keyboard focus into the given shell region. Alt+1..4 dispatches
   * here. The host looks up a well-known focusable element in each region
   * (activity bar icon, tabbed editor, right-panel close button, bottom
   * panel tab row) and calls .focus() on it.
   */
  onFocusRegion: (region: FocusRegion) => void;
  /** Return true if there's a tab to close (prevents Cmd+W from closing browser tab) */
  hasActiveTab: () => boolean;
}

// ── Shortcut metadata ─────────────────────────────────────────────

export interface ShortcutDef {
  /** Stable ID consumed by `shortcutLabel` and the command palette */
  id: string;
  /** Human-readable label */
  label: string;
  /** Settings key whose value provides the chord */
  settingKey: SettingKey;
  /** Category for grouping in docs */
  category: 'panels' | 'tabs' | 'navigation' | 'actions';
  /** Which handler to invoke when matched */
  handler: HandlerRef;
  /** Only fire when no input is focused */
  requireNoInput?: boolean;
  /** Only fire when there's an active tab to close */
  requireActiveTab?: boolean;
}

type HandlerRef =
  | {
      kind: 'direct';
      name: Exclude<keyof WorkspaceShortcutHandlers, 'onFocusRegion' | 'hasActiveTab'>;
    }
  | { kind: 'focus'; region: FocusRegion }
  /**
   * Editor-scoped shortcut. The window event loop NEVER dispatches
   * these — they're handled inside the focused editor instance (e.g.
   * Monaco's own command bindings for Format Code). The entry exists
   * so Settings → Keyboard and the InspectorDocs cheatsheet can render
   * the binding and let the user rebind it.
   */
  | { kind: 'editor' };

export const SHORTCUTS: readonly ShortcutDef[] = [
  // Panels
  {
    id: 'toggle-sidebar',
    label: 'Toggle sidebar',
    settingKey: 'keyboard.toggleSidebar',
    category: 'panels',
    handler: { kind: 'direct', name: 'onToggleSidebar' },
  },
  {
    id: 'toggle-bottom',
    label: 'Toggle bottom panel',
    settingKey: 'keyboard.toggleBottomPanel',
    category: 'panels',
    handler: { kind: 'direct', name: 'onToggleBottomPanel' },
  },
  {
    id: 'toggle-inspector',
    label: 'Toggle inspector',
    settingKey: 'keyboard.toggleInspector',
    category: 'panels',
    handler: { kind: 'direct', name: 'onToggleInspector' },
  },

  // Tabs
  {
    id: 'close-tab',
    label: 'Close tab',
    settingKey: 'keyboard.closeTab',
    category: 'tabs',
    handler: { kind: 'direct', name: 'onCloseTab' },
    requireActiveTab: true,
  },
  {
    id: 'prev-tab',
    label: 'Previous tab',
    settingKey: 'keyboard.previousTab',
    category: 'tabs',
    handler: { kind: 'direct', name: 'onPrevTab' },
  },
  {
    id: 'next-tab',
    label: 'Next tab',
    settingKey: 'keyboard.nextTab',
    category: 'tabs',
    handler: { kind: 'direct', name: 'onNextTab' },
  },
  {
    id: 'tab-search',
    label: 'Search tabs',
    settingKey: 'keyboard.tabSearch',
    category: 'tabs',
    handler: { kind: 'direct', name: 'onTabSearch' },
  },

  // Navigation
  {
    id: 'command-palette',
    label: 'Command palette',
    settingKey: 'keyboard.commandPalette',
    category: 'navigation',
    handler: { kind: 'direct', name: 'onCommandPalette' },
  },
  {
    id: 'focus-filter',
    label: 'Focus sidebar filter',
    settingKey: 'keyboard.focusSidebarFilter',
    category: 'navigation',
    handler: { kind: 'direct', name: 'onFocusFilter' },
    requireNoInput: true,
  },
  {
    id: 'focus-left',
    label: 'Focus left panel',
    settingKey: 'keyboard.focusLeftPanel',
    category: 'navigation',
    handler: { kind: 'focus', region: 'left' },
  },
  {
    id: 'focus-editor',
    label: 'Focus editor',
    settingKey: 'keyboard.focusEditor',
    category: 'navigation',
    handler: { kind: 'focus', region: 'editor' },
  },
  {
    id: 'focus-right',
    label: 'Focus right panel',
    settingKey: 'keyboard.focusRightPanel',
    category: 'navigation',
    handler: { kind: 'focus', region: 'right' },
  },
  {
    id: 'focus-bottom',
    label: 'Focus bottom panel',
    settingKey: 'keyboard.focusBottomPanel',
    category: 'navigation',
    handler: { kind: 'focus', region: 'bottom' },
  },

  // Actions
  {
    id: 'save',
    label: 'Save',
    settingKey: 'keyboard.save',
    category: 'actions',
    handler: { kind: 'direct', name: 'onSave' },
  },
  {
    id: 'new-rule',
    label: 'New rule',
    settingKey: 'keyboard.newRule',
    category: 'actions',
    handler: { kind: 'direct', name: 'onNewRule' },
  },
  {
    id: 'show-shortcuts',
    label: 'Keyboard shortcuts',
    settingKey: 'keyboard.showShortcutHelp',
    category: 'actions',
    handler: { kind: 'direct', name: 'onShowShortcuts' },
    requireNoInput: true,
  },
  {
    id: 'open-settings',
    label: 'Open settings',
    settingKey: 'keyboard.openSettings',
    category: 'actions',
    handler: { kind: 'direct', name: 'onOpenSettings' },
  },
  {
    id: 'format-code',
    label: 'Format code',
    settingKey: 'keyboard.formatCode',
    category: 'actions',
    // Handled inside CodeEditor's own keymap — the window event loop
    // skips this entry. Listed here so the cheatsheet and Settings
    // page expose the binding.
    handler: { kind: 'editor' },
  },
];

// ── Chord formatting (display) ────────────────────────────────────

const MOD_DISPLAY_MAC: Record<string, string> = {
  mod: '⌘',
  shift: '⇧',
  alt: '⌥',
  ctrl: '⌃',
};

const MOD_DISPLAY_WIN: Record<string, string> = {
  mod: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
};

const KEY_DISPLAY: Record<string, string> = {
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  escape: 'Esc',
  enter: '↵',
  space: 'Space',
};

function formatChord(chord: string): string {
  if (chord.length === 0) return '';
  const parts = chord.split('+');
  const key = parts[parts.length - 1] ?? '';
  const modifiers = parts.slice(0, -1);
  const mods = modifiers.map((m) => (IS_MAC ? (MOD_DISPLAY_MAC[m] ?? m) : (MOD_DISPLAY_WIN[m] ?? m)));
  const displayKey = KEY_DISPLAY[key.toLowerCase()] ?? key.toUpperCase();
  if (IS_MAC) return [...mods, displayKey].join('');
  return [...mods, displayKey].join('+');
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
 * Platform-appropriate display string for a shortcut id (e.g. `⌘B`).
 *
 * Non-reactive snapshot — safe inside event handlers, command data
 * builders, and any other place that reads once per invocation. React
 * components should prefer `useShortcutLabel` so the label updates
 * immediately when the chord is rebound in Settings → Keyboard.
 */
export function shortcutLabel(id: string): string {
  const def = SHORTCUTS.find((s) => s.id === id);
  if (!def) return '';
  return formatChord(readChord(def.settingKey));
}

/**
 * Live subscription variant — use in JSX so the rendered key hint
 * reflects rebindings without waiting for a parent re-render.
 */
export function useShortcutLabel(id: string): string {
  const def = SHORTCUTS.find((s) => s.id === id);
  // Always pass a real setting key to the hook so React's rules-of-hooks
  // stay satisfied when `id` is unknown — fall back to any keyboard key.
  const fallback: SettingKey = 'keyboard.commandPalette';
  const chord = useSettingValue((def?.settingKey ?? fallback) as SettingKey);
  if (!def) return '';
  return formatChord(typeof chord === 'string' ? chord : '');
}

/** Return a shortcut def by ID. */
export function getShortcut(id: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.id === id);
}

// ── Chord matching ────────────────────────────────────────────────

const CODE_TO_KEY: Record<string, string> = {
  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  Numpad0: '0',
  Numpad1: '1',
  Numpad2: '2',
  Numpad3: '3',
  Numpad4: '4',
  Numpad5: '5',
  Numpad6: '6',
  Numpad7: '7',
  Numpad8: '8',
  Numpad9: '9',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  // Space uses the word-mnemonic (`space`), not the raw ` ` character,
  // so the chord regex `[^\s+]+` accepts it and stored settings are
  // human-readable (consistent with `enter` / `escape` / arrow keys).
  Space: 'space',
  Enter: 'enter',
  Escape: 'escape',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

function codeToKey(code: string): string | null {
  if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
  return CODE_TO_KEY[code] ?? null;
}

/**
 * Normalize a keyboard event into every chord string it could match.
 *
 * macOS quirk: `Option+letter` composes a dead-key character (e.g.
 * `Option+F` → `Ï`), so `event.key` no longer contains the base letter.
 * We work around this by also deriving a key from `event.code`
 * (`KeyF` → `f`), which is layout-independent and unaffected by dead
 * keys. Every permutation is returned so downstream matchers can use
 * `Array.includes(chord)`.
 *
 * Exported so editor-scoped shortcuts (CodeEditor format, etc.) can
 * reuse the exact same chord-building logic as the window-level
 * shortcut loop.
 */
export function buildChordsFromEvent(e: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (e.metaKey || e.ctrlKey) mods.push('mod');
  if (e.shiftKey) mods.push('shift');
  if (e.altKey) mods.push('alt');
  const keys = new Set<string>();
  const eventKey = e.key.toLowerCase();
  // Normalize spacebar to the word-mnemonic `space` so stored chord
  // strings never contain raw whitespace (which the validation regex
  // rightly rejects). Other named keys (`enter`, `escape`, arrow
  // keys) already pass the regex as-is.
  const normalizedEventKey = eventKey === ' ' ? 'space' : eventKey;
  if (normalizedEventKey && normalizedEventKey !== 'dead') keys.add(normalizedEventKey);
  const codeKey = codeToKey(e.code);
  if (codeKey) keys.add(codeKey);
  // Skip pure modifier presses
  keys.delete('control');
  keys.delete('shift');
  keys.delete('alt');
  keys.delete('meta');
  keys.delete('cmd');
  const chords: string[] = [];
  for (const key of keys) {
    chords.push([...mods, key].join('+'));
  }
  return chords;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// ── Hook ──────────────────────────────────────────────────────────

export function useWorkspaceShortcuts(handlers: WorkspaceShortcutHandlers): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const eventChords = buildChordsFromEvent(e);
      if (eventChords.length === 0) return;
      const inputFocused = isInputFocused();

      for (const def of SHORTCUTS) {
        // Editor-scoped shortcuts are never dispatched at the window
        // level — the focused editor instance owns the binding.
        if (def.handler.kind === 'editor') continue;
        const boundChord = readChord(def.settingKey);
        if (!boundChord) continue;
        if (!eventChords.includes(boundChord)) continue;
        if (def.requireNoInput && inputFocused) continue;
        if (def.requireActiveTab && !handlers.hasActiveTab()) {
          // Let the browser handle it (close page) when there's no tab
          return;
        }

        e.preventDefault();
        if (def.handler.kind === 'direct') {
          handlers[def.handler.name]();
        } else {
          handlers.onFocusRegion(def.handler.region);
        }
        return;
      }
    },
    [handlers],
  );

  useShellKeyDown(handleKeyDown);
}
