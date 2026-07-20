// ── Header operations comparison (overview) ──────────────────────

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from '../_shared';

/**
 * Hero diagram for the Header Actions section. Reads as a single
 * "story": one starting header, four operations, four different
 * outcomes. Each row pairs the operation name + engine pill with a
 * side-by-side before → after that highlights what changed.
 * Locked color contract preserved (blue=DNR, purple=Script).
 */
export const HeaderOpsDiagram: React.FC = () => {
  const t = useT();
  const ID = 'hop';
  const BEFORE = t('workbench.docs.diagrams.headerActions.overview.before');

  type Op = {
    name: string;
    engineLabel: string;
    isScript: boolean;
    after: React.ReactNode;
  };

  const OPS: Op[] = [
    {
      name: t('workbench.docs.diagrams.headerActions.overview.opOverride'),
      engineLabel: t('workbench.docs.diagrams.headerActions.overview.engineDnr'),
      isScript: false,
      after: (
        <tspan>
          Cookie:{' '}
          <tspan fontWeight={700} fill={STROKE_BLUE}>
            {t('workbench.docs.diagrams.headerActions.overview.afterOverrideNew')}
          </tspan>
        </tspan>
      ),
    },
    {
      name: t('workbench.docs.diagrams.headerActions.overview.opAppend'),
      engineLabel: t('workbench.docs.diagrams.headerActions.overview.engineDnr'),
      isScript: false,
      after: (
        <tspan>
          {t('workbench.docs.diagrams.headerActions.overview.afterAppendKept')}{' '}
          <tspan fontWeight={700} fill={STROKE_BLUE}>
            {t('workbench.docs.diagrams.headerActions.overview.afterAppendNew')}
          </tspan>
        </tspan>
      ),
    },
    {
      name: t('workbench.docs.diagrams.headerActions.overview.opRemove'),
      engineLabel: t('workbench.docs.diagrams.headerActions.overview.engineDnr'),
      isScript: false,
      after: (
        <tspan fontStyle="italic" fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.headerActions.overview.afterRemoveGone')}
        </tspan>
      ),
    },
    {
      name: t('workbench.docs.diagrams.headerActions.overview.opMerge'),
      engineLabel: t('workbench.docs.diagrams.headerActions.overview.engineScript'),
      isScript: true,
      after: (
        <tspan>
          {BEFORE}
          <tspan fontWeight={700} fill={STROKE_PURPLE}>
            {t('workbench.docs.diagrams.headerActions.overview.afterMergeNew')}
          </tspan>
        </tspan>
      ),
    },
  ];

  const HEADER_Y = 16;
  const BEFORE_BOX_X = 80;
  const BEFORE_BOX_Y = 26;
  const BEFORE_BOX_W = 160;
  const BEFORE_BOX_H = 28;

  const ROW_Y0 = 84;
  const ROW_H = 40;
  const ROW_GAP = 8;
  const ROW_X = 10;
  const ROW_W = 300;

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.headerActions.overview.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={HEADER_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.overview.title')}
      </text>
      <rect
        x={BEFORE_BOX_X}
        y={BEFORE_BOX_Y}
        width={BEFORE_BOX_W}
        height={BEFORE_BOX_H}
        rx={4}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text
        x={BEFORE_BOX_X + BEFORE_BOX_W / 2}
        y={BEFORE_BOX_Y + 12}
        textAnchor="middle"
        fontSize={8}
        fontWeight={700}
        fill={TEXT_DIM}
        letterSpacing={0.5}
      >
        {t('workbench.docs.diagrams.headerActions.shared.beforeKicker')}
      </text>
      <text
        x={BEFORE_BOX_X + BEFORE_BOX_W / 2}
        y={BEFORE_BOX_Y + 24}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fill={TEXT}
      >
        {BEFORE}
      </text>

      <line x1={160} y1={BEFORE_BOX_Y + BEFORE_BOX_H} x2={160} y2={ROW_Y0 - 6} stroke={STROKE} strokeDasharray="2 3" />
      <line
        x1={160}
        y1={ROW_Y0 - 6}
        x2={160}
        y2={ROW_Y0 - 2}
        stroke={STROKE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />

      {OPS.map((op, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const accent = op.isScript ? STROKE_PURPLE : STROKE_BLUE;
        const accentFill = op.isScript ? FILL_PURPLE : FILL_BLUE;
        return (
          <g key={op.name}>
            <rect
              x={ROW_X}
              y={y}
              width={ROW_W}
              height={ROW_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            <rect x={ROW_X} y={y} width={102} height={ROW_H} rx={5} fill={accentFill} stroke={accent} />
            <text x={ROW_X + 12} y={y + 17} fontSize={11} fontWeight={700} fill={TEXT}>
              {op.name}
            </text>
            <rect
              x={ROW_X + 12}
              y={y + 22}
              width={42}
              height={12}
              rx={3}
              fill="var(--ant-color-bg-container)"
              stroke={accent}
            />
            <text x={ROW_X + 33} y={y + 31} textAnchor="middle" fontSize={8} fontWeight={700} fill={accent}>
              {op.engineLabel}
            </text>

            <line
              x1={ROW_X + 102 + 4}
              y1={y + ROW_H / 2}
              x2={ROW_X + 130}
              y2={y + ROW_H / 2}
              stroke={accent}
              strokeWidth={1.5}
              markerEnd={`url(#${ID})`}
            />

            <text x={ROW_X + 138} y={y + ROW_H / 2 + 4} fontFamily="monospace" fontSize={10} fill={TEXT}>
              {op.after}
            </text>
          </g>
        );
      })}

      <g transform={`translate(0, ${ROW_Y0 + 4 * (ROW_H + ROW_GAP) + 8})`}>
        <rect x={ROW_X} y={0} width={12} height={12} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={ROW_X + 18} y={9} fontSize={9} fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.headerActions.overview.legendDnr')}
        </text>
        <rect x={ROW_X} y={16} width={12} height={12} rx={2} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
        <text x={ROW_X + 18} y={25} fontSize={9} fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.headerActions.overview.legendScript')}
        </text>
      </g>
    </svg>
  );
};
