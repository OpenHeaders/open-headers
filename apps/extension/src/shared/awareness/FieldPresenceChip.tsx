/**
 * Field-level presence chip.
 *
 * Renders a small clickable dot per other-surface focused on the same
 * `(type, id, path)`. Empty when no other surface is focused.
 *
 * The chip is intentionally compact — a colored dot per peer, with a
 * tooltip carrying the surface's descriptive label and an optional
 * click-to-switch action when the peer is peer-addressable. Surfaces
 * place it inline in form labels or row actions.
 */

import { Tooltip } from 'antd';
import type React from 'react';
import { useSurfaceIdentity } from './IdentityContext';
import { isHandleCoLocated, isPeerNavigable, peerNavigate } from './peer-navigate';
import { surfaceKindColor, surfaceKindInitial } from './surface-label';
import { useFieldPresence } from './use-entity-presence';

export interface FieldPresenceChipProps {
  entityType: string;
  entityId: string | null | undefined;
  fieldPath: string;
  /** Local instance id — filtered out so this surface doesn't see itself. */
  excludeInstanceId: string;
  style?: React.CSSProperties;
}

const FieldPresenceChip: React.FC<FieldPresenceChipProps> = ({
  entityType,
  entityId,
  fieldPath,
  excludeInstanceId,
  style,
}) => {
  const ref = entityId ? { type: entityType, id: entityId, path: fieldPath } : null;
  const presence = useFieldPresence(ref, { excludeInstanceId, enabled: !!entityId });
  const localIdentity = useSurfaceIdentity().current();
  if (presence.length === 0) return null;

  return (
    <span style={{ display: 'inline-flex', gap: 2, ...style }}>
      {presence.map((p) => {
        const coLocated = isHandleCoLocated(localIdentity.navigation, p.identity.navigation);
        const navigable = !coLocated && isPeerNavigable(p.identity.navigation);
        const tooltip = coLocated
          ? `${p.identity.label} editing this field — already on this tab`
          : `${p.identity.label} editing this field${navigable ? ' — click to switch' : ''}`;
        const handleClick = navigable
          ? () => {
              if (p.identity.navigation) void peerNavigate(p.identity.navigation);
            }
          : undefined;
        return (
          <Tooltip key={p.identity.instanceId} title={tooltip} placement="top" zIndex={1100}>
            <button
              type="button"
              disabled={!navigable}
              onClick={handleClick}
              aria-label={tooltip}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                padding: 0,
                border: 'none',
                borderRadius: '50%',
                background: surfaceKindColor(p.identity.surfaceKind),
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1,
                cursor: navigable ? 'pointer' : 'default',
                // Dim co-located peers so the user knows which dot
                // represents the tab they're already on.
                opacity: coLocated ? 0.55 : 1,
              }}
            >
              {surfaceKindInitial(p.identity.surfaceKind)}
            </button>
          </Tooltip>
        );
      })}
    </span>
  );
};

export default FieldPresenceChip;
