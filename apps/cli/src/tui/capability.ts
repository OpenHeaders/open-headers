/**
 * Terminal capability probe — the TUI design §5: the four color tiers
 * (truecolor → 256 → 16 → none) and the unicode/ASCII glyph set. A
 * pure function of the environment plus the `--no-color`/`--ascii`
 * flags. Meaning survives every rung: glyphs are reinforcement, so
 * composers pair every dot with its text marker (`● on`, never `●`).
 */

export type ColorTier = 'truecolor' | '256' | '16' | 'none';

export interface BorderGlyphs {
  readonly topLeft: string;
  readonly topRight: string;
  readonly bottomLeft: string;
  readonly bottomRight: string;
  readonly horizontal: string;
  readonly vertical: string;
}

/** The design §5.2 glyph table — one entry per element row. */
export interface GlyphSet {
  readonly borders: BorderGlyphs;
  readonly dotOn: string;
  readonly dotOff: string;
  readonly dotDraft: string;
  readonly dotError: string;
  readonly selected: string;
  readonly separator: string;
  readonly ellipsis: string;
  readonly keyEnter: string;
  readonly keySpace: string;
  readonly keyTab: string;
  readonly keyPageUp: string;
  readonly keyPageDown: string;
}

export interface TerminalCapabilities {
  readonly colorTier: ColorTier;
  readonly unicode: boolean;
  readonly glyphs: GlyphSet;
}

export interface CapabilityFlags {
  readonly noColor?: boolean;
  readonly ascii?: boolean;
}

export type EnvLike = Readonly<Record<string, string | undefined>>;

export const UNICODE_GLYPHS: GlyphSet = {
  borders: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  dotOn: '●',
  dotOff: '○',
  dotDraft: '◐',
  dotError: '✕',
  selected: '▸',
  separator: '·',
  ellipsis: '…',
  keyEnter: '⏎',
  keySpace: '␣',
  keyTab: '⇥',
  keyPageUp: '⇞',
  keyPageDown: '⇟',
};

export const ASCII_GLYPHS: GlyphSet = {
  borders: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
  },
  dotOn: '*',
  dotOff: 'o',
  dotDraft: '~',
  dotError: 'x',
  selected: '>',
  separator: '-',
  ellipsis: '..',
  keyEnter: 'enter',
  keySpace: 'space',
  keyTab: 'tab',
  keyPageUp: 'pgup',
  keyPageDown: 'pgdn',
};

export function detectColorTier(env: EnvLike, flags?: CapabilityFlags): ColorTier {
  if (flags?.noColor === true || env.NO_COLOR !== undefined) return 'none';
  const term = env.TERM ?? '';
  if (term === 'dumb') return 'none';
  const colorterm = (env.COLORTERM ?? '').toLowerCase();
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor';
  if (term.includes('256color')) return '256';
  return '16';
}

export function detectUnicode(env: EnvLike, flags?: CapabilityFlags): boolean {
  if (flags?.ascii === true) return false;
  // POSIX precedence; an empty value counts as unset and falls through.
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || '';
  return /utf-?8/i.test(locale);
}

export function detectCapabilities(env: EnvLike, flags?: CapabilityFlags): TerminalCapabilities {
  const unicode = detectUnicode(env, flags);
  return {
    colorTier: detectColorTier(env, flags),
    unicode,
    glyphs: unicode ? UNICODE_GLYPHS : ASCII_GLYPHS,
  };
}
