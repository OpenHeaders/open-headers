/**
 * Field-level presence chip (Phase A A3).
 *
 * Renders a single small initial per other-surface focused on the same
 * `(type, id, path)`. Empty when no other surface is focused.
 *
 * The chip is intentionally minimal — a colored dot with a tooltip — so
 * it can land beside a form field without disturbing layout. Surfaces
 * place it inline in form labels or row actions.
 */

import { Tooltip } from 'antd';
import type React from 'react';
import { useFieldPresence } from './use-entity-presence';
import { surfaceColor, surfaceInitial, surfaceLabel } from './surface-label';

export interface FieldPresenceChipProps {
  entityType: string;
  entityId: string | null | undefined;
  fieldPath: string;
  excludeSurfaceId: string;
  /** Pass true when the surface is also publishing this field as dirty. */
  style?: React.CSSProperties;
}

const FieldPresenceChip: React.FC<FieldPresenceChipProps> = ({
  entityType,
  entityId,
  fieldPath,
  excludeSurfaceId,
  style,
}) => {
  const ref = entityId ? { type: entityType, id: entityId, path: fieldPath } : null;
  const presence = useFieldPresence(ref, { excludeSurfaceId, enabled: !!entityId });
  if (presence.length === 0) return null;

  return (
    <span style={{ display: 'inline-flex', gap: 2, ...style }}>
      {presence.map((p) => (
        <Tooltip
          key={p.surfaceId}
          title={`${surfaceLabel(p.surfaceId)} editing this field`}
          placement="top"
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: surfaceColor(p.surfaceId),
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {surfaceInitial(p.surfaceId)}
          </span>
        </Tooltip>
      ))}
    </span>
  );
};

export default FieldPresenceChip;
