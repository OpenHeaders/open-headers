/**
 * Per-tab / per-section presence badge.
 *
 * Aggregates `fieldFocus` presence across every leaf path under the
 * given `pathPrefix` (e.g. `"action.requestHeaders."` for the Request
 * Headers tab in a header rule). Renders the shared `AwarenessPill`
 * — same UX as the entity-level `PresenceBadge` and the per-field
 * `FieldPresenceChip` so a peer editing any field inside the section
 * shows up the same way.
 *
 * Returns `null` when there's no entity context yet (drafts before
 * first save) or when no peer is focused under the prefix.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import AwarenessPill from './AwarenessPill';
import { usePathPrefixPresence } from './use-entity-presence';

export interface TabPresenceBadgeProps {
  entityType: string;
  entityId: string | null | undefined;
  /** Path prefix to aggregate over — must end with `.` so it matches
   *  `<prefix><leaf>` cleanly without partial matches into a sibling. */
  pathPrefix: string;
  /** Local instance id — filtered so this surface doesn't see itself. */
  excludeInstanceId: string;
  style?: React.CSSProperties;
}

const TabPresenceBadge: React.FC<TabPresenceBadgeProps> = ({
  entityType,
  entityId,
  pathPrefix,
  excludeInstanceId,
  style,
}) => {
  const t = useT();
  const ref = entityId ? { type: entityType, id: entityId } : null;
  const presence = usePathPrefixPresence(ref, pathPrefix, { excludeInstanceId, enabled: !!entityId });
  return (
    <AwarenessPill
      presence={presence}
      title={t('shared.awareness.section.title')}
      ariaLabel={t('shared.awareness.section.editingAria', { count: presence.length })}
      style={style}
    />
  );
};

export default TabPresenceBadge;
