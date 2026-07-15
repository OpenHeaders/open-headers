/**
 * The `RefreshProvider` implementation — fills in the subsystem-specific
 * bits the shared `RefreshScheduler` core drives: entry listing/lookup,
 * cadence, the WS-C ownership/eviction/election gates, circuit gating,
 * adapter dispatch, failure recording, store subscriptions, and
 * observability hooks.
 */

import {
  computeNextFireAt as computeNextFireAtCore,
  electOfflineFallbackRunner,
  isWithinDeferHatchWindow,
} from '@openheaders/core/live';
import { onRequestStoreChange } from '@openheaders/oracle/entity/request-store';
import {
  deriveExecutionPolicyForWorkflow,
  isFallbackEligibleForWorkflow,
} from '@openheaders/oracle/live/execution-policy-resolver';
import { gateCircuitForFire } from '@openheaders/oracle/live/fire-circuit-gate';
import {
  listCachesForWorkflow,
  markExclusiveDegradedForRun,
  onLiveCacheStoreChange,
  recordRefreshError,
  type WorkflowRunCache,
} from '@openheaders/oracle/live/live-cache-store';
import {
  getLiveVariablesForWorkflowInWorkspace,
  onLiveVariableStoreChange,
} from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflowInWorkspace, onLiveWorkflowStoreChange } from '@openheaders/oracle/live/live-workflow-store';
import { canScheduleWorkflow } from '@openheaders/oracle/live/scheduling-gate';
import { computeWorkflowDependencies } from '@openheaders/oracle/live/workflow-dependency-graph';
import { recordLog } from '../observability-log';
import { trackProductTelemetryEvent } from '../product-telemetry';
import type { RefreshProvider } from '../refresh-scheduler';
import { refreshAdapter } from './adapter';
import { codec, LIVE_ALARM_PREFIX, type LiveAlarmPayload } from './codec';
import { collectEntries, type LiveEntry, toCacheSummary } from './entries';
import {
  BackendEvictedError,
  CircuitBlockedError,
  ConnectFenceError,
  DeferredError,
  describeRefreshFailure,
  ExclusiveDeferredError,
  FallbackNotElectedError,
  isNetworkOnline,
  LiveSchedulerNotReadyError,
  OfflineError,
} from './errors';
import { applyDeferOverride, isBackendConnected, isBackendEvicted, readFallbackPriority } from './probes';
import { recomputeLiveStatus } from './status';

// ── Provider — fills in the subsystem-specific bits ───────────────

export const provider: RefreshProvider<LiveAlarmPayload, LiveEntry, WorkflowRunCache | null> = {
  keyPrefix: LIVE_ALARM_PREFIX,
  decodeKey: (name) => codec.decode(name),
  encodeKey: (entry) => codec.encode({ w: entry.workspaceId, u: entry.workflow.uid, e: entry.environmentId }),
  encodeKeyFromPayload: (payload) => codec.encode(payload),
  listAll: () => collectEntries(),
  async getByKey(payload) {
    // Per-workspace lookup (MWPT-FULL session #19). The previous
    // implementation rejected when `payload.w !== runtime-Active` —
    // documented as "orphan alarm: cancel" — but that conflated two
    // distinct conditions:
    //   1. The workspace is GONE (deleted) — the per-workspace cache
    //      lookup below returns null, which the shared RefreshScheduler
    //      correctly interprets as "orphan — cancel."
    //   2. The workspace is ALIVE but not currently runtime-Active —
    //      legitimate target for cross-workspace dispatch (the user is
    //      on workspace-2 in per-tab mode and clicked "Refresh now"
    //      against a workspace-2 workflow). Cancelling this alarm under
    //      the v1.3 framing produced "Workflow X not found in workspace
    //      Y" for every cross-workspace gesture.
    // Reading via the per-workspace {@link LiveWorkflowCache} +
    // {@link LiveVariableCache} preserves the (1) behavior (cache
    // missing → null → cancel) while unblocking (2) cleanly.
    const workflow = getLiveWorkflowInWorkspace(payload.u, payload.w);
    if (!workflow) return null;
    const boundVariables = getLiveVariablesForWorkflowInWorkspace(payload.u, payload.w);
    const runs = await listCachesForWorkflow(payload.u, payload.w);
    const cache = runs.find((r) => r.environmentId === payload.e) ?? null;
    return {
      workspaceId: payload.w,
      workflow,
      boundVariables,
      cache,
      environmentId: payload.e,
    };
  },
  computeNextFireAt: (entry, nowMs) =>
    applyDeferOverride(entry.cache, computeNextFireAtCore(entry.workflow, toCacheSummary(entry.cache), nowMs), nowMs),
  canSchedule: (entry) => canScheduleWorkflow(entry.workflow, entry.boundVariables),
  computeDependencies: (entries) => computeWorkflowDependencies(entries, (w, u, e) => codec.encode({ w, u, e })),
  async refresh(entry, payload) {
    if (!refreshAdapter) {
      // Phase C shipped before Phase D. Record a scheduler-not-ready
      // error so the cache's failure counter widens and we don't
      // hot-loop. Throws so the scheduler routes into `onFailed`.
      throw new LiveSchedulerNotReadyError(
        `scheduler-not-ready: no refresh adapter installed for workflow ${payload.u}`,
      );
    }
    // Offline gate — check BEFORE touching the circuit. Offline blips
    // must not advance the state machine (see `OfflineError` comment).
    // The 'online' event handler in `background.ts` re-reconciles +
    // kicks catch-up when connectivity returns.
    if (!isNetworkOnline()) {
      throw new OfflineError(`offline: workflow ${payload.u} refresh skipped (navigator.onLine=false)`);
    }
    // Cadence-ownership guard (WS-C C8 + C9 + C10). While a backend is
    // connected it owns the cadence, and the load-bearing invariant is:
    // a peer NEVER self-refreshes an *exclusive* credential while
    // connected (a concurrent run burns a single-use TOTP code / trips
    // OAuth reuse-detection and silently revokes the session). The
    // backend is the sole runner; the peer defers, degrades, or fences
    // — three exits keyed on freshness + proof + execution policy.
    const now = Date.now();
    if (isBackendConnected()) {
      const expiresAt = entry.cache?.expiresAt ?? null;
      const synced = entry.cache?.lastSyncedValueAt != null;
      // (1) C8 — fresh remote-sourced value. The near-expiry SAFETY fire
      //     `applyDeferOverride` armed fired early (Chrome early-wake, or a
      //     fresher synced value mid-flight before its store-change
      //     reconcile re-armed us). Re-defer for every class; the backend's
      //     next push reschedules us later.
      if (synced && expiresAt != null && !isWithinDeferHatchWindow(expiresAt, now)) {
        throw new DeferredError(`deferred: workflow ${payload.u} — backend owns cadence, synced value still fresh`);
      }
      // Not comfortably fresh. Idempotent rows fall through and self-refresh
      // (preserves the 401-safety the feature sells — N concurrent mints are
      // at worst wasteful); only the exclusive class is held back.
      const { policy } = deriveExecutionPolicyForWorkflow(entry.workspaceId, entry.workflow, entry.environmentId);
      if (policy === 'exclusive') {
        if (synced && expiresAt != null) {
          // (2) C9 — we had PROOF the backend was producing this value (a
          //     remote value landed, with a derivable expiry) and it has now
          //     reached the near-expiry window with nothing fresher: the
          //     backend went silent/failing (a healthy backend keeps pushing
          //     expiry out, so the safety fire never lands). Mark the row
          //     degraded so the Status pill says "reconnect the desktop,"
          //     and re-defer rather than race.
          await markExclusiveDegradedForRun(payload.u, payload.e, now, payload.w);
          throw new ExclusiveDeferredError(
            `exclusive-deferred: workflow ${payload.u} — exclusive cred, backend silent near expiry; degrading instead of racing`,
          );
        }
        // (3) C10 — no proof yet: this host has never received a §4 value
        //     for the row (`lastSyncedValueAt == null`), or the synced value
        //     carries no derivable expiry. Either the backend's first
        //     catch-up value is still in flight (the Mode-1 connect edge a
        //     mid-cycle exclusive alarm would otherwise race) or the backend
        //     simply doesn't run this workflow. Decline to be the first
        //     runner of an exclusive cred while a backend is present; wait
        //     for its value. Stay SILENT — a transient catch-up gap mustn't
        //     flap the degraded banner, and a persistent gap surfaces via
        //     the generic stale-yellow path (C7/C14 own the messaging).
        throw new ConnectFenceError(
          `connect-fenced: workflow ${payload.u} — exclusive cred, backend connected but no synced value yet; declining to race`,
        );
      }
    } else {
      // WS-C C14 — a configured backend is OFFLINE (the probe returns a
      // snapshot) and this host is now a candidate runner. Idempotent
      // rows self-refresh on every partitioned peer (harmless — N mints
      // are at worst wasteful). For the EXCLUSIVE class only the single
      // ELECTED fallback host may run; the rest banner — else N
      // partitioned browsers race the single-use cred. Pure Mode-1 (probe
      // returns null) is deliberately NOT gated: the SW is the legitimate
      // sole runner (plan §8 — Mode-1 keeps its self-sufficient runner).
      const fallback = readFallbackPriority(entry.workspaceId);
      if (fallback) {
        const { policy, reasons } = deriveExecutionPolicyForWorkflow(
          entry.workspaceId,
          entry.workflow,
          entry.environmentId,
        );
        if (policy === 'exclusive') {
          // Evicted, not offline (audit X-1). The socket is down because the
          // backend REJECTED this peer (revoked/rotated token), not because
          // it's unreachable — the desktop is alive and still produces this
          // exclusive cred. Electing ourselves here would race the live
          // backend. Skip the election entirely: degrade to the same
          // "reconnect the desktop" banner the not-elected path raises (the
          // actionable re-pair CTA lives in Settings → Backend, fired off the
          // same auth-required signal), and re-arm without racing. The flag
          // clears the moment a fresh value syncs in after re-pairing.
          if (isBackendEvicted()) {
            await markExclusiveDegradedForRun(payload.u, payload.e, now, payload.w);
            throw new BackendEvictedError(
              `backend-evicted: workflow ${payload.u} — exclusive cred, backend rejected this peer (not offline); banner instead of self-electing`,
            );
          }
          const verdict = electOfflineFallbackRunner({
            priorityList: fallback.order,
            selfPrincipalId: fallback.selfPrincipalId,
            eligible: isFallbackEligibleForWorkflow(entry.workspaceId, reasons),
          });
          if (!verdict.elected) {
            // Not the elected runner. Degrade the row so the Status pill
            // shows "reconnect the desktop app" — the offline non-elected
            // state wants the identical actionable resolution C9 raises,
            // so it reuses the same flag + banner (no new wire/state). The
            // flag clears the instant a fresher value syncs in (the
            // elected host's, on reconnect) or the backend returns and
            // produces. Re-arm at the cadence floor without racing.
            await markExclusiveDegradedForRun(payload.u, payload.e, now, payload.w);
            throw new FallbackNotElectedError(
              `fallback-not-elected: workflow ${payload.u} — exclusive cred, backend offline, ${verdict.reason}; banner instead of racing`,
            );
          }
          // Elected → fall through and self-refresh as the single offline
          // fallback runner.
        }
      }
    }
    // Circuit-aware attempt gate + open→half-open probe-start — the
    // shared dispatch semantics both hosts' live providers run
    // (`gateCircuitForFire`). A refused dispatch throws a neutral
    // sentinel that routes through `onFailed` → `recordFailure`; the
    // provider's `recordFailure` returns the row untouched and the
    // core's post-fire re-arm lines the next attempt up with
    // `nextAttemptAt`.
    const cacheCircuit = entry.cache?.circuit ?? null;
    const circuitOk = await gateCircuitForFire({
      circuit: cacheCircuit,
      workflowUid: payload.u,
      environmentId: payload.e,
      workspaceId: payload.w,
      nowMs: now,
    });
    if (!circuitOk) {
      throw new CircuitBlockedError(
        `circuit-blocked: workflow ${payload.u} (state=${cacheCircuit?.state}, nextAttemptAt=${cacheCircuit?.nextAttemptAt})`,
      );
    }
    await refreshAdapter.refreshWorkflow({
      workspaceId: entry.workspaceId,
      workflow: entry.workflow,
      environmentId: entry.environmentId,
    });
  },
  async recordFailure(payload, err, job) {
    // Deliberate no-op skips — sentinels thrown when `provider.refresh`
    // bailed BEFORE the adapter ran. No probe happened, no counter
    // bump, no cache write; return the existing cache row so `onFailed`
    // has something to log. The core's post-fire re-arm lines the next
    // fire up with the correct target even though the skipped cache
    // write never ticked a store-change reconcile: cadence for
    // `OfflineError`, `nextAttemptAt` for `CircuitBlockedError`, the
    // (possibly newly-pushed-out) near-expiry threshold for
    // `DeferredError` (WS-C C8), and the cadence floor (≥30s, like the
    // offline poll) for the exclusive-class skips — `ExclusiveDeferred
    // Error` (C9, backend silent — "waiting for rescue"),
    // `ConnectFenceError` (C10, no §4 value yet; the store-change
    // reconcile beats any re-armed poll the moment the first synced
    // value lands), `FallbackNotElectedError` (C14, already degraded;
    // banner clears once the elected host's value syncs in or the
    // backend returns), and `BackendEvictedError` (audit X-1, backend
    // rejected this peer; banner clears once a fresh value syncs in
    // after re-pairing).
    if (
      err instanceof CircuitBlockedError ||
      err instanceof OfflineError ||
      err instanceof DeferredError ||
      err instanceof ExclusiveDeferredError ||
      err instanceof ConnectFenceError ||
      err instanceof FallbackNotElectedError ||
      err instanceof BackendEvictedError
    ) {
      return job?.cache ?? null;
    }
    // `live-chain-adapter` records its own error with richer context
    // (failed step id, extractor phase) before throwing — this
    // defensive write covers the scheduler-not-ready path + any
    // unexpected bubble from a misbehaving adapter. The cache returns
    // the post-increment row, which the RefreshScheduler passes to
    // `onFailed` as the error-state snapshot.
    return recordRefreshError(
      {
        workflowUid: payload.u,
        environmentId: payload.e,
        message: err.message ?? 'refresh failed',
        extractorOk: false,
      },
      payload.w,
    );
  },
  onStoreChange(callback) {
    // Every live store mutation drives two things: the scheduler's
    // reconcile (its `callback` argument) and the `live` Status pill
    // recompute. Folding both into one listener per store keeps the
    // scheduler's subscription count at exactly one per store — which
    // is what the scheduler's unit tests assert. The LF1–LF4
    // definitional-freshness detectors are a separate concern: they
    // live host-neutral in `@openheaders/oracle/live/definitional-
    // freshness` and own their OWN store subscriptions (installed by
    // `startDefinitionalFreshness` in `startLiveScheduler`), so they
    // are deliberately NOT wired here.
    const combined = (): void => {
      callback();
      void recomputeLiveStatus().catch(() => {});
    };
    const unsubscribers: Array<() => void> = [
      onLiveWorkflowStoreChange(combined),
      onLiveVariableStoreChange(combined),
      onLiveCacheStoreChange(combined),
      // A request edit can add or drop a `{{live.X}}` template ref,
      // reshaping the cross-workflow dependency DAG `computeWorkflow
      // Dependencies` derives — reconcile re-derives the edges. (No
      // status recompute; a request edit touches no cache row.)
      onRequestStoreChange(callback),
    ];
    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  },
  onFired(payload) {
    recordLog({
      subsystem: 'live',
      op: 'refresh-fired',
      level: 'info',
      message: `Alarm fired for workflow ${payload.u}`,
      context: { workspaceId: payload.w, workflowUid: payload.u, environmentId: payload.e },
    });
  },
  onSucceeded(payload) {
    recordLog({
      subsystem: 'live',
      op: 'refresh-succeeded',
      level: 'info',
      message: `Refreshed workflow ${payload.u}`,
      context: { workspaceId: payload.w, workflowUid: payload.u, environmentId: payload.e },
    });
  },
  onFailed(payload, err) {
    const { level, message, errorClass } = describeRefreshFailure(err, payload.u);
    // Only genuine failures beacon (`level: 'error'`) — the deliberate
    // no-op skips (offline, defer gates, circuit) are the state machine
    // working. Chain failures already beaconed `workflow-step-failed`
    // in the adapter before re-throwing.
    if (level === 'error' && errorClass !== 'ChainRefreshError') {
      trackProductTelemetryEvent({ name: 'error_beacon', code: 'source-refresh-failed' });
    }
    recordLog({
      subsystem: 'live',
      op: 'refresh-failed',
      level,
      message,
      context: { workspaceId: payload.w, workflowUid: payload.u, environmentId: payload.e, errorClass },
    });
  },
};
