/**
 * System Status — diagrams.
 *
 *   • SystemStatusSurfacesDiagram — where the status pill appears
 *     and at what density. Top: workbench footer's six-pill row
 *     (one pill per subsystem with its own colored dot). Bottom:
 *     popup/sidepanel header's single composite dot whose color
 *     reflects the worst-state subsystem.
 *
 *   • SystemStatusWorstLevelDiagram — how six individual states
 *     roll up into one. Left column: six subsystem rows in canonical
 *     order, each with its current state. Right side: one output dot
 *     whose color is `max(red > yellow > green)` across the inputs.
 *
 *   • SystemStatusPopoverDiagram — the popover body's two-tier
 *     layout. Greys first ("no events yet"), then coloreds (have
 *     reported), each preserving canonical subsystem order within
 *     its tier.
 */

import type React from 'react';
import { ArrowDefs, STROKE, TEXT, TEXT_DIM } from './_shared';

const SUCCESS = 'var(--ant-color-success)';
const WARNING = 'var(--ant-color-warning)';
const ERROR = 'var(--ant-color-error)';
const SUCCESS_BG = 'var(--ant-color-success-bg)';
const WARNING_BG = 'var(--ant-color-warning-bg)';
const ERROR_BG = 'var(--ant-color-error-bg)';
const GREY = 'var(--ant-color-text-tertiary)';
const GREY_BG = 'var(--ant-color-fill-quaternary)';
const BORDER = 'var(--ant-color-border)';
const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
const BG_CONTAINER = 'var(--ant-color-bg-container)';

type Level = 'green' | 'yellow' | 'red' | 'grey';

const dotColor = (lvl: Level): string =>
  lvl === 'red' ? ERROR : lvl === 'yellow' ? WARNING : lvl === 'green' ? SUCCESS : GREY;

const SUBSYSTEMS = ['Sync', 'Rules', 'Requests', 'Permissions', 'Secrets', 'Live'] as const;

// ─── Surfaces — where the pill renders ────────────────────────────

export const SystemStatusSurfacesDiagram: React.FC = () => {
  // Six pills in the workbench-footer row. Each gets its own state
  // — using a healthy snapshot here keeps the focus on layout, not
  // on alarm conditions (those belong to the Worst-level diagram).
  const ROW: { name: string; level: Level }[] = SUBSYSTEMS.map((s) => ({ name: s, level: 'green' }));

  const charW = 5.5;
  const PAD_X = 8;
  const DOT_R = 3;
  const DOT_GAP = 5;
  const PILL_H = 18;
  const PILL_GAP = 6;
  const widthOf = (name: string) => Math.ceil(name.length * charW) + PAD_X * 2 + DOT_R * 2 + DOT_GAP;
  const totalW = ROW.reduce((sum, p) => sum + widthOf(p.name), 0) + PILL_GAP * (ROW.length - 1);
  let cursor = 160 - totalW / 2;

  const pills = ROW.map((p) => {
    const w = widthOf(p.name);
    const x = cursor;
    cursor += w + PILL_GAP;
    return (
      <g key={p.name}>
        <rect x={x} y={64} width={w} height={PILL_H} rx={9} fill={FILL_SECONDARY} stroke={BORDER} />
        <circle cx={x + PAD_X + DOT_R} cy={64 + PILL_H / 2} r={DOT_R} fill={dotColor(p.level)} />
        <text
          x={x + PAD_X + DOT_R * 2 + DOT_GAP}
          y={64 + PILL_H / 2 + 3}
          fontSize={9}
          fontWeight={600}
          fill={TEXT}
        >
          {p.name}
        </text>
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Where the system status pill appears — a six-pill row in the workbench footer; a single composite dot in the popup or side-panel header."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Same status, two surfaces
      </text>

      {/* Surface 1 — Workbench footer */}
      <text x={10} y={42} fontSize={10} fontWeight={700} fill={TEXT}>
        Workbench footer
      </text>
      <text x={10} y={54} fontSize={9} fill={TEXT_DIM}>
        one pill per subsystem
      </text>
      <rect x={10} y={56} width={300} height={32} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      {pills}

      {/* Surface 2 — Popup / sidepanel header */}
      <text x={10} y={114} fontSize={10} fontWeight={700} fill={TEXT}>
        Popup / side-panel header
      </text>
      <text x={10} y={126} fontSize={9} fill={TEXT_DIM}>
        single dot · color = worst-state
      </text>

      {/* mini popup header mockup */}
      <rect x={10} y={132} width={300} height={36} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={10} y={132} width={300} height={36 / 2} fill={FILL_SECONDARY} />
      <text x={20} y={146} fontSize={10} fontWeight={700} fill={TEXT}>
        Open Headers
      </text>
      {/* the composite dot, on the right side of the header */}
      <circle cx={290} cy={150} r={4} fill={SUCCESS} />
      <line
        x1={286}
        y1={146}
        x2={244}
        y2={140}
        stroke={STROKE}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <text x={244} y={138} textAnchor="end" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        composite dot
      </text>

      <text x={160} y={188} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Click anywhere on either to open the same details popover.
      </text>
    </svg>
  );
};

// ─── Worst-level aggregator ───────────────────────────────────────

export const SystemStatusWorstLevelDiagram: React.FC = () => {
  // A scenario where two subsystems mis-fire — Permissions yellow,
  // Secrets red. Composite output is red.
  const ROWS: { name: string; level: Level; msg: string }[] = [
    { name: 'Sync', level: 'green', msg: 'connected' },
    { name: 'Rules', level: 'green', msg: '12 active' },
    { name: 'Requests', level: 'grey', msg: 'no events yet' },
    { name: 'Permissions', level: 'yellow', msg: 'host narrowed' },
    { name: 'Secrets', level: 'red', msg: 'cipher decrypt' },
    { name: 'Live', level: 'green', msg: '3 fresh' },
  ];

  const ID = 'sys-worst';
  const ROW_X = 16;
  const ROW_Y0 = 36;
  const ROW_H = 18;
  const ROW_GAP = 4;
  const ROW_W = 168;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Worst-state aggregator — six subsystem states feed into one composite dot. The worst color wins: red beats yellow beats green."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Worst color wins
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        red &gt; yellow &gt; green &nbsp;·&nbsp; grey = no events yet (treated as green)
      </text>

      {ROWS.map((row, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const fill =
          row.level === 'red'
            ? ERROR_BG
            : row.level === 'yellow'
              ? WARNING_BG
              : row.level === 'green'
                ? SUCCESS_BG
                : GREY_BG;
        const stroke = dotColor(row.level);
        return (
          <g key={row.name}>
            <rect x={ROW_X} y={y} width={ROW_W} height={ROW_H} rx={3} fill={fill} stroke={stroke} />
            <circle cx={ROW_X + 10} cy={y + ROW_H / 2} r={3.5} fill={dotColor(row.level)} />
            <text x={ROW_X + 22} y={y + ROW_H / 2 + 3} fontSize={9} fontWeight={700} fill={TEXT}>
              {row.name}
            </text>
            <text x={ROW_X + ROW_W - 8} y={y + ROW_H / 2 + 3} textAnchor="end" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {row.msg}
            </text>
          </g>
        );
      })}

      {/* Aggregation arrow */}
      <line
        x1={ROW_X + ROW_W + 4}
        y1={ROW_Y0 + (ROW_H * 6 + ROW_GAP * 5) / 2}
        x2={236}
        y2={ROW_Y0 + (ROW_H * 6 + ROW_GAP * 5) / 2}
        stroke={STROKE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={(ROW_X + ROW_W + 236) / 2}
        y={ROW_Y0 + (ROW_H * 6 + ROW_GAP * 5) / 2 - 4}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        max()
      </text>

      {/* Composite output */}
      <rect x={240} y={68} width={64} height={64} rx={6} fill={ERROR_BG} stroke={ERROR} />
      <circle cx={272} cy={94} r={8} fill={ERROR} />
      <text x={272} y={120} textAnchor="middle" fontSize={9} fontWeight={700} fill={ERROR}>
        red
      </text>
      <text x={272} y={144} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        composite
      </text>
      <text x={272} y={156} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        dot
      </text>

      <text x={160} y={186} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        One red anywhere → composite is red. Drives the popup/sidepanel dot.
      </text>
    </svg>
  );
};

// ─── Popover two-tier ordering ────────────────────────────────────

export const SystemStatusPopoverDiagram: React.FC = () => {
  const GREYS = [
    { name: 'Requests', msg: 'No events yet' },
    { name: 'Live', msg: 'No events yet' },
  ];
  const COLOREDS: { name: string; level: Exclude<Level, 'grey'>; msg: string }[] = [
    { name: 'Sync', level: 'green', msg: 'Connected' },
    { name: 'Rules', level: 'green', msg: '12 active rules' },
    { name: 'Permissions', level: 'yellow', msg: 'Hosts narrowed' },
    { name: 'Secrets', level: 'red', msg: 'Cipher decrypt failed' },
  ];

  const PAD_X = 14;
  const ROW_H = 16;
  const ROW_GAP = 3;
  const TAG_W = 64;
  const TAG_X = PAD_X;
  const FRAME_X = 30;
  const FRAME_W = 260;

  let y = 50;

  const renderRow = (
    name: string,
    msg: string,
    level: Level,
    options: { isGrey?: boolean } = {},
  ): React.ReactElement => {
    const localY = y;
    y += ROW_H + ROW_GAP;
    const fillTag = options.isGrey
      ? GREY_BG
      : level === 'red'
        ? ERROR_BG
        : level === 'yellow'
          ? WARNING_BG
          : SUCCESS_BG;
    const strokeTag = dotColor(level);
    return (
      <g key={`${name}-${localY}`}>
        <rect x={FRAME_X + TAG_X} y={localY} width={TAG_W} height={ROW_H} rx={3} fill={fillTag} stroke={strokeTag} />
        <text
          x={FRAME_X + TAG_X + TAG_W / 2}
          y={localY + ROW_H / 2 + 3}
          textAnchor="middle"
          fontSize={8}
          fontWeight={700}
          fill={TEXT}
        >
          {name}
        </text>
        <text x={FRAME_X + TAG_X + TAG_W + 10} y={localY + ROW_H / 2 + 3} fontSize={9} fill={TEXT}>
          {msg}
        </text>
      </g>
    );
  };

  // We need to render greys first, then divider, then coloreds. Using
  // a closure over `y` because the rows wrap with their own local y.
  const greyRows = GREYS.map((r) => renderRow(r.name, r.msg, 'grey', { isGrey: true }));
  const dividerY = y + 2;
  y += 10;
  const coloredRows = COLOREDS.map((r) => renderRow(r.name, r.msg, r.level));
  const frameH = y + 6 - 36;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Status popover layout — grey rows for subsystems with no events yet appear above colored rows for subsystems that have reported."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Popover order: greys first, then coloreds
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Within each tier, canonical subsystem order is preserved
      </text>

      {/* Popover frame */}
      <rect x={FRAME_X} y={36} width={FRAME_W} height={frameH} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      {/* Header inside the popover */}
      <text x={FRAME_X + 14} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        ● System status
      </text>
      <circle cx={FRAME_X + 14 - 7} cy={45} r={3.5} fill={ERROR} />

      {greyRows}

      {/* Divider between tiers */}
      <line
        x1={FRAME_X + 14}
        y1={dividerY}
        x2={FRAME_X + FRAME_W - 14}
        y2={dividerY}
        stroke={BORDER}
        strokeDasharray="2 2"
      />
      <text x={FRAME_X + FRAME_W - 14} y={dividerY - 2} textAnchor="end" fontSize={7} fontStyle="italic" fill={TEXT_DIM}>
        ↑ no events yet · ↓ have reported
      </text>

      {coloredRows}

      <text x={160} y={210} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        On first report, a row migrates from grey → colored once.
      </text>
    </svg>
  );
};
