import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Comparison matrix — four stacked category cards. The first three are
 * the product categories Open Headers competes with; the fourth is us,
 * accented with the brand blue. Each card carries 3–4 attribute rows
 * with ✓ / ✗ glyphs so the trade-off reads at a glance.
 */
export const ComparisonMatrixDiagram: React.FC = () => {
  type Row = { ok: boolean; text: string };
  type Card = { category: string; tag: string; rows: Row[]; us?: boolean };

  const CARDS: Card[] = [
    {
      category: 'SaaS API platforms',
      tag: 'cloud',
      rows: [
        { ok: false, text: 'Your data lives on their servers' },
        { ok: false, text: 'Account + login required' },
        { ok: true, text: 'Broad feature set' },
      ],
    },
    {
      category: 'Desktop proxies',
      tag: 'native',
      rows: [
        { ok: false, text: 'Separate binary to install + run' },
        { ok: false, text: 'CA cert + per-app proxy config' },
        { ok: true, text: 'Sees every kind of traffic' },
      ],
    },
    {
      category: 'Header-only extensions',
      tag: 'lite',
      rows: [
        { ok: true, text: 'In-browser, no setup' },
        { ok: false, text: 'One rule type — headers only' },
        { ok: false, text: 'No scripts, no auth, no body edits' },
      ],
    },
    {
      category: 'Open Headers',
      tag: 'us',
      us: true,
      rows: [
        { ok: true, text: 'In-browser · local-only · no account' },
        { ok: true, text: 'Nine rule types · one condition language' },
        { ok: true, text: 'Scripts + OAuth + files in the extension' },
        { ok: true, text: 'Four surfaces share one store' },
      ],
    },
  ];

  const CARD_X = 14;
  const CARD_W = 292;
  const CARD_GAP = 8;
  const CARD_Y_START = 32;
  const cardHeight = (rows: number) => 22 + rows * 14 + 12;

  let cursorY = CARD_Y_START;

  return (
    <svg
      viewBox="0 0 320 380"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Four category cards comparing SaaS API platforms, desktop proxies, and header-only extensions against Open Headers."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHERE OPEN HEADERS LANDS
      </text>

      {CARDS.map((card) => {
        const h = cardHeight(card.rows.length);
        const y = cursorY;
        cursorY = y + h + CARD_GAP;
        const accent = card.us ? STROKE_BLUE : 'var(--ant-color-border)';
        const accentBg = card.us ? FILL_BLUE : 'var(--ant-color-bg-container)';
        return (
          <g key={card.category}>
            <rect
              x={CARD_X}
              y={y}
              width={CARD_W}
              height={h}
              rx={6}
              fill={card.us ? accentBg : 'var(--ant-color-bg-container)'}
              stroke={accent}
              strokeWidth={card.us ? 1.5 : 1}
            />
            <rect x={CARD_X} y={y + 1} width={4} height={h - 2} rx={2} fill={accent} />

            <text x={CARD_X + 14} y={y + 16} fontSize={11} fontWeight={700} fill={TEXT}>
              {card.category}
            </text>
            <rect
              x={CARD_X + CARD_W - 56}
              y={y + 5}
              width={46}
              height={14}
              rx={7}
              fill={card.us ? OH_GREEN_TINT : 'var(--ant-color-fill-quaternary)'}
              stroke={card.us ? OH_GREEN : accent}
            />
            <text
              x={CARD_X + CARD_W - 33}
              y={y + 15}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={card.us ? TEXT : TEXT_DIM}
            >
              {card.tag}
            </text>

            {card.rows.map((row, i) => {
              const ry = y + 32 + i * 14;
              const glyphColor = row.ok ? STROKE_GREEN : 'var(--ant-color-error)';
              return (
                <g key={i}>
                  <text x={CARD_X + 16} y={ry} fontSize={11} fontWeight={700} fill={glyphColor}>
                    {row.ok ? '✓' : '✗'}
                  </text>
                  <text x={CARD_X + 30} y={ry} fontSize={10} fill={row.ok ? TEXT : TEXT_DIM}>
                    {row.text}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};
