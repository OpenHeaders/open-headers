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

import type { V5 } from '@openheaders/core/types';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveRendererContext,
  type SyncSimpleResult,
} from '@/shared/sync/apply-payload';
import { mintBatch, type MutationBody, type MutationEnvelope, type SideEffectIntent } from '@openheaders/core/sync';
import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  invalidateResolverIntent,
} from '@openheaders/core/sync';
import {
  createEnvSyncMirror,
  type EnvSyncMirror,
} from '@/context/env-sync-mirror';
import {
  buildDeleteEnvironmentBatch,
  buildRemoveEnvVarBatch,
  buildRenameEnvironmentBatch,
  buildSeedEnvironmentBatch,
  buildSetEnvVarBatch,
} from '@/shared/sync/env-mutations';

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
  variable: V5.Variable;
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
 * Seed a brand-new environment in the workspace identified by
 * `opts.workspaceId`. Sync-engine routing handles per-workspace storage —
 * the SW cache + persistence land in `wsKeys(opts.workspaceId).envs`.
 * Mirrors `applyRuleCreate` in `rule-write-client.ts`.
 */
export async function applyEnvironmentCreate(env: V5.Environment, opts: EnvWriteOptions): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSeedEnvironmentBatch(env, ctx));
}

/**
 * Tombstone an environment in the workspace identified by
 * `opts.workspaceId`. Mirrors `applyRuleDelete` in `rule-write-client.ts`.
 */
export async function applyEnvironmentDelete(envId: string, opts: EnvWriteOptions): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildDeleteEnvironmentBatch(envId, ctx));
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
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const oldByUid = new Map<string, V5.Variable>();
  for (const v of oldVars) oldByUid.set(v.uid, v);
  const newByUid = new Map<string, V5.Variable>();
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
 * Type-only re-export so callers can ack on the wire envelope shape
 * without pulling the core barrel themselves. Mirrors the rule
 * write-client's surface.
 */
export type { MutationEnvelope };
