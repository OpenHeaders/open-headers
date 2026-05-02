/**
 * Awareness coordinator — one per surface, owned by the
 * `<AwarenessIdentityProvider>`.
 *
 * Why this exists: the SW awareness store has exactly one row per
 * `(workspaceId, identity.instanceId)`, but a single surface (a
 * workbench page) can host many concurrently-mounted editors via the
 * dock layout. If every `useAwareness` published independently, they
 * would race on last-write-wins, and an unmounting editor would leave
 * its stale claim ("I'm editing rule X") in place — causing other
 * surfaces' presence badges to keep counting it long after the user
 * has closed that inner tab.
 *
 * The coordinator gives the surface a single voice. Each editor
 * `register()`s a slot, `update()`s its claim as state changes, and
 * `unregister()`s on unmount. The coordinator picks the most-recently-
 * touched slot ("which editor is the user actively in") and is the
 * SOLE publisher to the SW. When all slots unregister, it publishes a
 * clearing state (`entityFocus: null`) so other surfaces' badges drop
 * this surface from their counts; the lifeline port is independent
 * and still keeps the row alive in the SW so future claims land
 * immediately.
 *
 * This shape mirrors how every awareness library models presence —
 * one row per participant, contents reflect "what they're doing right
 * now", coordinated above the per-component layer.
 */

import type { HLC } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import type { RendererContextHandle } from '@/context/renderer-mutator-context';
import type { SurfaceIdentityHandle } from './surface-identity';

export interface AwarenessClaim {
  workspaceId: string;
  entityFocus: { type: string; id: string } | null;
  fieldFocus: { type: string; id: string; path: string } | null;
  dirtyFields: string[];
}

export interface AwarenessSlot {
  /** Replace the slot's claim. Bumps it to the top of the stack so the
   *  most-recently-active editor is what the surface advertises. */
  update(claim: AwarenessClaim): void;
  /** Remove the slot. If it was the active one, falls back to the
   *  next-most-recent registered slot; if no slots remain, publishes a
   *  clearing state so the surface no longer counts toward any badge. */
  unregister(): void;
}

export interface AwarenessCoordinator {
  /** Register a slot with an initial claim. Idempotent on re-register —
   *  a slot that's already registered is moved to the top. */
  register(initialClaim: AwarenessClaim): AwarenessSlot;
  /** Force a re-publish of the winning claim — used by the provider on
   *  lifeline reconnect (SW eviction recovery). */
  republish(): void;
  /** Tear down the coordinator. Cancels future publishes; does not
   *  remove the surface's awareness row (the lifeline owns liveness). */
  dispose(): void;
}

interface SlotRecord {
  id: number;
  claim: AwarenessClaim;
}

export interface CreateAwarenessCoordinatorOptions {
  identity: SurfaceIdentityHandle;
  /** Resolver for the renderer mutator context — needed to mint the
   *  HLC stamp on each publish. The coordinator calls this lazily so
   *  the workspace can change between publishes. */
  resolveContext: (workspaceId: string) => RendererContextHandle;
}

export function createAwarenessCoordinator(opts: CreateAwarenessCoordinatorOptions): AwarenessCoordinator {
  const { identity, resolveContext } = opts;
  // Insertion-ordered slots; the LAST inserted is the active one.
  // Re-`update`ing a slot moves it to the back via delete+set on Map.
  const slots = new Map<number, SlotRecord>();
  let nextSlotId = 1;
  let lastPublishedKey: string | null = null;
  let lastPublishedWorkspaceId: string | null = null;
  let disposed = false;

  function topClaim(): AwarenessClaim | null {
    if (slots.size === 0) return null;
    let last: SlotRecord | null = null;
    for (const rec of slots.values()) last = rec;
    return last ? last.claim : null;
  }

  function publishKey(claim: AwarenessClaim | null): string {
    return JSON.stringify({
      ws: claim?.workspaceId ?? null,
      e: claim?.entityFocus ?? null,
      f: claim?.fieldFocus ?? null,
      d: claim ? [...claim.dirtyFields].sort() : [],
      l: identity.current().label,
    });
  }

  function publish(): void {
    if (disposed) return;
    const claim = topClaim();
    const key = publishKey(claim);
    if (key === lastPublishedKey) return;
    lastPublishedKey = key;

    // When no slots remain, publish a clearing state under whichever
    // workspace was last advertised so other surfaces' badges stop
    // counting us. If we never published, there's nothing to clear.
    const workspaceId = claim?.workspaceId ?? lastPublishedWorkspaceId;
    if (!workspaceId) return;
    lastPublishedWorkspaceId = workspaceId;

    const ctx = resolveContext(workspaceId);
    const hlc: HLC = ctx.next().hlc;
    const identitySnapshot = identity.current();

    void call('oh.awareness.publish', {
      workspaceId,
      state: {
        identity: identitySnapshot,
        entityFocus: claim?.entityFocus ?? null,
        fieldFocus: claim?.fieldFocus ?? null,
        dirtyFields: claim ? [...claim.dirtyFields] : [],
        lastActivityHlc: hlc,
      },
    }).catch((err: Error) => {
      logger.info('AwarenessCoordinator', `publish failed: ${err.message}`);
    });
  }

  // Re-publish on label changes too — the label rides on every state.
  identity.onLabelChange(() => {
    lastPublishedKey = null;
    publish();
  });

  return {
    register(initialClaim) {
      const id = nextSlotId++;
      slots.set(id, { id, claim: initialClaim });
      publish();
      return {
        update(claim) {
          if (disposed) return;
          // Re-insert via delete+set to bump to the back of the Map's
          // insertion order — Map iteration is insertion-ordered, so
          // this puts the most-recently-touched slot at the top of the
          // virtual stack.
          slots.delete(id);
          slots.set(id, { id, claim });
          publish();
        },
        unregister() {
          if (disposed) return;
          slots.delete(id);
          publish();
        },
      };
    },
    republish() {
      if (disposed) return;
      lastPublishedKey = null;
      publish();
    },
    dispose() {
      disposed = true;
      slots.clear();
    },
  };
}
