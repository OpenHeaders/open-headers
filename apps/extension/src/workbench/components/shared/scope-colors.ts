import { createElement } from 'react';

export interface ScopeColorDef {
  /** Dark foreground color — used for the letter and for scope Tags. */
  color: string;
  /** Light tinted background — used inside the badge. */
  bg: string;
  letter: string;
}

export const SCOPE_COLORS = {
  vault:       { color: '#cf1322', bg: '#ffd8d5', letter: 'V' },
  environment: { color: '#007F31', bg: '#E5FFF1', letter: 'E' },
  collection:  { color: '#AD7A03', bg: '#FFF4BE', letter: 'C' },
  workspace:   { color: '#0053B8', bg: '#E7F0FF', letter: 'W' },
  live:        { color: '#531dab', bg: '#f5f0ff', letter: '↻' },
} as const satisfies Record<string, ScopeColorDef>;

export type ScopeKey = keyof typeof SCOPE_COLORS;

/** Colored letter badge — light tinted background with dark foreground letter.
 *  Colors are driven by CSS variables so light/dark theme switches automatically. */
export function scopeBadge(scope: ScopeKey, size = 14): React.ReactNode {
  const { letter } = SCOPE_COLORS[scope];
  return createElement('span', {
    style: {
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.25),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.65,
      fontWeight: 700,
      color: `var(--scope-${scope}-color)`,
      background: `var(--scope-${scope}-bg)`,
      flexShrink: 0,
      lineHeight: 1,
    },
  }, letter);
}
