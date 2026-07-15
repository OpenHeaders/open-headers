/**
 * Chord string → Monaco keybinding number conversion.
 *
 * The KeyMod / KeyCode values are injected (the converter never
 * imports the Monaco runtime); the stubs below carry Monaco's real
 * encoding so the composed numbers match what a mounted instance
 * would produce.
 */

import { chordToMonacoKeybinding } from '@openheaders/ui/workbench/components/monaco/chord-keybinding';
import { describe, expect, it } from 'vitest';
import { KeyCode, KeyMod } from '../helpers/monaco-key-enums';

function convert(chord: string): number | null {
  return chordToMonacoKeybinding(chord, KeyMod, KeyCode);
}

describe('chordToMonacoKeybinding', () => {
  it('converts a bare key', () => {
    expect(convert('f')).toBe(KeyCode.KeyF);
    expect(convert('/')).toBe(KeyCode.Slash);
    expect(convert('3')).toBe(KeyCode.Digit3);
  });

  it('composes modifiers onto the key', () => {
    expect(convert('mod+f')).toBe(KeyMod.CtrlCmd | KeyCode.KeyF);
    expect(convert('shift+alt+f')).toBe(KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF);
    expect(convert('mod+alt+f')).toBe(KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyF);
    expect(convert('mod+shift+i')).toBe(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI);
  });

  it('maps explicit ctrl to WinCtrl, not CtrlCmd', () => {
    expect(convert('ctrl+k')).toBe(KeyMod.WinCtrl | KeyCode.KeyK);
  });

  it('handles named keys and punctuation', () => {
    expect(convert('mod+[')).toBe(KeyMod.CtrlCmd | KeyCode.BracketLeft);
    expect(convert("mod+'")).toBe(KeyMod.CtrlCmd | KeyCode.Quote);
    expect(convert('alt+left')).toBe(KeyMod.Alt | KeyCode.LeftArrow);
    expect(convert('mod+enter')).toBe(KeyMod.CtrlCmd | KeyCode.Enter);
    expect(convert('shift+space')).toBe(KeyMod.Shift | KeyCode.Space);
  });

  it('is case-insensitive over the stored chord', () => {
    expect(convert('Mod+Shift+K')).toBe(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyK);
  });

  it('returns null for empty, modifier-only, and unknown-key chords', () => {
    expect(convert('')).toBeNull();
    expect(convert('mod')).toBeNull();
    expect(convert('mod+shift')).toBeNull();
    expect(convert('mod+ï')).toBeNull();
    expect(convert('mod+f13')).toBeNull();
    expect(convert('bogus+f')).toBeNull();
  });
});
