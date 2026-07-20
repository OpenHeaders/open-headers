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
import { TEXT, TEXT_DIM } from '../_shared';

export const SUCCESS = 'var(--ant-color-success)';
export const WARNING = 'var(--ant-color-warning)';
export const ERROR = 'var(--ant-color-error)';
export const SUCCESS_BG = 'var(--ant-color-success-bg)';
export const WARNING_BG = 'var(--ant-color-warning-bg)';
export const ERROR_BG = 'var(--ant-color-error-bg)';
export const GREY = 'var(--ant-color-text-tertiary)';
export const GREY_BG = 'var(--ant-color-fill-quaternary)';
export const BORDER = 'var(--ant-color-border)';
export const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
export const BG_CONTAINER = 'var(--ant-color-bg-container)';

export type Level = 'green' | 'yellow' | 'red' | 'grey';

export const dotColor = (lvl: Level): string =>
  lvl === 'red' ? ERROR : lvl === 'yellow' ? WARNING : lvl === 'green' ? SUCCESS : GREY;

// ─── Surfaces — where the pill renders ────────────────────────────

/**
 * Mini-rendering of the real Open Headers extension logo
 * (`apps/extension/src/assets/images/logo-pixel.svg`). Letter strokes
 * and the smile curve are preserved so the mark stays recognizable
 * even at toolbar-icon size. Inlined here instead of an `<image href>`
 * so colors stay theme-stable and the SVG ships with the diagram.
 */
export const OhLogo: React.FC<{ x: number; y: number; size: number; idSuffix: string }> = ({ x, y, size, idSuffix }) => {
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
export const BrowserFrame: React.FC<{ tabLabel: string; addressBar: string; children: React.ReactNode }> = ({
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
      <rect x={FX + 8} y={tabsY + 3} width={120} height={tabsH - 3} rx={4} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={FX + 16} y={tabsY + tabsH / 2 + 3} fontSize={9} fontWeight={700} fill={TEXT}>
        {tabLabel}
      </text>
      <text x={FX + FW - 8} y={tabsY + tabsH / 2 + 3} textAnchor="end" fontSize={11} fill={GREY}>
        +
      </text>

      {/* Address bar */}
      <rect x={FX} y={addrY} width={FW} height={addrH} fill={BG_CONTAINER} stroke={BORDER} />
      <rect x={FX + 8} y={addrY + 3} width={FW - 36} height={addrH - 6} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={FX + 16} y={addrY + addrH / 2 + 3} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        {addressBar}
      </text>
      {/* Toolbar extension icon slot */}
      <rect x={FX + FW - 22} y={addrY + 3} width={14} height={addrH - 6} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />

      {/* Caller-provided body content (positioned absolutely inside the frame) */}
      <g transform={`translate(0, 0)`}>{children}</g>

      {/* Body bounds exposed via data-attr for clarity — not visible */}
      <rect x={FX} y={bodyY} width={FW} height={bodyH} fill="transparent" stroke={BORDER} strokeWidth={0.5} />
    </g>
  );
};
