/**
 * Host-neutral refresh scheduler — the shared cadence loop across
 * OAuth token refresh and Live Variable workflow refresh on BOTH hosts
 * (extension service worker + desktop main process), with the
 * forthcoming DNR rule refresh as a third consumer.
 *
 * The scheduler owns the lifecycle shape every subsystem needs:
 *   - subscribe-on-store-change → reconcile (optionally debounced)
 *   - reconcile walks all jobs, arms the eligible ones, clears keys
 *     whose job no longer exists (orphan sweep)
 *   - idempotent arming keyed by the provider's key codec
 *   - fire dispatch: decode → in-flight guard → lookup → gate →
 *     refresh → log → record failure → re-arm off the post-write state
 *
 * Each subsystem provides a `RefreshProvider` that fills in the
 * subsystem-specific bits: key payload shape, cadence math, gate
 * checks, refresh work + failure recording, and observability-log
 * routing. Provider methods can be async where they do I/O; the
 * scheduler awaits accordingly.
 *
 * The timer substrate is the ONLY host-specific surface, injected as a
 * `RefreshTimer` (`./timer`): the extension's `chrome.alarms` adapter
 * (keys persist as alarm names across SW eviction; the host's alarm
 * dispatch routes fires back into `handleFire`) vs the in-memory
 * `setTimeout` adapter (`./in-memory-timer`) the always-on desktop
 * uses. Wake/eviction ceremony lives entirely in the adapters and the
 * host bootstrap — never here.
 *
 * Rationale for a class rather than a functional factory: callers
 * consume a handful of methods (`schedule` / `cancelByPayload` /
 * `reconcile` / `handleFire` / `start` / `stop`), and each subsystem
 * instantiates ONE scheduler — per-module singletons map cleanly to
 * instance state (`storeSubscription`, `inFlight`).
 */

import { logger } from '@openheaders/core/utils';
import type { RefreshTimer } from './timer';

/**
 * Port a subsystem fills in to use the shared scheduler. The type
 * parameters are the key-payload shape and the subsystem's concrete
 * "job" object (OAuth: `WorkspaceCredentialEntry`; Live: a workflow +
 * bindings + cache bundle). Error-state type is whatever
 * `recordFailure` returns; the scheduler carries it as opaque context
 * to the provider's `onFailed` log hook so per-subsystem escalation
 * rules (OAuth elevates to `error` at `consecutiveFailures >= 3`)
 * live with the provider, not in the scheduler.
 */
export interface RefreshProvider<TPayload extends object, TJob, TErrorState = unknown> {
  /** Unique prefix identifying keys this provider owns. */
  readonly keyPrefix: string;

  /**
   * Decode a key into the provider's payload shape. Returns `null` for
   * keys not owned by this provider or whose payload is malformed.
   * Callers (the scheduler) treat `null` as "ignore".
   */
  decodeKey(key: string): TPayload | null;

  /**
   * Build the key for a job. Used by `schedule` to arm the timer and
   * by reconcile to compute the "desired" set against which orphan
   * keys are cleared.
   */
  encodeKey(job: TJob): string;

  /**
   * Build the key from a payload alone — used by `cancelByPayload`
   * paths where callers have the identity but not a full job object
   * (e.g., deleting a credential by ref). Identity-only encoders are
   * cheap; providers that need extra context to build a key should
   * encode it into the payload shape.
   */
  encodeKeyFromPayload(payload: TPayload): string;

  /**
   * List every job the provider wants considered for scheduling.
   * Called by `reconcile` on host wake + after every store-change
   * tick. Provider is responsible for spanning inactive workspaces if
   * it wants cross-workspace scheduling.
   */
  listAll(): Promise<TJob[]>;

  /**
   * Look up a single job by its key payload. Returns `null` when the
   * job no longer exists (credential deleted, workflow removed), in
   * which case the scheduler clears the key.
   */
  getByKey(payload: TPayload): Promise<TJob | null>;

  /**
   * Compute the absolute wall-clock ms at which the refresh should
   * next fire. Returns `null` when no schedule is possible (manual
   * policy, missing expiry, etc.).
   */
  computeNextFireAt(job: TJob, nowMs: number): number | null;

  /**
   * Gate — returns `false` when the job shouldn't be armed at all
   * (disabled, no refresh capability, no consumers). The scheduler
   * calls `canSchedule` during both `schedule` (new work) and
   * `handleFire` (config may have changed between scheduling and
   * firing) so the gate is enforced on both sides.
   */
  canSchedule(job: TJob): boolean;

  /**
   * Execute the refresh. Must throw on failure — the scheduler uses
   * the throw to route into `recordFailure` + observability. Success
   * is expected to write the fresh token / cache, whose store-change
   * broadcast reconciles the wider set; the scheduler additionally
   * re-arms the fired key itself off the post-write state.
   */
  refresh(job: TJob, payload: TPayload): Promise<void>;

  /**
   * Persist the failure state + return its post-increment snapshot
   * (typically `{ consecutiveFailures, lastErrorAt }`). The scheduler
   * passes this snapshot to `onFailed` so per-subsystem log-level
   * escalation rules stay with the provider. Deliberate no-op skips
   * (circuit-blocked, offline, defer gates) return the existing state
   * without writing — the scheduler's post-fire re-arm lines the next
   * attempt up either way.
   */
  recordFailure(payload: TPayload, err: Error, job: TJob | null): Promise<TErrorState>;

  /**
   * Subscribe the scheduler to the provider's store-change events.
   * Returns an unsubscriber. The scheduler calls this once inside
   * `start()`.
   */
  onStoreChange(callback: () => void): () => void;

  /**
   * Observability: one entry per fire. Provider routes to its
   * subsystem (`oauth` / `live` / …).
   */
  onFired(payload: TPayload): void;

  /**
   * Observability: one entry per successful refresh. Provider routes
   * to its subsystem.
   */
  onSucceeded(payload: TPayload): void;

  /**
   * Observability: one entry per failed refresh. Provider decides log
   * level — OAuth elevates at `consecutiveFailures >= 3`; Live always
   * reports `error` for genuine faults and `info` for gate skips.
   */
  onFailed(payload: TPayload, err: Error, errorState: TErrorState): void;

  /**
   * OPTIONAL dependency graph across the jobs returned by `listAll`.
   * Keys and values are job identities — the keys produced by
   * `encodeKey`. The scheduler's reconcile pass reads this graph to
   * (a) topologically depth each job, (b) add `depth * 250ms` jitter to
   * the computed `when` so a downstream refresh fires AFTER its upstream
   * on the same reconcile wave, and (c) spread simultaneous same-depth
   * arms by an extra 0–250ms of random jitter so a 20-workflow cohort
   * against one origin doesn't race the rate limiter on wake.
   *
   * Providers without inter-job dependencies (OAuth) omit this hook;
   * the scheduler treats every job as depth 0 and applies only the
   * random fan-out jitter when two jobs would fire at the same `when`.
   */
  computeDependencies?(jobs: TJob[]): Map<string, string[]>;
}

/**
 * Maximum jitter applied per dependency hop. The value is a trade-off:
 * bigger than 250ms and downstream refreshes visibly lag their upstream;
 * smaller and the thundering-herd window (10+ workflows waking at the
 * same tick) collapses back onto the rate limiter.
 */
export const DEPENDENCY_JITTER_MS = 250;

/** Construction options beyond the provider + timer pair. */
export interface RefreshSchedulerOptions {
  /**
   * Collapse a burst of store-change events into one reconcile pass.
   * `0` (the default) reconciles on every event — the extension's
   * shape, where each store broadcast is already coarse. The desktop
   * passes a small window because its store events fan per-entity.
   */
  reconcileDebounceMs?: number;
}

// ── Scheduler ──────────────────────────────────────────────────────

export class RefreshScheduler<TPayload extends object, TJob, TErrorState> {
  private storeSubscription: (() => void) | null = null;
  private reconcileDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Keys whose fire is mid-flight — reconcile must not re-arm them. */
  private readonly inFlight = new Set<string>();
  private readonly reconcileDebounceMs: number;

  constructor(
    private readonly provider: RefreshProvider<TPayload, TJob, TErrorState>,
    private readonly tag: string,
    private readonly timer: RefreshTimer,
    options: RefreshSchedulerOptions = {},
  ) {
    this.reconcileDebounceMs = options.reconcileDebounceMs ?? 0;
  }

  /**
   * Schedule (or re-schedule) the timer for one job. Idempotent —
   * arming overwrites any existing timer with the same key. Returns
   * `true` when armed, `false` when the job was skipped (gate failed,
   * cadence returned null, timer substrate unavailable).
   *
   * `extraDelayMs` is added to the computed `when` so reconcile can
   * spread a wave of fires by dependency depth + random jitter. Single
   * callers (store-change reschedules, post-fire re-arms) pass 0.
   */
  async schedule(job: TJob, nowMs: number = Date.now(), extraDelayMs = 0): Promise<boolean> {
    if (!this.timer.available) return false;
    if (!this.provider.canSchedule(job)) {
      // A stale timer from a previous config could still be live —
      // clear it so a disabled credential / unbound workflow doesn't
      // keep firing.
      this.timer.cancel(this.provider.encodeKey(job));
      return false;
    }
    const when = this.provider.computeNextFireAt(job, nowMs);
    if (when == null) {
      this.timer.cancel(this.provider.encodeKey(job));
      return false;
    }
    const key = this.provider.encodeKey(job);
    const effectiveWhen = extraDelayMs > 0 ? when + extraDelayMs : when;
    this.timer.arm(key, effectiveWhen);
    logger.debug(this.tag, `Scheduled ${key} at ${new Date(effectiveWhen).toISOString()}`);
    return true;
  }

  /**
   * Clear the timer for a payload identity. Provider's
   * `encodeKeyFromPayload` must accept the payload without needing a
   * full job lookup.
   */
  async cancelByPayload(payload: TPayload): Promise<void> {
    if (!this.timer.available) return;
    this.timer.cancel(this.provider.encodeKeyFromPayload(payload));
  }

  /**
   * Walk every job the provider knows about, arm the eligible ones,
   * and clear any keys with our prefix whose job no longer exists
   * (orphan sweep). Keys whose fire is mid-flight are left alone —
   * their dispatch re-arms them off the post-write state.
   *
   * Dependency-aware: if the provider implements `computeDependencies`,
   * each job gets a jitter offset equal to `depth * DEPENDENCY_JITTER_MS`
   * plus a 0..DEPENDENCY_JITTER_MS random spread. This keeps the topology
   * honest (downstream fires AFTER upstream on the same reconcile wave)
   * and prevents a cohort of same-depth jobs from racing the rate
   * limiter on wake. Cycles — detected by DFS-on-revisit — are
   * assigned depth 0 so the scheduler still fires (correctness wins
   * over topology when the graph is broken).
   */
  async reconcile(nowMs: number = Date.now()): Promise<void> {
    if (!this.timer.available) return;
    const jobs = await this.provider.listAll();
    const depthByKey = this.computeDepths(jobs);
    const desired = new Set<string>();
    for (const job of jobs) {
      const key = this.provider.encodeKey(job);
      if (this.inFlight.has(key)) {
        // Mid-flight — don't disturb; its dispatch re-arms when done.
        desired.add(key);
        continue;
      }
      const depth = depthByKey.get(key) ?? 0;
      const extra = depth * DEPENDENCY_JITTER_MS + Math.floor(Math.random() * DEPENDENCY_JITTER_MS);
      const scheduled = await this.schedule(job, nowMs, extra);
      if (scheduled) desired.add(key);
    }
    const existing = await this.timer.listArmed();
    for (const key of existing) {
      if (!key.startsWith(this.provider.keyPrefix)) continue;
      if (!desired.has(key)) {
        this.timer.cancel(key);
        logger.debug(this.tag, `Cleared orphan ${key}`);
      }
    }
  }

  /**
   * DFS-based depth computation over the provider's dependency graph.
   * Jobs with no inbound edges are depth 0; otherwise depth is
   * `1 + max(parent depths)`. Cycles return depth 0 for the edges on
   * the cycle so the scheduler still fires — reconcile detects via the
   * same graph walk, logs + falls back to definition-order refresh.
   */
  private computeDepths(jobs: TJob[]): Map<string, number> {
    const depths = new Map<string, number>();
    const deps = this.provider.computeDependencies?.(jobs) ?? new Map<string, string[]>();
    if (deps.size === 0) return depths;
    const visiting = new Set<string>();
    const walk = (id: string): number => {
      const cached = depths.get(id);
      if (cached !== undefined) return cached;
      if (visiting.has(id)) return 0; // cycle — break here
      visiting.add(id);
      const parents = deps.get(id) ?? [];
      const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => walk(p)));
      visiting.delete(id);
      depths.set(id, d);
      return d;
    };
    for (const job of jobs) walk(this.provider.encodeKey(job));
    return depths;
  }

  /**
   * Handle one fire. Parses the payload, guards against a concurrent
   * dispatch of the same key, loads the job, re-checks the gate, runs
   * refresh, routes observability, and re-arms off the post-write
   * state — success lands the next cadence tick, failure the backoff
   * window, a gate skip the corrected target. The explicit re-arm is
   * what guarantees the next fire even when a deliberate skip wrote
   * nothing (no store-change ticked); on write paths it is idempotent
   * with the store-change reconcile, which computes the same instant.
   */
  async handleFire(key: string): Promise<void> {
    const payload = this.provider.decodeKey(key);
    if (!payload) return;
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    try {
      this.provider.onFired(payload);

      const job = await this.provider.getByKey(payload);
      if (!job) {
        // Job was deleted between scheduling and firing — clear the
        // key so it doesn't fire again.
        await this.cancelByPayload(payload);
        return;
      }
      if (!this.provider.canSchedule(job)) {
        // Config changed after scheduling made it ineligible (token
        // revoked, workflow disabled). Drop the key; reconcile will
        // re-add if state changes back.
        await this.cancelByPayload(payload);
        return;
      }

      try {
        await this.provider.refresh(job, payload);
        this.provider.onSucceeded(payload);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const state = await this.provider.recordFailure(payload, error, job);
        this.provider.onFailed(payload, error, state);
      }
    } finally {
      this.inFlight.delete(key);
      await this.rearmFromStore(payload).catch((err: unknown) => {
        logger.warn(this.tag, `Re-arm after fire failed for ${key}`, err);
      });
    }
  }

  /**
   * Re-arm one identity off a fresh provider read. A vanished job
   * stays cancelled (the dispatch already cleared it); an ineligible
   * one is cleared by `schedule`'s gate.
   */
  private async rearmFromStore(payload: TPayload): Promise<void> {
    const job = await this.provider.getByKey(payload);
    if (!job) return;
    await this.schedule(job);
  }

  /**
   * Subscribe to the provider's store-change events. Idempotent —
   * a second call before `stop()` is a no-op.
   */
  start(): void {
    if (this.storeSubscription) return;
    this.storeSubscription = this.provider.onStoreChange(() => this.triggerReconcile());
  }

  private triggerReconcile(): void {
    if (this.reconcileDebounceMs <= 0) {
      void this.reconcile().catch((err: unknown) => {
        logger.warn(this.tag, 'Reconcile after store change failed', err);
      });
      return;
    }
    if (this.reconcileDebounceTimer) clearTimeout(this.reconcileDebounceTimer);
    this.reconcileDebounceTimer = setTimeout(() => {
      this.reconcileDebounceTimer = null;
      void this.reconcile().catch((err: unknown) => {
        logger.warn(this.tag, 'Reconcile after store change failed', err);
      });
    }, this.reconcileDebounceMs);
  }

  /** Tear down the subscription + any pending debounce. */
  stop(): void {
    if (this.storeSubscription) {
      this.storeSubscription();
      this.storeSubscription = null;
    }
    if (this.reconcileDebounceTimer) {
      clearTimeout(this.reconcileDebounceTimer);
      this.reconcileDebounceTimer = null;
    }
  }
}
