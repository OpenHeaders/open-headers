/**
 * Live-variable mutator catalog — routing constant.
 *
 * A LiveVariable is a thin namespace projection — `(name, workflowUid,
 * stepId, captureName)` exposes one workflow-step capture as the
 * workspace-wide `{{live.<name>}}` key. The entity is flat-scalar; no
 * set-modeled paths. `manualOverride` is a small object stored as a
 * whole-object scalar (last-writer-wins on the override record) — the
 * editor surfaces "set override" / "clear override" as one gesture, so
 * per-field LWW within the override would only trade simplicity for
 * surface area no consumer asks for.
 *
 * Side-effects: every mutation emits an `INVALIDATE_RESOLVER` intent
 * keyed by the LV uid. Toggling `enabled`, swapping the binding (any
 * of `workflowUid` / `stepId` / `captureName`), or flipping the
 * manual override changes the resolved value of `{{live.<name>}}`, so
 * the resolver-invalidate runner widens to include this entity type.
 *
 * Cascade: deleting a Live Workflow does NOT cascade-delete the LVs
 * bound to it. Orphaned LVs surface `workflow-not-found` resolution
 * errors at resolve time so the user sees the broken binding and can
 * rebind rather than silently losing the namespace entry.
 */

/** Routing key carried on every live-variable mutation envelope. */
export const LIVE_VARIABLE_ENTITY_TYPE = 'live-variable';
