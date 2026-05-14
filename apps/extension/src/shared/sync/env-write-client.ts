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
  type MutationBody,
  type MutationEnvelope,
  mintBatch,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { Environment, Variable } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { EnvSyncMirror } from '@/context/env-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import {
  buildAddEnvironmentBatch,
  buildDeleteEnvironmentBatch,
  buildRemoveEnvVarBatch,
  buildRenameEnvironmentBatch,
  buildSetEnvVarBatch,
} from '@openheaders/core/sync-builders/env-mutations';

// `createEnvSyncMirror` is re-exported so tests can construct a mirror
// without going through the singleton.
export { createEnvSyncMirror } from '@/context/env-sync-mirror';

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
 * Editor convenience: persist a complete variables list. Identity is
 * `variable.uid` — the diff finds same-uid pairs to detect edits
 * (rename / value / type all on the same uid), uid-only-in-old to
 * detect deletions, and uid-only-in-new to detect adds. Empty diff →
 * empty batch (no broadcast, no recompile).
 */
export async function applyEnvVariablesReplacement(
  envId: string,
  newVars: readonly Variable[],
  oldVars: readonly Variable[],
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const oldByUid = new Map<string, Variable>();
  for (const v of oldVars) oldByUid.set(v.uid, v);
  const newByUid = new Map<string, Variable>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByUid.set(v.uid, v);
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `env-replace-${envId}` });

  const bodies: MutationBody[] = [];
  // Removals: any uid in old but not in new.
  for (const [uid] of oldByUid) {
    if (newByUid.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: envId,
      path: ENV_VARS_PATH,
      itemId: uid,
    });
  }
  // Adds + edits (rename / value / type): replace via addToSet (per-uid LWW).
  for (const [uid, variable] of newByUid) {
    const prev = oldByUid.get(uid);
    if (
      prev &&
      prev.name === variable.name &&
      prev.value === variable.value &&
      (prev.type ?? 'default') === (variable.type ?? 'default')
    ) {
      continue;
    }
    bodies.push({
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: envId,
      path: ENV_VARS_PATH,
      itemId: uid,
      item: variable,
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
