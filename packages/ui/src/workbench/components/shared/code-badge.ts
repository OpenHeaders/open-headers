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

export function codeBadge(code: string): React.ReactNode {
  return createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        width: 48,
        flexShrink: 0,
        backgroundImage: 'linear-gradient(180deg, var(--rule-code-from, #6b7689), var(--rule-code-to, #3d4456))',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
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
