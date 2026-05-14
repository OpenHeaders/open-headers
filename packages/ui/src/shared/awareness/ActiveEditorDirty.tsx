/**
 * `ActiveEditorDirty` — workspace-wide "active editor's dirty paths" state.
 *
 * Single source of truth for which entity is dirty (uncommitted edits)
 * on this surface right now. Set by `useEditorDirty` from inside the
 * active editor; read by `<SurfaceAwarenessPublisher>` so the surface's
 * one awareness publish carries an accurate `dirtyFields` claim.
 *
 * Why workspace-level (and not part of `ActiveTabEntity` / `ActiveFieldFocus`):
 * dirty state is editor-shape-specific and only the editor knows it.
 * `ActiveTabEntity` answers "which tab is the user looking at",
 * `ActiveFieldFocus` answers "where is the caret", neither of those
 * carry whether form values diverge from the persisted entity. The
 * editor whose entity matches the active tab contributes its dirty
 * marker here; other (non-active) editors stay silent.
 *
 * Provider mounts once near the surface root (workbench `App.tsx`).
 * The setter is callable from any descendant; the reader is the
 * publisher.
 */

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface ActiveEditorDirtyValue {
  entityType: string;
  entityId: string;
  /** Field paths the user has uncommitted edits for. Today every
   *  migrated editor uses the wildcard `['*']` marker, matching the
   *  pre-refactor behaviour; per-leaf path tracking lands when the
   *  diff-chip path expands. */
  dirtyFields: string[];
}

const ValueCtx = createContext<ActiveEditorDirtyValue | null>(null);
const SetterCtx = createContext<(next: ActiveEditorDirtyValue | null) => void>(() => undefined);

export interface ActiveEditorDirtyProviderProps {
  children: ReactNode;
}

export function ActiveEditorDirtyProvider({ children }: ActiveEditorDirtyProviderProps): ReactNode {
  const [value, setValue] = useState<ActiveEditorDirtyValue | null>(null);
  const setter = useCallback((next: ActiveEditorDirtyValue | null) => {
    setValue(next);
  }, []);
  // Memo the setter separately so consumers that only read don't
  // re-render when the setter identity changes (and vice versa).
  const memoSetter = useMemo(() => setter, [setter]);
  return (
    <ValueCtx.Provider value={value}>
      <SetterCtx.Provider value={memoSetter}>{children}</SetterCtx.Provider>
    </ValueCtx.Provider>
  );
}

export function useActiveEditorDirty(): ActiveEditorDirtyValue | null {
  return useContext(ValueCtx);
}

export function useSetActiveEditorDirty(): (next: ActiveEditorDirtyValue | null) => void {
  return useContext(SetterCtx);
}
