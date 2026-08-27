/**
 * Renderer-side imperative entry point for trusted-roots writes.
 *
 * Mirrors `pause-markers-write-client.ts` for the singleton
 * trusted-roots entity. `applyTrustedRootAdd` mints the row (uid +
 * `addedAt`) and upserts it; `applyTrustedRootRemove` keys by uid.
 * Both fire `oh.sync.apply` directly — the optimistic local apply
 * lands in the editor through the mirror's broadcast subscription.
 */

import {
  buildRemoveTrustedRootBatch,
  buildSetTrustedRootBatch,
} from '@openheaders/core/sync-builders/mutations/trusted-roots-mutations';
import type { TrustedRoot } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type TrustedRootsResult = SyncSimpleResult;

export type TrustedRootsWriteOptions = BaseSyncWriteOptions;

export interface ApplyTrustedRootAddInput {
  name: string;
  /** Certificate (or chain) PEM — the row's whole trust material. */
  certPem: string;
}

export type TrustedRootAddResult = { ok: true; root: TrustedRoot } | Exclude<SyncSimpleResult, { ok: true }>;

export async function applyTrustedRootAdd(
  input: ApplyTrustedRootAddInput,
  opts: TrustedRootsWriteOptions,
): Promise<TrustedRootAddResult> {
  const root: TrustedRoot = {
    uid: generateUid(),
    name: input.name,
    certPem: input.certPem,
    addedAt: new Date().toISOString(),
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const result = await applySyncPayload(buildSetTrustedRootBatch({ root }, ctx));
  return result.ok ? { ok: true, root } : result;
}

export interface ApplyTrustedRootRemoveInput {
  uid: string;
}

export async function applyTrustedRootRemove(
  input: ApplyTrustedRootRemoveInput,
  opts: TrustedRootsWriteOptions,
): Promise<TrustedRootsResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveTrustedRootBatch({ uid: input.uid }, ctx));
}
