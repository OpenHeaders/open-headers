/**
 * Editor-tab presence badge.
 *
 * Renders nothing when only the local surface (or no surface) has the
 * entity in focus. When other surfaces are present, shows the shared
 * `AwarenessPill` — colored dots per surface kind + count, with a
 * popover listing each peer.
 *
 * The badge is pure projection of the awareness mirror — it doesn't
 * itself publish anything. Surfaces publish via `useAwareness` and read
 * via this badge in their tab title / editor header slot.
 */

import type React from 'react';
import AwarenessPill from './AwarenessPill';
import { useEntityPresence } from './use-entity-presence';

export interface PresenceBadgeProps {
  entityType: string;
  entityId: string | null | undefined;
  /** Local instance id — filtered out so this surface doesn't see itself. */
  excludeInstanceId: string;
  style?: React.CSSProperties;
}

const PresenceBadge: React.FC<PresenceBadgeProps> = ({ entityType, entityId, excludeInstanceId, style }) => {
  const ref = entityId ? { type: entityType, id: entityId } : null;
  const presence = useEntityPresence(ref, { excludeInstanceId, enabled: !!entityId });
  return (
    <AwarenessPill
      presence={presence}
      title={`${presence.length} other surface${presence.length === 1 ? '' : 's'}`}
      ariaLabel={`${presence.length} other surface${presence.length === 1 ? '' : 's'} editing this entity`}
      style={style}
    />
  );
};

export default PresenceBadge;
