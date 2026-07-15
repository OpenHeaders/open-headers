/**
 * OAuth 2.0 refresh scheduler — alarm-driven background refresh so the
 * UI's "Connected (expires in Nmin)" badge stays green without requiring
 * the user to open a surface that would hydrate the bundle on demand.
 *
 * ARCHITECTURE §18 + Phase 14 §20.
 *
 * Implementation: thin provider over the host-neutral
 * `RefreshScheduler` core (`@openheaders/oracle/scheduling`), armed
 * through the `chrome.alarms` timer adapter (`./refresh-scheduler`).
 * OAuth owns the cadence math (`computeNextFireAt` — fire
 * `REFRESH_LEAD_MS` before expiry; exponential backoff on failures),
 * the gate (`canSilentRefresh` — must have a refresh_token OR be a
 * client-credentials flow), and the refresh work
 * (`refreshCredential(config, workspaceId)`). Everything else — key
 * codec, reconcile-on-wake, orphan sweep, store-change subscription,
 * fire dispatch — is shared with the Live workflow schedulers through
 * the core.
 *
 * What is NOT scheduled:
 *   • Credentials without a refresh capability — authorization-code
 *     (PKCE or plain) / `device-code` without a refresh_token,
 *     password-credentials without stored username + password. These
 *     require user interaction to renew; the executor's on-demand
 *     refresh path (`applyAuth`) still tries when a refresh_token is
 *     present.
 *   • Credentials without an `expiresAt` — we have nothing to schedule
 *     against. The executor's 30-second skew check handles these via
 *     the on-demand path.
 *
 * Cadence:
 *   • Healthy path: fire at `max(expiresAt - REFRESH_LEAD_MS, now + MIN_ALARM_DELAY_MS)`.
 *     Leads expiry by 60s so the next request is unlikely to race a
 *     just-expired access token.
 *   • After a failure: fire at `lastErrorAt + min(60·2^(n-1), 3600) seconds`
 *     where `n` is `consecutiveFailures`. Clamped to the 30s minimum.
 *
 * All failure handling writes one structured entry per fired alarm to
 * the observability log (`subsystem: 'oauth'`). No telemetry leaves
 * the device.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import type { OAuthRefreshErrorState, WorkspaceCredentialEntry } from '@openheaders/oracle/entity/oauth-token-store';
import {
  getRefreshConfig,
  getTokenBundle,
  listAllWorkspaceCredentials,
  onOAuthStoreChange,
  recordRefreshError,
} from '@openheaders/oracle/entity/oauth-token-store';
import { refreshCredential } from './oauth-flow';
import { recordLog } from './observability-log';
import { createAlarmsRefreshTimer, createKeyCodec, type RefreshProvider, RefreshScheduler } from './refresh-scheduler';

// ── Constants ──────────────────────────────────────────────────────

/** Alarm name prefix used to route alarms into the scheduler handler. */
export const OAUTH_ALARM_PREFIX = 'oauth-refresh:';

/** Minimum alarm delay — Chrome clamps to 30s in packed MV3 builds. */
export const MIN_ALARM_DELAY_MS = 30_000;

/** Fire `REFRESH_LEAD_MS` before the access-token expiry. */
export const REFRESH_LEAD_MS = 60_000;

/** Cap for exponential backoff in seconds. */
export const MAX_BACKOFF_SECONDS = 3600;

// ── Alarm name codec (shared primitive) ───────────────────────────

interface OAuthAlarmPayload {
  /** workspaceId */
  w: string;
  /** credentialRef */
  r: string;
}

const codec = createKeyCodec<OAuthAlarmPayload>(
  OAUTH_ALARM_PREFIX,
  (p): p is OAuthAlarmPayload =>
    !!p &&
    typeof p === 'object' &&
    typeof (p as { w?: unknown }).w === 'string' &&
    typeof (p as { r?: unknown }).r === 'string',
);

/**
 * Encode `{ workspaceId, credentialRef }` into an alarm name. Uses
 * base64url over JSON so arbitrary credentialRef contents (colons,
 * spaces, …) survive unambiguously.
 */
export function buildAlarmName(workspaceId: string, credentialRef: string): string {
  return codec.encode({ w: workspaceId, r: credentialRef });
}

/**
 * Decode an alarm name produced by {@link buildAlarmName}. Returns
 * null for anything that doesn't carry the prefix or whose payload is
 * malformed — callers treat that as "not ours, ignore."
 */
export function parseAlarmName(name: string): { workspaceId: string; credentialRef: string } | null {
  const parsed = codec.decode(name);
  if (!parsed) return null;
  return { workspaceId: parsed.w, credentialRef: parsed.r };
}

/** True when the alarm belongs to the OAuth scheduler. */
export function isOAuthRefreshAlarm(alarm: chrome.alarms.Alarm): boolean {
  return codec.matches(alarm?.name);
}

// ── Refresh-capability + cadence calculations (pure) ──────────────

/**
 * A credential is refreshable without user interaction when either it
 * has a refresh_token (the standard path for Authorization Code /
 * Password / Device Code flows) OR its flow re-runs the full token
 * exchange from stored material (Client Credentials always; Password
 * Credentials when the config carries username + password).
 */
export function canSilentRefresh(bundle: OAuth2TokenBundle | null, config: OAuth2Auth | null): boolean {
  if (!bundle || !config) return false;
  if (config.flow === 'client-credentials') return true;
  if (config.flow === 'password-credentials' && !!config.username && !!config.password) return true;
  return typeof bundle.refreshToken === 'string' && bundle.refreshToken.length > 0;
}

/**
 * Absolute wall-clock milliseconds at which the refresh alarm should
 * next fire. Honors backoff state before expiry so a burst of failures
 * doesn't hammer the token endpoint. Returns `null` when no schedule
 * is possible (no expiry AND no error state — nothing to fire against).
 */
export function computeNextFireAt(
  bundle: OAuth2TokenBundle,
  errorState: OAuthRefreshErrorState | null,
  nowMs: number,
): number | null {
  if (errorState && errorState.consecutiveFailures > 0) {
    const seconds = Math.min(60 * 2 ** (errorState.consecutiveFailures - 1), MAX_BACKOFF_SECONDS);
    const targetAfterBackoff = errorState.lastErrorAt + seconds * 1000;
    return Math.max(targetAfterBackoff, nowMs + MIN_ALARM_DELAY_MS);
  }
  if (bundle.expiresAt == null) return null;
  return Math.max(bundle.expiresAt - REFRESH_LEAD_MS, nowMs + MIN_ALARM_DELAY_MS);
}

// ── Provider — fills in the subsystem-specific bits ───────────────

const provider: RefreshProvider<OAuthAlarmPayload, WorkspaceCredentialEntry, OAuthRefreshErrorState> = {
  keyPrefix: OAUTH_ALARM_PREFIX,
  decodeKey: (name) => codec.decode(name),
  encodeKey: (entry) => codec.encode({ w: entry.workspaceId, r: entry.credentialRef }),
  encodeKeyFromPayload: (payload) => codec.encode(payload),
  listAll: () => listAllWorkspaceCredentials(),
  async getByKey(payload) {
    // Reconstruct the entry the scheduler passes to `refresh` /
    // `canSchedule`. `listAllWorkspaceCredentials` batches across
    // workspaces but for a single-alarm lookup we read the two blobs
    // directly — avoids a full-workspace scan per fire.
    const [config, bundle] = await Promise.all([
      getRefreshConfig(payload.r, payload.w),
      getTokenBundle(payload.r, payload.w),
    ]);
    if (!config || !bundle) return null;
    return {
      workspaceId: payload.w,
      credentialRef: payload.r,
      config,
      bundle,
      errorState: null,
    };
  },
  computeNextFireAt: (entry, nowMs) => computeNextFireAt(entry.bundle, entry.errorState, nowMs),
  canSchedule: (entry) => canSilentRefresh(entry.bundle, entry.config),
  async refresh(entry) {
    // `canSchedule` already gated on `entry.config` being non-null
    // (via `canSilentRefresh`); the scheduler checks it before every
    // refresh. The narrow isn't visible to TS through the provider
    // boundary, so assert here.
    if (!entry.config) throw new Error(`Missing config for ${entry.credentialRef}`);
    await refreshCredential(entry.config, entry.workspaceId);
    // `putTokenBundle` inside `refreshCredential` cleared
    // `refreshErrors` and fired `onOAuthStoreChange`, which triggers
    // reconcile to compute the next alarm from the fresh `expiresAt`.
  },
  async recordFailure(payload, err) {
    const message = err.message ?? 'refresh failed';
    return recordRefreshError(payload.r, message, payload.w);
  },
  onStoreChange: (callback) =>
    onOAuthStoreChange(() => {
      // Reconcile runs across every workspace. The per-workspace
      // signal isn't worth a narrower path today — total credential
      // counts in practice are small (one-digit to low-tens), and the
      // idempotent create/clear calls are cheap.
      callback();
    }),
  onFired(payload) {
    recordLog({
      subsystem: 'oauth',
      op: 'refresh-fired',
      level: 'info',
      message: `Alarm fired for credential ${payload.r}`,
      context: { credentialRef: payload.r, workspaceId: payload.w },
    });
  },
  onSucceeded(payload) {
    recordLog({
      subsystem: 'oauth',
      op: 'refresh-succeeded',
      level: 'info',
      message: `Refreshed credential ${payload.r}`,
      context: { credentialRef: payload.r, workspaceId: payload.w },
    });
  },
  onFailed(payload, err, state) {
    // Elevate to `error` once the failure run has crossed the 3-strike
    // threshold — the first-two-failure band stays `warn` so flaky
    // upstreams don't overwhelm the log.
    const level = state.consecutiveFailures >= 3 ? 'error' : 'warn';
    recordLog({
      subsystem: 'oauth',
      op: 'refresh-failed',
      level,
      message: `Refresh failed for ${payload.r} (attempt ${state.consecutiveFailures}): ${err.message}`,
      context: {
        credentialRef: payload.r,
        workspaceId: payload.w,
        errorClass: err.name,
      },
    });
  },
};

const scheduler = new RefreshScheduler(provider, 'OAuthScheduler', createAlarmsRefreshTimer());

// ── Public API (preserved for external callers + tests) ───────────

/**
 * Create (or update) the alarm for one credential. Safe to call
 * repeatedly — idempotent by alarm name. Returns `true` when scheduled,
 * `false` when skipped (non-refreshable, missing expiry, or no bundle).
 */
export async function scheduleOAuthRefresh(
  entry: WorkspaceCredentialEntry,
  nowMs: number = Date.now(),
): Promise<boolean> {
  return scheduler.schedule(entry, nowMs);
}

/** Cancel the alarm for one credential. No-op when no alarm exists. */
export async function cancelOAuthRefresh(workspaceId: string, credentialRef: string): Promise<void> {
  await scheduler.cancelByPayload({ w: workspaceId, r: credentialRef });
}

/**
 * Full reconcile — called on SW wake and after every oauth-store
 * mutation. Walks every workspace's tokens, (re)schedules alarms for
 * refreshable credentials, and clears alarms whose credential no
 * longer exists.
 */
export async function reconcileOAuthSchedules(nowMs: number = Date.now()): Promise<void> {
  return scheduler.reconcile(nowMs);
}

/**
 * Handle an `oauth-refresh:*` alarm. Delegates to the shared scheduler
 * core, which decodes + loads + gates + refreshes + routes
 * observability + records failure + re-arms.
 */
export async function handleOAuthAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  return scheduler.handleFire(alarm.name);
}

/** Subscribe the scheduler to oauth-store changes. Idempotent. */
export function startOAuthScheduler(): void {
  scheduler.start();
}

/** Tear down the scheduler. Test cleanup path. */
export function stopOAuthScheduler(): void {
  scheduler.stop();
}
