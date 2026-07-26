/**
 * Shared SVG primitives used across multiple diagrams. Color tokens
 * resolve to Ant Design CSS variables, so every diagram re-themes
 * automatically with the active light / dark theme — no per-theme
 * SVG duplicates needed.
 *
 * Stroke widths and font sizes are tuned for the narrow docs panel
 * (~240–320px container).
 */

import type React from 'react';

export const STROKE = 'var(--ant-color-text-secondary)';
export const TEXT = 'var(--ant-color-text)';
export const TEXT_DIM = 'var(--ant-color-text-tertiary)';
export const FILL_BLUE = 'var(--ant-color-primary-bg)';
export const STROKE_BLUE = 'var(--ant-color-primary-border)';
export const FILL_ORANGE = 'var(--ant-color-warning-bg)';
export const STROKE_ORANGE = 'var(--ant-color-warning-border)';
// Purple isn't an Ant theme color — use a fixed rgba that reads in
// both themes. The other colors live in the theme system.
export const FILL_PURPLE = 'rgba(146, 84, 222, 0.12)';
export const STROKE_PURPLE = 'rgba(146, 84, 222, 0.55)';
export const FILL_GREEN = 'var(--ant-color-success-bg)';
export const STROKE_GREEN = 'var(--ant-color-success-border)';

/** Reusable arrow-head marker — declared once at the top of each SVG. */
export function ArrowDefs({ id }: { id: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE} />
      </marker>
    </defs>
  );
}

/**
 * macOS-style browser window — rounded outer rect, a chrome bar across
 * the top with three real Apple traffic-light dots (`#ff5f57`,
 * `#febc2e`, `#28c840`), an optional title in the chrome, and an
 * optional caption rendered below the window.
 *
 * Lifted from the inline `renderClient` pattern in
 * `roadmap-server.tsx` so back-end / front-end diagrams in both the
 * docs and the settings pane share one definition of "what a browser
 * looks like in our diagrams." Pass children to render arbitrary
 * content inside the window content area.
 */
export function BrowserWindow({
  x,
  y,
  w,
  h,
  chromeH = 20,
  title,
  /**
   * Right-aligned chrome-bar label that says what kind of window this
   * is ("Browser", "Desktop App", "Web app"). Conceptually the desktop
   * app and a browser show the exact same workbench UI; the corner
   * label is the differentiator so a diagram with both side-by-side
   * stays legible without picking a different chrome shape.
   */
  corner,
  caption,
  bodyFill,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  chromeH?: number;
  title?: string;
  corner?: string;
  caption?: string;
  /**
   * Override fill for the body area (everything below the chrome
   * bar). Used by terminal-style windows that want a black body while
   * keeping the macOS chrome shape + rounded corners. Defaults to
   * `var(--ant-color-bg-container)` so existing diagrams render
   * pixel-identically.
   */
  bodyFill?: string;
  children?: React.ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={bodyFill ?? 'var(--ant-color-bg-container)'}
        stroke={STROKE_BLUE}
        strokeWidth={1.3}
      />
      {/* Chrome bar — top corners rounded to match the outer rx=6,
          bottom edge flat so a contrasting body fill (e.g. the CLI's
          black) doesn't show through the chrome's corner notches.
          Two layers: an opaque bg-container base so the body fill
          can't bleed through the (semi-transparent) secondary fill,
          then the secondary fill on top for the chrome shade. */}
      {(() => {
        const d = `M ${x + 6} ${y} H ${x + w - 6} a 6 6 0 0 1 6 6 V ${y + chromeH} H ${x} V ${y + 6} a 6 6 0 0 1 6 -6 Z`;
        return (
          <>
            <path d={d} fill="var(--ant-color-bg-container)" />
            <path d={d} fill="var(--ant-color-fill-secondary)" stroke={STROKE_BLUE} />
          </>
        );
      })()}
      <circle cx={x + 9} cy={y + chromeH / 2} r={3} fill="#ff5f57" />
      <circle cx={x + 18} cy={y + chromeH / 2} r={3} fill="#febc2e" />
      <circle cx={x + 27} cy={y + chromeH / 2} r={3} fill="#28c840" />
      {title && (
        // When a corner label is present the centered-after-lights
        // layout fights the corner for space; left-align the title past
        // the lights and let the corner own the right edge. Without a
        // corner, preserve the docs' existing centered-with-+14-offset
        // look so unchanged diagrams stay pixel-identical.
        <text
          x={corner ? x + 36 : x + w / 2 + 14}
          y={y + chromeH / 2 + 4}
          textAnchor={corner ? 'start' : 'middle'}
          fontSize={10}
          fontWeight={700}
          fill={TEXT}
        >
          {title}
        </text>
      )}
      {corner && (
        <text
          x={x + w - 8}
          y={y + chromeH / 2 + 3}
          textAnchor="end"
          fontSize={8}
          fontWeight={700}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {corner}
        </text>
      )}
      {caption && (
        <text x={x + w / 2} y={y + h + 12} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
          {caption}
        </text>
      )}
      {children}
    </g>
  );
}

/** Small text-on-rect helper — clean labels without re-typing common props. */
export function Box({
  x,
  y,
  w,
  h,
  fill,
  stroke,
  label,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  label: string;
  sub?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={1} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} textAnchor="middle" fontSize="11" fontWeight="600" fill={TEXT}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontSize="9" fill={TEXT_DIM}>
          {sub}
        </text>
      )}
    </g>
  );
}
