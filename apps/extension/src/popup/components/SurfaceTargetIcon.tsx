import { theme } from 'antd';
import type React from 'react';
import type { SurfaceMode } from '@/shared/surface';

interface SurfaceTargetIconProps {
  /** Surface the icon depicts — typically the surface the click will switch TO. */
  target: SurfaceMode;
  size?: number;
}

/**
 * Context-aware browser-chrome glyph for the surface-switch button.
 *
 *   target='popup'       a small floating rectangle anchored to the
 *                        top-right (the toolbar action popup)
 *   target='sidepanel'   a tall column docked to the right edge (the
 *                        persistent side panel)
 *
 * The frame represents the browser window; the filled region is what
 * the user will get if they click. Stroke / fill use Antd theme tokens
 * so the icon respects light/dark mode like every other glyph.
 *
 * Mirrors `DockSlotIcon` in spirit — primitives (rects, lines), no
 * library dependency, no font glyph that loses meaning at small sizes.
 */
export function SurfaceTargetIcon({ target, size = 16 }: SurfaceTargetIconProps): React.ReactElement {
  const { token } = theme.useToken();
  // Match the rest of the header glyphs (Settings gear, etc.) which
  // render at `colorText`. The tertiary tone we used before came out
  // visibly washed-out next to those.
  const stroke = token.colorText;
  const fill = token.colorText;
  const height = Math.round((size * 16) / 20);

  const FRAME_LEFT = 0.5;
  const FRAME_RIGHT = 19.5;
  const FRAME_TOP = 0.5;
  const FRAME_BOTTOM = 15.5;
  const FRAME_H = FRAME_BOTTOM - FRAME_TOP;
  // Top-third row: holds the popup glyph. Toolbar divider sits on its
  // bottom edge; the shaded cell sits in its right two-thirds-onward.
  const ROW1_Y = FRAME_TOP + FRAME_H / 3;
  const COL2_X = FRAME_LEFT + ((FRAME_RIGHT - FRAME_LEFT) * 2) / 3;
  // Sidepanel keeps its own geometry — full-height right column at x=13.
  const RIGHT_X = 13;

  return (
    <svg viewBox="0 0 20 16" width={size} height={height} role="img" aria-hidden="true" style={{ display: 'block' }}>
      {/* Browser window frame */}
      <rect x={0.5} y={0.5} width={19} height={15} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />

      {target === 'sidepanel' && (
        <>
          {/* Vertical divider for the docked side panel — same weight
            as the outer frame so it reads as a black line in the theme. */}
          <line x1={RIGHT_X} y1={FRAME_TOP} x2={RIGHT_X} y2={FRAME_BOTTOM} stroke={stroke} strokeWidth={1} />
          {/* Whole right column filled */}
          <rect
            x={RIGHT_X}
            y={FRAME_TOP}
            width={FRAME_RIGHT - RIGHT_X}
            height={FRAME_H}
            fill={fill}
            fillOpacity={0.22}
          />
        </>
      )}

      {target === 'popup' && (
        <>
          {/* Horizontal toolbar divider — same weight as the outer
            frame (thin strokes render washed-out at this size). */}
          <line x1={FRAME_LEFT} y1={ROW1_Y} x2={FRAME_RIGHT} y2={ROW1_Y} stroke={stroke} strokeWidth={1} />
          {/* Top-right cell shaded — that's where the popup hangs from */}
          <rect
            x={COL2_X}
            y={FRAME_TOP}
            width={FRAME_RIGHT - COL2_X}
            height={ROW1_Y - FRAME_TOP}
            fill={fill}
            fillOpacity={0.22}
          />
        </>
      )}
    </svg>
  );
}
