/**
 * Semantic styling — the TUI design §5.1: one semantic system rendered
 * per color tier. Truecolor maps to the workbench's exact status
 * palette so the embedded pane sits color-true inside the app; 256/16
 * snap to named ANSI slots (roles, never hex) so user themes keep
 * working; the `none` tier emits no SGR at all — text markers carry
 * the meaning alone. Selection is reverse video at every tier.
 */

import type { ColorTier } from './capability';

export type Semantic = 'ok' | 'warn' | 'error' | 'dim' | 'accent';

export const RESET = '\x1b[0m';
export const REVERSE = '\x1b[7m';
export const BOLD = '\x1b[1m';

interface SemanticCodes {
  /** 24-bit `r;g;b` of the workbench status token. */
  readonly truecolor: string;
  /** xterm-256 palette index nearest the token. */
  readonly ansi256: number;
  /** Basic named slot — the terminal theme defines the actual color. */
  readonly ansi16: number;
}

const SEMANTIC_CODES: Readonly<Record<Semantic, SemanticCodes>> = {
  ok: { truecolor: '82;196;26', ansi256: 76, ansi16: 32 },
  warn: { truecolor: '250;173;20', ansi256: 214, ansi16: 33 },
  error: { truecolor: '255;77;79', ansi256: 203, ansi16: 31 },
  dim: { truecolor: '140;140;140', ansi256: 245, ansi16: 90 },
  accent: { truecolor: '22;119;255', ansi256: 33, ansi16: 36 },
};

export function colorCode(semantic: Semantic, tier: ColorTier): string {
  if (tier === 'none') return '';
  const codes = SEMANTIC_CODES[semantic];
  if (tier === 'truecolor') return `\x1b[38;2;${codes.truecolor}m`;
  if (tier === '256') return `\x1b[38;5;${codes.ansi256}m`;
  return `\x1b[${codes.ansi16}m`;
}

/** Wrap `text` in a semantic color for the tier; identity on the `none` tier. */
export function paint(text: string, semantic: Semantic, tier: ColorTier): string {
  const code = colorCode(semantic, tier);
  return code === '' ? text : `${code}${text}${RESET}`;
}

/** Bold survives every tier except `none` (design §5.1 focused-pane row). */
export function bold(text: string, tier: ColorTier): string {
  return tier === 'none' ? text : `${BOLD}${text}${RESET}`;
}

/** Reverse video — position marking, valid at every tier including `none`. */
export function reverse(text: string): string {
  return `${REVERSE}${text}${RESET}`;
}
