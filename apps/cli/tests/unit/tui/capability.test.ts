/**
 * Capability probe — the four color tiers and the unicode/ASCII glyph
 * switch of TUI_DESIGN.md §5, as a pure function of environment plus
 * the --no-color/--ascii flags.
 */

import { describe, expect, it } from 'vitest';
import {
  ASCII_GLYPHS,
  detectCapabilities,
  detectColorTier,
  detectUnicode,
  UNICODE_GLYPHS,
} from '../../../src/tui/capability';

describe('detectColorTier', () => {
  it('COLORTERM=truecolor and 24bit answer the top tier', () => {
    expect(detectColorTier({ COLORTERM: 'truecolor', TERM: 'xterm-256color' })).toBe('truecolor');
    expect(detectColorTier({ COLORTERM: '24bit', TERM: 'xterm' })).toBe('truecolor');
  });

  it('a 256color TERM without COLORTERM answers 256', () => {
    expect(detectColorTier({ TERM: 'xterm-256color' })).toBe('256');
    expect(detectColorTier({ TERM: 'screen-256color' })).toBe('256');
  });

  it('a plain TERM answers 16', () => {
    expect(detectColorTier({ TERM: 'xterm' })).toBe('16');
    expect(detectColorTier({})).toBe('16');
  });

  it('NO_COLOR disables color at any value, beating COLORTERM', () => {
    expect(detectColorTier({ NO_COLOR: '1', COLORTERM: 'truecolor' })).toBe('none');
    expect(detectColorTier({ NO_COLOR: '', COLORTERM: 'truecolor' })).toBe('none');
  });

  it('the --no-color flag and TERM=dumb disable color', () => {
    expect(detectColorTier({ COLORTERM: 'truecolor' }, { noColor: true })).toBe('none');
    expect(detectColorTier({ TERM: 'dumb' })).toBe('none');
  });
});

describe('detectUnicode', () => {
  it('reads UTF-8 from the locale variables in POSIX precedence', () => {
    expect(detectUnicode({ LANG: 'en_US.UTF-8' })).toBe(true);
    expect(detectUnicode({ LC_CTYPE: 'C.utf8', LANG: 'C' })).toBe(true);
    expect(detectUnicode({ LC_ALL: 'C', LC_CTYPE: 'en_US.UTF-8' })).toBe(false);
  });

  it('an empty locale value falls through to the next variable', () => {
    expect(detectUnicode({ LC_ALL: '', LANG: 'en_US.UTF-8' })).toBe(true);
  });

  it('defaults to ASCII without a UTF-8 locale and under --ascii', () => {
    expect(detectUnicode({})).toBe(false);
    expect(detectUnicode({ LANG: 'en_US.UTF-8' }, { ascii: true })).toBe(false);
  });
});

describe('detectCapabilities', () => {
  it('combines tier and glyph set', () => {
    const caps = detectCapabilities({ COLORTERM: 'truecolor', LANG: 'en_US.UTF-8' });
    expect(caps.colorTier).toBe('truecolor');
    expect(caps.unicode).toBe(true);
    expect(caps.glyphs).toBe(UNICODE_GLYPHS);
  });

  it('serves ASCII glyphs without a UTF-8 locale', () => {
    const caps = detectCapabilities({ TERM: 'xterm' });
    expect(caps.glyphs).toBe(ASCII_GLYPHS);
  });
});

describe('glyph tables', () => {
  it('match the design §5.2 rows', () => {
    expect(UNICODE_GLYPHS.dotOn).toBe('●');
    expect(UNICODE_GLYPHS.dotOff).toBe('○');
    expect(UNICODE_GLYPHS.dotDraft).toBe('◐');
    expect(UNICODE_GLYPHS.dotError).toBe('✕');
    expect(UNICODE_GLYPHS.selected).toBe('▸');
    expect(UNICODE_GLYPHS.ellipsis).toBe('…');
    expect(UNICODE_GLYPHS.borders.topLeft).toBe('┌');
    expect(ASCII_GLYPHS.dotOn).toBe('*');
    expect(ASCII_GLYPHS.dotOff).toBe('o');
    expect(ASCII_GLYPHS.dotDraft).toBe('~');
    expect(ASCII_GLYPHS.dotError).toBe('x');
    expect(ASCII_GLYPHS.selected).toBe('>');
    expect(ASCII_GLYPHS.ellipsis).toBe('..');
    expect(ASCII_GLYPHS.borders.vertical).toBe('|');
  });
});
