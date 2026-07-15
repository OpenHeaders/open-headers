/**
 * useChordCapture — shared chord-recording hook for keybinding UI.
 *
 * Enter record mode, capture the next keystroke as a normalized chord
 * string ("mod+shift+k"), and hand it to the caller. Escape cancels
 * without committing. Chord normalization reuses the exact event →
 * chord logic the window shortcut loop matches with
 * (`buildChordsFromEvent`), so a recorded chord always round-trips
 * through the dispatcher.
 */

import { useCallback, useEffect, useState } from 'react';
import { buildChordsFromEvent } from '../../hooks/useWorkspaceShortcuts';

function isPrintableAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

/**
 * Pick the chord to persist from the candidates one keystroke produced.
 *
 * `buildChordsFromEvent` yields the `event.key` chord first and a
 * layout-independent `event.code` fallback second. The key chord is
 * preferred — it preserves shifted punctuation ("shift+?" rather than
 * "shift+/") and therefore matches the registry defaults — unless
 * composition turned it into a non-ASCII artifact (macOS Option dead
 * keys: Option+F reads as "ï"), in which case the code-derived chord
 * wins. Returns null for pure-modifier presses and unusable keys, so
 * recording stays armed until a real chord lands.
 */
export function pickCaptureChord(chords: readonly string[]): string | null {
  for (const chord of chords) {
    const key = chord.split('+').pop() ?? '';
    if (key.length > 0 && isPrintableAscii(key)) return chord;
  }
  return null;
}

export interface ChordCapture {
  recording: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useChordCapture(onChord: (chord: string) => void): ChordCapture {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setRecording(false);
        return;
      }
      const chord = pickCaptureChord(buildChordsFromEvent(e));
      if (!chord) return;
      e.preventDefault();
      // Keep the keystroke out of the window shortcut loop — recording
      // "mod+s" must not also trigger Save.
      e.stopPropagation();
      onChord(chord);
      setRecording(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [recording, onChord]);

  const start = useCallback(() => setRecording(true), []);
  const stop = useCallback(() => setRecording(false), []);
  const toggle = useCallback(() => setRecording((r) => !r), []);
  return { recording, start, stop, toggle };
}
