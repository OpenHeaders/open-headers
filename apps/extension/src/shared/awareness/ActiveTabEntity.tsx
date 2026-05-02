/**
 * `ActiveTabEntity` — describes the entity backing the workspace's
 * currently-active tab.
 *
 * The breadcrumb's last segment renames the active tab's entity. To
 * publish presence on its `name` field via `<EntityField>`, the
 * breadcrumb needs to know which `(entityType, entityId)` it's editing
 * — but the breadcrumb component lives in `StatusBar`, far from the tab
 * registry. App.tsx (which owns the active-tab dispatch) writes the
 * mapping into this context; the breadcrumb reads.
 *
 * Empty default (`null`) means "no entity is active right now" — the
 * breadcrumb skips wrapping with `<EntityField>` in that case.
 */

import { createContext, type ReactNode, useContext, useMemo } from 'react';

export interface ActiveTabEntityValue {
  entityType: string;
  entityId: string;
}

const Ctx = createContext<ActiveTabEntityValue | null>(null);

export interface ActiveTabEntityProviderProps {
  value: ActiveTabEntityValue | null;
  children: ReactNode;
}

export function ActiveTabEntityProvider({ value, children }: ActiveTabEntityProviderProps): ReactNode {
  // Memo by primitives so callers don't have to remember to stabilize
  // the props object.
  const memoed = useMemo<ActiveTabEntityValue | null>(
    () => (value ? { entityType: value.entityType, entityId: value.entityId } : null),
    [value?.entityType, value?.entityId],
  );
  return <Ctx.Provider value={memoed}>{children}</Ctx.Provider>;
}

export function useActiveTabEntity(): ActiveTabEntityValue | null {
  return useContext(Ctx);
}
