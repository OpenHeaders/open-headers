/**
 * Chord recording for the Keymap pane (and KeybindingField).
 *
 * The capture hook must normalize keystrokes exactly the way the window
 * shortcut loop matches them (`buildChordsFromEvent`): shifted
 * punctuation keeps its event-key form ("shift+?"), macOS Option
 * dead-key artifacts fall back to the code-derived key ("alt+f"), and
 * pure modifier presses keep recording armed.
 */

import { pickCaptureChord, useChordCapture } from '@openheaders/ui/workbench/settings/fields/use-chord-capture';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function press(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { ...init, cancelable: true }));
}

describe('pickCaptureChord', () => {
  it('prefers the event-key chord when its key is printable ASCII', () => {
    expect(pickCaptureChord(['shift+?', 'shift+/'])).toBe('shift+?');
    expect(pickCaptureChord(['mod+shift+k'])).toBe('mod+shift+k');
  });

  it('falls back to the code-derived chord on dead-key artifacts', () => {
    expect(pickCaptureChord(['alt+ï', 'alt+f'])).toBe('alt+f');
  });

  it('returns null when no candidate is usable', () => {
    expect(pickCaptureChord([])).toBeNull();
    expect(pickCaptureChord(['alt+ï'])).toBeNull();
  });
});

describe('useChordCapture', () => {
  it('captures a chord, commits it, and leaves record mode', () => {
    const onChord = vi.fn();
    const { result } = renderHook(() => useChordCapture(onChord));

    act(() => result.current.start());
    expect(result.current.recording).toBe(true);

    act(() => press({ key: 'k', code: 'KeyK', metaKey: true, shiftKey: true }));
    expect(onChord).toHaveBeenCalledWith('mod+shift+k');
    expect(result.current.recording).toBe(false);
  });

  it('normalizes macOS Option dead keys via the event code', () => {
    const onChord = vi.fn();
    const { result } = renderHook(() => useChordCapture(onChord));

    act(() => result.current.start());
    act(() => press({ key: 'ï', code: 'KeyF', altKey: true }));
    expect(onChord).toHaveBeenCalledWith('alt+f');
  });

  it('ignores pure modifier presses and stays armed', () => {
    const onChord = vi.fn();
    const { result } = renderHook(() => useChordCapture(onChord));

    act(() => result.current.start());
    act(() => press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }));
    expect(onChord).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(true);
  });

  it('Escape cancels without committing', () => {
    const onChord = vi.fn();
    const { result } = renderHook(() => useChordCapture(onChord));

    act(() => result.current.start());
    act(() => press({ key: 'Escape', code: 'Escape' }));
    expect(onChord).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
  });

  it('does nothing while not recording', () => {
    const onChord = vi.fn();
    renderHook(() => useChordCapture(onChord));
    act(() => press({ key: 's', code: 'KeyS', metaKey: true }));
    expect(onChord).not.toHaveBeenCalled();
  });
});
