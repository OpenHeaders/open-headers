/**
 * Sync service — per-workspace service-state shape plus the wiring-deps
 * contract shared by the production and test dependency factories.
 */

import type { AwarenessState, SyncBroadcastEvent } from '@openheaders/core/protocol';
import type { AwarenessStore } from '../awareness/awareness';
import type { InMemoryBroadcast } from '../broadcast';
import type { EntityCacheLike } from '../entity-registry';
import type { MutationLog } from '../mutation-log';
import type { EntityOracle, LockAcquirer } from '../oracle';
import type { PendingIntents } from '../pending-intents';
import type { SwContextHandle } from '../sw-context';

/**
 * Per-workspace service state. Each resident workspace has exactly one
 * of these in {@link services}; non-resident workspaces have none.
 */
export interface WorkspaceServiceState {
  workspaceId: string;
  /**
   * Resolves once the service is ready to accept `oracle.apply` calls.
   * Awaited by {@link applySyncRequest} before routing to the oracle —
   * closes the cold-oracle race without eager pre-create. Today the
   * oracle is synchronously ready; the promise contract is in place
   * for a future async seed-from-storage step.
   */
  hydrated: Promise<void>;
  oracle: EntityOracle;
  log: MutationLog;
  intents: PendingIntents;
  broadcast: InMemoryBroadcast;
  caches: EntityCacheLike[];
  context: SwContextHandle;
  awareness: AwarenessStore;
  /**
   * Active-bound DNR runner subscription bookkeeping. Non-null only
   * when this service is the runtime-Active workspace. The runner is
   * a singleton in spirit (browser DNR is platform-singular) — at any
   * moment exactly one resident service has this slot populated. The
   * Active flip in {@link setRuntimeActive} disposes the old slot
   * before attaching the new, making "≤1 DNR-writing runner" structural
   * by construction. (Lint #17a in commit 1e pins this invariant.)
   */
  dnrSubscription: { dispose(): void } | null;
  /**
   * Active-bound resolver-invalidate runner subscription bookkeeping.
   * Same structural framing as {@link dnrSubscription}: triggers
   * `recompile` on Active's variable-scope mutations (env / collection
   * vars / vault / live-vars / live-workflows / workspace-vars). Only
   * the Active workspace drives recompile because `recompile` =
   * `rule-engine.scheduleUpdate` is browser-singular.
   */
  resolverInvalidateSubscription: { dispose(): void } | null;
  /**
   * Stored deps used to (re)build Active-bound runner subscriptions on
   * Active flip. All resident workspaces share the same `recompile`
   * function in production (it's `rule-engine.scheduleUpdate`); kept
   * per-service so test-injected recompiles still flow through cleanly.
   */
  recompile: (reason: string) => void;
  unsubscribeBroadcast: () => void;
  /** Number of live references — Active pointer + in-flight applies + (later) lifelines. */
  refcount: number;
  /** Pending grace-period disposal timer; cancelled if refcount returns to ≥1 within grace. */
  disposalTimer: ReturnType<typeof setTimeout> | null;
  /** Set true once teardown begins; new acquires must rebuild a fresh service. */
  disposing: boolean;
}

export interface WireDeps {
  workspaceId: string;
  log: MutationLog;
  intents: PendingIntents;
  lock: LockAcquirer;
  recompile: (reason: string) => void;
  sink: (event: SyncBroadcastEvent) => void;
  awarenessSink: (presence: AwarenessState[]) => void;
}

export type WireDepsFactory = (workspaceId: string) => WireDeps;
