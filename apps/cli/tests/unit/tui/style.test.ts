/**
 * Semantic styling — per-tier SGR emission and the `none` tier's
 * no-color guarantee (markers carry meaning alone).
 */

import { describe, expect, it } from 'vitest';
import { visibleWidth } from '../../../src/tui/screen';
import { bold, colorCode, paint, reverse } from '../../../src/tui/style';

describe('style', () => {
  it('paints per tier: truecolor 38;2, 256 38;5, 16 basic, none bare', () => {
    expect(paint('x', 'ok', 'truecolor')).toBe('\x1b[38;2;82;196;26mx\x1b[0m');
    expect(paint('x', 'error', '256')).toBe('\x1b[38;5;203mx\x1b[0m');
    expect(paint('x', 'warn', '16')).toBe('\x1b[33mx\x1b[0m');
    expect(paint('x', 'accent', 'none')).toBe('x');
    expect(colorCode('dim', 'none')).toBe('');
  });

  it('bold is suppressed on the none tier; reverse survives every tier', () => {
    expect(bold('t', 'none')).toBe('t');
    expect(bold('t', '16')).toBe('\x1b[1mt\x1b[0m');
    expect(reverse('sel')).toBe('\x1b[7msel\x1b[0m');
  });

  it('styled output measures at its text width (SGR passes uncounted)', () => {
    expect(visibleWidth(paint('abc', 'ok', 'truecolor'))).toBe(3);
    expect(visibleWidth(reverse(bold('ab', '256')))).toBe(2);
  });
});
