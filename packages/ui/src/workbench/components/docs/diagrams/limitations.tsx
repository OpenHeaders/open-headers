/**
 * Limitations — diagrams.
 *
 *   • LimitationsOverviewDiagram — four-card visual summary of the
 *     gotchas users hit most. Each card mirrors a Callout below
 *     with a glyph + concrete tagline so users can recognise their
 *     symptom before reading any prose.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { TEXT, TEXT_DIM } from './_shared';

const ERR_BG = 'var(--ant-color-error-bg)';
const ERR_BORDER = 'var(--ant-color-error-border)';
const ERR = 'var(--ant-color-error)';

export const LimitationsOverviewDiagram: React.FC = () => {
  const t = useT();
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
      title: t('workbench.docs.diagrams.limitations.devtoolsTitle'),
      line1: t('workbench.docs.diagrams.limitations.devtoolsLine1'),
      line2: t('workbench.docs.diagrams.limitations.devtoolsLine2'),
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={ERR}>
          {'</>'}
        </text>
      ),
    },
    {
      title: t('workbench.docs.diagrams.limitations.scriptTitle'),
      line1: t('workbench.docs.diagrams.limitations.scriptLine1'),
      line2: t('workbench.docs.diagrams.limitations.scriptLine2'),
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={ERR}>
          {t('workbench.docs.diagrams.limitations.wireFn')}
        </text>
      ),
    },
    {
      title: t('workbench.docs.diagrams.limitations.mergeTitle'),
      line1: t('workbench.docs.diagrams.limitations.mergeLine1'),
      line2: t('workbench.docs.diagrams.limitations.mergeLine2'),
      glyph: (
        <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={ERR}>
          ;,
        </text>
      ),
    },
    {
      title: t('workbench.docs.diagrams.limitations.chromeTitle'),
      line1: t('workbench.docs.diagrams.limitations.chromeLine1'),
      line2: t('workbench.docs.diagrams.limitations.chromeLine2'),
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
      aria-label={t('workbench.docs.diagrams.limitations.overviewAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.limitations.gotchasKicker')}
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
              {t('workbench.docs.diagrams.limitations.seeCallout')}
            </text>
          </g>
        );
      })}

      <text x={160} y={216} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.limitations.footer')}
      </text>
    </svg>
  );
};
