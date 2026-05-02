/**
 * `<WorkbenchAwarenessSlot>` — workspace-level field-focus publisher.
 *
 * One mount near the workbench root. Reads `ActiveFieldFocusContext`;
 * when something is focused, calls `useAwareness` with the
 * (entityFocus, fieldFocus) pair from the focused field's entity. When
 * nothing is focused, the slot disables itself (`enabled: false`) so
 * the surface coordinator falls back to whatever the per-editor
 * `useAwareness` calls publish (typically entity-level focus only).
 *
 * This is the load-bearing piece that lets sidebar inline-rename and
 * breadcrumb inline-rename publish on the same wire as in-editor field
 * focus. The surface coordinator (session 56) handles MRT picking
 * across this slot + the editor's slot.
 *
 * The slot publishes empty `dirtyFields` because field-level dirty
 * tracking lives on the editor (which has form state). Cross-surface
 * dirty signaling (e.g. "the user has unsaved edits in the breadcrumb
 * rename") is a future concern — for now, dirty is editor-scoped.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAwareness } from '@hooks/useAwareness';
import { useActiveFieldFocus } from './ActiveFieldFocus';
import { useSurfaceIdentity } from './IdentityContext';

export interface WorkbenchAwarenessSlotProps {
  workspaceId: string | null;
}

export function WorkbenchAwarenessSlot({ workspaceId }: WorkbenchAwarenessSlotProps): ReactNode {
  const focus = useActiveFieldFocus();
  // useAwareness expects the SurfaceIdentityHandle (not the resolved
  // identity snapshot) so it can pull the latest navigation/title on
  // every publish — the handle's `.current()` is called inside the hook.
  const identity = useSurfaceIdentity();

  const entityFocus = useMemo(
    () => (focus ? { type: focus.entityType, id: focus.entityId } : null),
    [focus],
  );
  const fieldFocus = useMemo(
    () => (focus ? { type: focus.entityType, id: focus.entityId, path: focus.path } : null),
    [focus],
  );
  const dirtyFields = useMemo<string[]>(() => [], []);

  useAwareness({
    workspaceId,
    identity,
    entityFocus,
    fieldFocus,
    dirtyFields,
    enabled: focus !== null,
  });

  return null;
}
