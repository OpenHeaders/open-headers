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
 * them into the catalog primitives — the diff is `setEnvVar` for
 * adds/changes and `removeEnvVar` for deletions, all bundled under
 * one `batchId` so the oracle's per-batch all-or-nothing kicks in.
 *
 * In-place renames (the user changed a row's `name` field) read as
 * `delete old + add new` from a list-replacement standpoint — that's
 * the correct convergent answer (§7.2). The dedicated `renameEnvVar`
 * factory is reachable via `applyEnvRenameVar` for the few surfaces
 * that have explicit "rename" intent (e.g. inline rename gestures).
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
  type VariableType,
} from '@openheaders/core/sync';
import {
  createEnvSyncMirror,
  type EnvSyncMirror,
  getActiveEnvSyncMirror,
} from '@/context/env-sync-mirror';
import {
  buildRemoveEnvVarBatch,
  buildRenameEnvironmentBatch,
  buildRenameEnvVarBatch,
  buildSetEnvVarBatch,
  buildSetEnvVarTypeBatch,
} from '@/shared/sync/env-mutations';

// `createEnvSyncMirror` is re-exported so tests can construct a mirror
// without going through the singleton.
export { createEnvSyncMirror } from '@/context/env-sync-mirror';

export type EnvSimpleResult = SyncSimpleResult;

export interface EnvWriteOptions extends BaseSyncWriteOptions {
  mirror?: EnvSyncMirror;
}

function resolveMirror(opts: EnvWriteOptions): EnvSyncMirror {
  return opts.mirror ?? getActiveEnvSyncMirror();
}

export interface ApplyEnvSetVarInput {
  envId: string;
  name: string;
  value: string;
  type?: VariableType;
}

export async function applyEnvSetVar(input: ApplyEnvSetVarInput, opts: EnvWriteOptions): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetEnvVarBatch(input, ctx));
}

export interface ApplyEnvRemoveVarInput {
  envId: string;
  name: string;
}

export async function applyEnvRemoveVar(
  input: ApplyEnvRemoveVarInput,
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRemoveEnvVarBatch(input, ctx));
}

export interface ApplyEnvRenameVarInput {
  envId: string;
  oldName: string;
  newName: string;
  value: string;
  type?: VariableType;
}

export async function applyEnvRenameVar(
  input: ApplyEnvRenameVarInput,
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildRenameEnvVarBatch(input, ctx));
}

export interface ApplyEnvSetVarTypeInput {
  envId: string;
  name: string;
  value: string;
  type: VariableType;
}

export async function applyEnvSetVarType(
  input: ApplyEnvSetVarTypeInput,
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(buildSetEnvVarTypeBatch(input, ctx));
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
 * Editor convenience: persist a complete variables list. The caller
 * is responsible for passing the editor's pre-image (`oldVars`) so
 * the helper can compute the diff. Adds + value/type changes emit
 * `setEnvVar`; deletions emit `removeEnvVar`. Empty input → empty
 * batch (no broadcast, no recompile) — the catalog short-circuits the
 * `setEnvVar/removeEnvVar` factory calls before they reach this
 * function via the same-name fast-path.
 */
export async function applyEnvVariablesReplacement(
  envId: string,
  newVars: readonly V5.Variable[],
  oldVars: readonly V5.Variable[],
  opts: EnvWriteOptions,
): Promise<EnvSimpleResult> {
  const oldByName = new Map<string, V5.Variable>();
  for (const v of oldVars) oldByName.set(v.name, v);
  const newByName = new Map<string, V5.Variable>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByName.set(v.name, v);
  }

  const ctx = resolveRendererContext(opts).next({ batchId: opts.batchId ?? `env-replace-${envId}` });

  const bodies: MutationBody[] = [];
  // Removals: anything in old but not in new.
  for (const [name] of oldByName) {
    if (newByName.has(name)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: envId,
      path: ENV_VARS_PATH,
      itemId: name,
    });
  }
  // Adds + value/type changes: replace via addToSet (per-itemId LWW).
  for (const [name, variable] of newByName) {
    const prev = oldByName.get(name);
    if (
      prev &&
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
      itemId: name,
      item: { name, value: variable.value, type: variable.type ?? 'default' },
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
