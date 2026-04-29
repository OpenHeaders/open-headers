/**
 * Layout-state mutator catalog — routing constants.
 *
 * Singleton entity per workspace. Holds the renderer's persisted panel
 * layout (sidebar / inspector / bottom ratios + opaque tool-window
 * dock state). The shape is opaque at the engine boundary — the
 * renderer's `useResponsiveLayout` / `useDockLayoutStorage` hooks own
 * the geometry; the engine just LWW's the whole blob.
 *
 * The whole-object scalar posture matches the live-workflow `steps` and
 * `refresh` choices: every layout edit replaces the full object, so
 * per-leaf LWW would only invent collisions that don't exist in the
 * editor's gesture surface.
 *
 * Not sensitive — layout is pure UX state, not secrets.
 * No side effects — layout doesn't shape DNR or variable resolution.
 */

/** Routing key carried on every layout-state mutation envelope. */
export const LAYOUT_STATE_ENTITY_TYPE = 'layout-state';

/** Fixed singleton id — every workspace has exactly one of these. */
export const LAYOUT_STATE_ID = 'layout-state';

/** Field path holding the opaque layout blob on the singleton. */
export const LAYOUT_STATE_PATH = 'layout';
