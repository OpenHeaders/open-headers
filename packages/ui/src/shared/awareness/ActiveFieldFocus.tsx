/**
 * `ActiveFieldFocus` — workspace-wide "currently focused field" state.
 *
 * Single source of truth for which `(entity, fieldPath)` the user is
 * actively editing right now. Set by `<EntityField>`'s focus capture;
 * read by `<SurfaceAwarenessPublisher>` to publish presence; surfaces other
 * than the focused one render their `<FieldPresenceChip>` against the
 * SW's published view.
 *
 * Why workspace-level (not per-editor): the rename surfaces for an
 * entity's `name` field live OUTSIDE its editor (sidebar inline-rename,
 * breadcrumb inline-rename). A per-editor focused-field state can't see
 * those gestures. Lifting the state above the editor lets every surface
 * within the workspace contribute and consume the same signal.
 *
 * The provider is mounted once near the root of each surface (workbench
 * `App.tsx`, popup `App.tsx`, etc.). The setter is callable from any
 * descendant.
 */

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface ActiveFieldFocusValue {
  entityType: string;
  entityId: string;
  path: string;
}

const ValueCtx = createContext<ActiveFieldFocusValue | null>(null);
const SetterCtx = createContext<(focus: ActiveFieldFocusValue | null) => void>(() => undefined);

export interface ActiveFieldFocusProviderProps {
  children: ReactNode;
}

export function ActiveFieldFocusProvider({ children }: ActiveFieldFocusProviderProps): ReactNode {
  const [focus, setFocusState] = useState<ActiveFieldFocusValue | null>(null);
  // Stable setter so consumers can pass it directly to event handlers
  // without producing a new identity on every parent re-render.
  const setFocus = useCallback((next: ActiveFieldFocusValue | null) => {
    setFocusState(next);
  }, []);
  // Memo the value separately so consumers that only need the setter
  // don't re-render when the focused path changes (and vice versa).
  const memoSetter = useMemo(() => setFocus, [setFocus]);
  return (
    <ValueCtx.Provider value={focus}>
      <SetterCtx.Provider value={memoSetter}>{children}</SetterCtx.Provider>
    </ValueCtx.Provider>
  );
}

export function useActiveFieldFocus(): ActiveFieldFocusValue | null {
  return useContext(ValueCtx);
}

export function useSetActiveFieldFocus(): (focus: ActiveFieldFocusValue | null) => void {
  return useContext(SetterCtx);
}
