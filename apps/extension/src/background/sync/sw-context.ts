/**
 * SW-side HLC sequencer + `MutatorContext` factory.
 *
 * Phase A is single-device, single-user — but every mutation envelope
 * still needs an HLC stamp that's strictly monotonic across the SW's
 * own emissions and that orders correctly against any envelopes the
 * renderer surfaces emit. Each surface (SW, workbench tab, popup,
 * devpanel) gets its own `nodeId`; total ordering across surfaces falls
 * out of `compareHlc`'s (physical, logical, nodeId) tuple.
 *
 * The SW's nodeId is regenerated on each cold wake. That's correct for
 * Phase A (no cross-eviction state to preserve — the oracle's IDB log
 * is the only durable state, and its dedup is keyed on `mutationId`
 * which is independent). Phase D will persist a stable per-install
 * deviceId once cross-device sync ships.
 */

import { advanceHlc, createDefaultWallClock, type HLC, initialHlc, type MutatorContext } from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';

export type SwMutatorContextFactory = () => MutatorContext;

/**
 * Build a context factory for `workspaceId`. The factory takes an
 * optional override (`{ batchId, surfaceId }`) for callers that want
 * to bundle multiple intents under one batch or attribute the
 * emission to a specific UI surface.
 */
export interface SwContextOptions {
  /** Override the default surfaceId (`'sw'`). Used by SW-internal
   *  callers that emit on behalf of a specific UI gesture. */
  surfaceId?: string;
  /** Reuse a single batchId across multiple factory calls — gives the
   *  oracle a multi-mutation all-or-nothing batch. */
  batchId?: string;
  /** Observe an inbound HLC (e.g. from a remote envelope) so the
   *  sequencer's next emission strictly succeeds it. */
  observed?: HLC;
}

export interface SwContextHandle {
  /** Mint a fresh `MutatorContext` for a single envelope. */
  next(opts?: SwContextOptions): MutatorContext;
  /** Take the latest HLC (for observability / awareness — never the
   *  source of HLCs on the wire; that comes from `next`). */
  peekHlc(): HLC;
  /** The SW's nodeId for this lifetime. */
  readonly nodeId: string;
}

export function createSwContextHandle(workspaceId: string): SwContextHandle {
  const clock = createDefaultWallClock();
  const nodeId = `sw-${generateUid()}`;
  let hlc: HLC = initialHlc(nodeId, clock.now());

  return {
    nodeId,
    peekHlc: () => hlc,
    next(opts = {}): MutatorContext {
      hlc = advanceHlc(hlc, clock.now(), opts.observed);
      return {
        workspaceId,
        hlc,
        surfaceId: opts.surfaceId ?? 'sw',
        deviceId: nodeId,
        ...(opts.batchId ? { batchId: opts.batchId } : {}),
      };
    },
  };
}
