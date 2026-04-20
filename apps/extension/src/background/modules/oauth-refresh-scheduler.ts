/**
 * OAuth 2.0 refresh scheduler — alarm-driven background refresh so the
 * UI's "Connected (expires in Nmin)" badge stays green without requiring
 * the user to open a surface that would hydrate the bundle on demand.
 *
 * ARCHITECTURE §18 + Phase 14 §20.
 *
 * Design:
 *   • `chrome.alarms` is the only cross-SW-wake timer primitive. Each
 *     credential gets one alarm named `oauth-refresh:<b64url>` where
 *     the payload encodes `{ workspaceId, credentialRef }` — alarm
 *     names survive across SW eviction, so the refresh keeps firing
 *     even when the app hasn't been opened for hours.
 *   • The sidecar in `oauth-token-store` holds everything the alarm
 *     handler needs to rebuild the token-endpoint POST (`configs` map)
 *     and the per-credential failure state (`refreshErrors` map) so
 *     exponential backoff survives SW wakes too.
 *   • Reconciliation on wake — `reconcileOAuthSchedules()` runs once
 *     during `initializeExtension` and walks every workspace's tokens,
 *     adding any missing alarms and clearing any orphaned ones (e.g.
 *     user deleted a credential while the SW was asleep).
 *   • Change-driven reconcile — every `putTokenBundle` / `deleteTokenBundle`
 *     / `recordRefreshError` triggers `onOAuthStoreChange`, which we
 *     subscribe to so rescheduling after a successful refresh or a
 *     failure happens without the handler having to do it explicitly.
 *
 * What is NOT scheduled:
 *   • Credentials without a refresh capability — `authorization-code`
 *     (no PKCE, no refresh_token), `implicit`, `device-code` without a
 *     refresh_token. These require user interaction to renew; the
 *     executor's on-demand refresh path (`applyAuth`) still tries when
 *     a refresh_token is present.
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
import type { V5 } from '@openheaders/core/types';
import { alarms } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { refreshCredential } from './oauth-flow';
import type { OAuthRefreshErrorState, WorkspaceCredentialEntry } from './oauth-token-store';
import {
  getRefreshConfig,
  getTokenBundle,
  listAllWorkspaceCredentials,
  onOAuthStoreChange,
  recordRefreshError,
} from './oauth-token-store';
import { recordLog } from './observability-log';

// ── Constants ──────────────────────────────────────────────────────

/** Alarm name prefix used to route alarms into the scheduler handler. */
export const OAUTH_ALARM_PREFIX = 'oauth-refresh:';

/** Minimum alarm delay — Chrome clamps to 30s in packed MV3 builds. */
export const MIN_ALARM_DELAY_MS = 30_000;

/** Fire `REFRESH_LEAD_MS` before the access-token expiry. */
export const REFRESH_LEAD_MS = 60_000;

/** Cap for exponential backoff in seconds. */
export const MAX_BACKOFF_SECONDS = 3600;

// ── Alarm name codec ──────────────────────────────────────────────

/**
 * Encode `{ workspaceId, credentialRef }` into an alarm name. Uses
 * base64url over JSON so arbitrary credentialRef contents (colons,
 * spaces, …) survive unambiguously. Callers never parse the payload
 * themselves — use {@link parseAlarmName}.
 */
export function buildAlarmName(workspaceId: string, credentialRef: string): string {
  const json = JSON.stringify({ w: workspaceId, r: credentialRef });
  return `${OAUTH_ALARM_PREFIX}${base64UrlEncode(json)}`;
}

/**
 * Decode an alarm name produced by {@link buildAlarmName}. Returns
 * null for anything that doesn't carry the prefix or whose payload is
 * malformed — callers treat that as "not ours, ignore."
 */
export function parseAlarmName(name: string): { workspaceId: string; credentialRef: string } | null {
  if (!name.startsWith(OAUTH_ALARM_PREFIX)) return null;
  try {
    const json = base64UrlDecode(name.slice(OAUTH_ALARM_PREFIX.length));
    const parsed = JSON.parse(json) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { w?: unknown }).w === 'string' &&
      typeof (parsed as { r?: unknown }).r === 'string'
    ) {
      const obj = parsed as { w: string; r: string };
      return { workspaceId: obj.w, credentialRef: obj.r };
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the alarm belongs to the OAuth scheduler. */
export function isOAuthRefreshAlarm(alarm: chrome.alarms.Alarm): boolean {
  return typeof alarm?.name === 'string' && alarm.name.startsWith(OAUTH_ALARM_PREFIX);
}

// ── Refresh-capability + cadence calculations (pure) ──────────────

/**
 * A credential is refreshable without user interaction when either it
 * has a refresh_token (the standard path for Authorization Code /
 * Password / Device Code flows) OR its flow is Client Credentials
 * (which re-runs the full token exchange on every refresh).
 */
export function canSilentRefresh(bundle: OAuth2TokenBundle | null, config: V5.OAuth2Auth | null): boolean {
  if (!bundle || !config) return false;
  if (config.flow === 'client-credentials') return true;
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

// ── Scheduling ────────────────────────────────────────────────────

/**
 * Create (or update) the alarm for one credential. Safe to call
 * repeatedly — `chrome.alarms.create` overwrites any existing alarm
 * with the same name, so `reconcile → scheduleOAuthRefresh` is
 * idempotent.
 *
 * Returns `true` when an alarm was scheduled, `false` when the entry
 * was skipped (non-refreshable, missing expiry, or no bundle).
 */
export async function scheduleOAuthRefresh(
  entry: WorkspaceCredentialEntry,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!alarms) return false;
  if (!canSilentRefresh(entry.bundle, entry.config)) return false;

  const when = computeNextFireAt(entry.bundle, entry.errorState, nowMs);
  if (when == null) return false;

  const name = buildAlarmName(entry.workspaceId, entry.credentialRef);
  alarms.create(name, { when });
  logger.debug(
    'OAuthScheduler',
    `Scheduled refresh for ${entry.credentialRef} (ws=${entry.workspaceId}) at ${new Date(when).toISOString()}`,
  );
  return true;
}

/** Cancel the alarm for one credential. No-op when no alarm exists. */
export async function cancelOAuthRefresh(workspaceId: string, credentialRef: string): Promise<void> {
  if (!alarms) return;
  alarms.clear(buildAlarmName(workspaceId, credentialRef));
}

/**
 * Full reconcile — called on SW wake and after every oauth-store
 * mutation. Walks every workspace's tokens, (re)schedules alarms for
 * refreshable credentials, and clears alarms whose credential no
 * longer exists.
 */
export async function reconcileOAuthSchedules(nowMs: number = Date.now()): Promise<void> {
  if (!alarms) return;

  const entries = await listAllWorkspaceCredentials();
  const desiredNames = new Set<string>();

  for (const entry of entries) {
    if (!canSilentRefresh(entry.bundle, entry.config)) continue;
    const scheduled = await scheduleOAuthRefresh(entry, nowMs);
    if (scheduled) {
      desiredNames.add(buildAlarmName(entry.workspaceId, entry.credentialRef));
    }
  }

  // Clear any orphan alarms — credentials deleted while the SW was
  // asleep won't appear in `entries` anymore, but their alarms persist
  // until we explicitly clear them.
  const existing = await alarms.getAll();
  for (const alarm of existing) {
    if (!isOAuthRefreshAlarm(alarm)) continue;
    if (!desiredNames.has(alarm.name)) {
      alarms.clear(alarm.name);
      logger.debug('OAuthScheduler', `Cleared orphan alarm ${alarm.name}`);
    }
  }
}

// ── Alarm dispatch ────────────────────────────────────────────────

/**
 * Handle an `oauth-refresh:*` alarm. Parses the payload, attempts the
 * refresh, and records observability + error state. Rescheduling is
 * delegated to `onOAuthStoreChange` → `reconcileOAuthSchedules` so
 * every write path converges on the same cadence computation.
 */
export async function handleOAuthAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  const parsed = parseAlarmName(alarm.name);
  if (!parsed) return;
  const { workspaceId, credentialRef } = parsed;

  recordLog({
    subsystem: 'oauth',
    op: 'refresh-fired',
    level: 'info',
    message: `Alarm fired for credential ${credentialRef}`,
    context: { credentialRef, workspaceId },
  });

  const [config, bundle] = await Promise.all([
    getRefreshConfig(credentialRef, workspaceId),
    getTokenBundle(credentialRef, workspaceId),
  ]);
  if (!config || !bundle) {
    // Credential was deleted between scheduling and firing. Clear the
    // alarm so it doesn't fire again.
    await cancelOAuthRefresh(workspaceId, credentialRef);
    return;
  }
  if (!canSilentRefresh(bundle, config)) {
    // Config changed since scheduling (e.g., refresh_token revoked
    // server-side and stripped by a partial write). Nothing to do.
    await cancelOAuthRefresh(workspaceId, credentialRef);
    return;
  }

  try {
    await refreshCredential(config, workspaceId);
    recordLog({
      subsystem: 'oauth',
      op: 'refresh-succeeded',
      level: 'info',
      message: `Refreshed credential ${credentialRef}`,
      context: { credentialRef, workspaceId },
    });
    // `putTokenBundle` inside `refreshCredential` cleared `refreshErrors`
    // and fired `onOAuthStoreChange`, which triggers `reconcileOAuthSchedules`
    // to compute the next alarm from the fresh `expiresAt`. No explicit
    // reschedule needed here.
  } catch (err) {
    const message = (err as Error)?.message ?? 'refresh failed';
    const state = await recordRefreshError(credentialRef, message, workspaceId);
    recordLog({
      subsystem: 'oauth',
      op: 'refresh-failed',
      level: state.consecutiveFailures >= 3 ? 'error' : 'warn',
      message: `Refresh failed for ${credentialRef} (attempt ${state.consecutiveFailures}): ${message}`,
      context: {
        credentialRef,
        workspaceId,
        errorClass: (err as Error)?.name,
      },
    });
    // `recordRefreshError` also fired `onOAuthStoreChange`, which
    // triggers reconcile → scheduleOAuthRefresh → backoff alarm.
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────

let storeSubscription: (() => void) | null = null;

/**
 * Subscribe the scheduler to oauth-store changes. Idempotent — safe to
 * call repeatedly; later calls are no-ops until `stopOAuthScheduler`.
 */
export function startOAuthScheduler(): void {
  if (storeSubscription) return;
  storeSubscription = onOAuthStoreChange((_workspaceId) => {
    // Reconcile runs across every workspace. The per-workspace signal
    // isn't worth a narrower path today — total credential counts in
    // practice are small (one-digit to low-tens), and the idempotent
    // create/clear calls are cheap.
    void reconcileOAuthSchedules().catch((err: unknown) => {
      logger.warn('OAuthScheduler', 'Reconcile after store change failed', err);
    });
  });
}

/** Tear down the scheduler. Test cleanup path. */
export function stopOAuthScheduler(): void {
  if (storeSubscription) {
    storeSubscription();
    storeSubscription = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
