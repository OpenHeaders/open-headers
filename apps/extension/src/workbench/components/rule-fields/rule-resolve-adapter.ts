/**
 * `ConflictResolveAdapter<V5.Rule>` — re-export of the shared
 * action-entity factory's resolve adapter for Rule. Composition lives
 * in `rule-conflict-adapter.ts`; both adapters share one `accessors`
 * object so the per-entity binding stays in one file.
 */

export { ruleResolveAdapterShared as ruleResolveAdapter } from './rule-conflict-adapter';
