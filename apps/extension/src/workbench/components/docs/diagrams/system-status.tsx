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
 * Mini-rendering of the real Open Headers extension logo
 * (`apps/extension/src/assets/images/logo-pixel.svg`). Letter strokes
 * and the smile curve are preserved so the mark stays recognizable
 * even at toolbar-icon size. Inlined here instead of an `<image href>`
 * so colors stay theme-stable and the SVG ships with the diagram.
 */
const OhLogo: React.FC<{ x: number; y: number; size: number; idSuffix: string }> = ({
  x,
  y,
  size,
  idSuffix,
}) => {
  const scale = size / 512;
  const gradientId = `oh-bg-${idSuffix}`;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5890FF" />
          <stop offset="100%" stopColor="#4A7FE8" />
        </linearGradient>
      </defs>
      <rect width={512} height={512} rx={80} fill={`url(#${gradientId})`} />
      <g transform="translate(32 32) scale(0.875)">
        <g fill="white" shapeRendering="crispEdges">
          <rect x={80} y={112} width={128} height={32} />
          <rect x={48} y={144} width={64} height={160} />
          <rect x={176} y={144} width={64} height={160} />
          <rect x={80} y={304} width={128} height={32} />
          <rect x={272} y={112} width={64} height={224} />
          <rect x={400} y={112} width={64} height={224} />
          <rect x={272} y={208} width={192} height={32} />
        </g>
        <rect x={112} y={144} width={64} height={160} fill="#FF4444" shapeRendering="crispEdges" />
        <path
          d="M 80 388 C 180 448, 332 448, 432 388"
          stroke="white"
          strokeWidth={28}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

/**
 * Reusable: scaled-up version of the `SurfaceContext` glyph. Draws a
 * Chrome-style browser window — title bar with traffic lights, tab
 * strip, address bar — and lets the caller pass child SVG nodes for
 * whatever surface-specific content sits inside the content area.
 */
const BrowserFrame: React.FC<{ tabLabel: string; addressBar: string; children: React.ReactNode }> = ({
  tabLabel,
  addressBar,
  children,
}) => {
  const FX = 8;
  const FY = 18;
  const FW = 304;
  const FH = 160;

  const titleY = FY;
  const titleH = 16;
  const tabsY = titleY + titleH;
  const tabsH = 18;
  const addrY = tabsY + tabsH;
  const addrH = 18;
  const bodyY = addrY + addrH;
  const bodyH = FH - (titleH + tabsH + addrH);

  return (
    <g>
      {/* Outer frame */}
      <rect x={FX} y={FY} width={FW} height={FH} rx={6} fill={BG_CONTAINER} stroke={BORDER} />

      {/* Title bar — traffic lights */}
      <rect x={FX} y={titleY} width={FW} height={titleH} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={FX + 10 + i * 8} cy={titleY + titleH / 2} r={3} fill={GREY} />
      ))}

      {/* Tab strip */}
      <rect x={FX} y={tabsY} width={FW} height={tabsH} fill={FILL_SECONDARY} stroke={BORDER} />
      <rect
        x={FX + 8}
        y={tabsY + 3}
        width={120}
        height={tabsH - 3}
        rx={4}
        fill={BG_CONTAINER}
        stroke={BORDER}
      />
      <text x={FX + 16} y={tabsY + tabsH / 2 + 3} fontSize={9} fontWeight={700} fill={TEXT}>
        {tabLabel}
      </text>
      <text x={FX + FW - 8} y={tabsY + tabsH / 2 + 3} textAnchor="end" fontSize={11} fill={GREY}>
        +
      </text>

      {/* Address bar */}
      <rect x={FX} y={addrY} width={FW} height={addrH} fill={BG_CONTAINER} stroke={BORDER} />
      <rect
        x={FX + 8}
        y={addrY + 3}
        width={FW - 36}
        height={addrH - 6}
        rx={6}
        fill={FILL_SECONDARY}
        stroke={BORDER}
      />
      <text x={FX + 16} y={addrY + addrH / 2 + 3} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        {addressBar}
      </text>
      {/* Toolbar extension icon slot */}
      <rect
        x={FX + FW - 22}
        y={addrY + 3}
        width={14}
        height={addrH - 6}
        rx={3}
        fill={FILL_SECONDARY}
        stroke={BORDER}
      />

      {/* Caller-provided body content (positioned absolutely inside the frame) */}
      <g transform={`translate(0, 0)`}>{children}</g>

      {/* Body bounds exposed via data-attr for clarity — not visible */}
      <rect
        x={FX}
        y={bodyY}
        width={FW}
        height={bodyH}
        fill="transparent"
        stroke={BORDER}
        strokeWidth={0.5}
      />
    </g>
  );
};

/**
 * Workbench surface: the browser shows a workbench.html tab and the
 * status row lives in the workbench's bottom footer. Inside the body
 * we paint a few faded UI placeholders for context, and a real-looking
 * footer strip with the six pills as the focal point.
 */
export const SystemStatusWorkbenchSurfaceDiagram: React.FC = () => {
  const charW = 4.3;
  const PAD_X = 4;
  const DOT_R = 2;
  const DOT_GAP = 3;
  const PILL_H = 14;
  const PILL_GAP = 3;
  const widthOf = (name: string) =>
    Math.ceil(name.length * charW) + PAD_X * 2 + DOT_R * 2 + DOT_GAP;

  const ROW: { name: string; level: Level }[] = SUBSYSTEMS.map((s) => ({ name: s, level: 'green' }));
  const totalW = ROW.reduce((sum, p) => sum + widthOf(p.name), 0) + PILL_GAP * (ROW.length - 1);

  // Footer strip lives at the bottom of the body area.
  const FOOTER_H = 22;
  const FOOTER_Y = 178 - FOOTER_H; // frame bottom edge - footer height
  const FOOTER_X = 8;
  const FOOTER_W = 304;
  const pillsStartX = FOOTER_X + (FOOTER_W - totalW) / 2;
  const pillsCenterY = FOOTER_Y + FOOTER_H / 2;

  let cursor = pillsStartX;
  const pills = ROW.map((p) => {
    const w = widthOf(p.name);
    const x = cursor;
    cursor += w + PILL_GAP;
    return (
      <g key={p.name}>
        <rect
          x={x}
          y={pillsCenterY - PILL_H / 2}
          width={w}
          height={PILL_H}
          rx={7}
          fill={BG_CONTAINER}
          stroke={BORDER}
        />
        <circle cx={x + PAD_X + DOT_R} cy={pillsCenterY} r={DOT_R} fill={dotColor(p.level)} />
        <text x={x + PAD_X + DOT_R * 2 + DOT_GAP} y={pillsCenterY + 3} fontSize={8} fontWeight={600} fill={TEXT}>
          {p.name}
        </text>
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Workbench surface — the OpenHeaders workbench tab. The status row lives in the bottom footer with one pill per subsystem."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        Workbench: status row in the footer
      </text>

      <BrowserFrame tabLabel="Open Headers" addressBar="chrome-extension://…/workbench.html">
        {/* Faded body placeholders — sidebar + content panes */}
        <rect x={16} y={72} width={56} height={86} rx={4} fill="var(--ant-color-fill-quaternary)" />
        <rect x={80} y={72} width={232} height={86} rx={4} fill="var(--ant-color-fill-quaternary)" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={22}
            y={82 + i * 16}
            width={44}
            height={6}
            rx={2}
            fill="var(--ant-color-fill-tertiary)"
          />
        ))}
        {[0, 1, 2].map((i) => (
          <rect
            key={`m-${i}`}
            x={88}
            y={82 + i * 16}
            width={216 - i * 40}
            height={6}
            rx={2}
            fill="var(--ant-color-fill-tertiary)"
          />
        ))}

        {/* Footer strip highlighted */}
        <rect
          x={FOOTER_X}
          y={FOOTER_Y}
          width={FOOTER_W}
          height={FOOTER_H}
          fill={FILL_SECONDARY}
          stroke={dotColor('green')}
          strokeWidth={1.5}
        />
        {pills}
      </BrowserFrame>

      {/* Callout */}
      <text x={160} y={204} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        ↑ six pills — one per subsystem, click any to open the popover.
      </text>
    </svg>
  );
};

/**
 * Popup surface: the extension popup hangs from the toolbar icon.
 * Inside the popup, the status indicator lives in the FOOTER (not
 * the header) — rendered as a colored dot + "System status" label.
 * Matches the real UI: small `● System status v5.0.0` strip at the
 * bottom of the popup, alongside the Debug + help icons.
 */
export const SystemStatusPopupSurfaceDiagram: React.FC = () => {
  // Popup dimensions — anchored BELOW the address bar so the
  // browser-frame separators don't draw through the popup header.
  const PU_W = 172;
  const PU_H = 110;
  const PU_X = 312 - PU_W - 4;
  const PU_Y = 76;
  const HEAD_H = 22;
  const FOOTER_H = 22;
  const BODY_Y = PU_Y + HEAD_H;
  const FOOTER_Y = PU_Y + PU_H - FOOTER_H;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Popup surface — the extension popup hangs from the toolbar icon. The status pill sits in the popup's bottom footer as a dot plus 'System status' label."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        Popup: System status pill in the footer
      </text>

      <BrowserFrame tabLabel="example.com" addressBar="https://example.com">
        {/* Page content placeholders (dimmed) */}
        <g opacity={0.4}>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={16}
              y={86 + i * 14}
              width={290 - i * 28}
              height={6}
              rx={2}
              fill="var(--ant-color-fill-tertiary)"
            />
          ))}
        </g>

        {/* Toolbar extension icon — actual Open Headers logo */}
        <OhLogo x={286} y={53} size={20} idSuffix="popup-icon" />
        <rect
          x={284}
          y={51}
          width={24}
          height={24}
          rx={5}
          fill="transparent"
          stroke={STROKE_BLUE}
          strokeWidth={1.5}
          strokeDasharray="2 2"
        />

        {/* Popup window */}
        <rect x={PU_X} y={PU_Y} width={PU_W} height={PU_H} rx={5} fill={BG_CONTAINER} stroke={BORDER} />

        {/* Popup header (top) — OH logo + name + small chip suggesting the workspace selector */}
        <rect x={PU_X} y={PU_Y} width={PU_W} height={HEAD_H} rx={5} fill={FILL_SECONDARY} stroke={BORDER} />
        <OhLogo x={PU_X + 6} y={PU_Y + 5} size={12} idSuffix="popup-head" />
        <text x={PU_X + 22} y={PU_Y + HEAD_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
          Open Headers
        </text>
        <rect
          x={PU_X + PU_W - 32}
          y={PU_Y + 5}
          width={26}
          height={12}
          rx={6}
          fill={BG_CONTAINER}
          stroke={BORDER}
        />
        <text x={PU_X + PU_W - 19} y={PU_Y + 14} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
          ws ▾
        </text>

        {/* Popup body — a few faded placeholder rows */}
        <g opacity={0.55}>
          {[0, 1, 2].map((i) => (
            <rect
              key={`pbr-${i}`}
              x={PU_X + 10}
              y={BODY_Y + 10 + i * 12}
              width={PU_W - 24 - i * 18}
              height={5}
              rx={2}
              fill="var(--ant-color-fill-tertiary)"
            />
          ))}
        </g>

        {/* Popup footer — the focal point, with the status pill highlighted */}
        <rect
          x={PU_X}
          y={FOOTER_Y}
          width={PU_W}
          height={FOOTER_H}
          fill={FILL_SECONDARY}
          stroke={dotColor('green')}
          strokeWidth={1.5}
        />
        {/* Help icon on the left */}
        <circle cx={PU_X + 14} cy={FOOTER_Y + FOOTER_H / 2} r={6} fill={BG_CONTAINER} stroke={BORDER} />
        <text x={PU_X + 14} y={FOOTER_Y + FOOTER_H / 2 + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT_DIM}>
          ?
        </text>
        {/* Status pill — dot + label */}
        <circle cx={PU_X + 38} cy={FOOTER_Y + FOOTER_H / 2} r={3.5} fill={SUCCESS} />
        <text
          x={PU_X + 46}
          y={FOOTER_Y + FOOTER_H / 2 + 3}
          fontSize={9}
          fontWeight={700}
          fill={TEXT}
        >
          System status
        </text>
        {/* Right-aligned version chip */}
        <text
          x={PU_X + PU_W - 8}
          y={FOOTER_Y + FOOTER_H / 2 + 3}
          textAnchor="end"
          fontSize={8}
          fill={TEXT_DIM}
        >
          v5.0.0
        </text>
      </BrowserFrame>

      <text x={160} y={204} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        ↑ dot + "System status" label sits in the popup's footer strip.
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

      <text x={160} y={244} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Rebuild fires on every save.
      </text>
      <text x={160} y={256} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Paused stays green ("Rule execution paused").
      </text>
    </svg>
  );
};

/**
 * Capacity bar — three zones mapped to the meaningful 0…1.2× cap
 * range. Showing all the way to Chrome's 30k ceiling would crush
 * the warn/cap region into a sliver, since the cap default is
 * 5000. The 30k figure is a footer note, not bar geometry.
 */
export const RulesCapacityDiagram: React.FC = () => {
  // Stylised defaults — the real values come from settings.
  const CAP = 5000; // rulesEngine.maxActiveRules
  const WARN = 4000; // rulesEngine.largeRuleSetThreshold
  const DISPLAY_MAX = 6000; // 1.2× CAP — focuses on the meaningful range

  const BAR_X = 20;
  const BAR_Y = 78;
  const BAR_W = 280;
  const BAR_H = 28;

  const warnX = BAR_X + BAR_W * (WARN / DISPLAY_MAX);
  const capX = BAR_X + BAR_W * (CAP / DISPLAY_MAX);
  const endX = BAR_X + BAR_W;

  // Three example markers (rule counts), spaced so their badges
  // don't collide.
  const HEALTHY = 1200;
  const APPROACHING = 4500;
  const OVER = 5600;
  const x = (count: number) => BAR_X + BAR_W * Math.min(count / DISPLAY_MAX, 1);

  return (
    <svg
      viewBox="0 0 320 230"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="DNR capacity bar — green up to the warning threshold, yellow up to the truncation cap, red beyond. Rules over the cap are dropped, so the red zone is never reached at runtime."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Rule capacity — where each rule count lands
      </text>

      {/* Zone labels above the bar */}
      <text x={(BAR_X + warnX) / 2} y={34} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('green')}>
        ✓ healthy
      </text>
      <text
        x={(warnX + capX) / 2 - 10}
        y={34}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={dotColor('yellow')}
      >
        approach
      </text>
      <text x={(capX + endX) / 2} y={34} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('red')}>
        truncated
      </text>

      {/* Example count needles above the bar */}
      {[
        { count: HEALTHY, label: '1,200', level: 'green' as const },
        { count: APPROACHING, label: '4,500', level: 'yellow' as const },
        { count: OVER, label: '5,600', level: 'red' as const },
      ].map((m) => (
        <g key={m.count}>
          <rect
            x={x(m.count) - 22}
            y={48}
            width={44}
            height={16}
            rx={3}
            fill={m.level === 'red' ? ERROR_BG : m.level === 'yellow' ? WARNING_BG : SUCCESS_BG}
            stroke={dotColor(m.level)}
          />
          <text x={x(m.count)} y={59} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
            {m.label}
          </text>
          <line x1={x(m.count)} y1={64} x2={x(m.count)} y2={BAR_Y} stroke={dotColor(m.level)} strokeWidth={1.5} />
        </g>
      ))}

      {/* Bar — three colored segments */}
      <rect x={BAR_X} y={BAR_Y} width={warnX - BAR_X} height={BAR_H} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <rect x={warnX} y={BAR_Y} width={capX - warnX} height={BAR_H} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <rect
        x={capX}
        y={BAR_Y}
        width={endX - capX}
        height={BAR_H}
        fill={ERROR_BG}
        stroke={dotColor('red')}
        strokeDasharray="3 2"
      />

      {/* Threshold markers below the bar */}
      <line x1={warnX} y1={BAR_Y + BAR_H} x2={warnX} y2={BAR_Y + BAR_H + 6} stroke={dotColor('yellow')} strokeWidth={1.5} />
      <text x={warnX} y={BAR_Y + BAR_H + 18} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        warn
      </text>
      <text x={warnX} y={BAR_Y + BAR_H + 29} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        4,000
      </text>

      <line x1={capX} y1={BAR_Y + BAR_H} x2={capX} y2={BAR_Y + BAR_H + 6} stroke={dotColor('red')} strokeWidth={1.5} />
      <text x={capX} y={BAR_Y + BAR_H + 18} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        cap
      </text>
      <text x={capX} y={BAR_Y + BAR_H + 29} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        5,000
      </text>

      {/* Legend / footer notes */}
      <text x={20} y={172} fontSize={8} fontWeight={700} fill={TEXT}>
        warn
      </text>
      <text x={48} y={172} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        rulesEngine.largeRuleSetThreshold
      </text>

      <text x={20} y={186} fontSize={8} fontWeight={700} fill={TEXT}>
        cap
      </text>
      <text x={48} y={186} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        rulesEngine.maxActiveRules
      </text>

      <text x={160} y={208} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Rules over the cap are dropped in match-order (top wins).
      </text>
      <text x={160} y={222} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        Chrome's hard ceiling sits much further out at 30,000.
      </text>
    </svg>
  );
};

// ─── Requests subsystem — outcomes + scope ────────────────────────

/**
 * Outcomes: clarifies the surprising-but-correct rule that ANY HTTP
 * response (including 4xx/5xx) flips the pill green. The pill goes
 * yellow only when the request never produced a response — network
 * offline, DNS failure, abort. Two columns of example outcomes make
 * the distinction visual.
 */
export const RequestExecutorOutcomesDiagram: React.FC = () => {
  const ID = 'req-out';
  const errBorder = 'var(--ant-color-error-border)';

  const GREEN_EXAMPLES = [
    { status: '200', text: 'OK' },
    { status: '404', text: 'Not Found' },
    { status: '500', text: 'Server Error' },
  ];
  const YELLOW_EXAMPLES = [
    { status: '—', text: 'NetworkError' },
    { status: '—', text: 'Aborted' },
    { status: '—', text: 'Offline / DNS' },
  ];

  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Request executor outcomes — any HTTP response, including 4xx and 5xx, turns the pill green. Only network-level failures with no response turn it yellow."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        What turns the Requests pill which color?
      </text>

      {/* Source: Send button card */}
      <rect x={100} y={30} width={120} height={36} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={160} y={45} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Request editor
      </text>
      <rect x={140} y={51} width={40} height={12} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={60} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
        Send ▸
      </text>

      {/* Arrow down to executor */}
      <line x1={160} y1={66} x2={160} y2={82} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Executor box */}
      <rect x={120} y={84} width={80} height={22} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={160} y={99} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Executor fires
      </text>

      {/* Split arrows down to two outcomes */}
      <line x1={150} y1={106} x2={80} y2={130} stroke={dotColor('green')} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line x1={170} y1={106} x2={240} y2={130} stroke={dotColor('yellow')} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* LEFT column — got HTTP response */}
      <rect x={10} y={132} width={140} height={130} rx={6} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <text x={80} y={148} textAnchor="middle" fontSize={10} fontWeight={700} fill={dotColor('green')}>
        ✓ got HTTP response
      </text>
      <text x={80} y={161} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        any status code counts
      </text>
      {GREEN_EXAMPLES.map((ex, i) => {
        const ry = 174 + i * 22;
        return (
          <g key={ex.text}>
            <rect x={18} y={ry} width={124} height={18} rx={3} fill={BG_CONTAINER} stroke={dotColor('green')} />
            <rect x={22} y={ry + 2} width={28} height={14} rx={2} fill={SUCCESS_BG} stroke={dotColor('green')} />
            <text x={36} y={ry + 13} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
              {ex.status}
            </text>
            <text x={56} y={ry + 13} fontSize={9} fill={TEXT}>
              {ex.text}
            </text>
          </g>
        );
      })}
      <text x={80} y={252} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('green')}>
        Pill → green
      </text>

      {/* RIGHT column — network failure */}
      <rect x={170} y={132} width={140} height={130} rx={6} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <text x={240} y={148} textAnchor="middle" fontSize={10} fontWeight={700} fill={dotColor('yellow')}>
        ✗ no response
      </text>
      <text x={240} y={161} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        network-level failure
      </text>
      {YELLOW_EXAMPLES.map((ex, i) => {
        const ry = 174 + i * 22;
        return (
          <g key={ex.text}>
            <rect
              x={178}
              y={ry}
              width={124}
              height={18}
              rx={3}
              fill={BG_CONTAINER}
              stroke={errBorder}
              strokeDasharray="2 2"
            />
            <text x={184} y={ry + 13} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
              {ex.status}
            </text>
            <text x={200} y={ry + 13} fontSize={9} fill={TEXT}>
              {ex.text}
            </text>
          </g>
        );
      })}
      <text x={240} y={252} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('yellow')}>
        Pill → yellow
      </text>

      <text x={160} y={274} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        A 500 is still "green" — the request completed, you just got a 500.
      </text>
    </svg>
  );
};

/**
 * Scope: not every request updates the pill. Only ad-hoc Send-button
 * requests from the editor do. Live workflow refreshes pass
 * `silentStatus: true` so they don't spam the pill, and webpage
 * traffic (DNR / monkey-patched fetch) flows through a different
 * system entirely.
 */
export const RequestExecutorScopeDiagram: React.FC = () => {
  type Row = { source: string; sub: string; updates: boolean; reason: string };
  const ROWS: Row[] = [
    {
      source: 'Send ▸ in Request editor',
      sub: 'user-initiated',
      updates: true,
      reason: 'updates pill',
    },
    {
      source: 'Live workflow refresh',
      sub: 'background tick',
      updates: false,
      reason: 'silentStatus: true',
    },
    {
      source: 'Webpage fetch / XHR',
      sub: 'observed by Rules engine',
      updates: false,
      reason: 'different system',
    },
  ];

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Request executor scope — only Send-button requests update the pill. Live workflow refreshes are silent; webpage traffic uses the Rules engine instead."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        What updates the Requests pill?
      </text>

      {ROWS.map((row, i) => {
        const y = 36 + i * 50;
        const fill = row.updates ? SUCCESS_BG : GREY_BG;
        const stroke = row.updates ? dotColor('green') : GREY;
        return (
          <g key={row.source}>
            {/* Source card */}
            <rect x={10} y={y} width={150} height={40} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
            <text x={20} y={y + 16} fontSize={10} fontWeight={700} fill={TEXT}>
              {row.source}
            </text>
            <text x={20} y={y + 30} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {row.sub}
            </text>

            {/* Arrow + status */}
            <line
              x1={160}
              y1={y + 20}
              x2={188}
              y2={y + 20}
              stroke={row.updates ? dotColor('green') : GREY}
              strokeWidth={1.5}
              strokeDasharray={row.updates ? undefined : '3 2'}
              markerEnd="url(#sse-marker)"
            />

            {/* Result pill */}
            <rect x={190} y={y + 8} width={120} height={24} rx={4} fill={fill} stroke={stroke} />
            {row.updates ? (
              <>
                <circle cx={200} cy={y + 20} r={3.5} fill={dotColor('green')} />
                <text x={210} y={y + 24} fontSize={9} fontWeight={700} fill={TEXT}>
                  {row.reason}
                </text>
              </>
            ) : (
              <>
                <text x={200} y={y + 24} fontSize={11} fontWeight={700} fill={GREY}>
                  ✗
                </text>
                <text x={214} y={y + 18} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
                  no update
                </text>
                <text x={214} y={y + 28} fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
                  {row.reason}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* arrow marker (local) */}
      <defs>
        <marker id="sse-marker" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE} />
        </marker>
      </defs>

      <text x={160} y={194} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Only ad-hoc Send-button traffic shapes this pill.
      </text>
    </svg>
  );
};

// ─── Permissions subsystem — silent no-op + audit ─────────────────

/**
 * Impact: the WHY behind this audit. Two side-by-side scenarios of
 * the same rule against the same site. Left: <all_urls> granted →
 * rule fires. Right: host revoked → rule silently no-ops, no error
 * surfaced anywhere except this pill. That silent failure is exactly
 * what users would otherwise spend half an hour debugging.
 */
export const PermissionsImpactDiagram: React.FC = () => {
  const errBorder = 'var(--ant-color-error-border)';
  const errColor = dotColor('red');

  /** A miniature "rule applied / not applied" tile for one side. */
  const Tile = ({
    xOff,
    granted,
  }: {
    xOff: number;
    granted: boolean;
  }) => {
    const accent = granted ? dotColor('green') : errColor;
    const tileBg = granted ? SUCCESS_BG : ERROR_BG;
    return (
      <g>
        {/* Heading band */}
        <rect x={xOff} y={30} width={140} height={22} rx={4} fill={tileBg} stroke={accent} />
        <circle cx={xOff + 12} cy={41} r={3.5} fill={accent} />
        <text x={xOff + 24} y={44} fontSize={10} fontWeight={700} fill={TEXT}>
          {granted ? 'Granted' : 'Narrowed'}
        </text>
        <text x={xOff + 134} y={44} textAnchor="end" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
          {granted ? '<all_urls>' : 'host revoked'}
        </text>

        {/* Same rule shown in both tiles for comparison */}
        <rect
          x={xOff + 6}
          y={62}
          width={128}
          height={28}
          rx={3}
          fill={BG_CONTAINER}
          stroke={BORDER}
        />
        <text x={xOff + 12} y={75} fontSize={9} fontWeight={700} fill={TEXT}>
          Add header
        </text>
        <text x={xOff + 12} y={86} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
          api.openheaders.io
        </text>

        {/* Request flow */}
        <rect x={xOff + 6} y={102} width={56} height={26} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={xOff + 34} y={113} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
          Page
        </text>
        <text x={xOff + 34} y={123} textAnchor="middle" fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
          fetch()
        </text>

        {/* Arrow */}
        <line
          x1={xOff + 62}
          y1={115}
          x2={xOff + 76}
          y2={115}
          stroke={accent}
          strokeWidth={1.5}
          strokeDasharray={granted ? undefined : '2 2'}
          markerEnd={granted ? 'url(#perm-arrow-ok)' : 'url(#perm-arrow-x)'}
        />

        <rect
          x={xOff + 78}
          y={102}
          width={56}
          height={26}
          rx={3}
          fill={tileBg}
          stroke={accent}
          strokeDasharray={granted ? undefined : '3 2'}
        />
        <text x={xOff + 106} y={113} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
          DNR
        </text>
        <text x={xOff + 106} y={123} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
          {granted ? 'applies' : 'no-op'}
        </text>

        {/* Outcome row */}
        <rect x={xOff + 6} y={138} width={128} height={26} rx={3} fill={tileBg} stroke={accent} />
        <text x={xOff + 70} y={150} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
          {granted ? '✓ header arrives' : '✗ header missing'}
        </text>
        <text x={xOff + 70} y={161} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
          {granted ? 'rule fired' : 'silent no-op'}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Same rule, two permission states. With all_urls granted the DNR rule fires. With the host revoked the rule silently no-ops and the header never arrives."
    >
      {/* Local arrow markers — green and red variants */}
      <defs>
        <marker id="perm-arrow-ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={dotColor('green')} />
        </marker>
        <marker id="perm-arrow-x" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={errBorder} />
        </marker>
      </defs>

      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Same rule, two permission states
      </text>

      <Tile xOff={10} granted />
      <Tile xOff={170} granted={false} />

      <text x={160} y={186} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Narrowed hosts don't error — rules just silently do nothing.
      </text>
      <text x={160} y={202} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        The pill's red is the only hint until you restore access.
      </text>
    </svg>
  );
};

/**
 * Audit flow: when this check runs, and what each branch reports.
 * MV3 has no permission-change observer in Chromium, so the audit
 * polls on every SW wake.
 */
export const PermissionsAuditFlowDiagram: React.FC = () => {
  const ID = 'perm-audit';

  type Branch = { label: string; sub: string; level: Exclude<Level, 'grey'>; msg: string };
  const BRANCHES: Branch[] = [
    {
      label: 'granted = true',
      sub: 'happy path',
      level: 'green',
      msg: 'All granted',
    },
    {
      label: 'granted = false',
      sub: 'user revoked a host',
      level: 'red',
      msg: 'Hosts narrowed',
    },
    {
      label: 'throws',
      sub: 'API unavailable',
      level: 'yellow',
      msg: 'Audit failed',
    },
  ];

  // Box geometry: 3 boxes with gaps. Total = 3·BOX_W + 2·BOX_GAP ≤ 300.
  const BOX_W = 94;
  const BOX_GAP = 8;
  const TOTAL_W = BOX_W * 3 + BOX_GAP * 2;
  const BOX_X0 = (320 - TOTAL_W) / 2;
  const boxX = (i: number) => BOX_X0 + i * (BOX_W + BOX_GAP);
  const boxCenter = (i: number) => boxX(i) + BOX_W / 2;

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="When the audit runs and which Status level each outcome reports."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        When does the audit run, and what does each branch report?
      </text>

      {/* SW wake trigger */}
      <rect x={104} y={30} width={112} height={28} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={160} y={42} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        SW wakes
      </text>
      <text x={160} y={52} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        first hydration
      </text>

      {/* Arrow down */}
      <line x1={160} y1={58} x2={160} y2={74} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* permissions.contains call */}
      <rect x={64} y={76} width={192} height={28} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={160} y={88} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        chrome.permissions.contains
      </text>
      <text x={160} y={99} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        {'{ origins: [\'<all_urls>\'] }'}
      </text>

      {/* Three branch arrows */}
      {BRANCHES.map((b, i) => (
        <line
          key={b.label}
          x1={160}
          y1={104}
          x2={boxCenter(i)}
          y2={124}
          stroke={dotColor(b.level)}
          strokeWidth={1.5}
          markerEnd={`url(#${ID})`}
        />
      ))}

      {/* Branch outcome boxes */}
      {BRANCHES.map((branch, i) => {
        const x = boxX(i);
        const cx = boxCenter(i);
        const fill = branch.level === 'red' ? ERROR_BG : branch.level === 'yellow' ? WARNING_BG : SUCCESS_BG;
        const stroke = dotColor(branch.level);
        return (
          <g key={branch.label}>
            <rect x={x} y={126} width={BOX_W} height={86} rx={4} fill={fill} stroke={stroke} />
            <text x={cx} y={140} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
              {branch.label}
            </text>
            <text x={cx} y={152} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {branch.sub}
            </text>
            {/* Resulting pill */}
            <rect x={x + 8} y={160} width={BOX_W - 16} height={16} rx={3} fill={BG_CONTAINER} stroke={stroke} />
            <circle cx={x + 16} cy={168} r={2.5} fill={stroke} />
            <text x={cx + 4} y={171} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT}>
              {branch.level === 'green' ? 'green' : branch.level === 'yellow' ? 'yellow' : 'red'}
            </text>
            <text x={cx} y={196} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
              "{branch.msg}"
            </text>
          </g>
        );
      })}

      <text x={160} y={224} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        MV3 has no permission-change observer —
      </text>
      <text x={160} y={236} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        re-check fires on every SW wake.
      </text>
    </svg>
  );
};

// ─── Secrets subsystem — vault hydrate + drift ────────────────────

/**
 * Hydration: on SW wake, the vault blob loads from chrome.storage,
 * and every entry runs through the workspace schema. Matches are
 * kept; drift entries are dropped + logged + reported as yellow.
 * Three concrete rows make the keep/drop outcome visible at a glance.
 */
export const VaultHydrationDiagram: React.FC = () => {
  const ID = 'vault-hyd';
  const errBorder = 'var(--ant-color-error-border)';

  type Entry = { uid: string; ok: boolean; reason?: string };
  const ENTRIES: Entry[] = [
    { uid: 'sec_a1f3', ok: true },
    { uid: 'sec_b2c4', ok: true },
    { uid: 'sec_c3d5', ok: false, reason: 'old shape' },
  ];

  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Vault hydration — vault blob loads from storage, every entry runs through the schema. Matches are kept; drift entries are dropped and reported as yellow."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Vault hydrate on SW wake
      </text>

      {/* Storage source */}
      <rect x={20} y={32} width={280} height={40} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={32} y={48} fontSize={9} fontWeight={700} fill={TEXT}>
        chrome.storage.local
      </text>
      <text x={32} y={62} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        oh.ws.{'<id>'}.vault (encrypted blob)
      </text>
      <rect x={234} y={42} width={56} height={20} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={262} y={56} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        ENC
      </text>

      {/* Arrow down to validator */}
      <line x1={160} y1={72} x2={160} y2={88} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Validator box */}
      <rect x={100} y={90} width={120} height={24} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={160} y={105} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Schema validator
      </text>

      {/* Arrow down to entries */}
      <line x1={160} y1={114} x2={160} y2={128} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Three concrete entries */}
      {ENTRIES.map((entry, i) => {
        const y = 132 + i * 26;
        const fill = entry.ok ? SUCCESS_BG : ERROR_BG;
        const stroke = entry.ok ? dotColor('green') : errBorder;
        return (
          <g key={entry.uid}>
            <rect x={20} y={y} width={184} height={22} rx={3} fill={fill} stroke={stroke} />
            <text
              x={32}
              y={y + 14}
              fontFamily="monospace"
              fontSize={9}
              fontWeight={700}
              fill={TEXT}
            >
              {entry.uid}
            </text>
            <text x={120} y={y + 14} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {entry.ok ? 'matches schema' : `drift: ${entry.reason}`}
            </text>
            {/* Outcome arrow */}
            <line
              x1={206}
              y1={y + 11}
              x2={228}
              y2={y + 11}
              stroke={entry.ok ? dotColor('green') : errBorder}
              strokeWidth={1.5}
              strokeDasharray={entry.ok ? undefined : '2 2'}
              markerEnd={`url(#${ID})`}
            />
            {/* Outcome badge */}
            <rect
              x={232}
              y={y + 2}
              width={68}
              height={18}
              rx={3}
              fill={entry.ok ? SUCCESS_BG : WARNING_BG}
              stroke={dotColor(entry.ok ? 'green' : 'yellow')}
            />
            <text
              x={266}
              y={y + 14}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={TEXT}
            >
              {entry.ok ? '✓ kept' : '✗ dropped'}
            </text>
          </g>
        );
      })}

      {/* Status pill marker for the drift case */}
      <line x1={266} y1={206} x2={266} y2={224} stroke={dotColor('yellow')} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <rect x={222} y={224} width={88} height={18} rx={4} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <circle cx={232} cy={233} r={3} fill={dotColor('yellow')} />
      <text x={272} y={236} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Secrets · yellow
      </text>

      <text x={20} y={234} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        kept entries
      </text>
      <text x={20} y={246} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        hydrate cleanly
      </text>
    </svg>
  );
};

/**
 * Drift detail: what "doesn't match the current shape" actually looks
 * like. Two side-by-side cards — left valid, right invalid — with the
 * offending field highlighted. Beginners need to see drift concretely
 * before "Schema drift" reads as anything but jargon.
 */
export const VaultDriftDetailDiagram: React.FC = () => {
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';
  const errColor = dotColor('red');

  const Card = ({
    xOff,
    title,
    accent,
    accentStroke,
    fields,
    issue,
  }: {
    xOff: number;
    title: string;
    accent: string;
    accentStroke: string;
    fields: { key: string; value: string; ok?: boolean; missing?: boolean }[];
    issue?: string;
  }) => (
    <g>
      <rect x={xOff} y={30} width={140} height={150} rx={4} fill={BG_CONTAINER} stroke={accentStroke} />
      <rect x={xOff} y={30} width={140} height={20} rx={4} fill={accent} stroke={accentStroke} />
      <circle cx={xOff + 12} cy={40} r={3.5} fill={accentStroke} />
      <text x={xOff + 22} y={43} fontSize={10} fontWeight={700} fill={TEXT}>
        {title}
      </text>
      {fields.map((f, i) => {
        const fy = 64 + i * 22;
        const fieldOk = f.ok !== false && !f.missing;
        const fillRow = fieldOk ? 'transparent' : errBg;
        return (
          <g key={f.key}>
            {!fieldOk && (
              <rect x={xOff + 6} y={fy - 12} width={128} height={20} rx={2} fill={fillRow} stroke={errBorder} />
            )}
            <text x={xOff + 12} y={fy} fontFamily="monospace" fontSize={8} fontWeight={700} fill={TEXT}>
              {f.key}:
            </text>
            <text
              x={xOff + 64}
              y={fy}
              fontFamily="monospace"
              fontSize={8}
              fill={f.missing ? errColor : TEXT}
              fontStyle={f.missing ? 'italic' : undefined}
            >
              {f.missing ? '— missing —' : f.value}
            </text>
          </g>
        );
      })}
      {issue && (
        <text x={xOff + 70} y={166} textAnchor="middle" fontSize={8} fontStyle="italic" fill={errColor}>
          {issue}
        </text>
      )}
    </g>
  );

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="What schema drift actually looks like — a valid entry has uid, label, and cipher; a drift entry might be missing the cipher field. The validator drops the bad row and emits a yellow status."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        What "schema drift" actually looks like
      </text>

      <Card
        xOff={10}
        title="Valid entry"
        accent={SUCCESS_BG}
        accentStroke={dotColor('green')}
        fields={[
          { key: 'uid', value: 'sec_a1f3' },
          { key: 'label', value: 'API token' },
          { key: 'cipher', value: 'aes-gcm…' },
          { key: 'created', value: '1715000…' },
        ]}
      />

      <Card
        xOff={170}
        title="Drift entry"
        accent={errBg}
        accentStroke={errBorder}
        fields={[
          { key: 'uid', value: 'sec_c3d5' },
          { key: 'label', value: 'Old token' },
          { key: 'cipher', value: '', missing: true },
          { key: 'created', value: '"yesterday"', ok: false },
        ]}
        issue="2 schema issues → dropped"
      />

      <text x={160} y={198} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Drift entries are dropped on hydrate and the pill goes yellow.
      </text>
      <text x={160} y={212} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Re-saving from the Vault editor restores the entry's current shape.
      </text>
    </svg>
  );
};

// ─── Live subsystem — per-workflow state + aggregation ────────────

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
      <rect
        x={20}
        y={170}
        width={180}
        height={22}
        rx={3}
        fill={GREY_BG}
        stroke={dimStroke}
        strokeDasharray="3 2"
      />
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
