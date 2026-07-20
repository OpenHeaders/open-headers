import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';

/**
 * Actions taxonomy — three columns matching the registry's own grouping.
 *
 * Modify Request · Modify Response · Run Code. Each column lists every
 * action that belongs there with a one-line summary and an `engine`
 * tag (DNR or Script) so the reader sees both the "what" and the
 * "how it executes" at the same glance.
 */
export const ActionsTaxonomyDiagram: React.FC = () => {
  const t = useT();
  type Action = { name: string; sub: string; engine: 'dnr' | 'script' };
  type Category = { title: string; sub: string; actions: Action[] };

  const CATEGORIES: Category[] = [
    {
      title: t('workbench.docs.diagrams.actions.taxonomy.catModifyRequest'),
      sub: t('workbench.docs.diagrams.actions.taxonomy.catModifyRequestSub'),
      actions: [
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameHeaderActions'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subHeaderOps'),
          engine: 'dnr',
        },
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameBlock'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subBlock'),
          engine: 'dnr',
        },
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameRedirect'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subRedirect'),
          engine: 'dnr',
        },
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameQueryParams'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subQueryParams'),
          engine: 'dnr',
        },
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameRequestBody'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subRequestBody'),
          engine: 'script',
        },
      ],
    },
    {
      title: t('workbench.docs.diagrams.actions.taxonomy.catModifyResponse'),
      sub: t('workbench.docs.diagrams.actions.taxonomy.catModifyResponseSub'),
      actions: [
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameHeaderActions'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subHeaderResponse'),
          engine: 'dnr',
        },
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameResponseBody'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subResponseBody'),
          engine: 'script',
        },
      ],
    },
    {
      title: t('workbench.docs.diagrams.actions.taxonomy.catRunCode'),
      sub: t('workbench.docs.diagrams.actions.taxonomy.catRunCodeSub'),
      actions: [
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameInject'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subInject'),
          engine: 'script',
        },
        {
          name: t('workbench.docs.diagrams.actions.taxonomy.nameDelay'),
          sub: t('workbench.docs.diagrams.actions.taxonomy.subDelay'),
          engine: 'script',
        },
      ],
    },
  ];

  const W = 540;
  const PAD = 12;
  const COL_GAP = 10;
  const COL_W = (W - PAD * 2 - COL_GAP * (CATEGORIES.length - 1)) / CATEGORIES.length;
  const HEAD_H = 40;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;
  const GRID_Y = 64;

  const ROW_H = 30;
  const ROW_GAP = 6;

  const maxActions = Math.max(...CATEGORIES.map((c) => c.actions.length));
  const bodyH = HEAD_H + 6 + maxActions * (ROW_H + ROW_GAP);
  const VERDICT_Y = GRID_Y + bodyH + 14;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 600 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.actions.taxonomy.aria')}
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.actions.taxonomy.title')}
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.actions.taxonomy.subtitle')}
      </text>

      {CATEGORIES.map((cat, ci) => {
        const x = PAD + ci * (COL_W + COL_GAP);
        return (
          <g key={cat.title}>
            {/* Category card */}
            <rect
              x={x}
              y={GRID_Y}
              width={COL_W}
              height={bodyH}
              rx={6}
              fill="var(--ant-color-bg-container)"
              stroke={STROKE_BLUE}
              strokeWidth={1.3}
            />
            {/* Header band */}
            <rect x={x} y={GRID_Y} width={COL_W} height={HEAD_H} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text
              x={x + COL_W / 2}
              y={GRID_Y + 17}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={TEXT}
            >
              {cat.title}
            </text>
            <text
              x={x + COL_W / 2}
              y={GRID_Y + 31}
              textAnchor="middle"
              fontSize={9}
              fontStyle="italic"
              fill={TEXT_DIM}
            >
              {cat.sub}
            </text>

            {/* Action rows */}
            {cat.actions.map((a, i) => {
              const ry = GRID_Y + HEAD_H + 8 + i * (ROW_H + ROW_GAP);
              const isDnr = a.engine === 'dnr';
              const tagColor = isDnr ? STROKE_BLUE : STROKE_PURPLE;
              const tagBg = isDnr ? FILL_BLUE : FILL_PURPLE;
              return (
                <g key={a.name}>
                  <rect
                    x={x + 6}
                    y={ry}
                    width={COL_W - 12}
                    height={ROW_H}
                    rx={4}
                    fill="var(--ant-color-bg-container)"
                    stroke="var(--ant-color-border-secondary)"
                  />
                  {/* Engine tag — small pill at the right edge, width
                   *  follows label length so SCRIPT (6 chars) doesn't
                   *  get cramped in the same pill DNR (3 chars) uses. */}
                  {(() => {
                    const pillW = isDnr ? 32 : 44;
                    const pillX = x + COL_W - 6 - pillW - 2;
                    return (
                      <g>
                        <rect
                          x={pillX}
                          y={ry + 4}
                          width={pillW}
                          height={12}
                          rx={6}
                          fill={tagBg}
                          stroke={tagColor}
                          strokeWidth={0.8}
                        />
                        <text
                          x={pillX + pillW / 2}
                          y={ry + 13}
                          textAnchor="middle"
                          fontSize={8}
                          fontWeight={800}
                          fill={tagColor}
                          letterSpacing={0.6}
                        >
                          {isDnr ? 'DNR' : 'SCRIPT'}
                        </text>
                      </g>
                    );
                  })()}
                  <text x={x + 14} y={ry + 13} fontSize={10} fontWeight={700} fill={TEXT}>
                    {a.name}
                  </text>
                  <text x={x + 14} y={ry + 25} fontSize={8.5} fontStyle="italic" fill={TEXT_DIM}>
                    {a.sub}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Verdict / takeaway */}
      <rect
        x={PAD}
        y={VERDICT_Y}
        width={W - PAD * 2}
        height={VERDICT_H}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.actions.taxonomy.verdict')}
      </text>
    </svg>
  );
};
