/**
 * useKeyboardShortcuts — registers global keyboard shortcuts for the v5 shell.
 *
 * Shortcuts:
 *   ⌘B         Toggle left sidebar
 *   ⌘J         Toggle bottom panel
 *   ⌥⌘\        Toggle right sidebar (inspector)
 *   ⌘K         Open command palette
 *   ⌘N         New request
 *   ⇧⌘N        New rule
 *   ⌘,         Open settings
 *   ⌘[         Navigate back
 *   ⌘]         Navigate forward
 */

import { useEffect } from 'react';

export interface ShortcutHandlers {
  onToggleSidebar: () => void;
  onToggleBottomPanel: () => void;
  onToggleInspector: () => void;
  onCommandPalette: () => void;
  onOpenSettings?: () => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onSave?: () => void;
  onToggleWorkbench?: () => void;
  onToggleResponseLayout?: () => void;
  onResetLayout?: () => void;
  onSwapSidebars?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow ⌘K even in inputs (command palette)
        if (e.key !== 'k') return;
      }

      switch (e.key) {
        case 'b':
          if (!e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onToggleSidebar();
          }
          break;
        case 'j':
          if (!e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onToggleBottomPanel();
          }
          break;
        case '\\':
          if (e.altKey) {
            e.preventDefault();
            handlers.onToggleInspector();
          }
          break;
        case 'k':
          if (!e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onCommandPalette();
          }
          break;
        case ',':
          if (!e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onOpenSettings?.();
          }
          break;
        case 's':
          if (e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onSwapSidebars?.();
          } else if (!e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onSave?.();
          }
          break;
        case 'v':
          if (e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onToggleResponseLayout?.();
          }
          break;
        case 'm':
          if (e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onToggleWorkbench?.();
          }
          break;
        case 'r':
          if (e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onResetLayout?.();
          }
          break;
        case 'n':
          if (e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onNewRule?.();
          } else if (!e.shiftKey && !e.altKey) {
            e.preventDefault();
            handlers.onNewRequest?.();
          }
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
