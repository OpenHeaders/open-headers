/**
 * Renderer-side imperative entry point for trusted-roots writes.
 *
 * Mirrors `vault-write-client.ts` for the singleton trusted-roots
 * entity. `applyTrustedRootsReplacement` is the editor's Save: it
 * diffs the draft list against the canonical one by uid and commits
 * the result as ONE batch — the local-before-remote boundary, so an
 * unsaved root never reaches a peer. `applyTrustedRootAdd` and
 * `applyTrustedRootRemove` stay as single-gesture writes for callers
 * without a draft (palette, scripts). All fire `oh.sync.apply`
 * directly — the optimistic local apply lands in the editor through
 * the mirror's broadcast subscription.
 */

import { mintBatch, TRUSTED_ROOTS_ENTITY_TYPE, TRUSTED_ROOTS_ID, TRUSTED_ROOTS_PATH } from '@openheaders/core/sync';
import { synthesizeSetDiff, toLiveSetEntries } from '@openheaders/core/sync-builders';
import {
  buildRemoveTrustedRootBatch,
  buildSetTrustedRootBatch,
} from '@openheaders/core/sync-builders/mutations/trusted-roots-mutations';
import type { TrustedRoot } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import {
  getTrustedRootsSyncMirrorForWorkspace,
  type TrustedRootsSyncMirror,
} from '../../context/mirrors/trusted-roots-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type TrustedRootsResult = SyncSimpleResult;

export interface TrustedRootsWriteOptions extends BaseSyncWriteOptions {
  mirror?: TrustedRootsSyncMirror;
}

export interface ApplyTrustedRootAddInput {
  name: string;
  /** Certificate (or chain) PEM — the row's whole trust material. */
  certPem: string;
}

/** Mint a row for the draft: uid + `addedAt`, the PEM verbatim. */
export function mintTrustedRoot(input: ApplyTrustedRootAddInput): TrustedRoot {
  return {
    uid: generateUid(),
    name: input.name,
    certPem: input.certPem,
    addedAt: new Date().toISOString(),
  };
}

export type TrustedRootAddResult = { ok: true; root: TrustedRoot } | Exclude<SyncSimpleResult, { ok: true }>;

export async function applyTrustedRootAdd(
  input: ApplyTrustedRootAddInput,
  opts: TrustedRootsWriteOptions,
): Promise<TrustedRootAddResult> {
  const root = mintTrustedRoot(input);
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

/**
 * Commit a whole draft list against the canonical one: addToSet for
 * new or renamed rows, removeFromSet for dropped ones, nothing for a
 * row unchanged in content and position. Empty diff → `{ ok: true }`
 * without firing.
 */
export async function applyTrustedRootsReplacement(
  newRoots: readonly TrustedRoot[],
  oldRoots: readonly TrustedRoot[],
  opts: TrustedRootsWriteOptions,
): Promise<TrustedRootsResult> {
  const mirror = resolveMirror(opts, getTrustedRootsSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(mirror.liveRootOrderKeys().map((e) => [e.itemId, e.orderKey] as const));

  const bodies = synthesizeSetDiff({
    type: TRUSTED_ROOTS_ENTITY_TYPE,
    id: TRUSTED_ROOTS_ID,
    path: TRUSTED_ROOTS_PATH,
    live: toLiveSetEntries(oldRoots, currentKeys),
    newItems: newRoots.filter((r) => r.name.trim()),
  });
  if (bodies.length === 0) return { ok: true };

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? 'trusted-roots-replace' });
  return applySyncPayload({ batch: mintBatch(ctx, bodies), sideEffects: [] });
}
