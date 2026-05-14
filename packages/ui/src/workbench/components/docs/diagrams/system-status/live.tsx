import type React from 'react';
import { ArrowDefs,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS_BG,WARNING_BG,ERROR_BG,GREY_BG,Level,dotColor } from './_shared';

/**
 * Per-workflow state: shows what flips each individual Live workflow
 * green / yellow / red. Three vertically-stacked rows pin the exact
 * conditions to the actual code thresholds: 2× cadence staleness, the
 * 1–4 consecutive-failure yellow band, and the ≥ 5 red threshold.
 */
export const LiveWorkflowFreshnessDiagram: React.FC = () => {
  type StateDef = {
    level: Exclude<Level, 'grey'>;
    label: string;
    rule: string;
    example: string;
  };
  const STATES: StateDef[] = [
    {
      level: 'green',
      label: 'fresh',
      rule: 'last run OK · within 2× cadence · 0 failures',
      example: 'every refresh hits the 200',
    },
    {
      level: 'yellow',
      label: 'stale / faltering',
      rule: 'past 2× cadence  · OR  1–4 consecutive failures',
      example: 'one timeout, retrying',
    },
    {
      level: 'red',
      label: 'failing',
      rule: '≥ 5 consecutive failures',
      example: 'API down for an hour',
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
      aria-label="Live workflow per-state rules — fresh, stale/faltering, failing — pinned to the actual thresholds."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Per-workflow state rules
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
              e.g. {s.example}
            </text>
          </g>
        );
      })}

      <text x={160} y={208} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Cadence = the workflow's configured refresh interval.
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
  const ID = 'live-agg';
  const dimStroke = 'var(--ant-color-border-secondary)';

  const ACTIVE = [
    { name: 'fetchToken', level: 'green' as const, msg: 'fresh' },
    { name: 'invoiceList', level: 'yellow' as const, msg: '2 consecutive fails' },
    { name: 'healthCheck', level: 'green' as const, msg: 'fresh' },
  ];

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Live pill aggregation — three active-workspace workflows fold into one composite via max; inactive workspace workflows are excluded."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Active-workspace workflows fold into one pill
      </text>

      {/* Section header: active workspace */}
      <text x={20} y={36} fontSize={9} fontWeight={700} fill={TEXT}>
        Active workspace
      </text>
      <text x={20} y={48} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        contributes to the pill
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
        Other workspaces
      </text>
      <text x={20} y={162} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        deliberately excluded
      </text>
      <rect x={20} y={170} width={180} height={22} rx={3} fill={GREY_BG} stroke={dimStroke} strokeDasharray="3 2" />
      <text x={32} y={184} fontSize={9} fill={TEXT_DIM}>
        ✗ user can't act on them — skipped
      </text>

      {/* Composite pill */}
      <rect x={216} y={120} width={84} height={56} rx={6} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <circle cx={258} cy={138} r={7} fill={dotColor('yellow')} />
      <text x={258} y={158} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Live pill
      </text>
      <text x={258} y={170} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        max() = yellow
      </text>

      <text x={160} y={216} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        One worst-state workflow flips the whole pill.
      </text>
      <text x={160} y={230} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Switch workspace and the pill recomputes against that workspace's runs.
      </text>
    </svg>
  );
};

// ─── Popover two-tier ordering ────────────────────────────────────

