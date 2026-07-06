/**
 * DevPanelGlyph — category icon for the DevTools-panel settings sections.
 *
 * Reuses the bottom-panel geometry from the dock-layout RegionToggle
 * glyph (rounded frame + bottom band) so the settings nav reads as the
 * same surface the settings configure. Per-tab categories stamp a
 * letter into the content area (N = Network, H = Headers, …); the
 * layout category renders the bare frame.
 *
 * Drawn in currentColor so it follows the nav button's active/hover
 * text color like the Ant icons around it.
 */

import type React from 'react';

interface DevPanelGlyphProps {
  letter?: string;
}

const DevPanelGlyph: React.FC<DevPanelGlyphProps> = ({ letter }) => (
  <svg viewBox="0 0 16 13" width={15} height={12} role="img" aria-hidden="true" style={{ display: 'block' }}>
    <rect x="0.5" y="0.5" width="15" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth={1} />
    <rect x="1" y="9" width="14" height="3.5" fill="currentColor" opacity={0.25} stroke="none" />
    <line x1="0.5" y1="8.5" x2="15.5" y2="8.5" stroke="currentColor" strokeWidth={1} />
    {letter && (
      <text x="8" y="7" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="currentColor" stroke="none">
        {letter}
      </text>
    )}
  </svg>
);

export default DevPanelGlyph;
