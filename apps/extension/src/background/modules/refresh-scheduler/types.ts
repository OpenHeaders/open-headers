/**
 * Refresh scheduler — shared abstraction for alarm-driven background
 * refresh across subsystems that share the same wake / reconcile /
 * backoff shape (OAuth token refresh, Live Variable workflow refresh,
 * and the forthcoming DNR rule-refresh pipeline).
 *
 * Design intent (plan §Phase H):
 *   Each refresh subsystem owns three things — (a) an alarm-name
 *   encoding for its per-job identity, (b) cadence math that consumes
 *   its own cache/state shape, and (c) the refresh + write code path
 *   itself. Everything else (subscribe-on-store-change, reconcile-on-
 *   wake, orphan alarm sweep, backoff) is shared machinery.
 *
 *   This module declares the shared types. The OAuth and Live
 *   schedulers keep their existing module structure + public API but
 *   build alarm names via the shared codec, so the two schedulers
 *   no longer duplicate base64url / JSON-envelope logic. When the DNR
 *   rule-refresh pipeline lands, it plugs into the same primitives
 *   without re-implementing them.
 *
 * Not shipped here:
 *   - A generic `RefreshScheduler<TJob>` class. The OAuth and Live
 *     schedulers have diverged enough (error-state shapes, per-env
 *     alarms vs per-credential alarms, adapter-port vs direct refresh)
 *     that collapsing them into a parameterized class hides more than
 *     it reveals. Shared primitives are the right unit of reuse here;
 *     the higher-level ceremony stays per-subsystem.
 *   - Per-host token-bucket rate limiter. Still open — lands when the
 *     DNR rule-refresh scheduler ships and we have three consumers
 *     sharing a host throttle.
 */

/**
 * Tagged write target for future subsystem dispatch. Not consumed by
 * the Phase H primitives (OAuth + Live each own their write path),
 * but declared here so DNR rule-refresh + future sync-target features
 * have a stable contract to plug into.
 */
export type WriteTarget =
  | { kind: 'oauth-credential'; workspaceId: string; credentialRef: string }
  | { kind: 'live-workflow'; workspaceId: string; workflowUid: string; environmentId: string | null }
  | { kind: 'dnr-rule'; workspaceId: string; ruleUid: string };

/**
 * Marker type identifying a refresh job shared across the three
 * subsystems. `payload` carries whatever the cadence math needs
 * (OAuth: token bundle; Live: workflow + cache; DNR: rule + state).
 */
export interface RefreshJob<TPayload> {
  target: WriteTarget;
  payload: TPayload;
}
