/**
 * Shared geometry of the settings-row family — one control width for
 * every field control (selects, combo knobs, text inputs) so the
 * control column keeps a straight left edge; only the intrinsically-
 * sized switches sit outside it.
 */

export const CONTROL_WIDTH = 220;

/** Horizontal inset that lines a below-row line up with the control
 *  column's right edge: the row gap (6) plus the reset slot (20). */
export const CONTROL_RIGHT_INSET = 26;

/** Left inset of rows that depend on the knob above them — the
 *  settings pages' one-level indent. */
export const DEPENDENT_ROWS_INDENT = 16;
