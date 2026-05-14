/**
 * `useEditorDirty` — editor's contribution to the surface's awareness
 * publish.
 *
 * The editor passes its `(entityType, entityId)` scope and current
 * `isDirty` boolean. The hook writes to `ActiveEditorDirty` ONLY when
 * the editor's scope matches the active tab's entity (per
 * `ActiveTabEntity`) — that gates inactive (display:none) tab editors
 * from polluting the surface's published claim. Cleanup on unmount
 * clears the context if it still belongs to this editor.
 *
 * The wildcard `['*']` marker matches the pre-refactor publish shape
 * (`dirtyFields: isDirty ? ['*'] : []`). Per-leaf path tracking lands
 * when the diff-chip path needs it.
 */

import { useEffect } from 'react';
import { useActiveTabEntity } from './ActiveTabEntity';
import { useSetActiveEditorDirty } from './ActiveEditorDirty';
import type { EntityReprimeScope } from '../forms';

const WILDCARD: readonly string[] = Object.freeze(['*']);

export function useEditorDirty(scope: EntityReprimeScope, isDirty: boolean): void {
  const activeTab = useActiveTabEntity();
  const setDirty = useSetActiveEditorDirty();

  const isActiveEditor =
    !!scope.entityId &&
    activeTab !== null &&
    activeTab.entityType === scope.entityType &&
    activeTab.entityId === scope.entityId;

  useEffect(() => {
    if (!isActiveEditor) return;
    if (!scope.entityId) return;
    if (!isDirty) {
      setDirty(null);
      return;
    }
    setDirty({
      entityType: scope.entityType,
      entityId: scope.entityId,
      dirtyFields: [...WILDCARD],
    });
    return () => {
      // On unmount or when this editor stops being the active one,
      // clear the surface's claim if we wrote it. The publisher
      // re-evaluates on the same render tick, so there's no flicker.
      setDirty(null);
    };
  }, [isActiveEditor, isDirty, scope.entityType, scope.entityId, setDirty]);
}
