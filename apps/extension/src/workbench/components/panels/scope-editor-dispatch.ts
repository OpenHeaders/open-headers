/**
 * Inspector → editor dispatch helpers — pure, testable, no React.
 *
 * The Inspector's "open editor" affordances come in two flavours:
 *
 *   1. Section-level (AllScopesView's "Edit" link beside each scope
 *      title): dispatches by `DisplayScope` only. The collection scope
 *      goes to the active collection's per-family editor; the
 *      environment scope to the active env's editor; vault / workspace
 *      / live to their singleton list pages.
 *
 *   2. Row-level (InContextView's clickable variable row): dispatches
 *      by the row's scope BUT when the row carries a per-entity uid
 *      (today: `liveVariableUid` on a Live row), the dispatcher
 *      prefers a per-entity opener over the singleton list — so the
 *      user lands on the LV editor for THIS variable, not on the LV
 *      list page where they'd then have to find it.
 *
 * Extracted from `VariablesPanel.tsx` so the dispatch table has direct
 * unit-test coverage instead of needing a full React render to exercise
 * (the component depends on six provider hooks). Keeps the panel free
 * of conditional fallback logic that was hard to read inline.
 */

import type { Environment } from '@openheaders/core/types';
import {
  type CollectionFamilies,
  findCollectionWithFamily,
} from '@/shared/variables/collection-scope';

/** Mirrors `VariablesPanel.tsx`'s SCOPE_CONFIG keyset. Re-declared here
 *  so this module stays standalone; the test asserts they stay in
 *  sync. */
export type DisplayScope = 'vault' | 'environment' | 'collection' | 'workspace' | 'live';

/** Subset of `DisplayVariable` the dispatchers actually consume —
 *  scope + the per-row identity hooks. Keeping the shape narrow means
 *  tests don't need to construct a full DisplayVariable. */
export interface DispatchVariable {
  scope: DisplayScope;
  /** When present on a `live` scope row, the row-level dispatcher
   *  prefers `onOpenLiveVariableEdit(uid)` over the singleton list. */
  liveVariableUid?: string;
}

/** Openers wired by `App.tsx`; every callback is optional because the
 *  Inspector renders before workspace state is fully wired and we'd
 *  rather hide an affordance than crash on undefined. */
export interface ScopeEditorOpeners {
  onOpenVault?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenLiveVariables?: () => void;
  onOpenLiveVariableEdit?: (uid: string, name: string) => void;
  onOpenEnvironmentEdit?: (uid: string, name: string) => void;
  onOpenRuleCollectionVariables?: (uid: string, name: string) => void;
  onOpenRequestCollectionVariables?: (uid: string, name: string) => void;
  onOpenTemplateCollectionVariables?: (uid: string, name: string) => void;
}

export interface ScopeEditorContext {
  activeCollectionId: string | null;
  families: CollectionFamilies;
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  environments: readonly Environment[];
  /** All known live variables — used to look up uid by name from a
   *  row that didn't capture the uid at build time (defensive
   *  fallback; production callers attach `liveVariableUid` upstream). */
  liveVariables?: readonly { uid: string; name: string }[];
}

/**
 * Section-level dispatcher: returns a callback for the given scope, or
 * null if the click can't lead anywhere (e.g., `collection` scope with
 * no active collection, `environment` scope with no env selected and
 * no default).
 */
export function buildScopeEditorDispatch(
  openers: ScopeEditorOpeners,
  ctx: ScopeEditorContext,
): (scope: DisplayScope) => (() => void) | null {
  return (scope) => {
    if (scope === 'vault') return openers.onOpenVault ?? null;
    if (scope === 'workspace') return openers.onOpenWorkspaceVariables ?? null;
    if (scope === 'live') return openers.onOpenLiveVariables ?? null;
    if (scope === 'environment') {
      if (!openers.onOpenEnvironmentEdit) return null;
      const envId = ctx.activeEnvironmentId ?? ctx.defaultEnvironmentId;
      if (!envId) return null;
      const env = ctx.environments.find((e) => e.uid === envId);
      if (!env) return null;
      const open = openers.onOpenEnvironmentEdit;
      return () => open(env.uid, env.name);
    }
    if (scope === 'collection') {
      if (!ctx.activeCollectionId) return null;
      const hit = findCollectionWithFamily(ctx.activeCollectionId, ctx.families);
      if (!hit) return null;
      if (hit.family === 'rule' && openers.onOpenRuleCollectionVariables) {
        const open = openers.onOpenRuleCollectionVariables;
        return () => open(hit.collection.uid, hit.collection.name);
      }
      if (hit.family === 'request' && openers.onOpenRequestCollectionVariables) {
        const open = openers.onOpenRequestCollectionVariables;
        return () => open(hit.collection.uid, hit.collection.name);
      }
      if (hit.family === 'template' && openers.onOpenTemplateCollectionVariables) {
        const open = openers.onOpenTemplateCollectionVariables;
        return () => open(hit.collection.uid, hit.collection.name);
      }
      return null;
    }
    return null;
  };
}

/**
 * Row-level dispatcher: prefers per-entity openers when the row carries
 * a per-entity uid, otherwise falls back to the section-level dispatch.
 *
 * Today the only per-entity case is `live` rows with a known uid; new
 * cases (e.g., a vault row that opens the entry's editor) plug in here
 * without touching every consumer.
 */
export function buildVariableEditorDispatch(
  openers: ScopeEditorOpeners,
  ctx: ScopeEditorContext,
): (variable: DispatchVariable, name: string) => (() => void) | null {
  const sectionDispatch = buildScopeEditorDispatch(openers, ctx);
  return (variable, name) => {
    if (variable.scope === 'live' && openers.onOpenLiveVariableEdit) {
      const uid =
        variable.liveVariableUid ??
        ctx.liveVariables?.find((lv) => lv.name === name)?.uid ??
        null;
      if (uid) {
        const open = openers.onOpenLiveVariableEdit;
        return () => open(uid, name);
      }
    }
    return sectionDispatch(variable.scope);
  };
}
