/**
 * multi-selection — the one multi-selection model every workbench
 * tree and list shares (the sidebar trees, the Commit window's tree,
 * the log, the Push window's tree), the IDE tree contract over an
 * ordered list of visible row ids the consumer flattens:
 *
 *   - A plain click selects the row alone and makes it the anchor.
 *   - Cmd/Ctrl+click toggles one row and makes it the anchor.
 *   - Shift+click selects the run of visible rows between the anchor
 *     and the clicked row — every depth, folders and leaves alike —
 *     on top of the selection the anchor was made with; the anchor
 *     stays, so a second Shift+click re-ranges from the same row
 *     rather than from the last one clicked. A plain click anchors on
 *     an empty base, so a Shift+click after it is a pure range; a
 *     toggled click anchors on the toggled set, so a Shift+click after
 *     it adds the range to it.
 *   - The lead is the keyboard cursor — the last row clicked or
 *     stepped to; a plain step collapses the selection onto the row,
 *     a Shift+step extends the range from the anchor.
 *   - A right-click inside the selection keeps it; outside, the row
 *     becomes the only selection.
 *
 * Two layers: the primitives (`toggleId`, `rangeIds`) for a consumer
 * that keeps its own cursor and anchor, and the `MultiSelection` state
 * with its transitions for one that takes the whole model. What a row
 * is selectable FOR is the consumer's call — it leaves non-rows out of
 * the order it hands in. Pure shaping; no React.
 */

export interface SelectionAnchor {
  id: string;
  /** The selection as it stood when the anchor was set — what a range grows on top of. */
  base: ReadonlySet<string>;
}

export interface MultiSelection {
  /** Every selected id. */
  ids: ReadonlySet<string>;
  /** The range anchor — the last plain or toggled click, with the selection it was set on. */
  anchor: SelectionAnchor | null;
  /** The keyboard cursor — the last row clicked or stepped to. */
  lead: string | null;
}

export interface SelectModifiers {
  /** Cmd on a Mac, Ctrl elsewhere — toggle the row. */
  toggle: boolean;
  /** Shift — the range from the anchor. */
  range: boolean;
}

export const EMPTY_SELECTION: MultiSelection = { ids: new Set(), anchor: null, lead: null };

const EMPTY_BASE: ReadonlySet<string> = new Set();

/** The modifiers a pointer event carries, in the selection's vocabulary. */
export function clickModifiers(event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): SelectModifiers {
  return { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey };
}

/** The set with `id` flipped in or out; the input is never mutated. */
export function toggleId(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * The anchor's base plus every id between the anchor and `id` in
 * `order`, inclusive, either direction; an anchor no longer in the
 * order picks `id` alone on top of the base.
 */
export function rangeIds(order: readonly string[], anchor: SelectionAnchor, id: string): Set<string> {
  const a = order.indexOf(anchor.id);
  const b = order.indexOf(id);
  const next = new Set(anchor.base);
  if (a < 0 || b < 0) {
    next.add(id);
    return next;
  }
  const [from, to] = a <= b ? [a, b] : [b, a];
  for (let i = from; i <= to; i++) next.add(order[i]);
  return next;
}

/** The selection of `id` alone, anchored there on an empty base. */
export function selectOnly(id: string): MultiSelection {
  return { ids: new Set([id]), anchor: { id, base: EMPTY_BASE }, lead: id };
}

/** The anchor a range grows from — the set one, else the cursor, else the row itself on the current selection. */
function rangeAnchor(selection: MultiSelection, id: string): SelectionAnchor {
  if (selection.anchor !== null) return selection.anchor;
  return { id: selection.lead ?? id, base: selection.ids };
}

/** The selection after a click on `id` with the modifiers held. */
export function selectOnClick(
  selection: MultiSelection,
  order: readonly string[],
  id: string,
  modifiers: SelectModifiers,
): MultiSelection {
  if (modifiers.range) {
    const anchor = rangeAnchor(selection, id);
    return { ids: rangeIds(order, anchor, id), anchor, lead: id };
  }
  if (modifiers.toggle) {
    const ids = toggleId(selection.ids, id);
    return { ids, anchor: { id, base: ids }, lead: id };
  }
  return selectOnly(id);
}

/** The selection after the keyboard lands on `id` — Shift extends the range from the anchor. */
export function selectOnStep(
  selection: MultiSelection,
  order: readonly string[],
  id: string,
  extend: boolean,
): MultiSelection {
  if (!extend) return selectOnly(id);
  const anchor = rangeAnchor(selection, id);
  return { ids: rangeIds(order, anchor, id), anchor, lead: id };
}

/** The selection after a right-click on `id` — kept when the row is already in it. */
export function selectOnContextMenu(selection: MultiSelection, id: string): MultiSelection {
  return selection.ids.has(id) ? selection : selectOnly(id);
}

/**
 * The selection narrowed to the ids still in `order` — a collapse or a
 * refresh hides members; a hidden anchor is dropped (the next range
 * grows from the lead), a hidden lead falls back to the first
 * survivor. The same object comes back when nothing changed.
 */
export function pruneSelection(selection: MultiSelection, order: readonly string[]): MultiSelection {
  const visible = new Set(order);
  let dropped = false;
  const ids = new Set<string>();
  for (const id of selection.ids) {
    if (visible.has(id)) ids.add(id);
    else dropped = true;
  }
  const anchorKept = selection.anchor === null || visible.has(selection.anchor.id);
  const leadKept = selection.lead === null || visible.has(selection.lead);
  if (!dropped && anchorKept && leadKept) return selection;
  const first = ids.values().next();
  const fallback = first.done ? null : first.value;
  return {
    ids,
    anchor: anchorKept ? selection.anchor : null,
    lead: leadKept ? selection.lead : fallback,
  };
}
