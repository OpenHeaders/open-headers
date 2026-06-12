/**
 * Refresh scheduling — shared vocabulary for the subsystems that share
 * the same reconcile / fire / backoff shape (OAuth token refresh, Live
 * Variable workflow refresh on both hosts, and the forthcoming DNR
 * rule-refresh pipeline). The scheduler core itself is
 * `./refresh-scheduler`; the timer substrate port is `./timer`.
 */

/**
 * Tagged write target for future subsystem dispatch. Not consumed by
 * the scheduler core (OAuth + Live each own their write path), but
 * declared here so DNR rule-refresh + future sync-target features have
 * a stable contract to plug into.
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
