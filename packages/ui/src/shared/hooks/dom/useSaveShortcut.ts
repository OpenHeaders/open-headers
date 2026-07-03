/**
 * Save-shortcut listener for layered editing surfaces — Cmd/Ctrl+S
 * saves regardless of focused element while the surface is mounted.
 * The caller assigns `handleSaveRef` each render: the current save
 * closure when saveable, null otherwise.
 *
 * Surfaces stack (a rule quick-editor popover with a variable popover
 * on top), and each used to attach its own window listener — one
 * keystroke then saved EVERY layer at once. A module-level claim stack
 * fixes that: every mounted hook registers, and only the most recently
 * mounted claimant receives the chord. It owns the chord outright —
 * an unsaveable top layer swallows the keystroke rather than letting
 * it fall through and save a layer the user isn't looking at.
 */

import { buildChordsFromEvent, useShortcutLabel } from '@openheaders/ui/workbench/hooks/useWorkspaceShortcuts';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { type RefObject, useEffect, useRef } from 'react';

const claimants: RefObject<(() => void) | null>[] = [];

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
    claimants.push(handleSaveRef);
    return () => {
      const i = claimants.indexOf(handleSaveRef);
      if (i !== -1) claimants.splice(i, 1);
    };
  }, []);
  useEffect(() => {
    if (typeof saveChord !== 'string' || !saveChord) return;
    const onKey = (e: KeyboardEvent) => {
      const chords = buildChordsFromEvent(e);
      if (!chords.includes(saveChord)) return;
      // A later-mounted layer owns the chord — leave the event to it.
      if (claimants[claimants.length - 1] !== handleSaveRef) return;
      e.preventDefault();
      e.stopPropagation();
      handleSaveRef.current?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [saveChord]);
  return { saveLabel, handleSaveRef };
}
