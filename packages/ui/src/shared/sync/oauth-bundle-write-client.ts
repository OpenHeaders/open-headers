/**
 * Renderer-side imperative entry point for OAuth-bundle revoke.
 *
 * Mirrors `vault-write-client.ts` for the singleton OAuth-bundle entity.
 * Browser-mediated flow gestures (`authorize` / `clientCredentials` /
 * `refresh`) stay on bridge RPCs because they need SW-resident
 * browser-mediated auth APIs; only the catalog-only
 * `revoke` (delete) goes renderer-direct here. The Provider's primary
 * mutator path threads the editing-scope workspaceId so diverged-tab
 * revocations land in the originating workspace's oracle (MWPT-FULL
 * § 8.3.10).
 */

import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import { buildDeleteOAuthTokenBatch } from '@openheaders/core/sync-builders/oauth-bundle-mutations';

export type OAuthBundleSimpleResult = SyncSimpleResult;

export interface OAuthBundleWriteOptions extends BaseSyncWriteOptions {}

export interface ApplyOAuthRevokeInput {
  credentialRef: string;
}

export async function applyOAuthRevoke(
  input: ApplyOAuthRevokeInput,
  opts: OAuthBundleWriteOptions,
): Promise<OAuthBundleSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildDeleteOAuthTokenBatch({ credentialRef: input.credentialRef }, ctx));
}
