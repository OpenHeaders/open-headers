/**
 * OAuth 2.0 token store — persists `OAuth2TokenBundle`s keyed by
 * `credentialRef` in `chrome.storage.local` under
 * `oh.ws.<workspaceId>.oauth`. Per-workspace so deleting a workspace
 * purges its OAuth material alongside environments + files.
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
import { logger } from '@utils/logger';
import { entityLockName, withLock } from '@/shared/coordination/with-lock';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { getActiveWorkspaceId } from './workspace-store';

// ── Storage shape ─────────────────────────────────────────────────

interface OAuthStoreBlob {
  schemaVersion: number;
  version: number;
  /** Map of credentialRef → token bundle. */
  tokens: Record<string, OAuth2TokenBundle>;
}

const DEFAULT_BLOB: OAuthStoreBlob = { schemaVersion: 5, version: 1, tokens: {} };

function isValidBlob(raw: unknown): raw is OAuthStoreBlob {
  if (!raw || typeof raw !== 'object') return false;
  const blob = raw as Partial<OAuthStoreBlob>;
  return (
    typeof blob.schemaVersion === 'number' &&
    typeof blob.version === 'number' &&
    blob.tokens !== null &&
    typeof blob.tokens === 'object'
  );
}

async function readBlob(workspaceId: string): Promise<OAuthStoreBlob> {
  const raw = await extensionStorage.get(wsKeys(workspaceId).oauth);
  if (isValidBlob(raw)) return raw;
  return DEFAULT_BLOB;
}

async function writeBlob(workspaceId: string, blob: OAuthStoreBlob): Promise<void> {
  await extensionStorage.set(wsKeys(workspaceId).oauth, blob);
}

// ── Change listeners ────────────────────────────────────────────────

type ChangeListener = () => void;
const listeners: Set<ChangeListener> = new Set();

export function onOAuthStoreChange(listener: ChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyChange(): void {
  for (const fn of listeners) fn();
}

// ── Reads ──────────────────────────────────────────────────────────

export async function getTokenBundle(credentialRef: string): Promise<OAuth2TokenBundle | null> {
  const workspaceId = getActiveWorkspaceId();
  const blob = await readBlob(workspaceId);
  return blob.tokens[credentialRef] ?? null;
}

export async function listTokenBundles(): Promise<Record<string, OAuth2TokenBundle>> {
  const workspaceId = getActiveWorkspaceId();
  const blob = await readBlob(workspaceId);
  return { ...blob.tokens };
}

// ── Writes ─────────────────────────────────────────────────────────

function withOAuthLock<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(entityLockName(workspaceId, 'oauth', 'singleton'), fn, { op: 'oauth-mutate' });
}

export async function putTokenBundle(credentialRef: string, bundle: OAuth2TokenBundle): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  await withOAuthLock(workspaceId, async () => {
    const current = await readBlob(workspaceId);
    const next: OAuthStoreBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      tokens: { ...current.tokens, [credentialRef]: bundle },
    };
    await writeBlob(workspaceId, next);
    logger.debug('OAuthStore', `Stored token for ${credentialRef} (expiresAt=${bundle.expiresAt ?? 'none'})`);
  });
  notifyChange();
}

export async function deleteTokenBundle(credentialRef: string): Promise<boolean> {
  const workspaceId = getActiveWorkspaceId();
  const removed = await withOAuthLock(workspaceId, async () => {
    const current = await readBlob(workspaceId);
    if (!(credentialRef in current.tokens)) return false;
    const { [credentialRef]: _dropped, ...rest } = current.tokens;
    const next: OAuthStoreBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      tokens: rest,
    };
    await writeBlob(workspaceId, next);
    logger.info('OAuthStore', `Deleted token for ${credentialRef}`);
    return true;
  });
  if (removed) notifyChange();
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
  notifyChange();
}
