/**
 * Compact back-end-tier icons for the settings picker.
 *
 * Each glyph mirrors the artwork in the docs' `paradigm-local-first.tsx`
 * `renderIcon` switch (the four tiers: browser / desktop / daemon / vm)
 * so the visual identity is identical between the docs and the
 * settings UI. The docs render them inside a much larger card; here we
 * inline-size them via the SVG `viewBox` so each one fits a compact
 * 32×24 button icon without re-drawing the geometry.
 *
 * Renders as standalone `<svg>` elements — no surrounding diagram
 * frame, no labels. The settings picker adds its own title + caption
 * beside the icon.
 */

import type React from 'react';
import { FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE } from '../../components/docs/diagrams/_shared';
import { OH_GREEN } from '../../components/docs/diagrams/open-headers/_shared';

export type BackendIconKey = 'browser' | 'desktop' | 'daemon' | 'vm';

interface IconProps {
  /** Rendered size on the long axis; the SVG viewBox preserves aspect. */
  size?: number;
}

const STROKE = STROKE_BLUE;
const FILL = FILL_BLUE;

const InBrowserGlyph: React.FC<IconProps> = ({ size = 32 }) => (
  <svg viewBox="-26 -18 52 36" width={size} height={size * (36 / 52)} role="presentation">
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
  </svg>
);

const DesktopGlyph: React.FC<IconProps> = ({ size = 32 }) => (
  <svg viewBox="-26 -20 52 40" width={size} height={size * (40 / 52)} role="presentation">
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
  </svg>
);

const DaemonGlyph: React.FC<IconProps> = ({ size = 32 }) => (
  <svg viewBox="-26 -20 52 40" width={size} height={size * (40 / 52)} role="presentation">
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
  </svg>
);

const VmGlyph: React.FC<IconProps> = ({ size = 32 }) => (
  <svg viewBox="-26 -18 52 36" width={size} height={size * (36 / 52)} role="presentation">
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
  </svg>
);

export const BackendIcon: React.FC<{ kind: BackendIconKey; size?: number }> = ({ kind, size }) => {
  switch (kind) {
    case 'browser':
      return <InBrowserGlyph size={size} />;
    case 'desktop':
      return <DesktopGlyph size={size} />;
    case 'daemon':
      return <DaemonGlyph size={size} />;
    case 'vm':
      return <VmGlyph size={size} />;
  }
};
