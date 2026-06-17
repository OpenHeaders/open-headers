/**
 * useDebugModeShortcut — one global keydown listener that toggles debug
 * mode (`inspection.cdpEnabled`) from every surface that mounts the
 * DebugModePill: popup, side panel, workbench, and the DevTools panel.
 *
 * The DevTools panel has no shortcut registry, so binding this in the
 * shared control (rather than per-surface dispatchers) is what makes the
 * toggle reach all four surfaces from a single place. The chord is read
 * live from `keyboard.toggleDebugMode`, so rebinding in Settings →
 * Keyboard takes effect without a reload, and it's matched through the
 * same `buildChordsFromEvent` helper the other shortcut loops use (so
 * `mod` resolves to ⌘/Ctrl per platform and macOS dead keys still work).
 *
 * Inert where the host can't drive the debugging protocol, and ignored
 * while a text input / editor has focus.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { buildChordsFromEvent } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { get as getSetting, set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { useEffect } from 'react';

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable;
}

function readToggleChord(): string {
  try {
    const value = getSetting('keyboard.toggleDebugMode');
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export function useDebugModeShortcut(): void {
  useEffect(() => {
    if (!hasCapability('cdpInspection')) return;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isInputFocused()) return;
      const chord = readToggleChord();
      if (!chord || !buildChordsFromEvent(e).includes(chord)) return;
      e.preventDefault();
      setSetting('inspection.cdpEnabled', !getSetting('inspection.cdpEnabled'));
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
