/**
 * OAuth 2.0 token store — persists `OAuth2TokenBundle`s keyed by
 * `credentialRef` in `chrome.storage.local` under
 * `oh.ws.<workspaceId>.oauth`. Per-workspace so deleting a workspace
 * purges its OAuth material alongside environments + files.
 *
 * Two parallel maps live in the blob:
 *   • `tokens`  — the `OAuth2TokenBundle` (access/refresh/expiry) —
 *     mutated on every successful flow or refresh exchange.
 *   • `configs` — the `OAuth2Auth` sidecar captured at authorize /
 *     refresh time. Phase 14 §20's alarm handler needs enough of the
 *     original request's auth config to rebuild a token-endpoint POST
 *     without walking the request tree; stashing the whole config is
 *     the simplest correct answer. (`credentialRef` + `tokenEndpoint`
 *     + `clientId/Secret` + `scopes` + `extraTokenParams` are the live
 *     fields — we store the rest verbatim so future refresh semantics
 *     don't require a migration.)
 *
 * A third `refreshErrors` map tracks consecutive-failure counters so
 * the scheduler can apply exponential backoff across SW lifetimes.
 *
 * Writes serialize through `withLock(entityLockName(ws, 'oauth',
 * 'singleton'))` — Phase 10 discipline: one writer per workspace,
 * no lost updates when two tabs refresh the same credential at once.
 *
 * This module does NOT run the OAuth flow — see `oauth-flow.ts` for
 * the `launchAuthorizationCodeFlow` / `performRefresh` functions.
 * Tokens land here AFTER the flow runner finishes the exchange.
 *
 * The access_token + refresh_token are plain strings at rest today
 * (no-op cipher per ARCHITECTURE §10 v1). The `Vault` upgrade (v2
 * passphrase → v3 WebAuthn PRF) wraps this storage invisibly — the
 * call sites below don't change when the cipher upgrades.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, OH, wsKeys } from '@/shared/storage';
import { getActiveWorkspaceId } from './workspace-store';

// ── Storage shape ─────────────────────────────────────────────────

export interface OAuthRefreshErrorState {
  /** Consecutive failures since last success. Reset on success. */
  consecutiveFailures: number;
  /** Wall-clock ms of the last failure. */
  lastErrorAt: number;
  /** Human-readable last error message (truncated). */
  lastErrorMessage: string;
}

interface OAuthStoreBlob {
  schemaVersion: number;
  version: number;
  /** Map of credentialRef → token bundle. */
  tokens: Record<string, OAuth2TokenBundle>;
  /** Map of credentialRef → `OAuth2Auth` config captured at last authorize/refresh. */
  configs: Record<string, V5.OAuth2Auth>;
  /** Map of credentialRef → scheduler failure state for exponential backoff. */
  refreshErrors: Record<string, OAuthRefreshErrorState>;
}

const DEFAULT_BLOB: OAuthStoreBlob = {
  schemaVersion: 5,
  version: 1,
  tokens: {},
  configs: {},
  refreshErrors: {},
};

function normalizeBlob(raw: unknown): OAuthStoreBlob {
  if (!raw || typeof raw !== 'object') return DEFAULT_BLOB;
  const blob = raw as Partial<OAuthStoreBlob>;
  if (
    typeof blob.schemaVersion !== 'number' ||
    typeof blob.version !== 'number' ||
    !blob.tokens ||
    typeof blob.tokens !== 'object'
  ) {
    return DEFAULT_BLOB;
  }
  // `configs` + `refreshErrors` are new in §20 — older blobs (written
  // before this session) will be missing them. Default to empty maps so
  // the next write up-fills them.
  return {
    schemaVersion: blob.schemaVersion,
    version: blob.version,
    tokens: blob.tokens as Record<string, OAuth2TokenBundle>,
    configs: (blob.configs && typeof blob.configs === 'object' ? blob.configs : {}) as Record<string, V5.OAuth2Auth>,
    refreshErrors: (blob.refreshErrors && typeof blob.refreshErrors === 'object' ? blob.refreshErrors : {}) as Record<
      string,
      OAuthRefreshErrorState
    >,
  };
}

async function readBlob(workspaceId: string): Promise<OAuthStoreBlob> {
  const raw = await extensionStorage.get(wsKeys(workspaceId).oauth);
  return normalizeBlob(raw);
}

async function writeBlob(workspaceId: string, blob: OAuthStoreBlob): Promise<void> {
  await extensionStorage.set(wsKeys(workspaceId).oauth, blob);
}

function resolveWorkspaceId(workspaceId: string | undefined): string {
  return workspaceId ?? getActiveWorkspaceId();
}

// ── Change listeners ────────────────────────────────────────────────

/**
 * Change listeners receive the workspaceId that mutated so subscribers
 * scoped to a specific workspace (UI surfaces, scheduler) can filter
 * without polling every workspace on every event.
 */
type ChangeListener = (workspaceId: string) => void;
const listeners: Set<ChangeListener> = new Set();

export function onOAuthStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(workspaceId: string): void {
  for (const fn of listeners) fn(workspaceId);
}

// ── Reads ──────────────────────────────────────────────────────────

export async function getTokenBundle(credentialRef: string, workspaceId?: string): Promise<OAuth2TokenBundle | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return blob.tokens[credentialRef] ?? null;
}

export async function getRefreshConfig(credentialRef: string, workspaceId?: string): Promise<V5.OAuth2Auth | null> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return blob.configs[credentialRef] ?? null;
}

export async function listTokenBundles(workspaceId?: string): Promise<Record<string, OAuth2TokenBundle>> {
  const wsId = resolveWorkspaceId(workspaceId);
  const blob = await readBlob(wsId);
  return { ...blob.tokens };
}

/**
 * Scheduler entry-point: snapshot every workspace's OAuth store.
 * Returns a flat list of credentials the refresh scheduler can iterate
 * without having to re-read per workspace.
 */
export interface WorkspaceCredentialEntry {
  workspaceId: string;
  credentialRef: string;
  bundle: OAuth2TokenBundle;
  config: V5.OAuth2Auth | null;
  errorState: OAuthRefreshErrorState | null;
}

export async function listAllWorkspaceCredentials(): Promise<WorkspaceCredentialEntry[]> {
  const workspaces = (await extensionStorage.get(OH.workspaces)) ?? [];
  const out: WorkspaceCredentialEntry[] = [];
  for (const ws of workspaces) {
    const blob = await readBlob(ws.id);
    for (const [credentialRef, bundle] of Object.entries(blob.tokens)) {
      out.push({
        workspaceId: ws.id,
        credentialRef,
        bundle,
        config: blob.configs[credentialRef] ?? null,
        errorState: blob.refreshErrors[credentialRef] ?? null,
      });
    }
  }
  return out;
}

// ── Writes ─────────────────────────────────────────────────────────

function withOAuthLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'oauth', 'singleton'), fn, { op: 'oauth-mutate' });
}

/**
 * Persist a token bundle. When `config` is provided, the sidecar map
 * is updated so the scheduler can refresh this credential later
 * without looking up the originating request. Callers inside
 * `oauth-flow.ts` always pass the config; the executor's on-demand
 * refresh path does the same via `performRefresh`.
 */
export async function putTokenBundle(
  credentialRef: string,
  bundle: OAuth2TokenBundle,
  config?: V5.OAuth2Auth,
  workspaceId?: string,
): Promise<void> {
  const wsId = resolveWorkspaceId(workspaceId);
  await withOAuthLock(wsId, async () => {
    const current = await readBlob(wsId);
    const nextConfigs = config ? { ...current.configs, [credentialRef]: config } : current.configs;
    // A successful put clears any stashed failure state — the next
    // alarm firing restarts from a clean slate.
    const { [credentialRef]: _droppedErr, ...remainingErrors } = current.refreshErrors;
    const next: OAuthStoreBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      tokens: { ...current.tokens, [credentialRef]: bundle },
      configs: nextConfigs,
      refreshErrors: remainingErrors,
    };
    await writeBlob(wsId, next);
    logger.debug('OAuthStore', `Stored token for ${credentialRef} (expiresAt=${bundle.expiresAt ?? 'none'})`);
  });
  notifyChange(wsId);
}

export async function deleteTokenBundle(credentialRef: string, workspaceId?: string): Promise<boolean> {
  const wsId = resolveWorkspaceId(workspaceId);
  const removed = await withOAuthLock(wsId, async () => {
    const current = await readBlob(wsId);
    if (!(credentialRef in current.tokens)) return false;
    const { [credentialRef]: _droppedToken, ...remainingTokens } = current.tokens;
    const { [credentialRef]: _droppedConfig, ...remainingConfigs } = current.configs;
    const { [credentialRef]: _droppedErr, ...remainingErrors } = current.refreshErrors;
    const next: OAuthStoreBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      tokens: remainingTokens,
      configs: remainingConfigs,
      refreshErrors: remainingErrors,
    };
    await writeBlob(wsId, next);
    logger.info('OAuthStore', `Deleted token for ${credentialRef}`);
    return true;
  });
  if (removed) notifyChange(wsId);
  return removed;
}

/**
 * Drop every OAuth token for a workspace. Called by the
 * workspace-orchestrator on workspace delete.
 */
export async function purgeOAuthForWorkspace(workspaceId: string): Promise<void> {
  await withOAuthLock(workspaceId, async () => {
    await extensionStorage.remove(wsKeys(workspaceId).oauth);
    logger.info('OAuthStore', `Purged all OAuth tokens for workspace ${workspaceId}`);
  });
  notifyChange(workspaceId);
}

/**
 * Scheduler-only: record a refresh failure so backoff can widen.
 * Keeps the token bundle intact — the stale access token is still the
 * best thing to attach until a successful refresh lands.
 */
export async function recordRefreshError(
  credentialRef: string,
  errorMessage: string,
  workspaceId: string,
): Promise<OAuthRefreshErrorState> {
  let latest: OAuthRefreshErrorState = { consecutiveFailures: 1, lastErrorAt: Date.now(), lastErrorMessage: '' };
  await withOAuthLock(workspaceId, async () => {
    const current = await readBlob(workspaceId);
    const previous = current.refreshErrors[credentialRef];
    latest = {
      consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
      lastErrorAt: Date.now(),
      lastErrorMessage: truncate(errorMessage, 200),
    };
    const next: OAuthStoreBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      tokens: current.tokens,
      configs: current.configs,
      refreshErrors: { ...current.refreshErrors, [credentialRef]: latest },
    };
    await writeBlob(workspaceId, next);
  });
  notifyChange(workspaceId);
  return latest;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}
