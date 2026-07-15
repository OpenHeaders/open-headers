/**
 * ANSI SGR rendering for the response body pane's Raw view. Log
 * endpoints (k8s pod logs, service log streams) embed SGR color
 * escapes; ESC is valid UTF-8, so the body stays a text capture and
 * Raw would otherwise show `[32m` noise on every line.
 *
 * Display-only, like every viewer concern: the capture bytes and the
 * Copy body stay the wire text; this module only decides what the Raw
 * view PAINTS. SGR sequences (final byte `m`) become style runs;
 * non-SGR CSI sequences (cursor movement, line erase) are stripped
 * from the display — the Hex view keeps showing every byte verbatim.
 *
 * Perf shape (the Raw view's law): one linear pass over the body,
 * memoized by the caller. Lines without escapes stay plain strings —
 * the render path keeps them on the existing single-text-node span;
 * only lines that carry escapes (or inherit a live style from a
 * previous line) split into per-run spans.
 */

import type { GlobalToken } from 'antd';
import type { CSSProperties } from 'react';

/** A resolved SGR color: one of the 16 basic slots (theme-mapped at
 *  render time) or a literal rgb the server asked for (256-color cube
 *  and truecolor resolve here — they name absolute colors, not theme
 *  roles). */
export type AnsiColor = { kind: 'basic'; index: number } | { kind: 'rgb'; r: number; g: number; b: number };

export interface AnsiStyle {
  fg: AnsiColor | null;
  bg: AnsiColor | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  inverse: boolean;
}

/** One styled segment of a line; `style: null` marks the default style
 *  (render as plain text, no wrapping span). */
export interface AnsiRun {
  text: string;
  style: AnsiStyle | null;
}

/** A parsed display line: a plain string when nothing on it needs
 *  styling (the fast path — most log lines), else its style runs. */
export type AnsiLine = string | AnsiRun[];

const DEFAULT_STYLE: AnsiStyle = Object.freeze({
  fg: null,
  bg: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strike: false,
  inverse: false,
});

/** CSI: ESC `[` params (0x30–0x3F), intermediates (0x20–0x2F), final
 *  (0x40–0x7E). SGR is the `m` final with no intermediates; everything
 *  else strips from display. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the ESC control character is the subject matter
const CSI_RE = /\u001b\[([0-9;:<=>?]*)([ -/]*)([@-~])/g;

/** Lights the Raw view's ANSI rendering — presence of `ESC [` in the
 *  display text; content-type plays no part (locked in the plan). */
export function hasAnsiEscapes(text: string): boolean {
  return text.includes('\u001b[');
}

/** Every CSI sequence removed — the >gutter-cap fallback's display
 *  text, which must stay one text node. */
export function stripAnsiEscapes(text: string): string {
  CSI_RE.lastIndex = 0;
  return text.replace(CSI_RE, '');
}

function styleIsDefault(style: AnsiStyle): boolean {
  return (
    style.fg === null &&
    style.bg === null &&
    !style.bold &&
    !style.dim &&
    !style.italic &&
    !style.underline &&
    !style.strike &&
    !style.inverse
  );
}

/** xterm 256-color slot → resolved color. 0–15 stay theme-mapped basic
 *  slots; 16–231 is the 6×6×6 cube; 232–255 the grayscale ramp. */
function color256(n: number): AnsiColor | null {
  if (!Number.isInteger(n) || n < 0 || n > 255) return null;
  if (n < 16) return { kind: 'basic', index: n };
  if (n < 232) {
    const cube = n - 16;
    const level = (v: number): number => (v === 0 ? 0 : 55 + v * 40);
    return {
      kind: 'rgb',
      r: level(Math.floor(cube / 36)),
      g: level(Math.floor(cube / 6) % 6),
      b: level(cube % 6),
    };
  }
  const gray = 8 + 10 * (n - 232);
  return { kind: 'rgb', r: gray, g: gray, b: gray };
}

function colorRgb(r: number, g: number, b: number): AnsiColor | null {
  const ok = (v: number): boolean => Number.isInteger(v) && v >= 0 && v <= 255;
  return ok(r) && ok(g) && ok(b) ? { kind: 'rgb', r, g, b } : null;
}

/** Extended color payload after a 38/48 selector: `5;n` (256-color) or
 *  `2;r;g;b` (truecolor). Returns the parameter count consumed, 0 when
 *  the payload is malformed (the rest of the sequence is dropped —
 *  applying half a color spec would paint garbage). */
function applyExtendedColor(style: AnsiStyle, target: 'fg' | 'bg', args: number[]): number {
  if (args[0] === 5 && args.length >= 2) {
    const color = color256(args[1]);
    if (color) style[target] = color;
    return 2;
  }
  if (args[0] === 2 && args.length >= 4) {
    const color = colorRgb(args[1], args[2], args[3]);
    if (color) style[target] = color;
    return 4;
  }
  return 0;
}

/** One plain SGR code against a mutable draft style. */
function applyCode(style: AnsiStyle, code: number): void {
  if (code === 0) Object.assign(style, DEFAULT_STYLE);
  else if (code === 1) style.bold = true;
  else if (code === 2) style.dim = true;
  else if (code === 3) style.italic = true;
  else if (code === 4) style.underline = true;
  else if (code === 7) style.inverse = true;
  else if (code === 9) style.strike = true;
  else if (code === 22) {
    style.bold = false;
    style.dim = false;
  } else if (code === 23) style.italic = false;
  else if (code === 24) style.underline = false;
  else if (code === 27) style.inverse = false;
  else if (code === 29) style.strike = false;
  else if (code >= 30 && code <= 37) style.fg = { kind: 'basic', index: code - 30 };
  else if (code === 39) style.fg = null;
  else if (code >= 40 && code <= 47) style.bg = { kind: 'basic', index: code - 40 };
  else if (code === 49) style.bg = null;
  else if (code >= 90 && code <= 97) style.fg = { kind: 'basic', index: code - 90 + 8 };
  else if (code >= 100 && code <= 107) style.bg = { kind: 'basic', index: code - 100 + 8 };
  // Unknown codes are no-ops — logs carry the occasional exotic
  // attribute (blink, fonts); ignoring beats misrendering.
}

/** Fold one SGR parameter string into a style. Accepts both separator
 *  conventions: classic semicolons (`38;5;208`) and ITU colon
 *  sub-parameters (`38:5:208`). An empty parameter list is reset, per
 *  the spec (`ESC [ m`). */
function applySgr(style: AnsiStyle, params: string): AnsiStyle {
  const next: AnsiStyle = { ...style };
  const parts = params === '' ? ['0'] : params.split(';');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.includes(':')) {
      const sub = part.split(':').map(Number);
      if (sub[0] === 38 || sub[0] === 48) applyExtendedColor(next, sub[0] === 38 ? 'fg' : 'bg', sub.slice(1));
      else if (Number.isInteger(sub[0])) applyCode(next, sub[0]);
      continue;
    }
    const code = part === '' ? 0 : Number(part);
    if (!Number.isInteger(code)) continue;
    if (code === 38 || code === 48) {
      const consumed = applyExtendedColor(next, code === 38 ? 'fg' : 'bg', parts.slice(i + 1).map(Number));
      if (consumed === 0) break;
      i += consumed;
    } else {
      applyCode(next, code);
    }
  }
  return next;
}

/**
 * Parse the Raw display text into per-line runs, one linear pass. SGR
 * state carries across lines (a color opened on one line paints the
 * next until reset — how real log streams behave); a line with no
 * escapes under default state stays a plain string, the render fast
 * path. Non-SGR CSI sequences vanish from the runs. A lone ESC that
 * starts no CSI stays in the text verbatim — Raw never invents bytes.
 */
export function parseAnsiBody(text: string): AnsiLine[] {
  const out: AnsiLine[] = [];
  let style = DEFAULT_STYLE;
  let isDefault = true;
  for (const line of text.split('\n')) {
    if (!line.includes('\u001b')) {
      out.push(isDefault || line === '' ? line : [{ text: line, style }]);
      continue;
    }
    const runs: AnsiRun[] = [];
    let at = 0;
    let styled = false;
    CSI_RE.lastIndex = 0;
    let m = CSI_RE.exec(line);
    while (m !== null) {
      if (m.index > at) {
        runs.push({ text: line.slice(at, m.index), style: isDefault ? null : style });
        styled ||= !isDefault;
      }
      at = m.index + m[0].length;
      if (m[3] === 'm' && m[2] === '') {
        style = applySgr(style, m[1]);
        isDefault = styleIsDefault(style);
      }
      m = CSI_RE.exec(line);
    }
    if (at < line.length) {
      runs.push({ text: line.slice(at), style: isDefault ? null : style });
      styled ||= !isDefault;
    }
    out.push(styled ? runs : runs.map((r) => r.text).join(''));
  }
  return out;
}

/** The 16 basic slots resolved against the active antd theme — fg and
 *  bg each get their own ramp so colored text stays readable and
 *  colored backgrounds stay a tint under default ink, in both themes. */
export interface AnsiPalette {
  fg: string[];
  bg: string[];
  defaultFg: string;
  defaultBg: string;
}

/** The token slice the palette reads — structural, so tests can hand
 *  in a literal instead of a full theme. */
export type AnsiThemeToken = Pick<
  GlobalToken,
  | 'colorText'
  | 'colorTextSecondary'
  | 'colorTextTertiary'
  | 'colorFill'
  | 'colorFillSecondary'
  | 'colorFillTertiary'
  | 'colorBgContainer'
  | `${'red' | 'green' | 'gold' | 'blue' | 'magenta' | 'cyan'}${'2' | '3' | '5' | '6'}`
>;

export function buildAnsiPalette(token: AnsiThemeToken): AnsiPalette {
  return {
    // black / red / green / yellow / blue / magenta / cyan / white,
    // then the bright half. "Black" and "white" map to theme ink roles
    // (a literal #000 disappears on the dark canvas).
    fg: [
      token.colorText,
      token.red6,
      token.green6,
      token.gold6,
      token.blue6,
      token.magenta6,
      token.cyan6,
      token.colorTextSecondary,
      token.colorTextTertiary,
      token.red5,
      token.green5,
      token.gold5,
      token.blue5,
      token.magenta5,
      token.cyan5,
      token.colorText,
    ],
    bg: [
      token.colorFill,
      token.red2,
      token.green2,
      token.gold2,
      token.blue2,
      token.magenta2,
      token.cyan2,
      token.colorFillSecondary,
      token.colorFillTertiary,
      token.red3,
      token.green3,
      token.gold3,
      token.blue3,
      token.magenta3,
      token.cyan3,
      token.colorFillSecondary,
    ],
    defaultFg: token.colorText,
    defaultBg: token.colorBgContainer,
  };
}

function resolveColor(color: AnsiColor, ramp: string[]): string {
  return color.kind === 'basic' ? ramp[color.index] : `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/** A run's style resolved to CSS against the theme palette. */
export function ansiRunStyle(style: AnsiStyle, palette: AnsiPalette): CSSProperties {
  let fg = style.fg ? resolveColor(style.fg, palette.fg) : null;
  let bg = style.bg ? resolveColor(style.bg, palette.bg) : null;
  if (style.inverse) {
    const swappedFg = bg ?? palette.defaultBg;
    const swappedBg = fg ?? palette.defaultFg;
    fg = swappedFg;
    bg = swappedBg;
  }
  const css: CSSProperties = {};
  if (fg) css.color = fg;
  if (bg) css.backgroundColor = bg;
  if (style.bold) css.fontWeight = 600;
  if (style.dim) css.opacity = 0.65;
  if (style.italic) css.fontStyle = 'italic';
  const decorations = [style.underline ? 'underline' : null, style.strike ? 'line-through' : null].filter(
    (d) => d !== null,
  );
  if (decorations.length > 0) css.textDecoration = decorations.join(' ');
  return css;
}
