import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

// CJK glyphs render close to the full em box, not the ~0.55em a Latin
// glyph averages — weigh them accordingly when sizing text-driven pills.
const unitLen = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.85 : 1), 0);

/**
 * Comparison matrix — four stacked category cards. The first three are
 * the product categories Open Headers competes with; the fourth is us,
 * accented with the brand blue. Each card carries 3–4 attribute rows
 * with ✓ / ✗ glyphs so the trade-off reads at a glance.
 */
export const ComparisonMatrixDiagram: React.FC = () => {
  const t = useT();
  type Row = { ok: boolean; text: string };
  type Card = { category: string; tag: string; rows: Row[]; us?: boolean };

  const CARDS: Card[] = [
    {
      category: t('workbench.docs.diagrams.openHeaders.matrix.catSaas'),
      tag: t('workbench.docs.diagrams.openHeaders.matrix.tagCloud'),
      rows: [
        { ok: false, text: t('workbench.docs.diagrams.openHeaders.matrix.rowSaasData') },
        { ok: false, text: t('workbench.docs.diagrams.openHeaders.matrix.rowSaasAccount') },
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowSaasFeatures') },
      ],
    },
    {
      category: t('workbench.docs.diagrams.openHeaders.matrix.catProxies'),
      tag: t('workbench.docs.diagrams.openHeaders.matrix.tagNative'),
      rows: [
        { ok: false, text: t('workbench.docs.diagrams.openHeaders.matrix.rowProxyBinary') },
        { ok: false, text: t('workbench.docs.diagrams.openHeaders.matrix.rowProxyCert') },
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowProxyTraffic') },
      ],
    },
    {
      category: t('workbench.docs.diagrams.openHeaders.matrix.catHeaderOnly'),
      tag: t('workbench.docs.diagrams.openHeaders.matrix.tagLite'),
      rows: [
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowLiteNoSetup') },
        { ok: false, text: t('workbench.docs.diagrams.openHeaders.matrix.rowLiteOneRule') },
        { ok: false, text: t('workbench.docs.diagrams.openHeaders.matrix.rowLiteNoScripts') },
      ],
    },
    {
      category: t('workbench.docs.diagrams.openHeaders.shared.openHeaders'),
      tag: t('workbench.docs.diagrams.openHeaders.matrix.tagUs'),
      us: true,
      rows: [
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowUsLocal') },
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowUsNine') },
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowUsScripts') },
        { ok: true, text: t('workbench.docs.diagrams.openHeaders.matrix.rowUsSurfaces') },
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
      aria-label={t('workbench.docs.diagrams.openHeaders.matrix.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.openHeaders.matrix.title')}
      </text>

      {CARDS.map((card) => {
        const h = cardHeight(card.rows.length);
        const y = cursorY;
        cursorY = y + h + CARD_GAP;
        const accent = card.us ? STROKE_BLUE : 'var(--ant-color-border)';
        const accentBg = card.us ? FILL_BLUE : 'var(--ant-color-bg-container)';
        const tagW = Math.max(30, Math.round(unitLen(card.tag) * 5.5) + 16);
        const tagX = CARD_X + CARD_W - 10 - tagW;
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
              x={tagX}
              y={y + 5}
              width={tagW}
              height={14}
              rx={7}
              fill={card.us ? OH_GREEN_TINT : 'var(--ant-color-fill-quaternary)'}
              stroke={card.us ? OH_GREEN : accent}
            />
            <text
              x={tagX + tagW / 2}
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
