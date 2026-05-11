/**
 * Limitations — diagrams.
 *
 *   • LimitationsOverviewDiagram — four-card visual summary of the
 *     gotchas users hit most. Each card mirrors a Callout below
 *     with a glyph + concrete tagline so users can recognise their
 *     symptom before reading any prose.
 */

import type React from 'react';
import { STROKE_BLUE, TEXT, TEXT_DIM } from './_shared';

const ERR_BG = 'var(--ant-color-error-bg)';
const ERR_BORDER = 'var(--ant-color-error-border)';
const ERR = 'var(--ant-color-error)';

export const LimitationsOverviewDiagram: React.FC = () => {
  type Card = {
    title: string;
    /** Tagline split across two lines to fit inside the 142px card. */
    line1: string;
    line2: string;
    /** Small glyph rendered inside a circle in the top-left. */
    glyph: React.ReactNode;
  };

  const CARDS: Card[] = [
    {
      title: 'DevTools blind',
      line1: 'Network tab shows',
      line2: 'the original headers.',
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={ERR}>
          {'</>'}
        </text>
      ),
    },
    {
      title: 'Script reach',
      line1: 'Only fetch / XHR —',
      line2: 'no nav, no static.',
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={ERR}>
          fn
        </text>
      ),
    },
    {
      title: 'Merge scope',
      line1: 'Sees only headers',
      line2: 'set by page code.',
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={ERR}>
          ;,
        </text>
      ),
    },
    {
      title: 'Chrome 128+',
      line1: 'Older browsers',
      line2: 'skip header match.',
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill={ERR}>
          128+
        </text>
      ),
    },
  ];

  const CARD_W = 142;
  const CARD_H = 76;
  const CARD_X = [14, 164] as const;
  const CARD_Y_START = 36;
  const CARD_GAP = 12;

  return (
    <svg
      viewBox="0 0 320 224"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Common limitations — DevTools blind spot for modified headers; script engine only sees fetch/XHR; Merge only sees page-set headers; header matching needs Chrome 128+."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        COMMON GOTCHAS
      </text>

      {CARDS.map((card, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = CARD_X[col];
        const y = CARD_Y_START + row * (CARD_H + CARD_GAP);
        return (
          <g key={card.title}>
            <rect
              x={x}
              y={y}
              width={CARD_W}
              height={CARD_H}
              rx={5}
              fill={ERR_BG}
              stroke={ERR_BORDER}
              strokeDasharray="3 2"
            />
            {/* Glyph circle */}
            <circle cx={x + 18} cy={y + 18} r={11} fill="var(--ant-color-bg-container)" stroke={ERR} />
            <g transform={`translate(${x + 18}, ${y + 18})`}>{card.glyph}</g>
            {/* Title */}
            <text x={x + 34} y={y + 22} fontSize={10} fontWeight={700} fill={TEXT}>
              {card.title}
            </text>
            {/* Tagline — two lines */}
            <text x={x + 10} y={y + 44} fontSize={9} fill={TEXT}>
              {card.line1}
            </text>
            <text x={x + 10} y={y + 56} fontSize={9} fill={TEXT}>
              {card.line2}
            </text>
            <text x={x + 10} y={y + 70} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              See callout below.
            </text>
          </g>
        );
      })}

      <text x={160} y={216} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Each gotcha is also called out inline in the section it affects.
      </text>
    </svg>
  );
};
