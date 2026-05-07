/**
 * `useEditorLifecycle` — editor's contribution to the surface's
 * lifecycle awareness.
 *
 * Editors are mounted for every open tab (the dock layout sets
 * `display: none` on inactive tabs), so the publisher gates on
 * `useTabActive()` to make sure only the editor the user is currently
 * viewing writes its lifecycle status into the shared context. The
 * footer reads that context to render exactly one chip — for whatever
 * is in front of the user right now.
 *
 * Unlike `useEditorDirty` this also publishes for scratch entities
 * (`entityId === null` → status `'scratch'`) so the footer can
 * surface "Scratch" before the first save.
 */

import { useEffect } from 'react';
import type { EntityReprimeScope } from '@/shared/forms';
import type { EditorLifecycleStatus } from '@/shared/editor-shell/types';
import { useTabActive } from './TabActiveContext';
import { useSetActiveEditorLifecycle } from './ActiveEditorLifecycle';

const SCRATCH_ID = '__scratch__';

export function useEditorLifecycle(scope: EntityReprimeScope, status: EditorLifecycleStatus): void {
  const isTabActive = useTabActive();
  const setLifecycle = useSetActiveEditorLifecycle();

  useEffect(() => {
    if (!isTabActive) return;
    setLifecycle({
      entityType: scope.entityType,
      entityId: scope.entityId ?? SCRATCH_ID,
      status,
    });
    return () => {
      setLifecycle(null);
    };
  }, [isTabActive, status, scope.entityType, scope.entityId, setLifecycle]);
}
