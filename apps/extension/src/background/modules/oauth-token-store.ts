/**
 * OAuth 2.0 token store — singleton-per-workspace blob holding three
 * parallel maps keyed by `credentialRef`:
 *
 *   • `tokens`         — `OAuth2TokenBundle` (access/refresh/expiry).
 *   • `configs`        — `V5.OAuth2Auth` sidecar captured at last
 *                        authorize/refresh; lets the scheduler rebuild
 *                        a refresh POST without walking the request tree.
 *   • `refreshErrors`  — `OAuthRefreshErrorState` failure counters for
 *                        exponential backoff across SW lifetimes.
 *
 * Persisted at `oh.ws.<workspaceId>.oauth`. Per-workspace so deleting a
 * workspace purges its OAuth material alongside environments + files.
 *
 * Writes route through the sync oracle (catalog factory →
 * MutationBatch → `oracle.apply`); the {@link OAuthBundleCache} owns
 * `chrome.storage.local` persistence + drives the local mirror via
 * broadcast-driven re-projection. Reads stay synchronous off the local
 * mirror.
 *
 * Sensitivity: the entity is §12.1 schema-marked sensitive in full
 * (access/refresh tokens, embedded `clientSecret`). The bundle is
 * non-syncing in v1 (§12.3) — local convergence only across same-machine
 * surfaces.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type {
  MutationBatch,
  MutatorContext,
  SideEffectIntent,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, OH, wsKeys } from '@/shared/storage';
import {
  buildDeleteOAuthTokenBatch,
  buildRecordOAuthRefreshErrorBatch,
  buildSetOAuthTokenBatch,
} from '@/shared/sync/oauth-bundle-mutations';
import type { OAuthBundleSnapshot } from '@/shared/sync/oauth-bundle-projection';
import { getActiveOAuthBundleCache } from '../sync/oauth-bundle-cache';
import { getOracleForCurrentWorkspace, nextSwMutatorContext } from '../sync/service';
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

const EMPTY_SNAPSHOT: OAuthBundleSnapshot = {
  schemaVersion: 5,
  tokens: {},
  configs: {},
  refreshErrors: {},
};

// ── In-memory mirror (active workspace) ───────────────────────────

let mirror: OAuthBundleSnapshot = EMPTY_SNAPSHOT;
let mirrorWorkspaceId: string | null = null;

// ── Change listeners ──────────────────────────────────────────────

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

export async function getTokenBundle(
  credentialRef: string,
  workspaceId?: string,
): Promise<OAuth2TokenBundle | null> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  if (wsId === mirrorWorkspaceId) {
    return (mirror.tokens[credentialRef] as OAuth2TokenBundle | undefined) ?? null;
  }
  // Cross-workspace read (scheduler enumerates every workspace) — read
  // through chrome.storage directly. The active mirror only reflects the
  // currently-bridged workspace.
  const blob = await readSnapshot(wsId);
  return (blob.tokens[credentialRef] as OAuth2TokenBundle | undefined) ?? null;
}

export async function getRefreshConfig(
  credentialRef: string,
  workspaceId?: string,
): Promise<V5.OAuth2Auth | null> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  if (wsId === mirrorWorkspaceId) {
    return (mirror.configs[credentialRef] as V5.OAuth2Auth | undefined) ?? null;
  }
  const blob = await readSnapshot(wsId);
  return (blob.configs[credentialRef] as V5.OAuth2Auth | undefined) ?? null;
}

export async function listTokenBundles(
  workspaceId?: string,
): Promise<Record<string, OAuth2TokenBundle>> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  if (wsId === mirrorWorkspaceId) {
    return { ...(mirror.tokens as Record<string, OAuth2TokenBundle>) };
  }
  const blob = await readSnapshot(wsId);
  return { ...(blob.tokens as Record<string, OAuth2TokenBundle>) };
}

export interface WorkspaceCredentialEntry {
  workspaceId: string;
  credentialRef: string;
  bundle: OAuth2TokenBundle;
  config: V5.OAuth2Auth | null;
  errorState: OAuthRefreshErrorState | null;
}

/**
 * Scheduler entry-point: snapshot every workspace's OAuth store. Reads
 * through chrome.storage directly so it covers non-active workspaces.
 */
export async function listAllWorkspaceCredentials(): Promise<WorkspaceCredentialEntry[]> {
  const workspaces = (await extensionStorage.get(OH.workspaces)) ?? [];
  const out: WorkspaceCredentialEntry[] = [];
  for (const ws of workspaces) {
    const blob = await readSnapshot(ws.id);
    for (const [credentialRef, bundle] of Object.entries(blob.tokens)) {
      out.push({
        workspaceId: ws.id,
        credentialRef,
        bundle: bundle as OAuth2TokenBundle,
        config: (blob.configs[credentialRef] as V5.OAuth2Auth | undefined) ?? null,
        errorState:
          (blob.refreshErrors[credentialRef] as OAuthRefreshErrorState | undefined) ?? null,
      });
    }
  }
  return out;
}

// ── Writes ─────────────────────────────────────────────────────────

/**
 * Persist a token bundle. When `config` is provided, the sidecar map is
 * updated so the scheduler can refresh this credential later without
 * looking up the originating request. Successful put clears any stashed
 * refresh-error state for this credential.
 */
export async function putTokenBundle(
  credentialRef: string,
  bundle: OAuth2TokenBundle,
  config?: V5.OAuth2Auth,
  workspaceId?: string,
): Promise<void> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  if (wsId !== mirrorWorkspaceId) {
    // Cross-workspace OAuth writes happen on the scheduler / refresh
    // path. The currently-bridged oracle only owns the active workspace;
    // other workspaces' bundles aren't loaded into an oracle. Direct
    // storage write keeps those credentials reachable on next bridge.
    await applyDirectStorageWrite(wsId, (blob) => {
      const next = { ...blob };
      next.tokens = { ...next.tokens, [credentialRef]: bundle };
      if (config) next.configs = { ...next.configs, [credentialRef]: config };
      const { [credentialRef]: _drop, ...remainingErrors } = next.refreshErrors;
      next.refreshErrors = remainingErrors;
      return next;
    });
    notifyChange(wsId);
    return;
  }

  await applyOAuthMutationOrThrow(
    (ctx) =>
      buildSetOAuthTokenBatch(
        { credentialRef, bundle, ...(config !== undefined ? { config } : {}) },
        ctx,
      ),
    'putTokenBundle',
  );
  logger.debug('OAuthStore', `Stored token for ${credentialRef} (expiresAt=${bundle.expiresAt ?? 'none'})`);
  notifyChange(wsId);
}

export async function deleteTokenBundle(credentialRef: string, workspaceId?: string): Promise<boolean> {
  const wsId = workspaceId ?? getActiveWorkspaceId();
  if (wsId !== mirrorWorkspaceId) {
    let removed = false;
    await applyDirectStorageWrite(wsId, (blob) => {
      if (!(credentialRef in blob.tokens)) return blob;
      removed = true;
      const { [credentialRef]: _t, ...remainingTokens } = blob.tokens;
      const { [credentialRef]: _c, ...remainingConfigs } = blob.configs;
      const { [credentialRef]: _e, ...remainingErrors } = blob.refreshErrors;
      return {
        ...blob,
        tokens: remainingTokens,
        configs: remainingConfigs,
        refreshErrors: remainingErrors,
      };
    });
    if (removed) notifyChange(wsId);
    return removed;
  }

  if (!(credentialRef in mirror.tokens)) return false;
  await applyOAuthMutationOrThrow(
    (ctx) => buildDeleteOAuthTokenBatch({ credentialRef }, ctx),
    'deleteTokenBundle',
  );
  logger.info('OAuthStore', `Deleted token for ${credentialRef}`);
  notifyChange(wsId);
  return true;
}

/**
 * Drop every OAuth token for a workspace. Called by the workspace
 * orchestrator on workspace delete — direct storage removal because the
 * sync service is being torn down for that workspace.
 */
export async function purgeOAuthForWorkspace(workspaceId: string): Promise<void> {
  await extensionStorage.remove(wsKeys(workspaceId).oauth);
  logger.info('OAuthStore', `Purged all OAuth tokens for workspace ${workspaceId}`);
  if (workspaceId === mirrorWorkspaceId) {
    mirror = EMPTY_SNAPSHOT;
  }
  notifyChange(workspaceId);
}

/**
 * Scheduler-only: record a refresh failure so backoff can widen. Keeps
 * the token bundle intact — the stale access token is still the best
 * thing to attach until a successful refresh lands.
 */
export async function recordRefreshError(
  credentialRef: string,
  errorMessage: string,
  workspaceId: string,
): Promise<OAuthRefreshErrorState> {
  if (workspaceId !== mirrorWorkspaceId) {
    let latest: OAuthRefreshErrorState = {
      consecutiveFailures: 1,
      lastErrorAt: Date.now(),
      lastErrorMessage: truncate(errorMessage, 200),
    };
    await applyDirectStorageWrite(workspaceId, (blob) => {
      const previous = blob.refreshErrors[credentialRef] as OAuthRefreshErrorState | undefined;
      latest = {
        consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
        lastErrorAt: Date.now(),
        lastErrorMessage: truncate(errorMessage, 200),
      };
      return {
        ...blob,
        refreshErrors: { ...blob.refreshErrors, [credentialRef]: latest },
      };
    });
    notifyChange(workspaceId);
    return latest;
  }

  const previous = mirror.refreshErrors[credentialRef] as OAuthRefreshErrorState | undefined;
  const latest: OAuthRefreshErrorState = {
    consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
    lastErrorAt: Date.now(),
    lastErrorMessage: truncate(errorMessage, 200),
  };
  await applyOAuthMutationOrThrow(
    (ctx) => buildRecordOAuthRefreshErrorBatch({ credentialRef, errorState: latest }, ctx),
    'recordRefreshError',
  );
  notifyChange(workspaceId);
  return latest;
}

// ── Sync engine plumbing ──────────────────────────────────────────

async function applyOAuthMutationOrThrow(
  factory: (ctx: MutatorContext) => { batch: MutationBatch; sideEffects: SideEffectIntent[] },
  op: string,
): Promise<void> {
  const oracle = getOracleForCurrentWorkspace();
  const ctx = nextSwMutatorContext({ surfaceId: 'sw' });
  if (!oracle || !ctx) {
    throw new Error(`OAuthStore.${op}: sync service not initialized`);
  }
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  const result = await oracle.apply(batch, sideEffects);
  if (!result.ok) {
    throw new Error(
      `OAuthStore.${op}: oracle rejected batch (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
    );
  }
}

// ── Hydration / bridge ────────────────────────────────────────────

async function readSnapshot(workspaceId: string): Promise<OAuthBundleSnapshot> {
  const raw = await extensionStorage.get(wsKeys(workspaceId).oauth);
  return normalizeBlob(raw);
}

function normalizeBlob(raw: unknown): OAuthBundleSnapshot {
  if (!raw || typeof raw !== 'object') return EMPTY_SNAPSHOT;
  const blob = raw as Partial<OAuthBundleSnapshot>;
  return {
    schemaVersion: typeof blob.schemaVersion === 'number' ? blob.schemaVersion : 5,
    tokens: (blob.tokens && typeof blob.tokens === 'object' ? blob.tokens : {}) as Record<string, unknown>,
    configs: (blob.configs && typeof blob.configs === 'object' ? blob.configs : {}) as Record<string, unknown>,
    refreshErrors: (blob.refreshErrors && typeof blob.refreshErrors === 'object'
      ? blob.refreshErrors
      : {}) as Record<string, unknown>,
  };
}

async function applyDirectStorageWrite(
  workspaceId: string,
  mutator: (blob: OAuthBundleSnapshot) => OAuthBundleSnapshot,
): Promise<void> {
  // Cross-workspace direct writes don't reach the oracle (other workspaces
  // aren't bridged into the active sync service). Serialize through the
  // same per-entity Web Lock the oracle uses when active so concurrent
  // puts on the scheduler / cross-workspace refresh path don't lose
  // updates.
  await withLock(
    entityLockName(workspaceId, 'oauth-bundle', 'oauth'),
    async () => {
      const current = await readSnapshot(workspaceId);
      const next = mutator(current);
      if (next === current) return;
      await extensionStorage.set(wsKeys(workspaceId).oauth, next);
    },
    { op: 'oauth-direct-write' },
  );
}

let cacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the local mirror to the active workspace's
 * {@link OAuthBundleCache}. Idempotent — the prior subscription is
 * dropped first. Seeds the oracle from the current persisted blob.
 */
export async function bridgeOAuthSyncEngine(): Promise<void> {
  const cache = getActiveOAuthBundleCache();
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  const workspaceId = getActiveWorkspaceId();
  cacheUnsubscribe = cache.onChange(() => {
    mirror = cache.getSnapshot();
    notifyChange(workspaceId);
  });
  const persisted = await readSnapshot(workspaceId);
  await cache.seedFromPersistedOAuthBundle(persisted);
  mirror = cache.getSnapshot();
  mirrorWorkspaceId = workspaceId;
}

// ── Helpers ───────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

// ── Test helpers ──────────────────────────────────────────────────

export function __resetForTests(): void {
  mirror = EMPTY_SNAPSHOT;
  mirrorWorkspaceId = null;
  listeners.clear();
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
}
