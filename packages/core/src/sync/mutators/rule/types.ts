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
 * `RULE_ENTITY_TYPE` is the routing key carried on every Rule mutation
 * envelope; the matching constant for environment lives at
 * `mutators/environment/types.ts`. The factory context shape and
 * return shape live in the parent `mutators/types.ts` since they're
 * identical across entity types (Phase B collapse).
 */

/** Routing key carried on every rule mutation envelope. */
export const RULE_ENTITY_TYPE = 'rule';
