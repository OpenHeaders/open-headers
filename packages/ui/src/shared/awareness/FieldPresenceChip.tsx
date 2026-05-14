/**
 * Field-level presence chip.
 *
 * Renders the shared `AwarenessPill` for surfaces with `fieldFocus`
 * exactly equal to `(entityType, entityId, fieldPath)`. Same UI as the
 * entity-level `PresenceBadge` and the per-tab `TabPresenceBadge` so
 * the visual treatment of "someone else is editing this" is uniform
 * across every scope.
 */

import type React from 'react';
import AwarenessPill from './AwarenessPill';
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
  return (
    <AwarenessPill
      presence={presence}
      title="Editing this field"
      ariaLabel={`${presence.length} other surface${presence.length === 1 ? '' : 's'} editing this field`}
      style={style}
    />
  );
};

export default FieldPresenceChip;
