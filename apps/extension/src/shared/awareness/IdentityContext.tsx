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
import { ensureRendererContext, type RendererContextHandle } from '@/context/renderer-mutator-context';
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
  children: React.ReactNode;
}

export const AwarenessIdentityProvider: React.FC<AwarenessIdentityProviderProps> = ({ value, children }) => {
  const coordinator = useMemo<AwarenessCoordinator>(
    () =>
      createAwarenessCoordinator({
        identity: value,
        resolveContext: (workspaceId): RendererContextHandle =>
          ensureRendererContext({ workspaceId, surfaceId: value.current().surfaceKind }),
      }),
    [value],
  );

  // One lifeline per identity. Opens on first render, disposes on
  // provider unmount (page unload / surface tear-down). Reconnects
  // transparently across SW eviction; the coordinator re-publishes
  // its winning claim into the freshly-rebuilt SW store.
  useEffect(() => {
    const lifeline = openAwarenessLifeline({
      instanceId: value.current().instanceId,
      onReconnect: () => coordinator.republish(),
    });
    return () => {
      lifeline.dispose();
      coordinator.dispose();
    };
  }, [value, coordinator]);

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
