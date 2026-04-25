/**
 * Pure resolvers for the collection-env-auto-switch feature.
 *
 * Three user-visible modes drive how the active environment reacts
 * when the workbench tab focus moves between collections (and the
 * folders / rules / requests that live inside them):
 *
 *   keep-selection    — once the user picks an env, stay put. The only
 *                       auto-switch is the first time a collection with
 *                       a default is entered while nothing is selected.
 *   apply-defaults    — collection defaults take over while inside; the
 *                       user's last manual pick is the base env,
 *                       restored elsewhere. No per-collection memory.
 *   follow-collection — each collection with a default remembers your
 *                       picks (per-collection override map). Collections
 *                       without a default just keep whatever is
 *                       currently selected.
 *
 * `resolveAutoSwitchTarget` is the single entry point — App.tsx
 * compares the return value to the current active env and issues one
 * `setActiveEnvironment` call only if they differ. Unit-testable and
 * platform-free (no React, no chrome.storage).
 */

export type CollectionEnvOverride = string | null;
// string = envId, null = explicit "No environment"
// key absent in map = no override (auto-switch applies)

export type CollectionEnvAutoSwitchMode = 'keep-selection' | 'apply-defaults' | 'follow-collection';

export interface AutoSwitchParams {
  mode: CollectionEnvAutoSwitchMode;
  collectionId: string | null;
  collections: ReadonlyArray<{ uid: string; defaultEnvironmentId?: string | null }>;
  overrides: Readonly<Record<string, CollectionEnvOverride>>;
  activeEnvId: string | null;
  manualEnvId: string | null;
  knownEnvIds: ReadonlySet<string>;
}

/**
 * Compute the env uid the active environment should be set to for the
 * current tab, given the mode + context. Return value matches the
 * `activeEnvironmentId` convention: `string` uid, or `null` for
 * "No environment". Compare against the current active env and only
 * issue a switch if they differ.
 */
export function resolveAutoSwitchTarget(params: AutoSwitchParams): string | null {
  const { mode, collectionId, collections, overrides, activeEnvId, manualEnvId, knownEnvIds } = params;

  const col = collectionId ? collections.find((c) => c.uid === collectionId) : undefined;
  const rawDefault = col?.defaultEnvironmentId ?? null;
  const collectionDefaultId = rawDefault && knownEnvIds.has(rawDefault) ? rawDefault : null;
  const validManualId = manualEnvId && knownEnvIds.has(manualEnvId) ? manualEnvId : null;
  const validActiveId = activeEnvId && knownEnvIds.has(activeEnvId) ? activeEnvId : null;

  switch (mode) {
    case 'keep-selection':
      // Once something is selected, the user owns the active env —
      // never auto-switch. The lone exception is the null→default
      // bootstrap: entering a collection with a default while nothing
      // is selected adopts that default.
      if (validActiveId !== null) return validActiveId;
      return collectionDefaultId;

    case 'apply-defaults':
      // A collection's default takes over while inside; otherwise
      // fall back to the user's "base" (last manual pick), and as a
      // last resort keep the current active env so a fresh-state
      // user (manual=null) doesn't get wiped to "No environment"
      // when they leave a default-collection.
      return collectionDefaultId ?? validManualId ?? validActiveId;

    case 'follow-collection':
      return resolveCollectionEnv({
        collectionId,
        collections,
        overrides,
        activeEnvId: validActiveId,
        knownEnvIds,
      });
  }
}

/**
 * Per-collection override resolver — the core of `follow` mode.
 * Override wins over the collection's default, which wins over the
 * currently active env. Exposed separately so callers that only need
 * the `follow` semantics (e.g. unit tests) can skip the mode switch.
 */
export function resolveCollectionEnv(params: {
  collectionId: string | null;
  collections: ReadonlyArray<{ uid: string; defaultEnvironmentId?: string | null }>;
  overrides: Readonly<Record<string, CollectionEnvOverride>>;
  activeEnvId: string | null;
  knownEnvIds: ReadonlySet<string>;
}): string | null {
  const { collectionId, collections, overrides, activeEnvId, knownEnvIds } = params;
  const validActive = activeEnvId && knownEnvIds.has(activeEnvId) ? activeEnvId : null;
  if (!collectionId) return validActive;

  if (collectionId in overrides) {
    const ov = overrides[collectionId];
    if (ov === null) return null;
    if (knownEnvIds.has(ov)) return ov;
    // override points to deleted env — fall through to default
  }

  const col = collections.find((c) => c.uid === collectionId);
  const defaultId = col?.defaultEnvironmentId ?? null;
  if (defaultId && knownEnvIds.has(defaultId)) return defaultId;

  return validActive;
}
