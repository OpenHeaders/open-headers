/**
 * Live-workflow mutator catalog — routing constant.
 *
 * A LiveWorkflow owns the ordered step list + refresh policy that
 * powers `{{live.X}}` refresh. The entity is mostly flat-scalar; the
 * one structural field is `steps`, treated here as a whole-array
 * scalar (last-writer-wins on the entire steps list).
 *
 * Why steps is a scalar, not a set:
 *   - Each step has a user-facing identifier (`id`), not a uid. Set
 *     membership keyed by step id would conflate a rename ("rename
 *     step from `auth` to `signin`") with a delete-then-create pair.
 *   - Step bodies (`captures`, `dependsOn`, `runIf`, `priorityFrom`)
 *     are themselves nested objects with branch-aware paths the
 *     catalog can't address generically.
 *   - The editor surface is the single producer today; it swaps the
 *     full array on save. Whole-array LWW is the v1 contract — same
 *     posture as template `formValues` / request `body`.
 *   - Per-step LWW lands as a Phase B+ wrinkle if multi-surface
 *     workflow editing emerges.
 *
 * Side-effects: every workflow mutation emits an `INVALIDATE_RESOLVER`
 * intent keyed by the workflow uid. Toggling `enabled`, swapping
 * `steps`, or changing `refresh` may all change the resolved value of
 * `{{live.X}}` for any LV bound to this workflow, so the resolver
 * re-reads after the broadcast lands.
 */

/** Routing key carried on every live-workflow mutation envelope. */
export const LIVE_WORKFLOW_ENTITY_TYPE = 'live-workflow';
