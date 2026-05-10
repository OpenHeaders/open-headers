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
import { ArrowDefs, FILL_BLUE, STROKE, STROKE_BLUE, TEXT, TEXT_DIM } from './_shared';

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
 * Lifecycle: a UML-style sequence diagram of the Sync connection
 * lifetime. Three lifelines — Extension SW, Desktop app, and the
 * Status pill — and a sequence of messages timed top-to-bottom. The
 * Status pill column shows the colored state at each transition so
 * "what does the user see when X happens?" is answerable at a glance.
 */
export const SyncLifecycleDiagram: React.FC = () => {
  const ID = 'sync-life';

  // Lifeline anchor X positions
  const X_SW = 44;
  const X_DESK = 156;
  const X_PILL = 276;
  const PILL_W = 64;

  // Status pill column helper — renders a tiny pill at a given Y to
  // mirror what the actual UI shows at that point in the timeline.
  const StatusMarker = ({
    y,
    level,
    label,
  }: {
    y: number;
    level: Exclude<Level, 'grey'>;
    label: string;
  }) => {
    const fill = level === 'green' ? SUCCESS_BG : level === 'yellow' ? WARNING_BG : ERROR_BG;
    const stroke = dotColor(level);
    return (
      <g>
        <rect x={X_PILL - PILL_W / 2} y={y - 7} width={PILL_W} height={14} rx={4} fill={fill} stroke={stroke} />
        <circle cx={X_PILL - PILL_W / 2 + 5} cy={y} r={2.5} fill={dotColor(level)} />
        <text x={X_PILL - PILL_W / 2 + 11} y={y + 3} fontSize={8} fontWeight={700} fill={TEXT}>
          {label}
        </text>
      </g>
    );
  };

  const ARROW_LABEL_FS = 8;

  return (
    <svg
      viewBox="0 0 320 340"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Sync connection lifecycle as a sequence diagram — extension service worker connects to the desktop app, status pill transitions green to yellow to green over time"
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        How the Sync pill changes over time
      </text>

      {/* Lifeline headers */}
      <rect x={X_SW - 40} y={24} width={80} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={X_SW} y={38} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Extension SW
      </text>

      <rect x={X_DESK - 40} y={24} width={80} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={X_DESK} y={38} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Desktop app
      </text>

      <rect x={X_PILL - PILL_W / 2 - 4} y={24} width={PILL_W + 8} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={X_PILL} y={38} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Sync pill
      </text>

      {/* Lifelines */}
      {[X_SW, X_DESK, X_PILL].map((x) => (
        <line key={x} x1={x} y1={46} x2={x} y2={310} stroke={STROKE} strokeDasharray="2 3" />
      ))}

      {/* ── Event 1: SW boot reads settings ── */}
      <text x={X_SW} y={62} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        SW wakes
      </text>
      <text x={X_SW} y={74} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        reads settings
      </text>

      {/* ── Event 2: auto-connect off branch — status disabled (green) ── */}
      <text x={(X_SW + X_PILL) / 2} y={90} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        if auto-connect = off →
      </text>
      <StatusMarker y={94} level="green" label="Disabled" />

      {/* divider */}
      <line x1={20} y1={108} x2={300} y2={108} stroke={BORDER} strokeDasharray="3 3" />
      <text x={160} y={105} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        otherwise →
      </text>

      {/* ── Event 3: SW initiates WS connection ── */}
      <line x1={X_SW} y1={122} x2={X_DESK - 2} y2={122} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={118} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={TEXT}>
        WebSocket connect
      </text>
      <StatusMarker y={126} level="yellow" label="Connecting" />

      {/* ── Event 4: handshake OK ── */}
      <line
        x1={X_DESK}
        y1={146}
        x2={X_SW + 2}
        y2={146}
        stroke={SUCCESS}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text x={(X_SW + X_DESK) / 2} y={142} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={SUCCESS}>
        handshake OK
      </text>
      <StatusMarker y={150} level="green" label="Connected" />

      {/* Activation bars on both lifelines while connected */}
      <rect x={X_SW - 3} y={150} width={6} height={50} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <rect x={X_DESK - 3} y={150} width={6} height={50} fill={SUCCESS_BG} stroke={dotColor('green')} />

      {/* ── Event 5: keep-alive ping ── */}
      <line x1={X_SW + 3} y1={172} x2={X_DESK - 3} y2={172} stroke={STROKE} strokeWidth={1} strokeDasharray="2 2" markerEnd={`url(#${ID})`} />
      <line x1={X_DESK - 3} y1={184} x2={X_SW + 3} y2={184} stroke={STROKE} strokeWidth={1} strokeDasharray="2 2" markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={168} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={TEXT_DIM}>
        ping ⇄ pong
      </text>

      {/* ── Event 6: drop ── */}
      <text x={(X_SW + X_DESK) / 2} y={216} textAnchor="middle" fontSize={ARROW_LABEL_FS} fontWeight={700} fill={WARNING}>
        ✗ connection drops
      </text>
      <line x1={X_SW + 8} y1={220} x2={X_DESK - 8} y2={220} stroke={WARNING} strokeWidth={1} strokeDasharray="3 3" />
      <line x1={(X_SW + X_DESK) / 2 - 5} y1={215} x2={(X_SW + X_DESK) / 2 + 5} y2={225} stroke={WARNING} strokeWidth={1.5} />
      <line x1={(X_SW + X_DESK) / 2 + 5} y1={215} x2={(X_SW + X_DESK) / 2 - 5} y2={225} stroke={WARNING} strokeWidth={1.5} />
      <StatusMarker y={224} level="yellow" label="Retry #1" />

      {/* ── Event 7: backoff + retry ── */}
      <text x={X_SW} y={246} textAnchor="middle" fontSize={ARROW_LABEL_FS} fontStyle="italic" fill={TEXT_DIM}>
        backoff
      </text>
      <line x1={X_SW} y1={252} x2={X_DESK - 2} y2={252} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={(X_SW + X_DESK) / 2} y={248} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={TEXT}>
        retry connect
      </text>
      <StatusMarker y={256} level="yellow" label="Retry #2" />

      {/* ── Event 8: handshake OK again ── */}
      <line
        x1={X_DESK}
        y1={278}
        x2={X_SW + 2}
        y2={278}
        stroke={SUCCESS}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text x={(X_SW + X_DESK) / 2} y={274} textAnchor="middle" fontSize={ARROW_LABEL_FS} fill={SUCCESS}>
        handshake OK
      </text>
      <StatusMarker y={282} level="green" label="Connected" />

      <text x={160} y={326} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Exponential backoff between retries · pings detect silent proxy drops
      </text>
    </svg>
  );
};

// ─── Rules subsystem — compile pipeline + capacity ────────────────

/**
 * Pipeline: how a user rule turns into a live DNR entry. Four
 * stages — compile, resolve variables, cap check, Chrome apply —
 * each annotated with which Status state it can emit if it goes
 * sideways.
 */
export const RulesPipelineDiagram: React.FC = () => {
  const ID = 'rules-pipe';

  type Stage = { name: string; sub: string; outcome?: { label: string; level: Exclude<Level, 'grey'> } };
  const STAGES: Stage[] = [
    { name: 'Your rule', sub: 'Auth: Bearer {{TOKEN}}' },
    { name: 'Compile', sub: 'to DNR JSON' },
    { name: 'Resolve {{VAR}}', sub: 'vault · env · workspace', outcome: { label: 'unresolved → yellow', level: 'yellow' } },
    { name: 'Cap check', sub: 'maxActiveRules', outcome: { label: 'over cap → yellow', level: 'yellow' } },
    { name: 'Chrome apply', sub: 'updateDynamicRules', outcome: { label: 'rejected → red', level: 'red' } },
    { name: 'Live rule', sub: 'matches requests', outcome: { label: 'N active → green', level: 'green' } },
  ];

  const ROW_X = 30;
  const ROW_W = 260;
  const ROW_H = 26;
  const ROW_GAP = 8;
  const ROW_Y0 = 36;

  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Rules pipeline — user rule compiles, resolves variables, passes cap check, then Chrome applies it. Each stage can emit a Status level if it goes wrong."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        How a rule becomes a live DNR entry
      </text>

      {STAGES.map((stage, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const isLive = i === STAGES.length - 1;
        const fill = isLive ? SUCCESS_BG : BG_CONTAINER;
        const stroke = isLive ? dotColor('green') : BORDER;
        return (
          <g key={stage.name}>
            <rect x={ROW_X} y={y} width={ROW_W} height={ROW_H} rx={4} fill={fill} stroke={stroke} />
            {/* Stage number badge */}
            <circle cx={ROW_X + 14} cy={y + ROW_H / 2} r={8} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={ROW_X + 14} y={y + ROW_H / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
              {i + 1}
            </text>
            {/* Stage label */}
            <text x={ROW_X + 30} y={y + 12} fontSize={10} fontWeight={700} fill={TEXT}>
              {stage.name}
            </text>
            <text x={ROW_X + 30} y={y + 23} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {stage.sub}
            </text>
            {/* Outcome badge (right side) */}
            {stage.outcome && (
              <g>
                <rect
                  x={ROW_X + ROW_W - 110}
                  y={y + 5}
                  width={104}
                  height={ROW_H - 10}
                  rx={3}
                  fill={
                    stage.outcome.level === 'red'
                      ? ERROR_BG
                      : stage.outcome.level === 'yellow'
                        ? WARNING_BG
                        : SUCCESS_BG
                  }
                  stroke={dotColor(stage.outcome.level)}
                />
                <circle
                  cx={ROW_X + ROW_W - 104}
                  cy={y + ROW_H / 2}
                  r={2.5}
                  fill={dotColor(stage.outcome.level)}
                />
                <text
                  x={ROW_X + ROW_W - 96}
                  y={y + ROW_H / 2 + 3}
                  fontSize={8}
                  fontWeight={600}
                  fill={TEXT}
                >
                  {stage.outcome.label}
                </text>
              </g>
            )}
            {/* Connector to next */}
            {i < STAGES.length - 1 && (
              <line
                x1={ROW_X + 14}
                y1={y + ROW_H}
                x2={ROW_X + 14}
                y2={y + ROW_H + ROW_GAP}
                stroke={STROKE}
                strokeWidth={1.5}
                markerEnd={`url(#${ID})`}
              />
            )}
          </g>
        );
      })}

      <text x={160} y={250} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Rebuild fires on every save · paused state stays green ("Rule execution paused").
      </text>
    </svg>
  );
};

/**
 * Capacity bar — visualizes how the rule count maps to a Status
 * level. Three zones: 0…threshold (green), threshold…cap (yellow,
 * "approaching"), and cap…Chrome ceiling (red — but the engine
 * never gets here because rules over `cap` are truncated up-front,
 * with the truncation reported as yellow).
 */
export const RulesCapacityDiagram: React.FC = () => {
  // Stylised — actual numbers come from settings. Defaults documented
  // here for clarity; tweak the visualised proportions, not the
  // semantics.
  const MAX = 30000; // chrome's hard ceiling (MAX_DYNAMIC)
  const CAP = 5000; // rulesEngine.maxActiveRules default
  const WARN = 4000; // rulesEngine.largeRuleSetThreshold default

  const BAR_X = 20;
  const BAR_Y = 80;
  const BAR_W = 280;
  const BAR_H = 28;

  const fracWarn = WARN / MAX;
  const fracCap = CAP / MAX;
  const warnX = BAR_X + BAR_W * fracWarn;
  const capX = BAR_X + BAR_W * fracCap;

  // Three example markers
  const HEALTHY = 1200;
  const APPROACHING = 4500;
  const OVER = 5800;
  const x = (count: number) => BAR_X + BAR_W * Math.min(count / MAX, 1);

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="DNR capacity bar — green up to the warning threshold, yellow up to the truncation cap, red beyond. The engine truncates over the cap so the red zone is never actually reached at runtime."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Rule capacity — where each rule count lands
      </text>

      {/* Zone labels above the bar */}
      <text x={(BAR_X + warnX) / 2} y={36} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('green')}>
        ✓ healthy
      </text>
      <text x={(warnX + capX) / 2} y={36} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('yellow')}>
        approaching
      </text>
      <text x={(capX + (BAR_X + BAR_W)) / 2} y={36} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('red')}>
        (truncated)
      </text>

      {/* Threshold rule counts */}
      <text x={(BAR_X + warnX) / 2} y={50} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        0 – warn
      </text>
      <text x={(warnX + capX) / 2} y={50} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        warn – cap
      </text>
      <text x={(capX + (BAR_X + BAR_W)) / 2} y={50} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        over cap
      </text>

      {/* Bar — three colored segments */}
      <rect x={BAR_X} y={BAR_Y} width={warnX - BAR_X} height={BAR_H} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <rect x={warnX} y={BAR_Y} width={capX - warnX} height={BAR_H} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <rect
        x={capX}
        y={BAR_Y}
        width={BAR_X + BAR_W - capX}
        height={BAR_H}
        fill={ERROR_BG}
        stroke={dotColor('red')}
        strokeDasharray="3 2"
      />

      {/* Threshold markers below the bar */}
      <line x1={warnX} y1={BAR_Y + BAR_H} x2={warnX} y2={BAR_Y + BAR_H + 8} stroke={dotColor('yellow')} strokeWidth={1.5} />
      <text x={warnX} y={BAR_Y + BAR_H + 20} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
        warn
      </text>
      <text x={warnX} y={BAR_Y + BAR_H + 30} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
        largeRuleSetThreshold
      </text>

      <line x1={capX} y1={BAR_Y + BAR_H} x2={capX} y2={BAR_Y + BAR_H + 8} stroke={dotColor('red')} strokeWidth={1.5} />
      <text x={capX} y={BAR_Y + BAR_H + 20} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
        cap
      </text>
      <text x={capX} y={BAR_Y + BAR_H + 30} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
        maxActiveRules
      </text>

      <line x1={BAR_X + BAR_W} y1={BAR_Y + BAR_H} x2={BAR_X + BAR_W} y2={BAR_Y + BAR_H + 8} stroke={GREY} strokeWidth={1.5} />
      <text x={BAR_X + BAR_W} y={BAR_Y + BAR_H + 20} textAnchor="end" fontSize={8} fontWeight={700} fill={TEXT}>
        30k
      </text>
      <text x={BAR_X + BAR_W} y={BAR_Y + BAR_H + 30} textAnchor="end" fontSize={7} fill={TEXT_DIM}>
        Chrome ceiling
      </text>

      {/* Example count needles above the bar */}
      {[
        { count: HEALTHY, label: '1,200', level: 'green' as const },
        { count: APPROACHING, label: '4,500', level: 'yellow' as const },
        { count: OVER, label: '5,800', level: 'red' as const },
      ].map((m) => (
        <g key={m.count}>
          <line x1={x(m.count)} y1={BAR_Y - 4} x2={x(m.count)} y2={BAR_Y} stroke={dotColor(m.level)} strokeWidth={2} />
          <rect
            x={x(m.count) - 22}
            y={BAR_Y - 22}
            width={44}
            height={14}
            rx={3}
            fill={
              m.level === 'red' ? ERROR_BG : m.level === 'yellow' ? WARNING_BG : SUCCESS_BG
            }
            stroke={dotColor(m.level)}
          />
          <text x={x(m.count)} y={BAR_Y - 12} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
            {m.label}
          </text>
        </g>
      ))}

      <text x={160} y={160} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Rules over the cap are dropped in match-order (top wins).
      </text>
      <text x={160} y={176} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        The yellow status carries the dropped count so you know what's missing.
      </text>
      <text x={160} y={204} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        Defaults shown — both thresholds are configurable in Settings.
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
