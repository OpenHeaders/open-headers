/**
 * Shared variables-replacement diff helper.
 *
 * Editor convenience: persist a complete variables list. Identity is
 * `variable.uid` — the diff finds same-uid pairs to detect edits
 * (rename / value / type all on the same uid), uid-only-in-old to
 * detect deletions, and uid-only-in-new to detect adds. Empty diff →
 * null (caller short-circuits to `{ ok: true }` without firing).
 *
 * Lives at the renderer-side write-client tier because the diff math
 * (compare pre-image to post-image, fold into per-uid primitives,
 * bundle under one batchId) is identical across every per-uid variable
 * scope (rule-collection, request-collection, template-collection). The
 * per-scope write client wraps this helper with its own `entityType`,
 * `varsPath`, side-effect intent factory, and `mintBatch`.
 *
 * Singleton scopes (workspace-vars, vault) intentionally don't fold in:
 * their `id` is a fixed constant and their side-effect intent doesn't
 * take a key. Their replacement helpers stay parallel until a third
 * singleton justifies a shared variant.
 */

import type { HLC } from '@openheaders/core/sync';
import {
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  type SideEffectIntent,
} from '@openheaders/core/sync';

export type VariableType = 'default' | 'secret';

export interface VariableLike {
  uid: string;
  name: string;
  value: string;
  type?: VariableType;
}

export interface VariablesReplacementBindings {
  entityType: string;
  varsPath: string;
  /** Side effect to fire alongside the replacement batch (resolver
   *  invalidation). Returns `[]` to skip. */
  makeSideEffects: (entityUid: string, hlc: HLC) => SideEffectIntent[];
}

export interface VariablesReplacementInput {
  entityUid: string;
  newVars: readonly VariableLike[];
  oldVars: readonly VariableLike[];
}

/**
 * Build the `(MutationBatch, SideEffectIntent[])` pair that converges
 * the entity's variables list to `newVars`. Identity = `variable.uid`.
 * Returns `null` when the input has no semantic diff (no envelopes to
 * fire).
 */
export function buildVariablesReplacement(
  bindings: VariablesReplacementBindings,
  ctx: MutatorContext,
  input: VariablesReplacementInput,
): { batch: MutationBatch; sideEffects: SideEffectIntent[] } | null {
  const { entityType, varsPath, makeSideEffects } = bindings;
  const { entityUid, newVars, oldVars } = input;

  const oldByUid = new Map<string, VariableLike>();
  for (const v of oldVars) oldByUid.set(v.uid, v);

  const newByUid = new Map<string, VariableLike>();
  for (const v of newVars) {
    if (!v.name.trim()) continue;
    newByUid.set(v.uid, v);
  }

  const bodies: MutationBody[] = [];
  for (const [uid] of oldByUid) {
    if (newByUid.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: entityType,
      id: entityUid,
      path: varsPath,
      itemId: uid,
    });
  }
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
      type: entityType,
      id: entityUid,
      path: varsPath,
      itemId: uid,
      item: { uid, name: variable.name, value: variable.value, type: variable.type ?? 'default' },
    });
  }

  if (bodies.length === 0) return null;

  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: makeSideEffects(entityUid, ctx.hlc),
  };
}
