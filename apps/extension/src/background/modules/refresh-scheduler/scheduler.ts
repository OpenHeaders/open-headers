/**
 * Generic alarm-driven refresh scheduler — shared machinery across
 * OAuth token refresh, Live Variable workflow refresh, and (future)
 * DNR rule refresh. See `./types.ts` for the subsystem-agnostic
 * `RefreshJob` + `WriteTarget` vocabulary.
 *
 * The scheduler owns the lifecycle shape every subsystem needs:
 *   - subscribe-on-store-change → reconcile
 *   - reconcile walks all jobs, schedules the eligible ones, clears
 *     alarms whose job no longer exists (orphan sweep)
 *   - idempotent `chrome.alarms.create` keyed by the provider's alarm
 *     name codec so alarms survive SW eviction
 *   - alarm dispatch: decode → lookup → gate → refresh → log → record
 *     failure → let the store-change reconcile handle backoff
 *
 * Each subsystem provides a `RefreshProvider` that fills in the
 * subsystem-specific bits: alarm payload shape, cadence math, gate
 * checks, refresh work + failure recording, and observability-log
 * routing. Provider methods can be async where they do I/O; the
 * scheduler awaits accordingly.
 *
 * Rationale for a class rather than a functional factory: callers
 * consume a handful of methods (`schedule` / `cancelAlarm` /
 * `reconcile` / `handleAlarm` / `start` / `stop`), and each subsystem
 * instantiates ONE scheduler — per-module singletons map cleanly to
 * instance state (`storeSubscription`). The class isn't exported
 * beyond its subsystem's own module so there's no risk of misuse.
 */

import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';

/**
 * Port a subsystem fills in to use the shared scheduler. The type
 * parameters are the alarm-payload shape and the subsystem's concrete
 * "job" object (OAuth: `WorkspaceCredentialEntry`; Live: a workflow +
 * bindings + cache bundle). Error-state type is whatever
 * `recordFailure` returns; the scheduler carries it as opaque context
 * to the provider's `onFailed` log hook so per-subsystem escalation
 * rules (OAuth elevates to `error` at `consecutiveFailures >= 3`)
 * live with the provider, not in the scheduler.
 */
export interface RefreshProvider<TAlarmPayload extends object, TJob, TErrorState = unknown> {
  /** Unique prefix identifying alarms this provider owns. */
  readonly alarmPrefix: string;

  /**
   * Decode an alarm name into the provider's payload shape. Returns
   * `null` for alarms not owned by this provider or whose payload is
   * malformed. Callers (the scheduler) treat `null` as "ignore".
   */
  decodeAlarm(name: string): TAlarmPayload | null;

  /**
   * Build the alarm name for a job. Used by `schedule` to create the
   * alarm and by reconcile to compute the "desired" set against which
   * orphan alarms are cleared.
   */
  encodeAlarm(job: TJob): string;

  /**
   * Build the alarm name from a payload alone — used by `cancelByAlarm`
   * paths where callers have the identity but not a full job object
   * (e.g., deleting a credential by ref). Identity-only encoders are
   * cheap; providers that need extra context to build an alarm name
   * should encode it into the payload shape.
   */
  encodeAlarmFromPayload(payload: TAlarmPayload): string;

  /**
   * List every job the provider wants considered for scheduling.
   * Called by `reconcile` on SW wake + after every store-change tick.
   * Provider is responsible for spanning inactive workspaces if it
   * wants cross-workspace scheduling.
   */
  listAll(): Promise<TJob[]>;

  /**
   * Look up a single job by its alarm payload. Returns `null` when
   * the job no longer exists (credential deleted, workflow removed),
   * in which case the scheduler clears the alarm.
   */
  getByAlarm(payload: TAlarmPayload): Promise<TJob | null>;

  /**
   * Compute the absolute wall-clock ms at which the refresh should
   * next fire. Returns `null` when no schedule is possible (manual
   * policy, missing expiry, etc.).
   */
  computeNextFireAt(job: TJob, nowMs: number): number | null;

  /**
   * Gate — returns `false` when the job shouldn't be alarmed at all
   * (disabled, no refresh capability, no consumers). The scheduler
   * calls `canSchedule` during both `schedule` (new work) and
   * `handleAlarm` (config may have changed between scheduling and
   * firing) so the gate is enforced on both sides.
   */
  canSchedule(job: TJob): boolean;

  /**
   * Execute the refresh. Must throw on failure — the scheduler uses
   * the throw to route into `recordFailure` + observability. Success
   * is expected to trigger a store-change broadcast (putting the
   * fresh token / cache), which the scheduler's subscription then
   * reconciles to compute the next alarm.
   */
  refresh(job: TJob, payload: TAlarmPayload): Promise<void>;

  /**
   * Persist the failure state + return its post-increment snapshot
   * (typically `{ consecutiveFailures, lastErrorAt }`). The scheduler
   * passes this snapshot to `onFailed` so per-subsystem log-level
   * escalation rules stay with the provider.
   */
  recordFailure(payload: TAlarmPayload, err: Error, job: TJob | null): Promise<TErrorState>;

  /**
   * Subscribe the scheduler to the provider's store-change events.
   * Returns an unsubscriber. The scheduler calls this once inside
   * `start()`.
   */
  onStoreChange(callback: () => void): () => void;

  /**
   * Observability: one entry per alarm fire. Provider routes to its
   * subsystem (`oauth` / `live` / …).
   */
  onFired(payload: TAlarmPayload): void;

  /**
   * Observability: one entry per successful refresh. Provider routes
   * to its subsystem.
   */
  onSucceeded(payload: TAlarmPayload): void;

  /**
   * Observability: one entry per failed refresh. Provider decides log
   * level — OAuth elevates at `consecutiveFailures >= 3`; Live always
   * reports `error`.
   */
  onFailed(payload: TAlarmPayload, err: Error, errorState: TErrorState): void;

  /**
   * OPTIONAL dependency graph across the jobs returned by `listAll`.
   * Keys and values are job identities — the alarm names produced by
   * `encodeAlarm`. The scheduler's reconcile pass reads this graph to
   * (a) topologically depth each job, (b) add `depth * 250ms` jitter to
   * the computed `when` so a downstream refresh fires AFTER its upstream
   * on the same reconcile wave, and (c) spread simultaneous same-depth
   * alarms by an extra 0–250ms of random jitter so a 20-workflow cohort
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
 * same alarm tick) collapses back onto the rate limiter.
 */
export const DEPENDENCY_JITTER_MS = 250;

// ── Scheduler ──────────────────────────────────────────────────────

export class RefreshScheduler<TAlarmPayload extends object, TJob, TErrorState> {
  private storeSubscription: (() => void) | null = null;

  constructor(
    private readonly provider: RefreshProvider<TAlarmPayload, TJob, TErrorState>,
    private readonly tag: string,
  ) {}

  /**
   * Schedule (or re-schedule) the alarm for one job. Idempotent —
   * `alarms.create` overwrites any existing alarm with the same name.
   * Returns `true` when an alarm was scheduled, `false` when the job
   * was skipped (gate failed, cadence returned null, alarms shim
   * unavailable).
   *
   * `extraDelayMs` is added to the computed `when` so reconcile can
   * spread a wave of alarms by dependency depth + random jitter. Single
   * callers (store-change reschedules) pass 0.
   */
  async schedule(job: TJob, nowMs: number = Date.now(), extraDelayMs = 0): Promise<boolean> {
    if (!alarms) return false;
    if (!this.provider.canSchedule(job)) {
      // A stale alarm from a previous config could still be live —
      // clear it so a disabled credential / unbound workflow doesn't
      // keep firing.
      alarms.clear(this.provider.encodeAlarm(job));
      return false;
    }
    const when = this.provider.computeNextFireAt(job, nowMs);
    if (when == null) {
      alarms.clear(this.provider.encodeAlarm(job));
      return false;
    }
    const name = this.provider.encodeAlarm(job);
    const effectiveWhen = extraDelayMs > 0 ? when + extraDelayMs : when;
    alarms.create(name, { when: effectiveWhen });
    logger.debug(this.tag, `Scheduled alarm ${name} at ${new Date(effectiveWhen).toISOString()}`);
    return true;
  }

  /**
   * Clear an alarm by its payload identity. Provider's
   * `encodeAlarmFromPayload` must accept the payload without needing a
   * full job lookup.
   */
  async cancelByPayload(payload: TAlarmPayload): Promise<void> {
    if (!alarms) return;
    alarms.clear(this.provider.encodeAlarmFromPayload(payload));
  }

  /**
   * Walk every job the provider knows about, schedule the eligible
   * ones, and clear any alarms with our prefix whose job no longer
   * exists (orphan sweep).
   *
   * Dependency-aware: if the provider implements `computeDependencies`,
   * each job gets a jitter offset equal to `depth * DEPENDENCY_JITTER_MS`
   * plus a 0..DEPENDENCY_JITTER_MS random spread. This keeps the topology
   * honest (downstream fires AFTER upstream on the same reconcile wave)
   * and prevents a cohort of same-depth jobs from racing the rate
   * limiter on SW wake. Cycles — detected by DFS-on-revisit — are
   * assigned depth 0 so the scheduler still fires (correctness wins
   * over topology when the graph is broken).
   */
  async reconcile(nowMs: number = Date.now()): Promise<void> {
    if (!alarms) return;
    const jobs = await this.provider.listAll();
    const depthByAlarm = this.computeDepths(jobs);
    const desired = new Set<string>();
    for (const job of jobs) {
      const alarmName = this.provider.encodeAlarm(job);
      const depth = depthByAlarm.get(alarmName) ?? 0;
      const extra = depth * DEPENDENCY_JITTER_MS + Math.floor(Math.random() * DEPENDENCY_JITTER_MS);
      const scheduled = await this.schedule(job, nowMs, extra);
      if (scheduled) desired.add(alarmName);
    }
    const existing = await alarms.getAll();
    for (const alarm of existing) {
      if (!alarm.name.startsWith(this.provider.alarmPrefix)) continue;
      if (!desired.has(alarm.name)) {
        alarms.clear(alarm.name);
        logger.debug(this.tag, `Cleared orphan alarm ${alarm.name}`);
      }
    }
  }

  /**
   * DFS-based depth computation over the provider's dependency graph.
   * Jobs with no inbound edges are depth 0; otherwise depth is
   * `1 + max(parent depths)`. Cycles return depth 0 for the edges on
   * the cycle so the scheduler still fires — the plan's git-merge-cycle
   * case documents this as the recovery behavior ("reconcile-on-wake
   * detects via same graph walk, logs + falls back to definition-order
   * refresh").
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
    for (const job of jobs) walk(this.provider.encodeAlarm(job));
    return depths;
  }

  /**
   * Handle one alarm fire. Parses the payload, loads the job,
   * re-checks the gate, runs refresh, and routes observability.
   * Rescheduling is delegated to the store-change listener so every
   * write path (success + failure) converges on the same cadence
   * computation.
   */
  async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    const payload = this.provider.decodeAlarm(alarm.name);
    if (!payload) return;

    this.provider.onFired(payload);

    const job = await this.provider.getByAlarm(payload);
    if (!job) {
      // Job was deleted between scheduling and firing — clear the
      // alarm so it doesn't fire again.
      await this.cancelByPayload(payload);
      return;
    }
    if (!this.provider.canSchedule(job)) {
      // Config changed after scheduling made it ineligible (token
      // revoked, workflow disabled). Drop the alarm; reconcile will
      // re-add if state changes back.
      await this.cancelByPayload(payload);
      return;
    }

    try {
      await this.provider.refresh(job, payload);
      this.provider.onSucceeded(payload);
      // A successful refresh fires a store-change via the provider's
      // put path, which triggers the scheduler's subscription to
      // reconcile — computing the next alarm from the fresh state.
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const state = await this.provider.recordFailure(payload, error, job);
      this.provider.onFailed(payload, error, state);
      // Store-change from `recordFailure` likewise re-reconciles with
      // the new backoff state.
    }
  }

  /**
   * Subscribe to the provider's store-change events. Idempotent —
   * a second call before `stop()` is a no-op.
   */
  start(): void {
    if (this.storeSubscription) return;
    this.storeSubscription = this.provider.onStoreChange(() => {
      void this.reconcile().catch((err: unknown) => {
        logger.warn(this.tag, 'Reconcile after store change failed', err);
      });
    });
  }

  /** Tear down the subscription. Test cleanup path. */
  stop(): void {
    if (this.storeSubscription) {
      this.storeSubscription();
      this.storeSubscription = null;
    }
  }
}
