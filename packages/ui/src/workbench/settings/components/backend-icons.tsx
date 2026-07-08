/**
 * Back-end-tier icons + glyphs for the settings picker and the detail
 * diagrams. Two ways to render:
 *
 *   - `<BackendIcon kind size />` — standalone `<svg>` for the picker
 *     buttons.
 *   - `<BackendGlyph kind cx cy scale />` — embeddable `<g>` for use
 *     inside parent SVGs (the detail diagrams).
 *
 * Geometry mirrors the docs' artwork in
 * `paradigm-local-first.tsx`'s `renderIcon` + the `cli` case in
 * `paradigm-front-ends.tsx`, so the visual identity is identical
 * between the docs and the settings UI.
 */

import type React from 'react';
import { FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE } from '../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../components/docs/diagrams/open-headers/_shared';
import type { BackendMode } from '../schema/backend';

export type BackendIconKey = 'browser' | 'desktop' | 'laptop' | 'daemon' | 'vm' | 'cli' | 'web';

const MODE_ICON: Record<BackendMode, BackendIconKey> = {
  'in-browser': 'browser',
  'desktop-app': 'desktop',
  'local-self-hosted': 'daemon',
  'remote-self-hosted': 'vm',
};

/** The back-end-tier glyph for a derived mode — one icon vocabulary
 *  across the tier-zero card, the connection rows, and the docs. */
export function backendModeIcon(mode: BackendMode): BackendIconKey {
  return MODE_ICON[mode];
}

const STROKE = STROKE_BLUE;
const FILL = FILL_BLUE;

// ── Embeddable groups (use inside parent SVGs) ──────────────────────

interface GlyphProps {
  cx: number;
  cy: number;
  /** Visual scale; 1 = the docs' default ~52px-wide icon. */
  scale?: number;
}

const BrowserG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <rect x={-22} y={-14} width={44} height={28} rx={3} fill="var(--ant-color-bg-container)" stroke={STROKE} />
    <rect x={-22} y={-14} width={44} height={7} rx={3} fill={FILL} stroke={STROKE} />
    <circle cx={-18} cy={-10.5} r={1.2} fill={STROKE} />
    <circle cx={-14} cy={-10.5} r={1.2} fill={STROKE} />
    <circle cx={-10} cy={-10.5} r={1.2} fill={STROKE} />
    {[0, 1, 2].map((i) => (
      <rect
        key={i}
        x={-18}
        y={-4 + i * 5}
        width={36 - i * 8}
        height={2}
        rx={1}
        fill="var(--ant-color-fill-tertiary)"
      />
    ))}
  </g>
);

const DesktopG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <rect x={-22} y={-16} width={44} height={26} rx={2} fill="var(--ant-color-bg-container)" stroke={STROKE} />
    <rect x={-19} y={-13} width={38} height={20} fill={FILL} stroke={STROKE} />
    {[0, 1, 2].map((i) => (
      <rect
        key={i}
        x={-16}
        y={-10 + i * 4}
        width={32 - i * 6}
        height={1.8}
        rx={0.8}
        fill="var(--ant-color-bg-container)"
        opacity={0.7}
      />
    ))}
    <rect x={-4} y={10} width={8} height={4} fill={STROKE} />
    <rect x={-10} y={14} width={20} height={2} rx={1} fill={STROKE} />
  </g>
);

const DaemonG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect
          x={-22}
          y={-16 + i * 11}
          width={44}
          height={9}
          rx={2}
          fill={FILL_PURPLE}
          stroke={STROKE_PURPLE}
        />
        <circle cx={-17} cy={-11.5 + i * 11} r={1.8} fill={OH_GREEN} />
        <rect x={-12} y={-13 + i * 11} width={28} height={2} rx={1} fill="var(--ant-color-fill-tertiary)" />
      </g>
    ))}
  </g>
);

const VmG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <path
      d="M -18 6
         c -8 0 -8 -10 0 -10
         c 0 -8 12 -8 14 -2
         c 2 -6 14 -4 14 4
         c 6 0 6 8 0 8 Z"
      fill="var(--ant-color-bg-container)"
      stroke={STROKE}
      strokeWidth={1.5}
    />
    <rect x={-4} y={-2} width={8} height={6} rx={1} fill={FILL} stroke={STROKE} />
    <path d="M -3 -2 v -2 a 3 3 0 0 1 6 0 v 2" fill="none" stroke={STROKE} strokeWidth={1.2} />
  </g>
);

/**
 * Laptop glyph — inspired by the desktop's monitor+content layering but
 * shaped like an open clam-shell: thin screen on top, trapezoidal
 * keyboard deck below, trackpad notch on the front edge. Same color
 * tokens as the desktop so the two read as members of the same
 * visual family.
 */
const LaptopG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    {/* Screen body */}
    <rect x={-22} y={-16} width={44} height={22} rx={2} fill="var(--ant-color-bg-container)" stroke={STROKE} />
    {/* Screen content area */}
    <rect x={-19} y={-13} width={38} height={16} fill={FILL} stroke={STROKE} />
    {[0, 1, 2].map((i) => (
      <rect
        key={i}
        x={-16}
        y={-10 + i * 4}
        width={32 - i * 6}
        height={1.6}
        rx={0.8}
        fill="var(--ant-color-bg-container)"
        opacity={0.7}
      />
    ))}
    {/* Keyboard deck — trapezoid wider than the screen */}
    <path
      d="M -25 6 L 25 6 L 22 12 L -22 12 Z"
      fill="var(--ant-color-bg-container)"
      stroke={STROKE}
      strokeWidth={1}
    />
    {/* Trackpad notch */}
    <rect x={-5} y={9} width={10} height={1.5} rx={0.5} fill={STROKE} opacity={0.6} />
  </g>
);

/**
 * Web app glyph — browser frame with a globe inside the content area.
 * Lifted from `paradigm-front-ends.tsx`'s `web` case.
 */
const WebG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <rect x={-22} y={-14} width={44} height={28} rx={3} fill="var(--ant-color-bg-container)" stroke={STROKE} />
    <rect x={-22} y={-14} width={44} height={7} rx={3} fill={FILL} stroke={STROKE} />
    <circle cx={-18} cy={-10.5} r={1.2} fill={STROKE} />
    <circle cx={-14} cy={-10.5} r={1.2} fill={STROKE} />
    <circle cx={-10} cy={-10.5} r={1.2} fill={STROKE} />
    {/* Globe — meridians/parallels on the body */}
    <circle cx={0} cy={3} r={7} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} strokeWidth={1.2} />
    <ellipse cx={0} cy={3} rx={3} ry={7} fill="none" stroke={STROKE_BLUE} strokeWidth={1} />
    <line x1={-7} y1={3} x2={7} y2={3} stroke={STROKE_BLUE} strokeWidth={1} />
  </g>
);

/**
 * CLI terminal glyph — solid dark body with three traffic-light dots
 * and a `$ _` monospace prompt. Lifted from `paradigm-front-ends.tsx`'s
 * `cli` case. No `animate` here — the docs version has a blinking
 * cursor; an inline-SVG embedded inside a settings panel doesn't need
 * the eye candy.
 */
const CliG: React.FC<GlyphProps> = ({ cx, cy, scale = 1 }) => (
  <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
    <rect x={-22} y={-14} width={44} height={28} rx={3} fill="var(--ant-color-text)" stroke={STROKE} />
    <rect x={-22} y={-14} width={44} height={6} rx={3} fill={FILL} stroke={STROKE} />
    <circle cx={-18} cy={-11} r={1} fill="#ff5f57" />
    <circle cx={-14} cy={-11} r={1} fill="#febc2e" />
    <circle cx={-10} cy={-11} r={1} fill="#28c840" />
    <text x={-18} y={4} fontFamily="monospace" fontSize={10} fontWeight={800} fill={OH_GREEN}>
      $ _
    </text>
    <rect x={-2} y={7} width={6} height={2} fill={OH_GREEN} />
  </g>
);

export const BackendGlyph: React.FC<GlyphProps & { kind: BackendIconKey }> = ({ kind, ...rest }) => {
  switch (kind) {
    case 'browser':
      return <BrowserG {...rest} />;
    case 'desktop':
      return <DesktopG {...rest} />;
    case 'laptop':
      return <LaptopG {...rest} />;
    case 'daemon':
      return <DaemonG {...rest} />;
    case 'vm':
      return <VmG {...rest} />;
    case 'cli':
      return <CliG {...rest} />;
    case 'web':
      return <WebG {...rest} />;
  }
};

// ── Standalone (use for the picker buttons) ─────────────────────────

/**
 * `BackendIcon` wraps a glyph in its own `<svg>` so the picker buttons
 * can drop it in as a simple inline element. ViewBox auto-sized per
 * kind to preserve the docs' aspect ratios.
 */
export const BackendIcon: React.FC<{ kind: BackendIconKey; size?: number }> = ({ kind, size = 32 }) => {
  const { vb, ratio } = ICON_VIEWBOX[kind];
  const w = size;
  const h = Math.round(size * ratio);
  return (
    <svg viewBox={vb} width={w} height={h} role="presentation">
      <BackendGlyph kind={kind} cx={0} cy={0} scale={1} />
    </svg>
  );
};

const ICON_VIEWBOX: Record<BackendIconKey, { vb: string; ratio: number }> = {
  browser: { vb: '-26 -18 52 36', ratio: 36 / 52 },
  desktop: { vb: '-26 -20 52 40', ratio: 40 / 52 },
  laptop: { vb: '-28 -18 56 34', ratio: 34 / 56 },
  daemon: { vb: '-26 -20 52 40', ratio: 40 / 52 },
  vm: { vb: '-26 -18 52 36', ratio: 36 / 52 },
  cli: { vb: '-26 -18 52 36', ratio: 36 / 52 },
  web: { vb: '-26 -18 52 36', ratio: 36 / 52 },
};
