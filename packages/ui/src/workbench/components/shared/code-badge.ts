/**
 * codeBadge — the fixed-width monospace text badge that stands in for a
 * line glyph in every create/picker menu. A neutral gradient fill (no
 * hue) keeps it from reading as a status/scope color, and the fixed slot
 * keeps labels aligned across codes of different length.
 *
 * Shared by the rule-type menus (`rule-type-menu.tsx`) and the
 * request-kind menus (`request-kind-menu.tsx`) — its own tiny module so
 * neither has to import the other's heavier surface (Ant icons,
 * templates) just to draw a badge.
 */

import type React from 'react';
import { createElement } from 'react';

const NEUTRAL_FILL = {
  backgroundImage: 'linear-gradient(180deg, var(--rule-code-from, #6b7689), var(--rule-code-to, #3d4456))',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
} as const;

/** `width` — the slot's fixed width; 48 fits the six-character rule
 *  codes, the four-character request kinds sit tighter at 36. `color`
 *  — a solid tint in place of the neutral gradient, where the badge
 *  stands for a kind that has its own (the Scripts rail's headers). */
export function codeBadge(code: string, width = 48, color?: string): React.ReactNode {
  return createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        width,
        flexShrink: 0,
        ...(color === undefined ? NEUTRAL_FILL : { color }),
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.03em',
        lineHeight: 1,
      },
    },
    code,
  );
}
