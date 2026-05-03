/**
 * Entity-agnostic conflict-tracking primitives.
 *
 * Per-entity hooks (e.g. `useRuleConflicts`) project their entity into
 * a `Record<path, string>` baseline + lookup live "theirs" by the same
 * paths. The shapes here are what the editor-side UI consumes — chips,
 * banner, dialog. Adding a new entity is a per-entity tracker hook +
 * wiring; no infrastructure change in this folder.
 */

import type { SurfaceKind } from '@openheaders/core/protocol';

export interface ConflictRemoteInfo {
  /** Surface kind. Drives the colored dot + canonical short label
   *  ("Workbench" / "Popup" / "DevTools panel" / "Side panel"). */
  surfaceKind: SurfaceKind;
  /** The peer's free-form label (typically its tab title). Verbose
   *  by design — kept for tooltips + the chip's compact subtitle. */
  surfaceLabel: string;
  /** Stable identity used to detect "all rows came from the same
   *  peer" for the dialog's top-of-banner attribution. */
  instanceId: string;
  /** Milliseconds since the peer's last awareness activity. */
  agoMs: number;
}

/**
 * Conflict shape:
 *   - 'leaf'         — scalar field disagrees (the dominant case).
 *   - 'set-add'      — saved version added an item that mine doesn't have.
 *                      `theirs` is a human-summary of the added row;
 *                      `rowPayload` carries the row object for re-insert.
 *   - 'set-remove'   — saved version removed an item that mine still has.
 *                      `base` is the row's last-seen summary; `theirs`
 *                      is empty (gone). `rowPayload` is the local row
 *                      object so the form can preserve / re-add it.
 *   - 'set-reorder'  — same membership on both sides, different order.
 *                      `base`/`theirs` carry compact order summaries;
 *                      `rowPayload` carries the saved-side ordered uid
 *                      array so the resolver can re-sort the form.
 */
export type PathConflictKind = 'leaf' | 'set-add' | 'set-remove' | 'set-reorder';

export interface PathConflict {
  /** Defaults to 'leaf' when omitted (back-compat). */
  kind?: PathConflictKind;
  /** Value the form was last seeded with. */
  base: string;
  /** Value most recently committed by another surface. */
  theirs: string;
  /** Optional attribution. Populated only when a peer surface is still
   *  focused on the same path so awareness can attribute it. */
  remote?: ConflictRemoteInfo;
  /** For set-level conflicts: the row object the resolver needs to
   *  insert / preserve. Opaque to the dialog. */
  rowPayload?: unknown;
}

/** Bridge handed to per-field renderers so they can call into a tracker. */
export interface ConflictBridge {
  getConflict: (path: string, localValue: string) => PathConflict | null;
  onAcceptTheirs: (path: string, theirs: string) => void;
  onDismissConflict: (path: string) => void;
}
