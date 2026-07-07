/**
 * Renderer-side imperative entry point for Environment writes.
 *
 * Mirrors `rule-write-client.ts`. Each helper builds a
 * `MutationBatch` against the active env mirror and fires
 * `oh.sync.apply` directly — no SW round-trip per primitive, no
 * `updateEnvironmentVariables` shim. The §19.4 synchronous-render
 * discipline lives in the editor; this module is what the editor
 * reaches for once the user commits.
 *
 * `applyEnvVariablesReplacement` is the editor convenience: take the
 * editor's pre-image (`oldVars`) + post-image (`newVars`) and fold
 * them into the catalog primitives. Identity is `variable.uid` — the
 * diff is `setEnvVar` for adds + edits (rename / value / type — all on
 * the same uid) and `removeEnvVar` for deletions, all bundled under
 * one `batchId` so the oracle's per-batch all-or-nothing kicks in.
 *
 * In-place rename collapses to a single `addToSet` against the existing
 * uid (per-itemId LWW handles convergence) — no remove+add pair, no
 * presence flicker mid-edit.
 */

import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  invalidateResolverIntent,
  keyBetween,
  type MutationBody,
  type MutationEnvelope,
  mintBatch,
  type SideEffectIntent,
  seedKey,
} from '@openheaders/core/sync';
import {
  buildAddEnvironmentBatch,
  buildDeleteEnvironmentBatch,
  buildRemoveEnvVarBatch,
  buildRenameEnvironmentBatch,
  buildSetEnvVarBatch,
} from '@openheaders/core/sync-builders/mutations/env-mutations';
import type { Environment, Variable } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { type EnvSyncMirror, getEnvSyncMirrorForWorkspace } from '../../context/mirrors/env-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type { EnvSyncMirror } from '../../context/mirrors/env-sync-mirror';
// `createEnvSyncMirror` is re-exported so tests can construct a mirror
// without going through the singleton.
export { createEnvSyncMirror } from '../../context/mirrors/env-sync-mirror';

export type EnvSimpleResult = SyncSimpleResult;

export interface EnvWriteOptions extends BaseSyncWriteOptions {
  mirror?: EnvSyncMirror;
}

export interface ApplyEnvSetVarInput {
  envId: string;
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
}

export async function applyEnvSetVar(input: ApplyEnvSetVarInput, opts: EnvWriteOptions): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetEnvVarBatch(input, ctx));
}

export interface ApplyEnvRemoveVarInput {
  envId: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export async function applyEnvRemoveVar(
  input: ApplyEnvRemoveVarInput,
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveEnvVarBatch(input, ctx));
}

export interface ApplyRenameEnvironmentInput {
  envId: string;
  name: string;
}

export async function applyRenameEnvironment(
  input: ApplyRenameEnvironmentInput,
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameEnvironmentBatch(input, ctx));
}

/**
 * Editor convenience: persist a complete variables list, preserving the
 * editor's row ORDER as fractional-index `orderKey`s (§23.5) so the set
 * materializes back in the same order the user sees — not uid-sorted.
 *
 * Identity is `variable.uid`. The diff emits `removeFromSet` for deleted
 * uids and `addToSet` for adds / content edits / reorders. Each surviving
 * row's `orderKey` is assigned LSEQ-style: reuse the row's current key
 * while it keeps the running order monotonic, and mint a fresh
 * `keyBetween` only where the order breaks (a moved row) or a row is new.
 * A row unchanged in both content AND position emits nothing — so a plain
 * value edit re-keys nothing and a pure content save no longer trips the
 * order-sensitive dirty check. Empty diff → `{ ok: true }` (no fire).
 */
export async function applyEnvVariablesReplacement(
  envId: string,
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const oldByUid = new Map<string, Variable>();
  for (const v of oldVars) oldByUid.set(v.uid, v);
  const survivors = newVars.filter((v) => v.name.trim());
  const newUids = new Set(survivors.map((v) => v.uid));

  // Current persisted order keys (fractional-index order). The write
  // reuses them to keep unmoved rows byte-stable across saves.
  const mirror = resolveMirror(opts, getEnvSyncMirrorForWorkspace);
  await mirror.hydrated;
  const currentKeys = new Map(mirror.liveVarOrderKeys(envId).map((e) => [e.itemId, e.orderKey] as const));

  // Assign each survivor an orderKey in editor order: reuse the existing
  // key when it stays strictly greater than the previous assignment,
  // otherwise mint a fresh one after `prev` (seed for the first mint).
  const assigned = new Map<string, string>();
  let prevKey: string | null = null;
  for (const v of survivors) {
    const cur = currentKeys.get(v.uid);
    const reuse = cur !== undefined && (prevKey === null || cur > prevKey);
    const key: string = reuse ? cur : prevKey === null ? seedKey() : keyBetween(prevKey, null);
    assigned.set(v.uid, key);
    prevKey = key;
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `env-replace-${envId}` });

  const bodies: MutationBody[] = [];
  // Removals: any uid in old but not in new.
  for (const [uid] of oldByUid) {
    if (newUids.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: envId,
      path: ENV_VARS_PATH,
      itemId: uid,
    });
  }
  // Adds + edits + reorders: emit only rows whose content OR key changed.
  for (const variable of survivors) {
    const prev = oldByUid.get(variable.uid);
    const key = assigned.get(variable.uid)!;
    const contentSame =
      prev &&
      prev.name === variable.name &&
      prev.value === variable.value &&
      (prev.type ?? 'default') === (variable.type ?? 'default');
    const keySame = currentKeys.get(variable.uid) === key;
    if (contentSame && keySame) continue;
    bodies.push({
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: envId,
      path: ENV_VARS_PATH,
      itemId: variable.uid,
      item: variable,
      orderKey: key,
    });
  }

  if (bodies.length === 0) return { ok: true };

  // One INVALIDATE_RESOLVER intent for the whole batch — the runner
  // coalesces by (kind, envId) on the IDB side anyway, but emitting
  // once keeps the wire payload tight.
  const sideEffects: SideEffectIntent[] = [invalidateResolverIntent(envId, ctx.hlc)];
  const batch = mintBatch(ctx, bodies);
  return applySyncPayload({ batch, sideEffects });
}

/**
 * Renderer-direct env create. Mints uid locally, builds the seed batch
 * (one `create` for the scalar shell + one `addToSet` per variable) plus
 * an `INVALIDATE_RESOLVER` side-effect, and fires `oh.sync.apply` against
 * the workspace carried on `opts`. Mirrors `applyRuleCreate`. The
 * legacy SW handler (`createEnvironment`) operates on the runtime-Active
 * workspace and is bypassed here — workbench surfaces emit applies with
 * the editing-scope workspaceId, fixing BC-MWPT-FULL-1.
 */
export type EnvironmentMutationResult =
  | { ok: true; environment: Environment }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export interface ApplyEnvironmentCreateInput {
  name: string;
  variables?: Variable[];
}

export async function applyEnvironmentCreate(
  input: ApplyEnvironmentCreateInput,
  opts: EnvWriteOptions,
): Promise<EnvironmentMutationResult> {
  const environment: Environment = {
    schemaVersion: 5,
    uid: generateUid(),
    name: input.name.trim() || 'Untitled Environment',
    variables: input.variables ?? [],
  };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const ack = await applySyncPayload(buildAddEnvironmentBatch({ environment }, ctx));
  if (ack.ok) return { ok: true, environment };
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

export interface ApplyEnvironmentDeleteInput {
  envId: string;
}

export async function applyEnvironmentDelete(
  input: ApplyEnvironmentDeleteInput,
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildDeleteEnvironmentBatch({ envId: input.envId }, ctx));
}

/**
 * Type-only re-export so callers can ack on the wire envelope shape
 * without pulling the core barrel themselves. Mirrors the rule
 * write-client's surface.
 */
export type { MutationEnvelope };
