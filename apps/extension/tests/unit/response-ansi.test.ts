/**
 * ANSI SGR display laws for the Raw view: detection (`ESC [` in the
 * text, no content-type involvement), the per-line parse (plain-string
 * fast path for escape-free lines, span runs only where a style
 * paints, state carrying across lines), SGR semantics (combos, partial
 * resets, bright/background slots, 256-color and truecolor selectors,
 * colon sub-parameters, malformed-selector safety), non-SGR CSI
 * stripping (display-only — the wire text is never touched), and the
 * theme mapping from runs to CSS.
 *
 * The multi-line fixture mirrors the playground's deterministic
 * `/api/ansi-log` probe (`playground/server/api-binary.ts`) — the e2e
 * sweep drives the same shape through the real viewer.
 */

import {
  type AnsiPalette,
  type AnsiRun,
  ansiRunStyle,
  buildAnsiPalette,
  hasAnsiEscapes,
  parseAnsiBody,
  stripAnsiEscapes,
} from '@openheaders/ui/workbench/components/request-editor/response/response-ansi';
import { describe, expect, it } from 'vitest';

const ESC = '\u001b';

/** The probe body from `playground/server/api-binary.ts`, verbatim. */
const PROBE_BODY = [
  `${ESC}[32mINFO${ESC}[0m  server started on api.openheaders.io:59210`,
  `${ESC}[33;1mWARN${ESC}[0m  cache miss for key "oh_probe"`,
  `${ESC}[31mERROR${ESC}[39m request failed: ${ESC}[1mtimeout${ESC}[22m after 30s`,
  'plain line without any escapes',
  `${ESC}[2K${ESC}[1Aredrawn progress line (cursor controls strip)`,
  `${ESC}[38;5;208morange 256-color${ESC}[0m and ${ESC}[38;2;255;105;180mtruecolor pink${ESC}[0m`,
  `${ESC}[36mcyan span opens here`,
  `and still paints this line before the reset${ESC}[0m`,
  'back to plain',
  '',
].join('\n');

function runsOf(line: string | AnsiRun[]): AnsiRun[] {
  if (typeof line === 'string') throw new Error(`expected style runs, got a plain line: "${line}"`);
  return line;
}

describe('hasAnsiEscapes', () => {
  it('lights on ESC [ regardless of content-type', () => {
    expect(hasAnsiEscapes(`${ESC}[32mgreen${ESC}[0m`)).toBe(true);
    expect(hasAnsiEscapes(PROBE_BODY)).toBe(true);
  });

  it('stays dark for plain text and for a lone ESC without the bracket', () => {
    expect(hasAnsiEscapes('plain log line')).toBe(false);
    expect(hasAnsiEscapes(`odd ${ESC} byte`)).toBe(false);
  });
});

describe('parseAnsiBody — line shapes', () => {
  const lines = parseAnsiBody(PROBE_BODY);

  it('keeps one entry per newline-split line', () => {
    expect(lines).toHaveLength(PROBE_BODY.split('\n').length);
  });

  it('escape-free lines under default state stay plain strings (fast path)', () => {
    expect(lines[3]).toBe('plain line without any escapes');
    expect(lines[8]).toBe('back to plain');
    expect(lines[9]).toBe('');
  });

  it('splits an SGR line into runs with the escapes removed', () => {
    const runs = runsOf(lines[0]);
    expect(runs.map((r) => r.text).join('')).toBe('INFO  server started on api.openheaders.io:59210');
    expect(runs[0]).toMatchObject({ text: 'INFO', style: { fg: { kind: 'basic', index: 2 } } });
    expect(runs[1].style).toBeNull();
  });

  it('applies semicolon combos in one sequence (33;1 = yellow bold)', () => {
    const runs = runsOf(lines[1]);
    expect(runs[0].style).toMatchObject({ fg: { kind: 'basic', index: 3 }, bold: true });
  });

  it('handles partial resets: 39 clears only the color, 22 only intensity', () => {
    const runs = runsOf(lines[2]);
    expect(runs[0]).toMatchObject({ text: 'ERROR', style: { fg: { kind: 'basic', index: 1 }, bold: false } });
    // After 39 the style is default again — the segment needs no span.
    expect(runs[1]).toMatchObject({ text: ' request failed: ', style: null });
    expect(runs[2]).toMatchObject({ text: 'timeout', style: { fg: null, bold: true } });
    expect(runs[3]).toMatchObject({ text: ' after 30s', style: null });
  });

  it('strips non-SGR CSI sequences (erase-line, cursor-up) from display', () => {
    // Under default state the whole line collapses back to a string.
    expect(lines[4]).toBe('redrawn progress line (cursor controls strip)');
  });

  it('resolves 256-color and truecolor selectors', () => {
    const runs = runsOf(lines[5]);
    expect(runs[0].style?.fg).toEqual({ kind: 'rgb', r: 255, g: 135, b: 0 });
    expect(runs[1]).toMatchObject({ text: ' and ', style: null });
    expect(runs[2].style?.fg).toEqual({ kind: 'rgb', r: 255, g: 105, b: 180 });
  });

  it('carries an open style across lines until the reset', () => {
    const cyan = { kind: 'basic', index: 6 };
    expect(runsOf(lines[6])[0]).toMatchObject({ text: 'cyan span opens here', style: { fg: cyan } });
    // The next line has an escape (the reset) but inherits cyan first.
    const runs = runsOf(lines[7]);
    expect(runs[0]).toMatchObject({ text: 'and still paints this line before the reset', style: { fg: cyan } });
  });
});

describe('parseAnsiBody — SGR semantics', () => {
  it('treats an empty parameter list as reset (ESC [ m)', () => {
    const [line] = parseAnsiBody(`${ESC}[31mred${ESC}[mplain`);
    const runs = runsOf(line);
    expect(runs[1]).toMatchObject({ text: 'plain', style: null });
  });

  it('maps bright foregrounds and backgrounds to the upper slots', () => {
    const [line] = parseAnsiBody(`${ESC}[91;104mbright${ESC}[0m`);
    const style = runsOf(line)[0].style;
    expect(style?.fg).toEqual({ kind: 'basic', index: 9 });
    expect(style?.bg).toEqual({ kind: 'basic', index: 12 });
  });

  it('accepts ITU colon sub-parameters (38:5:n)', () => {
    const [line] = parseAnsiBody(`${ESC}[38:5:196mred${ESC}[0m`);
    // Slot 196 of the xterm cube: 16 + 36·5 = pure red.
    expect(runsOf(line)[0].style?.fg).toEqual({ kind: 'rgb', r: 255, g: 0, b: 0 });
  });

  it('resolves 256-color slots below 16 to theme-mapped basic colors', () => {
    const [line] = parseAnsiBody(`${ESC}[38;5;2mgreen${ESC}[0m`);
    expect(runsOf(line)[0].style?.fg).toEqual({ kind: 'basic', index: 2 });
  });

  it('resolves the 256-color grayscale ramp', () => {
    const [line] = parseAnsiBody(`${ESC}[38;5;240mgray${ESC}[0m`);
    expect(runsOf(line)[0].style?.fg).toEqual({ kind: 'rgb', r: 88, g: 88, b: 88 });
  });

  it('drops a malformed extended-color selector without painting garbage', () => {
    const [line] = parseAnsiBody(`${ESC}[38;9mtext`);
    expect(line).toBe('text');
  });

  it('ignores unknown attribute codes instead of misrendering', () => {
    const [line] = parseAnsiBody(`${ESC}[5;31mblink-red${ESC}[0m`);
    const style = runsOf(line)[0].style;
    expect(style?.fg).toEqual({ kind: 'basic', index: 1 });
  });

  it('supports dim, italic, underline, strike, inverse and their resets', () => {
    const [line] = parseAnsiBody(`${ESC}[2;3;4;7;9mall${ESC}[22;23;24;27;29mnone`);
    const runs = runsOf(line);
    expect(runs[0].style).toMatchObject({ dim: true, italic: true, underline: true, inverse: true, strike: true });
    expect(runs[1]).toMatchObject({ text: 'none', style: null });
  });

  it('keeps a lone ESC that starts no CSI verbatim — Raw never invents bytes', () => {
    const [line] = parseAnsiBody(`odd ${ESC} byte`);
    expect(line).toBe(`odd ${ESC} byte`);
  });
});

describe('stripAnsiEscapes', () => {
  it('removes every CSI sequence, SGR and cursor controls alike', () => {
    expect(stripAnsiEscapes(PROBE_BODY.split('\n')[0])).toBe('INFO  server started on api.openheaders.io:59210');
    expect(stripAnsiEscapes(`${ESC}[2K${ESC}[1Aredrawn`)).toBe('redrawn');
  });

  it('leaves plain text untouched', () => {
    expect(stripAnsiEscapes('plain line')).toBe('plain line');
  });
});

describe('theme mapping', () => {
  const palette: AnsiPalette = buildAnsiPalette({
    colorText: '#111',
    colorTextSecondary: '#444',
    colorTextTertiary: '#777',
    colorFill: '#eee',
    colorFillSecondary: '#ddd',
    colorFillTertiary: '#ccc',
    colorBgContainer: '#fff',
    red2: '#fee',
    red3: '#fdd',
    red5: '#f66',
    red6: '#f33',
    green2: '#efe',
    green3: '#dfd',
    green5: '#6f6',
    green6: '#3f3',
    gold2: '#ffe',
    gold3: '#ffd',
    gold5: '#ff6',
    gold6: '#ff3',
    blue2: '#eef',
    blue3: '#ddf',
    blue5: '#66f',
    blue6: '#33f',
    magenta2: '#fef',
    magenta3: '#fdf',
    magenta5: '#f6f',
    magenta6: '#f3f',
    cyan2: '#eff',
    cyan3: '#dff',
    cyan5: '#6ff',
    cyan6: '#3ff',
  });

  function styleOf(sgr: string) {
    const [line] = parseAnsiBody(`${ESC}[${sgr}mx`);
    const style = runsOf(line)[0].style;
    expect(style).not.toBeNull();
    if (style === null) throw new Error('unreachable');
    return ansiRunStyle(style, palette);
  }

  it('maps basic slots through the theme ramps, fg and bg separately', () => {
    expect(styleOf('31')).toMatchObject({ color: '#f33' });
    expect(styleOf('92')).toMatchObject({ color: '#6f6' });
    expect(styleOf('41')).toMatchObject({ backgroundColor: '#fee' });
    expect(styleOf('104')).toMatchObject({ backgroundColor: '#ddf' });
  });

  it('paints rgb selectors literally — they name absolute colors', () => {
    expect(styleOf('38;2;255;105;180')).toMatchObject({ color: 'rgb(255, 105, 180)' });
  });

  it('maps attributes to CSS: bold, dim, italic, decorations', () => {
    expect(styleOf('1')).toMatchObject({ fontWeight: 600 });
    expect(styleOf('2')).toMatchObject({ opacity: 0.65 });
    expect(styleOf('3')).toMatchObject({ fontStyle: 'italic' });
    expect(styleOf('4;9')).toMatchObject({ textDecoration: 'underline line-through' });
  });

  it('inverse swaps against the theme defaults when no colors are set', () => {
    expect(styleOf('7')).toMatchObject({ color: '#fff', backgroundColor: '#111' });
    expect(styleOf('31;7')).toMatchObject({ color: '#fff', backgroundColor: '#f33' });
  });
});
