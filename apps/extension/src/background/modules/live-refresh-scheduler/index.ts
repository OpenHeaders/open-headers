/**
 * Live workflow refresh scheduler — alarm-driven background refresh so
 * `{{live.X}}` values stay warm without requiring a renderer-side
 * refresh click.
 *
 * ARCHITECTURE §20 + the live-variables plan (Phase C).
 *
 * Implementation: thin provider over the host-neutral `RefreshScheduler`
 * core (`@openheaders/oracle/scheduling`), armed through the
 * `chrome.alarms` timer adapter (`./refresh-scheduler`). Live owns the
 * cadence math (delegated to `@openheaders/core/live/refresh-cadence`),
 * the gate (`canScheduleWorkflow` — enabled + ≥1 enabled LV bound), the
 * per-env alarm expansion (one alarm per `(workflow, env)` because each
 * env has its own cache row), and the refresh delegation (to
 * `live-chain-adapter` via the adapter port). Everything else — key
 * codec, reconcile-on-wake, orphan sweep, store-change subscription,
 * fire dispatch — is shared with the OAuth scheduler AND the desktop
 * live runner through the core.
 *
 * What is NOT scheduled:
 *   • Workflows with `refresh.kind === 'manual'` — user-triggered only.
 *     `computeNextFireAt` returns null → scheduler declines.
 *   • Workflows that are `enabled: false` or whose bound LVs are all
 *     disabled — `canScheduleWorkflow` → false.
 *
 * Cadence:
 *   • Healthy path: `computeNextFireAt(workflow, cache, now)` from
 *     `@openheaders/core/live/refresh-cadence`. Respects the 30s MV3
 *     floor + `expires-in` / `expires-at` lead time.
 *   • After a failure: the SAME core function applies the `60·2^(n-1)`
 *     backoff (capped at 3600s) off `cache.lastErrorAt`. We don't
 *     duplicate the math here.
 *
 * Observability: every fired alarm writes one structured entry to the
 * observability log (`subsystem: 'live'`). Values never appear —
 * entries carry `{workflowUid, op, workspaceId, environmentId?}` only.
 *
 * Status pill: `recomputeLiveStatus()` aggregates every workspace's
 * cached runs into one `live` Status entry after every tick (see
 * Phase G).
 */

// Re-exported from core so the scheduler can be reasoned about in
// isolation, and so tests don't have to reach across package bounds
// to pin the floor value.
export { MAX_BACKOFF_SECONDS, MIN_ALARM_DELAY_MS } from '@openheaders/core/live';
// Re-export the lifted gate + definitional-freshness maintenance hooks
// so the scheduler's existing external callers + unit tests keep their
// import surface (the implementations now live host-neutral in oracle).
export {
  __resetLiveCascadeBaseline,
  __resetWorkflowDefinitionBaseline,
  __setLiveCascadeRefreshDebounceMs,
  __setRequestEditRefreshDebounceMs,
  __setVariableEditRefreshDebounceMs,
} from '@openheaders/oracle/live/definitional-freshness';
export { canScheduleWorkflow } from '@openheaders/oracle/live/scheduling-gate';

export { __setLiveRefreshAdapter, type LiveRefreshAdapter } from './adapter';
export {
  cancelLiveWorkflowRefresh,
  handleLiveAlarm,
  kickActiveContextRefresh,
  reconcileLiveSchedules,
  refreshLiveWorkflowByUser,
  refreshLiveWorkflowSynchronously,
  resetCircuitForWorkflow,
  scheduleLiveWorkflowRefresh,
  startLiveScheduler,
  stopLiveScheduler,
} from './api';
export { buildAlarmName, isLiveRefreshAlarm, LIVE_ALARM_PREFIX, parseAlarmName } from './codec';
export { toCacheSummary } from './entries';
export {
  type FallbackPrioritySnapshot,
  setBackendConnectionProbe,
  setBackendEvictedProbe,
  setFallbackPriorityProbe,
} from './probes';
