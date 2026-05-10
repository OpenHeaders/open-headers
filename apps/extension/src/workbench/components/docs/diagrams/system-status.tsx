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

/**
 * Two surface mockups stacked. Top: a stylised workbench app frame
 * with a real-looking footer strip carrying all six subsystem pills.
 * Bottom: a popup window mockup with a header bar carrying the
 * single composite dot. The mockups frame the indicator so users
 * can spot where to look in their own UI.
 */
export const SystemStatusSurfacesDiagram: React.FC = () => {
  // Compact pill metrics — tight enough that all six fit in a real-
  // looking footer strip (≈ 280px) without truncation.
  const charW = 4.3;
  const PAD_X = 4;
  const DOT_R = 2;
  const DOT_GAP = 3;
  const PILL_H = 14;
  const PILL_GAP = 3;
  const widthOf = (name: string) => Math.ceil(name.length * charW) + PAD_X * 2 + DOT_R * 2 + DOT_GAP;

  const ROW: { name: string; level: Level }[] = SUBSYSTEMS.map((s) => ({ name: s, level: 'green' }));
  const totalW = ROW.reduce((sum, p) => sum + widthOf(p.name), 0) + PILL_GAP * (ROW.length - 1);

  // ─ Workbench mockup geometry ─
  const WB_X = 10;
  const WB_Y = 36;
  const WB_W = 300;
  const WB_H = 88;
  const FOOTER_H = 22;
  const footerY = WB_Y + WB_H - FOOTER_H;
  const pillsStartX = WB_X + (WB_W - totalW) / 2;
  const pillsCenterY = footerY + FOOTER_H / 2;

  let cursor = pillsStartX;
  const pills = ROW.map((p) => {
    const w = widthOf(p.name);
    const x = cursor;
    cursor += w + PILL_GAP;
    return (
      <g key={p.name}>
        <rect x={x} y={pillsCenterY - PILL_H / 2} width={w} height={PILL_H} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
        <circle cx={x + PAD_X + DOT_R} cy={pillsCenterY} r={DOT_R} fill={dotColor(p.level)} />
        <text
          x={x + PAD_X + DOT_R * 2 + DOT_GAP}
          y={pillsCenterY + 3}
          fontSize={8}
          fontWeight={600}
          fill={TEXT}
        >
          {p.name}
        </text>
      </g>
    );
  });

  // ─ Popup mockup geometry ─
  const PU_X = 90;
  const PU_Y = 142;
  const PU_W = 140;
  const PU_H = 50;
  const PU_HEAD_H = 22;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Where the system status pill appears — a six-pill row in the workbench footer; a single composite dot in the popup or side-panel header."
    >
      <text x={160} y={16} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Same status, two surfaces
      </text>

      {/* ── Surface 1 — Workbench app + footer strip ── */}
      <rect x={WB_X} y={WB_Y} width={WB_W} height={WB_H} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      {/* Workbench title bar */}
      <rect x={WB_X} y={WB_Y} width={WB_W} height={14} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={WB_X + 8 + i * 7} cy={WB_Y + 7} r={2.5} fill={GREY} />
      ))}
      <text x={WB_X + WB_W / 2} y={WB_Y + 10} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT_DIM}>
        Open Headers — Workbench
      </text>
      {/* Body placeholder lines */}
      {[0, 1, 2].map((i) => (
        <rect
          key={`b-${i}`}
          x={WB_X + 12}
          y={WB_Y + 22 + i * 8}
          width={WB_W - 24}
          height={4}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}
      {/* Footer strip */}
      <rect x={WB_X} y={footerY} width={WB_W} height={FOOTER_H} fill={FILL_SECONDARY} stroke={BORDER} />
      {pills}
      {/* Footer label */}
      <text x={WB_X} y={WB_Y - 4} fontSize={9} fontWeight={700} fill={TEXT}>
        Workbench footer
      </text>
      <text x={WB_X + WB_W} y={WB_Y - 4} textAnchor="end" fontSize={8} fill={TEXT_DIM}>
        one pill per subsystem
      </text>

      {/* ── Surface 2 — Popup mini-window with composite dot ── */}
      <rect x={PU_X} y={PU_Y} width={PU_W} height={PU_H} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={PU_X} y={PU_Y} width={PU_W} height={PU_HEAD_H} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={PU_X + 8} y={PU_Y + 14} fontSize={9} fontWeight={700} fill={TEXT}>
        Open Headers
      </text>
      <circle cx={PU_X + PU_W - 10} cy={PU_Y + PU_HEAD_H / 2} r={4} fill={SUCCESS} />
      {/* composite dot annotation */}
      <line
        x1={PU_X + PU_W - 14}
        y1={PU_Y + PU_HEAD_H / 2 - 4}
        x2={PU_X + PU_W + 18}
        y2={PU_Y - 4}
        stroke={STROKE}
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <text x={PU_X + PU_W + 22} y={PU_Y - 6} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        composite dot
      </text>
      {/* Mini body */}
      {[0, 1].map((i) => (
        <rect
          key={`pb-${i}`}
          x={PU_X + 8}
          y={PU_Y + PU_HEAD_H + 6 + i * 8}
          width={PU_W - 16}
          height={4}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}
      {/* Popup section header label */}
      <text x={PU_X} y={PU_Y - 6} textAnchor="start" fontSize={9} fontWeight={700} fill={TEXT}>
        Popup / side-panel
      </text>

      <text x={160} y={210} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
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

// ─── Sync subsystem — topology + lifecycle ────────────────────────

/**
 * Topology: the extension's background SW maintains a single
 * WebSocket to the desktop app on `127.0.0.1:59210`. The line in the
 * middle carries the actual data shapes — keeping it labeled keeps
 * "what does syncing actually do?" answerable without reading prose.
 */
export const SyncTopologyDiagram: React.FC = () => {
  const ID = 'sync-topo';
  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Sync topology — the extension service worker holds one WebSocket to the desktop app on 127.0.0.1:59210, exchanging workspaces, variables, and team sync data."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        How the Sync subsystem connects
      </text>

      {/* Extension card (left) */}
      <rect x={14} y={36} width={120} height={108} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={14} y={36} width={120} height={20} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={74} y={50} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Extension
      </text>
      <text x={74} y={72} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        service worker
      </text>
      {/* Mini browser icon */}
      <rect x={50} y={82} width={48} height={36} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={56 + i * 6} cy={89} r={2} fill={GREY} />
      ))}
      <rect x={54} y={96} width={40} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={54} y={102} width={28} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={54} y={108} width={34} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <text x={74} y={134} textAnchor="middle" fontSize={9} fill={TEXT}>
        WS client
      </text>

      {/* Desktop card (right) */}
      <rect x={186} y={36} width={120} height={108} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={186} y={36} width={120} height={20} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={246} y={50} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Desktop app
      </text>
      <text x={246} y={72} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        on your machine
      </text>
      {/* Mini desktop window icon */}
      <rect x={210} y={82} width={72} height={36} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect x={210} y={82} width={72} height={6} fill="var(--ant-color-fill-tertiary)" stroke={BORDER} />
      <circle cx={215} cy={85} r={1.5} fill={ERROR} />
      <circle cx={220} cy={85} r={1.5} fill={WARNING} />
      <circle cx={225} cy={85} r={1.5} fill={SUCCESS} />
      <rect x={215} y={94} width={62} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={215} y={100} width={50} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <rect x={215} y={106} width={56} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
      <text x={246} y={134} textAnchor="middle" fontSize={9} fill={TEXT}>
        WS server
      </text>

      {/* WebSocket line between */}
      <line x1={134} y1={90} x2={186} y2={90} stroke={SUCCESS} strokeWidth={2} />
      <line x1={134} y1={110} x2={186} y2={110} stroke={SUCCESS} strokeWidth={2} markerEnd={`url(#${ID})`} />
      <line x1={186} y1={110} x2={134} y2={110} stroke={SUCCESS} strokeWidth={2} markerEnd={`url(#${ID})`} />
      <text x={160} y={86} textAnchor="middle" fontSize={8} fontWeight={700} fill={SUCCESS}>
        WebSocket
      </text>
      <text x={160} y={124} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        127.0.0.1:59210
      </text>

      <text x={160} y={166} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Carries: dynamic variables · workspaces · team sync
      </text>
      <text x={160} y={184} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Loopback only — never leaves your machine.
      </text>
    </svg>
  );
};

/**
 * Lifecycle: state diagram of every label the Sync pill can show.
 * Pulled directly from `websocket.ts` — green for Disabled/Connected,
 * yellow for Connecting/Reconnecting/URL-rejected, plus the reserved
 * red box drawn dashed since no code path emits it today.
 */
export const SyncLifecycleDiagram: React.FC = () => {
  const ID = 'sync-life';

  const StateBox = ({
    x,
    y,
    w,
    label,
    sub,
    level,
    dashed = false,
  }: {
    x: number;
    y: number;
    w: number;
    label: string;
    sub: string;
    level: Level;
    dashed?: boolean;
  }) => {
    const fill =
      level === 'red'
        ? ERROR_BG
        : level === 'yellow'
          ? WARNING_BG
          : level === 'green'
            ? SUCCESS_BG
            : GREY_BG;
    const stroke = dotColor(level);
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={36}
          rx={5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray={dashed ? '3 2' : undefined}
        />
        <circle cx={x + 10} cy={y + 12} r={3} fill={dotColor(level)} />
        <text x={x + 20} y={y + 15} fontSize={10} fontWeight={700} fill={TEXT}>
          {label}
        </text>
        <text x={x + 10} y={y + 28} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
          {sub}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Sync connection lifecycle — Disabled is green; Connecting and Reconnecting are yellow; Connected is green. URL rejected is yellow. Red is reserved and not emitted."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Sync states and how they're reached
      </text>

      {/* Top row: Disabled & Connecting */}
      <StateBox x={14} y={30} w={130} label="Disabled" sub="auto-connect off" level="green" />
      <StateBox x={176} y={30} w={130} label="Connecting…" sub="first attempt" level="yellow" />

      {/* Middle row: Connected & Reconnecting */}
      <StateBox x={14} y={96} w={130} label="Connected" sub="WS handshake OK" level="green" />
      <StateBox x={176} y={96} w={130} label="Reconnecting #N" sub="backs off, retries" level="yellow" />

      {/* Bottom row: URL rejected & Red reserved */}
      <StateBox x={14} y={162} w={130} label="URL rejected" sub="bad settings URL" level="yellow" />
      <StateBox
        x={176}
        y={162}
        w={130}
        label="(red reserved)"
        sub="no code path today"
        level="red"
        dashed
      />

      {/* Transitions */}
      {/* Disabled → Connecting (enable auto-connect) */}
      <line x1={144} y1={48} x2={176} y2={48} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={160} y={43} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        enable
      </text>

      {/* Connecting → Connected (success) */}
      <line x1={241} y1={66} x2={79} y2={96} stroke={SUCCESS} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={170} y={78} fontSize={8} fontStyle="italic" fill={SUCCESS}>
        handshake OK
      </text>

      {/* Connecting → URL rejected */}
      <line x1={176} y1={66} x2={79} y2={162} stroke={WARNING} strokeWidth={1.2} strokeDasharray="3 2" markerEnd={`url(#${ID})`} />
      <text x={110} y={130} fontSize={8} fontStyle="italic" fill={WARNING}>
        invalid URL
      </text>

      {/* Connected → Reconnecting (drop) */}
      <line x1={144} y1={114} x2={176} y2={114} stroke={WARNING} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={160} y={110} textAnchor="middle" fontSize={8} fontStyle="italic" fill={WARNING}>
        drop
      </text>

      {/* Reconnecting → Connected (retry succeeds) */}
      <line x1={176} y1={120} x2={144} y2={120} stroke={SUCCESS} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={160} y={132} textAnchor="middle" fontSize={8} fontStyle="italic" fill={SUCCESS}>
        re-OK
      </text>

      <text x={160} y={210} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Reconnect uses exponential backoff (configurable max delay).
      </text>
      <text x={160} y={224} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Periodic pings detect silent drops behind strict proxies.
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
