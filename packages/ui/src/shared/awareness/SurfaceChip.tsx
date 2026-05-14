/**
 * Compact surface attribution: colored dot + canonical kind label +
 * relative time. Tooltip carries the peer's free-form label
 * (typically the tab title) for users who want to disambiguate two
 * instances of the same surface kind.
 *
 * Used by every UI surface that attributes a value to a peer — the
 * inline conflict chip, the entity conflict dialog, and any future
 * presence-attributed affordance — so attribution looks the same
 * everywhere.
 */

import type { SurfaceKind } from '@openheaders/core/protocol';
import { Tooltip } from 'antd';
import type React from 'react';
import { formatAgo } from './format-ago';
import { surfaceKindColor, surfaceKindLabel } from './surface-label';

export interface SurfaceDotProps {
  kind: SurfaceKind;
  size?: number;
}

export const SurfaceDot: React.FC<SurfaceDotProps> = ({ kind, size = 8 }) => (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: surfaceKindColor(kind),
      flexShrink: 0,
    }}
  />
);

export interface SurfaceChipProps {
  kind: SurfaceKind;
  /** Free-form label (typically tab title); shown in tooltip. */
  label: string;
  /** Milliseconds since last activity; rendered via formatAgo. */
  agoMs: number;
  size?: 'small' | 'normal';
  /** When true, omits the surface kind text — leaves dot + ago. */
  iconOnly?: boolean;
}

const SurfaceChip: React.FC<SurfaceChipProps> = ({ kind, label, agoMs, size = 'normal', iconOnly = false }) => {
  const fontSize = size === 'small' ? 11 : 12;
  const dotSize = size === 'small' ? 6 : 8;
  return (
    <Tooltip title={label} mouseEnterDelay={0.3}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize, lineHeight: 1.4 }}>
        <SurfaceDot kind={kind} size={dotSize} />
        {!iconOnly && <span>{surfaceKindLabel(kind)}</span>}
        <span style={{ opacity: 0.6 }}>· {formatAgo(agoMs)}</span>
      </span>
    </Tooltip>
  );
};

export default SurfaceChip;
