/**
 * Rule mutator catalog — high-level intent factories.
 *
 * UI surfaces (workbench editor, popup, devpanel inline edits, sidebar
 * bulk actions) call these factories. The factories translate user
 * intent into a {@link MutationBatch} of generic mutations plus the
 * {@link SideEffectIntent}s the local oracle should enqueue once the
 * batch commits. Factories never touch the document store directly —
 * they're pure transforms over their context + arguments.
 *
 * Two consequences fall out:
 *   1. Tests can construct intents without bringing up an oracle.
 *   2. The same factory is called in the popup and the workbench;
 *      apply-side semantics are decided once at the oracle, not at
 *      every callsite.
 *
 * `RULE_ENTITY_TYPE` is the only place a string literal for the rule
 * routing key lives in `core/sync`. Other entities will register
 * their own constants in Phase B.
 */

import type { MutationBatch } from '../../envelope';
import type { HLC } from '../../hlc';
import type { SideEffectIntent } from '../types';

/** Routing key carried on every rule mutation envelope. */
export const RULE_ENTITY_TYPE = 'rule';

/**
 * Per-batch context the local oracle stamps onto every envelope a
 * factory mints. Surfaces fill these in once and pass through.
 */
export interface RuleMutatorContext {
  workspaceId: string;
  hlc: HLC;
  surfaceId: string;
  deviceId: string;
  /**
   * Optional: when supplied, all envelopes in the resulting batch
   * share this batchId. Otherwise a fresh one is minted per factory
   * call. UI gestures that emit multiple intents in one tick (e.g.
   * "delete header mod" → remove + recompile) should pass an explicit
   * batchId so the oracle treats them all-or-nothing.
   */
  batchId?: string;
  userId?: string;
}

export interface RuleIntent {
  batch: MutationBatch;
  /**
   * Side-effect intents to enqueue once the batch commits. The oracle
   * coalesces by `(kind, key)` — latest HLC wins (§18.1).
   */
  sideEffects: SideEffectIntent[];
}
