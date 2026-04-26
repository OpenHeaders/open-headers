/**
 * env-switcher — single owner of "active environment" policy.
 *
 * Replaces the loose contract that previously lived implicitly across
 * the codebase: "if you change the active env without also setting
 * `manualEnvId`, the workbench's auto-switch effect will silently
 * revert your write on its next run." That contract was undocumented,
 * unenforced, and produced silent flicker bugs every time someone
 * called `useEnvironments().setActiveEnvironment(uid)` from a UI
 * surface (sidebar, popover, env editor).
 *
 * The service centralizes:
 *
 *   1. **Manual-pick policy** (`pickActiveEnvironment(uid, ctx?)`).
 *      The single API every "user clicked an env" surface uses. It
 *      records the manual pick, applies collection-mode-specific
 *      side-effects (per-collection overrides for follow-collection
 *      mode, session overrides for apply-defaults mode), and sets
 *      the active env in one operation. Auto-switch sees the new
 *      `manualEnvId` and respects it.
 *
 *   2. **Auto-switch effect**. Re-runs when active tab / collection
 *      changes, computes the target env from
 *      `resolveAutoSwitchTarget`, and sets it. Lives inside the
 *      provider so the service owns the entire active-env lifecycle.
 *
 *   3. **Apply-defaults session-override map**. Per-collection memory
 *      that lets a manual pick survive intra-collection navigation
 *      without leaking into other collections or other workspaces.
 *      Cleared on collection-leave, mode change, and workspace
 *      switch.
 *
 * Surfaces consume the service via `useEnvSwitcher().pickActiveEnvironment`.
 * The raw `setActiveEnvironment` on `useEnvironments` stays exported
 * but is documented as "internal — service-only" — the only legit
 * caller is the auto-switch effect inside this provider.
 *
 * The collection-aware behavior is opt-in via the `collectionContext`
 * prop. The popup and devtools panel don't have a tab system or
 * auto-switch settings, so they mount the provider WITHOUT the
 * context — the service degrades to plain `setManualEnv +
 * setActiveEnvironment` which is what those surfaces actually want.
 */

import { useEnvironments } from '@hooks/useEnvironments';
import type { V5 } from '@openheaders/core/types';
import { type CollectionEnvAutoSwitchMode, resolveAutoSwitchTarget } from '@openheaders/core/utils';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

export interface EnvSwitcherCollectionContext {
  /** Uid of the collection the active editor tab lives in, or null. */
  activeTabCollectionId: string | null;
  /** Every collection visible in the env-resolution scope (local + remote). */
  allCollectionsForEnv: V5.Collection[];
  /** The user's auto-switch preference. */
  collectionEnvAutoSwitch: CollectionEnvAutoSwitchMode;
  /** The active collection's pinned default env, separated so the
   *  auto-switch effect re-runs when the user pins a new default
   *  via the env-selector pin without changing the active tab. */
  activeCollectionDefaultEnvId: string | null;
  /** Workspace identity — used to drop session overrides on workspace
   *  switch (collection uids are workspace-scoped but the in-memory
   *  override map carries old-workspace entries by reference). */
  activeWorkspaceId: string | null;
}

export interface EnvSwitcherApi {
  /** User-driven env pick. ALWAYS use this from UI surfaces (sidebar,
   *  popover, env editor, command palette). It does:
   *    - Record the pick as `manualEnvId` so auto-switch respects it
   *    - Apply collection-mode side-effects (follow-collection
   *      overrides, apply-defaults session overrides) when a
   *      `collectionContext` is present
   *    - Set the active env in one go
   *  Pass `null` to enter "No environment" mode. */
  pickActiveEnvironment(uid: string | null): void;
}

const NOOP_API: EnvSwitcherApi = { pickActiveEnvironment: () => {} };

const EnvSwitcherContext = createContext<EnvSwitcherApi>(NOOP_API);

interface EnvSwitcherProviderProps {
  /** Workbench-only payload — when present, the service applies
   *  collection-aware policy on top of manual pick. Omit in popup /
   *  devpanel where there's no tab/collection context. */
  collectionContext?: EnvSwitcherCollectionContext;
  children: React.ReactNode;
}

export const EnvSwitcherProvider: React.FC<EnvSwitcherProviderProps> = ({ collectionContext, children }) => {
  const envApi = useEnvironments();

  // Per-collection session overrides for apply-defaults mode. A user
  // who picks a non-default env mid-visit sees their pick survive
  // intra-collection navigation; it's discarded the moment they
  // leave. Cleared on mode change and workspace switch (see effects
  // below). Ref because the auto-switch effect already owns the
  // re-run trigger via deps; mutating the map shouldn't itself
  // re-render.
  const sessionOverridesRef = useRef<Map<string, string | null>>(new Map());
  const prevCollectionIdRef = useRef<string | null>(null);

  // Drop session overrides on mode change OR workspace switch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: drops are intentional on these dep changes.
  useEffect(() => {
    sessionOverridesRef.current.clear();
    prevCollectionIdRef.current = null;
  }, [collectionContext?.collectionEnvAutoSwitch, collectionContext?.activeWorkspaceId]);

  // Auto-switch effect — runs only when collection context is mounted
  // (workbench surface). Without it, the active env is whatever the
  // user manually picked plus broadcast updates; no auto-switch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment below.
  useEffect(() => {
    if (!collectionContext) return;
    if (!envApi.isReady) return;
    const { activeTabCollectionId, allCollectionsForEnv, collectionEnvAutoSwitch } = collectionContext;

    // Detect collection-leave and clear any session override on the
    // collection we just left.
    const prevCollectionId = prevCollectionIdRef.current;
    if (prevCollectionId && prevCollectionId !== activeTabCollectionId) {
      sessionOverridesRef.current.delete(prevCollectionId);
    }
    prevCollectionIdRef.current = activeTabCollectionId;

    const knownEnvIds = new Set(envApi.environments.map((e) => e.uid));

    // apply-defaults: in-session pick wins over the resolver's
    // "default takes over" rule until the user leaves the collection.
    if (collectionEnvAutoSwitch === 'apply-defaults' && activeTabCollectionId) {
      const sessionOverride = sessionOverridesRef.current.get(activeTabCollectionId);
      if (sessionOverride !== undefined) {
        const overrideValid = sessionOverride === null || knownEnvIds.has(sessionOverride);
        if (overrideValid) {
          if (sessionOverride !== envApi.activeEnvironmentId) {
            void envApi.setActiveEnvironment(sessionOverride);
          }
          return;
        }
        sessionOverridesRef.current.delete(activeTabCollectionId);
      }
    }

    const target = resolveAutoSwitchTarget({
      mode: collectionEnvAutoSwitch,
      collectionId: activeTabCollectionId,
      collections: allCollectionsForEnv,
      overrides: envApi.collectionEnvOverrides,
      activeEnvId: envApi.activeEnvironmentId,
      manualEnvId: envApi.manualEnvId,
      knownEnvIds,
    });
    if (target !== envApi.activeEnvironmentId) {
      void envApi.setActiveEnvironment(target);
    }
    // `activeEnvironmentId` and `manualEnvId` are deliberately omitted
    // from deps: the effect WRITES active env (would loop), and
    // `pickActiveEnvironment` writes both directly so re-running on
    // their changes would race with the user's pick.
    // `envApi.environments` and `envApi.collectionEnvOverrides` are
    // included so a cross-tab env add/delete or override change
    // re-resolves; `activeCollectionDefaultEnvId` is included so
    // pinning a new default applies immediately.
  }, [
    collectionContext?.activeTabCollectionId,
    collectionContext?.activeCollectionDefaultEnvId,
    collectionContext?.collectionEnvAutoSwitch,
    collectionContext?.allCollectionsForEnv,
    envApi.isReady,
    envApi.environments,
    envApi.collectionEnvOverrides,
  ]);

  const pickActiveEnvironment = useCallback<EnvSwitcherApi['pickActiveEnvironment']>(
    (uid) => {
      if (collectionContext) {
        const { activeTabCollectionId, allCollectionsForEnv, collectionEnvAutoSwitch } = collectionContext;
        const col = activeTabCollectionId
          ? allCollectionsForEnv.find((c) => c.uid === activeTabCollectionId)
          : undefined;
        const defaultId = col?.defaultEnvironmentId ?? null;

        if (collectionEnvAutoSwitch === 'follow-collection' && activeTabCollectionId) {
          // Follow-collection: remember the pick per-collection.
          // Picking the default itself clears any prior override so
          // the collection reverts to "follow default" behavior.
          const clearOverride = defaultId !== null && uid === defaultId;
          void envApi.setCollectionEnvOverride(activeTabCollectionId, clearOverride ? undefined : uid);
        }

        if (collectionEnvAutoSwitch === 'apply-defaults' && activeTabCollectionId) {
          // Apply-defaults: keep the pick alive for the duration of
          // this collection visit (cleared on collection-leave).
          sessionOverridesRef.current.set(activeTabCollectionId, uid);
        }
      }

      // Both writes always fire — the manual pick must update
      // `manualEnvId` so the auto-switch effect respects it instead
      // of clobbering on its next run.
      void envApi.setManualEnv(uid);
      void envApi.setActiveEnvironment(uid);
    },
    [collectionContext, envApi],
  );

  const api = useMemo<EnvSwitcherApi>(() => ({ pickActiveEnvironment }), [pickActiveEnvironment]);

  return <EnvSwitcherContext.Provider value={api}>{children}</EnvSwitcherContext.Provider>;
};

/** Returns the active env-switcher API for the current surface.
 *  Outside an `EnvSwitcherProvider` returns a noop — UI surfaces that
 *  expect to switch envs (sidebar, popover, env editor) must be
 *  rendered inside a provider; the noop default exists only so that
 *  unit tests rendering individual components don't crash. */
export function useEnvSwitcher(): EnvSwitcherApi {
  return useContext(EnvSwitcherContext);
}
