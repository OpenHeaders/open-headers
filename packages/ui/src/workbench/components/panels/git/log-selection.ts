/**
 * log-selection — the commit lists' reading of the shared selection
 * model (the log's timeline and the Push window's commits): which
 * commit the details pane follows after a gesture, and where the
 * keyboard lands. A click decides synchronously over the pure model so
 * the orchestrator learns the details commit in the same tick as the
 * rows — the clicked commit while it stays selected (a plain click, a
 * range, a toggle in), else the first commit still selected (a toggle
 * out), else none. Pure shaping; no React.
 */

import { type MultiSelection, type SelectModifiers, selectOnClick } from '@openheaders/ui/shared/selection';

export interface CommitClickOutcome {
  /** The selection after the click — what the hook will hold. */
  next: MultiSelection;
  /** The commit the details pane follows; null when nothing stays selected. */
  lead: string | null;
}

/** The selection and the details commit after a click on `sha` with the modifiers held. */
export function commitClickOutcome(
  selection: MultiSelection,
  order: readonly string[],
  sha: string,
  modifiers: SelectModifiers,
): CommitClickOutcome {
  const next = selectOnClick(selection, order, sha, modifiers);
  if (next.ids.has(sha)) return { next, lead: sha };
  const first = next.ids.values().next();
  return { next, lead: first.done ? null : first.value };
}

/**
 * The row an arrow lands on: one step from the cursor, clamped to the
 * list's ends; the first row when there is no cursor or it left the
 * list; null on an empty list.
 */
export function stepTarget(order: readonly string[], lead: string | null, delta: 1 | -1): string | null {
  if (order.length === 0) return null;
  const index = lead === null ? -1 : order.indexOf(lead);
  if (index === -1) return order[0];
  return order[Math.min(order.length - 1, Math.max(0, index + delta))];
}
