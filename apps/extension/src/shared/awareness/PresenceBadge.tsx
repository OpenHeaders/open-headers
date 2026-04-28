/**
 * Editor-tab presence badge (Phase A A2).
 *
 * Renders nothing when only the local surface (or no surface) has the
 * entity in focus. When other surfaces are present, shows a small
 * pill-shaped chip with the count and a tooltip listing the surfaces.
 *
 * The badge is pure projection of the awareness mirror — it doesn't
 * itself publish anything. Surfaces publish via `useAwareness` and read
 * via this badge in their tab title / editor header slot.
 */

import { Tooltip } from 'antd';
import type React from 'react';
import { useEntityPresence } from './use-entity-presence';
import { surfaceColor, surfaceLabel } from './surface-label';

export interface PresenceBadgeProps {
  entityType: string;
  entityId: string | null | undefined;
  /** Local surface id — filtered out so this surface doesn't see itself. */
  excludeSurfaceId: string;
  style?: React.CSSProperties;
}

const PresenceBadge: React.FC<PresenceBadgeProps> = ({ entityType, entityId, excludeSurfaceId, style }) => {
  const ref = entityId ? { type: entityType, id: entityId } : null;
  const presence = useEntityPresence(ref, { excludeSurfaceId, enabled: !!entityId });
  if (presence.length === 0) return null;

  // Dedup by surfaceId — the mirror already keys by surfaceId so this is
  // belt-and-braces against future multi-instance surfaces.
  const seen = new Set<string>();
  const surfaces: string[] = [];
  for (const p of presence) {
    if (seen.has(p.surfaceId)) continue;
    seen.add(p.surfaceId);
    surfaces.push(p.surfaceId);
  }

  const tooltip = surfaces.map(surfaceLabel).join(', ');

  return (
    <Tooltip title={`Also editing here: ${tooltip}`} placement="bottom">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          height: 16,
          padding: '0 4px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.04)',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1,
          ...style,
        }}
      >
        {surfaces.map((sid) => (
          <span
            key={sid}
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: surfaceColor(sid),
            }}
          />
        ))}
        <span style={{ marginLeft: 2 }}>{surfaces.length}</span>
      </span>
    </Tooltip>
  );
};

export default PresenceBadge;
