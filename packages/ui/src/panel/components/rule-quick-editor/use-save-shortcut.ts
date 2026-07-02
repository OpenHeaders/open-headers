/**
 * Save-shortcut listener for the quick-editor popovers — Cmd/Ctrl+S
 * saves regardless of focused element while the popover is mounted
 * (mirrors the variable popover). The caller assigns `handleSaveRef`
 * each render: the current save closure when saveable, null otherwise.
 */

import { buildChordsFromEvent, useShortcutLabel } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { type RefObject, useEffect, useRef } from 'react';

export interface SaveShortcutApi {
  saveLabel: string;
  /** Set to the save closure when saveable, null otherwise. */
  handleSaveRef: RefObject<(() => void) | null>;
}

export function useSaveShortcut(): SaveShortcutApi {
  const saveLabel = useShortcutLabel('save');
  const saveChord = useSettingValue('keyboard.save');
  const handleSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (typeof saveChord !== 'string' || !saveChord) return;
    const onKey = (e: KeyboardEvent) => {
      const chords = buildChordsFromEvent(e);
      if (chords.includes(saveChord)) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [saveChord]);
  return { saveLabel, handleSaveRef };
}
