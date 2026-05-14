/**
 * OAuth-bundle write-site → oracle helpers.
 *
 * Mirrors `vault-mutations.ts`. Each helper produces a
 * `(MutationBatch, SideEffectIntent[])` pair from the catalog factory in
 * `@openheaders/core/sync` and a {@link MutatorContext}. Pure transforms
 * — no oracle reads, no IO. Both the SW (boot-time hydration via the
 * cache + every legacy write site) and the renderer (future write
 * client) consume these.
 *
 * Singleton entity — no id arg on the catalog factories. Items are
 * keyed by `credentialRef`.
 */

import {
  deleteOAuthToken,
  type MutatorContext,
  type MutatorIntent,
  recordOAuthRefreshError,
  setOAuthToken,
} from '@openheaders/core/sync';

export type OAuthBundleMutationPayload = MutatorIntent;

export interface SetOAuthTokenInput {
  credentialRef: string;
  bundle: unknown;
  config?: unknown;
}

export function buildSetOAuthTokenBatch(
  input: SetOAuthTokenInput,
  ctx: MutatorContext,
): OAuthBundleMutationPayload {
  return setOAuthToken(ctx, input);
}

export interface DeleteOAuthTokenInput {
  credentialRef: string;
}

export function buildDeleteOAuthTokenBatch(
  input: DeleteOAuthTokenInput,
  ctx: MutatorContext,
): OAuthBundleMutationPayload {
  return deleteOAuthToken(ctx, input);
}

export interface RecordOAuthRefreshErrorInput {
  credentialRef: string;
  errorState: unknown;
}

export function buildRecordOAuthRefreshErrorBatch(
  input: RecordOAuthRefreshErrorInput,
  ctx: MutatorContext,
): OAuthBundleMutationPayload {
  return recordOAuthRefreshError(ctx, input);
}
