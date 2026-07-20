import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS_BG,WARNING_BG,ERROR_BG,GREY_BG,Level,dotColor } from './_shared';

/**
 * Per-workflow state: shows what flips each individual Live workflow
 * green / yellow / red. Three vertically-stacked rows pin the exact
 * conditions to the actual code thresholds: 2× cadence staleness, the
 * 1–4 consecutive-failure yellow band, and the ≥ 5 red threshold.
 */
export const LiveWorkflowFreshnessDiagram: React.FC = () => {
  const t = useT();
  type StateDef = {
    level: Exclude<Level, 'grey'>;
    label: string;
    rule: string;
    example: string;
  };
  const STATES: StateDef[] = [
    {
      level: 'green',
      label: t('workbench.docs.diagrams.systemStatus.liveFreshness.stateFresh'),
      rule: t('workbench.docs.diagrams.systemStatus.liveFreshness.ruleFresh'),
      example: t('workbench.docs.diagrams.systemStatus.liveFreshness.egFresh'),
    },
    {
      level: 'yellow',
      label: t('workbench.docs.diagrams.systemStatus.liveFreshness.stateStale'),
      rule: t('workbench.docs.diagrams.systemStatus.liveFreshness.ruleStale'),
      example: t('workbench.docs.diagrams.systemStatus.liveFreshness.egStale'),
    },
    {
      level: 'red',
      label: t('workbench.docs.diagrams.systemStatus.liveFreshness.stateFailing'),
      rule: t('workbench.docs.diagrams.systemStatus.liveFreshness.ruleFailing'),
      example: t('workbench.docs.diagrams.systemStatus.liveFreshness.egFailing'),
    },
  ];

  const ROW_X = 16;
  const ROW_W = 288;
  const ROW_H = 50;
  const ROW_Y0 = 32;
  const ROW_GAP = 6;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.liveFreshness.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.liveFreshness.title')}
      </text>

      {STATES.map((s, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const fill = s.level === 'red' ? ERROR_BG : s.level === 'yellow' ? WARNING_BG : SUCCESS_BG;
        const stroke = dotColor(s.level);
        return (
          <g key={s.label}>
            <rect x={ROW_X} y={y} width={ROW_W} height={ROW_H} rx={4} fill={fill} stroke={stroke} />
            {/* Left badge: state name */}
            <circle cx={ROW_X + 14} cy={y + ROW_H / 2} r={4.5} fill={stroke} />
            <text x={ROW_X + 26} y={y + 18} fontSize={10} fontWeight={700} fill={TEXT}>
              {s.label}
            </text>
            <text x={ROW_X + 26} y={y + 32} fontSize={9} fill={TEXT}>
              {s.rule}
            </text>
            <text x={ROW_X + 26} y={y + 44} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {s.example}
            </text>
          </g>
        );
      })}

      <text x={160} y={208} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveFreshness.footer')}
      </text>
    </svg>
  );
};

/**
 * Aggregation: how N per-workflow states roll up into ONE pill, and
 * what's deliberately excluded. Three example workflows from the
 * active workspace fold via `max` into the composite. A dim row
 * pinned below shows the inactive workspace's workflows being
 * skipped — the user can't act on them, so they don't pill.
 */
export const LivePillAggregationDiagram: React.FC = () => {
  const t = useT();
  const ID = 'live-agg';
  const dimStroke = 'var(--ant-color-border-secondary)';

  const freshMsg = t('workbench.docs.diagrams.systemStatus.liveAggregation.msgFresh');
  const ACTIVE = [
    { name: 'fetchToken', level: 'green' as const, msg: freshMsg },
    {
      name: 'invoiceList',
      level: 'yellow' as const,
      msg: t('workbench.docs.diagrams.systemStatus.liveAggregation.msgConsecFails'),
    },
    { name: 'healthCheck', level: 'green' as const, msg: freshMsg },
  ];

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.liveAggregation.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.title')}
      </text>

      {/* Section header: active workspace */}
      <text x={20} y={36} fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.activeWorkspace')}
      </text>
      <text x={20} y={48} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.contributes')}
      </text>

      {ACTIVE.map((wf, i) => {
        const y = 56 + i * 26;
        const fill = wf.level === 'green' ? SUCCESS_BG : WARNING_BG;
        const stroke = dotColor(wf.level);
        return (
          <g key={wf.name}>
            <rect x={20} y={y} width={180} height={22} rx={3} fill={fill} stroke={stroke} />
            <circle cx={32} cy={y + 11} r={3.5} fill={stroke} />
            <text x={44} y={y + 14} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
              {wf.name}
            </text>
            <text x={196} y={y + 14} textAnchor="end" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {wf.msg}
            </text>
            {/* Aggregation arrow into composite */}
            <line
              x1={200}
              y1={y + 11}
              x2={236}
              y2={140}
              stroke={dotColor(wf.level)}
              strokeWidth={1.5}
              markerEnd={`url(#${ID})`}
            />
          </g>
        );
      })}

      {/* Section header: inactive workspace */}
      <text x={20} y={150} fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.otherWorkspaces')}
      </text>
      <text x={20} y={162} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.excluded')}
      </text>
      <rect x={20} y={170} width={180} height={22} rx={3} fill={GREY_BG} stroke={dimStroke} strokeDasharray="3 2" />
      <text x={32} y={184} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.skipped')}
      </text>

      {/* Composite pill */}
      <rect x={216} y={120} width={84} height={56} rx={6} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <circle cx={258} cy={138} r={7} fill={dotColor('yellow')} />
      <text x={258} y={158} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.livePill')}
      </text>
      <text x={258} y={170} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.maxYellow')}
      </text>

      <text x={160} y={216} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.footer1')}
      </text>
      <text x={160} y={230} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.liveAggregation.footer2')}
      </text>
    </svg>
  );
};

// ─── Popover two-tier ordering ────────────────────────────────────

