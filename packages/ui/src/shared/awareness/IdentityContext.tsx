/**
 * React context carrying the local surface's
 * {@link SurfaceIdentityHandle} and the surface-scoped
 * {@link AwarenessCoordinator}.
 *
 * Surfaces wrap their tree in `<AwarenessIdentityProvider value={...}>`
 * once at root; descendants read the identity (and the convenience
 * `instanceId` for `excludeInstanceId` props) without re-resolving the
 * navigation handle on every component.
 *
 * The provider owns two surface-scoped resources:
 *
 * 1. The **single lifeline port**. Liveness is a per-surface property
 *    (one identity ↔ one tab), so the port lives at the same scope as
 *    the identity. One port per `useAwareness` would break when a
 *    surface has several editors mounted concurrently and one of them
 *    unmounts: the SW would prune the surface's row even though the
 *    surface is still alive.
 *
 * 2. The **awareness coordinator**. Multiple `useAwareness` callers
 *    inside one surface (every editor in the dock layout) all
 *    register with this single coordinator instead of publishing
 *    independently — otherwise they'd race on last-write-wins, and an
 *    unmounting editor would leave its stale claim ("editing rule X")
 *    behind, inflating other surfaces' badges.
 */

import type React from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { ensureRendererContext, type RendererContextHandle } from '@openheaders/ui/context';
import { type AwarenessCoordinator, createAwarenessCoordinator } from './awareness-coordinator';
import { openAwarenessLifeline } from './awareness-lifeline';
import type { SurfaceIdentityHandle } from './surface-identity';

interface IdentityContextValue {
  identity: SurfaceIdentityHandle;
  coordinator: AwarenessCoordinator;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export interface AwarenessIdentityProviderProps {
  value: SurfaceIdentityHandle;
  /**
   * Workspace the surface is currently editing or rendering for.
   * Carried in the lifeline `bind` message so the SW refcount-acquires
   * the workspace's `WorkspaceServiceState` while this surface is live
   * (design § 4.0.7). Workbench passes its editing-scope workspaceId;
   * popup / side-panel / devtools panel pass the runtime-Active id.
   * `null` is allowed for cold-mount frames where the surface hasn't
   * resolved its workspace yet — the lifeline opens liveness-only and
   * the SW skips refcount acquire until the next non-null value.
   *
   * On change the lifeline disposes + reopens (one port ↔ one
   * workspace ref); the SW sees a clean release-then-acquire pair
   * across the rebind.
   */
  workspaceId?: string | null;
  children: React.ReactNode;
}

export const AwarenessIdentityProvider: React.FC<AwarenessIdentityProviderProps> = ({
  value,
  workspaceId = null,
  children,
}) => {
  const coordinator = useMemo<AwarenessCoordinator>(
    () =>
      createAwarenessCoordinator({
        identity: value,
        resolveContext: (resolveWorkspaceId): RendererContextHandle =>
          ensureRendererContext({ workspaceId: resolveWorkspaceId, surfaceId: value.current().surfaceKind }),
      }),
    [value],
  );

  // One lifeline per (identity, workspaceId) pair. Opens on first
  // render, disposes on provider unmount AND on workspaceId change
  // (per § 4.0.7's "one port ↔ one workspace ref" framing). Reconnects
  // transparently across SW eviction; the coordinator re-publishes its
  // winning claim into the freshly-rebuilt SW store, and the lifeline
  // re-sends the `bind` message so the SW re-acquires the workspace
  // ref before the awareness state lands.
  useEffect(() => {
    const lifeline = openAwarenessLifeline({
      instanceId: value.current().instanceId,
      workspaceId,
      onReconnect: () => coordinator.republish(),
    });
    return () => {
      lifeline.dispose();
    };
  }, [value, coordinator, workspaceId]);

  // Coordinator dispose is decoupled from lifeline dispose so a
  // workspaceId change doesn't tear down the coordinator's pending
  // claims — only the SW-side refcount handle rebinds.
  useEffect(() => {
    return () => coordinator.dispose();
  }, [coordinator]);

  const ctxValue = useMemo<IdentityContextValue>(() => ({ identity: value, coordinator }), [value, coordinator]);

  return <IdentityContext.Provider value={ctxValue}>{children}</IdentityContext.Provider>;
};

function requireCtx(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    throw new Error('Awareness hook called outside <AwarenessIdentityProvider>');
  }
  return ctx;
}

/** Required identity. Throws when the surface forgot to wrap its tree —
 *  this is a programming error, not a runtime condition, so failing
 *  loud is the right call. */
export function useSurfaceIdentity(): SurfaceIdentityHandle {
  return requireCtx().identity;
}

/** The surface-scoped coordinator. `useAwareness` is the typical
 *  consumer; surfaces shouldn't need to call this directly. */
export function useAwarenessCoordinator(): AwarenessCoordinator {
  return requireCtx().coordinator;
}

/** Convenience: returns the local instanceId for `excludeInstanceId`
 *  props on PresenceBadge / FieldPresenceChip. */
export function useLocalInstanceId(): string {
  return requireCtx().identity.current().instanceId;
}

/** Same as {@link useLocalInstanceId} but returns `undefined` when no
 *  provider is mounted. Used by tracker hooks that want to opt into
 *  awareness-driven attribution when available without coupling
 *  themselves to the provider being mounted in every test setup. */
export function useOptionalLocalInstanceId(): string | undefined {
  const ctx = useContext(IdentityContext);
  return ctx?.identity.current().instanceId;
}
