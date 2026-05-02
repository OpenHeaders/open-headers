/**
 * `ActiveTabEntity` — the entity backing the surface's currently-active
 * editing context.
 *
 * Different surfaces compute "active entity" differently:
 *
 *   - **Workbench** — the dock layout's active tab maps to one entity
 *     (rule / request / template / live-* / env / vault / …). App.tsx
 *     computes the mapping and pushes it into this context.
 *   - **Devpanel** — the rule-hover popover binds to one rule when
 *     visible and clears on unmount. The popover itself writes the
 *     mapping.
 *   - **Popup / sidepanel** — typically have a singleton entity (e.g.
 *     popup is bound to the active workspace's overview); they write
 *     it too.
 *
 * The provider holds state internally and exposes both the value AND
 * a setter so any descendant component (App-level effect, popover
 * mount, future surface) can write the active entity. The
 * `<SurfaceAwarenessPublisher>` reads the value to compose its
 * `entityFocus` claim — one wire, one publisher, regardless of who
 * sourced the entity.
 */

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface ActiveTabEntityValue {
  entityType: string;
  entityId: string;
}

const ValueCtx = createContext<ActiveTabEntityValue | null>(null);
const SetterCtx = createContext<(next: ActiveTabEntityValue | null) => void>(() => undefined);

export interface ActiveTabEntityProviderProps {
  children: ReactNode;
}

export function ActiveTabEntityProvider({ children }: ActiveTabEntityProviderProps): ReactNode {
  const [value, setValue] = useState<ActiveTabEntityValue | null>(null);
  // Memo by primitives so consumers reading the value don't re-render
  // when an unrelated rerender produces a structurally-identical object.
  const memoedValue = useMemo<ActiveTabEntityValue | null>(
    () => (value ? { entityType: value.entityType, entityId: value.entityId } : null),
    [value?.entityType, value?.entityId],
  );
  const setter = useCallback((next: ActiveTabEntityValue | null) => {
    setValue(next);
  }, []);
  const memoSetter = useMemo(() => setter, [setter]);
  return (
    <ValueCtx.Provider value={memoedValue}>
      <SetterCtx.Provider value={memoSetter}>{children}</SetterCtx.Provider>
    </ValueCtx.Provider>
  );
}

export function useActiveTabEntity(): ActiveTabEntityValue | null {
  return useContext(ValueCtx);
}

export function useSetActiveTabEntity(): (next: ActiveTabEntityValue | null) => void {
  return useContext(SetterCtx);
}
