/**
 * useWorkspaceShortcuts — global keyboard shortcuts for workspace.html.
 *
 * Design constraints:
 *   - Browser tab context: some shortcuts (Ctrl+Tab, Cmd+T, Cmd+1-9) are intercepted
 *     by the browser before JS runs — can't override, don't try.
 *   - Follows VS Code conventions for panel toggles and tab management — developers
 *     already have muscle memory for these.
 *   - Cmd+K follows web-app convention (Notion, Linear, Slack, GitHub) for command palette.
 *   - Single-char shortcuts (/, ?) only fire when no input/textarea is focused.
 *   - Cmd+W only preventDefault when there's a tab to close — if no tabs, let the
 *     browser close the page (matches VS Code web behavior).
 */

import { useCallback, useEffect } from 'react';

// ── Platform detection ─────────────────────────────────────────────

const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

// ── Shortcut definitions (shared with UI for tooltip labels) ──────

export interface ShortcutDef {
  /** Unique ID for this shortcut */
  id: string;
  /** Human-readable label */
  label: string;
  /** Display string for Mac (e.g. "⌘B") */
  mac: string;
  /** Display string for Windows/Linux (e.g. "Ctrl+B") */
  win: string;
  /** Category for grouping in docs */
  category: 'panels' | 'tabs' | 'navigation' | 'actions';
}

export const SHORTCUTS: ShortcutDef[] = [
  // Panels
  { id: 'toggle-sidebar', label: 'Toggle sidebar', mac: '⌘B', win: 'Ctrl+B', category: 'panels' },
  { id: 'toggle-bottom', label: 'Toggle bottom panel', mac: '⌘J', win: 'Ctrl+J', category: 'panels' },
  { id: 'toggle-inspector', label: 'Toggle inspector', mac: '⌘\\', win: 'Ctrl+\\', category: 'panels' },

  // Tabs
  { id: 'close-tab', label: 'Close tab', mac: '⌘W', win: 'Ctrl+W', category: 'tabs' },
  { id: 'prev-tab', label: 'Previous tab', mac: '⌘[', win: 'Ctrl+[', category: 'tabs' },
  { id: 'next-tab', label: 'Next tab', mac: '⌘]', win: 'Ctrl+]', category: 'tabs' },
  { id: 'tab-search', label: 'Search tabs', mac: '⌘⇧A', win: 'Ctrl+Shift+A', category: 'tabs' },

  // Navigation
  { id: 'command-palette', label: 'Command palette', mac: '⌘K', win: 'Ctrl+K', category: 'navigation' },
  { id: 'focus-filter', label: 'Focus sidebar filter', mac: '/', win: '/', category: 'navigation' },

  // Actions
  { id: 'save', label: 'Save', mac: '⌘S', win: 'Ctrl+S', category: 'actions' },
  { id: 'new-rule', label: 'New rule', mac: '⌥N', win: 'Alt+N', category: 'actions' },
  { id: 'show-shortcuts', label: 'Keyboard shortcuts', mac: '?', win: '?', category: 'actions' },

  // Focus regions — Option/Alt + 1..4. Cmd/Ctrl+1..9 are intercepted by
  // the browser tab chrome, so we fall back to Option/Alt which ships
  // on every platform and doesn't collide with anything browser-native.
  { id: 'focus-left', label: 'Focus left panel', mac: '⌥1', win: 'Alt+1', category: 'navigation' },
  { id: 'focus-editor', label: 'Focus editor', mac: '⌥2', win: 'Alt+2', category: 'navigation' },
  { id: 'focus-right', label: 'Focus right panel', mac: '⌥3', win: 'Alt+3', category: 'navigation' },
  { id: 'focus-bottom', label: 'Focus bottom panel', mac: '⌥4', win: 'Alt+4', category: 'navigation' },
];

/** Get the platform-appropriate display string for a shortcut */
export function shortcutLabel(id: string): string {
  const def = SHORTCUTS.find((s) => s.id === id);
  if (!def) return '';
  return IS_MAC ? def.mac : def.win;
}

/** Get a shortcut def by ID */
export function getShortcut(id: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.id === id);
}

// ── Callbacks interface ───────────────────────────────────────────

export interface WorkspaceShortcutHandlers {
  onToggleSidebar: () => void;
  onToggleBottomPanel: () => void;
  onToggleInspector: () => void;
  onCloseTab: () => void;
  onPrevTab: () => void;
  onNextTab: () => void;
  onSave: () => void;
  onNewRule: () => void;
  onFocusFilter: () => void;
  onCommandPalette: () => void;
  onShowShortcuts: () => void;
  /**
   * Move keyboard focus into the given shell region. Alt+1..4 dispatches
   * here. The host looks up a well-known focusable element in each region
   * (activity bar icon, tabbed editor, right-panel close button, bottom
   * panel tab row) and calls .focus() on it.
   */
  onFocusRegion: (region: 'left' | 'editor' | 'right' | 'bottom') => void;
  /** Return true if there's a tab to close (prevents Cmd+W from closing browser tab) */
  hasActiveTab: () => boolean;
}

// ── Helper: is the user typing in an input field? ─────────────────

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
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // ── Modifier shortcuts (work even when input focused) ──────

      if (mod && !e.shiftKey && !e.altKey) {
        switch (key) {
          case 'b':
            e.preventDefault();
            handlers.onToggleSidebar();
            return;
          case 'j':
            e.preventDefault();
            handlers.onToggleBottomPanel();
            return;
          case '\\':
            e.preventDefault();
            handlers.onToggleInspector();
            return;
          case 's':
            e.preventDefault();
            handlers.onSave();
            return;
          case 'w':
            if (handlers.hasActiveTab()) {
              e.preventDefault();
              handlers.onCloseTab();
            }
            // If no active tab, let browser close the tab
            return;
          case 'k':
            e.preventDefault();
            handlers.onCommandPalette();
            return;
          case '[':
            e.preventDefault();
            handlers.onPrevTab();
            return;
          case ']':
            e.preventDefault();
            handlers.onNextTab();
            return;
        }
      }

      // ── Alt shortcuts ────────────────────────────────────────
      // Use e.code (physical key) instead of e.key — on macOS, Alt+N produces
      // the dead-key character "ñ" so e.key would be "Dead" or "ñ", not "n".

      if (e.altKey && !mod && !e.shiftKey) {
        if (e.code === 'KeyN') {
          e.preventDefault();
          handlers.onNewRule();
          return;
        }
        // Alt/Option + 1..4 — focus shell regions. Uses e.code so the
        // Mac dead-key remapping of Option+digit doesn't affect detection.
        if (e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          handlers.onFocusRegion('left');
          return;
        }
        if (e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          handlers.onFocusRegion('editor');
          return;
        }
        if (e.code === 'Digit3' || e.code === 'Numpad3') {
          e.preventDefault();
          handlers.onFocusRegion('right');
          return;
        }
        if (e.code === 'Digit4' || e.code === 'Numpad4') {
          e.preventDefault();
          handlers.onFocusRegion('bottom');
          return;
        }
      }

      // Note: Cmd+Shift+A (tab search) is handled in TabBar.tsx

      // ── Single-char shortcuts (only when not in an input) ─────

      if (!mod && !e.shiftKey && !e.altKey && !e.ctrlKey && !isInputFocused()) {
        if (key === '/') {
          e.preventDefault();
          handlers.onFocusFilter();
          return;
        }
      }

      // ? requires shift (Shift+/ on US layout)
      if (!mod && e.shiftKey && !e.altKey && !e.ctrlKey && !isInputFocused()) {
        if (e.code === 'Slash' || key === '?') {
          e.preventDefault();
          handlers.onShowShortcuts();
          return;
        }
      }
    },
    [handlers],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
