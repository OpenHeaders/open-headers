/**
 * `<SurfaceAwarenessPublisher>` — sole `useAwareness` caller per
 * surface.
 *
 * Composes the surface's published claim from three workspace-level
 * context signals, each with one authoritative source:
 *
 *   - `entityFocus` ← `ActiveTabEntity` (the dock-layout's active tab)
 *   - `fieldFocus`  ← `ActiveFieldFocus` (the focused field anywhere
 *      on the surface, including sidebar/breadcrumb inline-rename)
 *   - `dirtyFields` ← `ActiveEditorDirty` (the active editor's dirty
 *      marker via `useEditorDirty`)
 *
 * One slot, one voice — replaces session 56's per-`useAwareness`
 * MRT-pick model (which conflated multiple "voices" into a stack and
 * could erase fieldFocus when an editor's dirty flip bumped its slot
 * to MRT). The user is one person; their focus / dirty / active-tab
 * state composes into one row, never compete.
 *
 * Migration is incremental. The `migratedEntityTypes` prop lists the
 * entity types whose editors have dropped their per-editor
 * `useAwareness` and adopted `useEditorDirty`. For non-migrated entity
 * types the publisher stays silent; their existing per-editor
 * `useAwareness` calls keep publishing as before. Each future session
 * adds one entity type to the list as its editor migrates.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAwareness } from '@hooks/useAwareness';
import { useActiveEditorDirty } from './ActiveEditorDirty';
import { useActiveFieldFocus } from './ActiveFieldFocus';
import { useActiveTabEntity } from './ActiveTabEntity';
import { useSurfaceIdentity } from './IdentityContext';

export interface SurfaceAwarenessPublisherProps {
  workspaceId: string | null;
  /** Entity types whose editors have migrated to the centralized
   *  publish model. The publisher only takes over when the active
   *  tab's entity is in this set; non-migrated tabs let their
   *  per-editor `useAwareness` keep publishing. */
  migratedEntityTypes: readonly string[];
}

export function SurfaceAwarenessPublisher({
  workspaceId,
  migratedEntityTypes,
}: SurfaceAwarenessPublisherProps): ReactNode {
  const tabEntity = useActiveTabEntity();
  const fieldFocus = useActiveFieldFocus();
  const dirty = useActiveEditorDirty();
  // useAwareness expects the SurfaceIdentityHandle (not a snapshot)
  // so it can pull the latest navigation/title on every publish.
  const identity = useSurfaceIdentity();

  const isMigrated = !!tabEntity && migratedEntityTypes.includes(tabEntity.entityType);

  // Field-focus contribution: the user's focus path is published only
  // when it belongs to the active tab's entity. Sidebar/breadcrumb
  // inline-rename of the active tab's entity flows through naturally
  // (matching scope). Cross-entity focus (renaming a different
  // entity's name in the sidebar while a non-matching tab is active)
  // is a known gap addressed in a later session — for now the
  // publisher stays silent on cross-entity focus rather than emit a
  // mixed (entityFocus=A, fieldFocus=B) row.
  const publishedFieldFocus = useMemo(() => {
    if (!isMigrated || !fieldFocus || !tabEntity) return null;
    if (fieldFocus.entityType !== tabEntity.entityType) return null;
    if (fieldFocus.entityId !== tabEntity.entityId) return null;
    return { type: fieldFocus.entityType, id: fieldFocus.entityId, path: fieldFocus.path };
  }, [isMigrated, fieldFocus, tabEntity]);

  const publishedEntityFocus = useMemo(
    () => (isMigrated && tabEntity ? { type: tabEntity.entityType, id: tabEntity.entityId } : null),
    [isMigrated, tabEntity],
  );

  const publishedDirty = useMemo<string[]>(() => {
    if (!isMigrated || !tabEntity || !dirty) return [];
    if (dirty.entityType !== tabEntity.entityType) return [];
    if (dirty.entityId !== tabEntity.entityId) return [];
    return dirty.dirtyFields;
  }, [isMigrated, tabEntity, dirty]);

  useAwareness({
    workspaceId,
    identity,
    entityFocus: publishedEntityFocus,
    fieldFocus: publishedFieldFocus,
    dirtyFields: publishedDirty,
    enabled: isMigrated,
  });

  return null;
}
