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
  type MutationBatch,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { synthesizeSetDiff, toLiveSetEntries } from './set-diff';

export type VariableType = 'default' | 'secret';

export interface VariableLike {
  uid: string;
  name: string;
  value: string;
  type?: VariableType;
  /** Absent means enabled; only `false` is ever persisted. */
  enabled?: boolean;
}

export interface VariablesReplacementBindings {
  entityType: string;
  varsPath: string;
}

/**
 * Canonical persisted row shape. Normalizes both diff sides so a `type`
 * that round-trips as undefined vs 'default' (or an `enabled` that
 * round-trips as undefined vs true) doesn't read as a content edit.
 * `enabled` only persists as `false` — a truthy flag is stripped so
 * untouched rows stay byte-stable. Shared with the env / workspace-vars
 * replacement write clients, which run the same set diff directly.
 */
export function normalizeVariableRow(v: VariableLike): VariableLike {
  return {
    uid: v.uid,
    name: v.name,
    value: v.value,
    type: v.type ?? 'default',
    ...(v.enabled === false ? { enabled: false } : {}),
  };
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
 * The diff itself is {@link synthesizeSetDiff} — the same LIS-optimal
 * synthesizer the rule / request / template set paths use. Vanished uids
 * → `removeFromSet`; new + content-changed uids → `addToSet` with an
 * `orderKey`; pure position changes → a minimal set of `moveBefore`
 * envelopes. A row unchanged in both content AND position emits nothing,
 * and materialized key order always converges to the editor's row order.
 */
export function buildVariablesReplacement(
  bindings: VariablesReplacementBindings,
  ctx: MutatorContext,
  input: VariablesReplacementInput,
): { batch: MutationBatch; sideEffects: SideEffectIntent[] } | null {
  const { entityType, varsPath } = bindings;
  const { entityUid, newVars, oldVars } = input;
  const currentKeys = input.currentKeys ?? new Map<string, string>();

  const survivors = newVars.filter((v) => v.name.trim()).map(normalizeVariableRow);

  const bodies = synthesizeSetDiff({
    type: entityType,
    id: entityUid,
    path: varsPath,
    live: toLiveSetEntries(oldVars.map(normalizeVariableRow), currentKeys),
    newItems: survivors,
  });
  if (bodies.length === 0) return null;

  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}
