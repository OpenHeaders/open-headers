/**
 * `EntityScope` — declares the active entity for a subtree of the UI.
 *
 * Editors mount this around their body so every nested `<EntityField>`
 * resolves to the editor's entity without prop-drilling. Sidebar rows
 * mount it around the row's interactive elements (inline rename, etc.)
 * with the row's own `(entityType, entityId)`. Inspector / popover
 * surfaces follow the same shape.
 *
 * `EntityField` reads from this context but accepts explicit
 * `entityType` / `entityId` props that take precedence — useful for
 * sidebar rows whose surrounding scope (workspace) differs from the row's
 * entity (a specific rule / request / template).
 *
 * The scope is intentionally entity-agnostic. Adding a new entity type
 * does NOT require touching this file — callers just supply the right
 * type string.
 */

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { EditorShellScopeWiring } from '@/shared/editor-shell';

export interface EntityScopeValue {
  entityType: string;
  /** Null while the entity has not yet been minted (e.g. unsaved drafts). */
  entityId: string | null;
}

const Ctx = createContext<EntityScopeValue>({ entityType: '', entityId: null });

export interface EntityScopeProviderProps {
  entityType?: string;
  entityId?: string | null;
  /** Shell-produced wiring bundle. When supplied, overrides the
   *  individual `entityType` / `entityId` props. */
  shell?: EditorShellScopeWiring;
  children: ReactNode;
}

export function EntityScopeProvider({ entityType, entityId, shell, children }: EntityScopeProviderProps): ReactNode {
  const wiring = shell as unknown as { entityType: string; entityId: string | null } | undefined;
  const eType = (wiring ? wiring.entityType : entityType) ?? '';
  const eId = wiring ? wiring.entityId : (entityId ?? null);
  const value = useMemo<EntityScopeValue>(() => ({ entityType: eType, entityId: eId ?? null }), [eType, eId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntityScope(): EntityScopeValue {
  return useContext(Ctx);
}
