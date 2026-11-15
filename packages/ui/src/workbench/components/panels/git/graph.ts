/**
 * The log graph's lane palette. The layout is core's and the host's: a
 * row arrives with its cell laid out and its colours as palette NUMBERS
 * (`log-cell.ts`, `log-sifted-window.ts`); what a number looks like is
 * the theme's, through these tokens.
 */

/** The lane palette — per-theme tokens (`--oh-git-lane-N`); index = the layout's colour number. */
export const GRAPH_LANE_COLORS = [
  'var(--oh-git-lane-0)',
  'var(--oh-git-lane-1)',
  'var(--oh-git-lane-2)',
  'var(--oh-git-lane-3)',
  'var(--oh-git-lane-4)',
  'var(--oh-git-lane-5)',
  'var(--oh-git-lane-6)',
  'var(--oh-git-lane-7)',
] as const;
