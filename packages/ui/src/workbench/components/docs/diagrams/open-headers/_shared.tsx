/**
 * Open Headers diagrams — shared primitives.
 *
 * Local saturated-green palette. We deliberately avoid the parent
 * `_shared` FILL_GREEN / STROKE_GREEN — they map to Ant's `success-bg`
 * / `success-border` which render as a washed-out lime on light themes.
 * These use the vibrant `success` token + a low-alpha tint for fill so
 * the green still reads on a white panel.
 */
import type React from 'react';

export const OH_GREEN = 'var(--ant-color-success)';
export const OH_GREEN_TINT = 'rgba(82, 196, 26, 0.12)';

/**
 * Mini Open Headers logo, scaled into a small box. Mirrors the
 * pixel-art mark from `apps/extension/src/assets/images/logo-pixel.svg`
 * so the visual identity matches the actual extension.
 */
export const OhLogoSmall: React.FC<{ x: number; y: number; size: number; idSuffix: string }> = ({
  x,
  y,
  size,
  idSuffix,
}) => {
  const scale = size / 512;
  const gradId = `oh-${idSuffix}`;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5890FF" />
          <stop offset="100%" stopColor="#4A7FE8" />
        </linearGradient>
      </defs>
      <rect width={512} height={512} rx={80} fill={`url(#${gradId})`} />
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
