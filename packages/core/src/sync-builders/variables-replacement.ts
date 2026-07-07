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
 * per-scope write client supplies its own `entityType` + `varsPath`;
 * the resolver-invalidation side effects are single-sourced from the
 * minted batch through {@link deriveSideEffectsForEnvelope} — the same
 * function the inbound bridge runs — so mint-side equals receive-side.
 *
 * Singleton scopes (workspace-vars, vault) intentionally don't fold in:
 * their `id` is a fixed constant. Their replacement helpers stay
 * parallel until a third singleton justifies a shared variant.
 */

import {
  deriveSideEffectsForEnvelope,
  keyBetween,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
  seedKey,
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
}

export interface VariablesReplacementInput {
  entityUid: string;
  newVars: readonly VariableLike[];
  oldVars: readonly VariableLike[];
  /**
   * Current persisted per-uid fractional-index order keys, read from the
   * entity's sync mirror. The builder reuses them to keep unmoved rows
   * byte-stable across saves and preserves row ORDER as `orderKey`s
   * (§23.5) so the set materializes back in editor order — not uid-sorted.
   * Omitted (empty) → every survivor gets a freshly minted key.
   */
  currentKeys?: ReadonlyMap<string, string>;
}

/**
 * Build the `(MutationBatch, SideEffectIntent[])` pair that converges
 * the entity's variables list to `newVars`. Identity = `variable.uid`.
 * Returns `null` when the input has no semantic diff (no envelopes to
 * fire).
 *
 * Row order persists as fractional-index `orderKey`s. Each surviving row's
 * key is assigned LSEQ-style: reuse the row's current key while it keeps
 * the running order monotonic, and mint a fresh `keyBetween` only where the
 * order breaks (a moved row) or a row is new. A row unchanged in both
 * content AND position emits nothing — so a plain value edit re-keys
 * nothing and a pure content save no longer trips the order-sensitive
 * dirty check. Same discipline as `applyEnvVariablesReplacement`.
 */
export function buildVariablesReplacement(
  bindings: VariablesReplacementBindings,
  ctx: MutatorContext,
  input: VariablesReplacementInput,
): { batch: MutationBatch; sideEffects: SideEffectIntent[] } | null {
  const { entityType, varsPath } = bindings;
  const { entityUid, newVars, oldVars } = input;
  const currentKeys = input.currentKeys ?? new Map<string, string>();

  const oldByUid = new Map<string, VariableLike>();
  for (const v of oldVars) oldByUid.set(v.uid, v);

  const survivors = newVars.filter((v) => v.name.trim());
  const newUids = new Set(survivors.map((v) => v.uid));

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

  const bodies: MutationBody[] = [];
  for (const [uid] of oldByUid) {
    if (newUids.has(uid)) continue;
    bodies.push({
      kind: 'removeFromSet',
      type: entityType,
      id: entityUid,
      path: varsPath,
      itemId: uid,
    });
  }
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
      type: entityType,
      id: entityUid,
      path: varsPath,
      itemId: variable.uid,
      item: { uid: variable.uid, name: variable.name, value: variable.value, type: variable.type ?? 'default' },
      orderKey: key,
    });
  }

  if (bodies.length === 0) return null;

  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}
