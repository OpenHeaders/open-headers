/**
 * The undo history of a draft (the workflow runs plan, Decisions log,
 * S31): what the draft was before each edit, what it is, and what an
 * undo took back. Pure — each entry is a whole draft, so an undo back to
 * the saved state reads as saved with no flag to clear.
 */

export interface DraftHistory<T> {
  /** What the draft was before each kept edit, the oldest first. */
  past: readonly T[];
  present: T;
  /** What undo took back, the next redo first. */
  future: readonly T[];
}

/** How many edits a history keeps; the oldest goes first. */
export const DRAFT_HISTORY_LIMIT = 100;

export function historyOf<T>(present: T): DraftHistory<T> {
  return { past: [], present, future: [] };
}

/** An edit as an entry of its own. What undo had taken back is gone. */
export function pushEdit<T>(history: DraftHistory<T>, next: T, limit: number = DRAFT_HISTORY_LIMIT): DraftHistory<T> {
  if (next === history.present) return history;
  const past = [...history.past, history.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next, future: [] };
}

/** An edit that continues the last one — typing in one field. The entry it belongs to stays the one an undo takes back. */
export function amendEdit<T>(history: DraftHistory<T>, next: T): DraftHistory<T> {
  if (next === history.present) return history;
  return { past: history.past, present: next, future: [] };
}

/**
 * Every entry rewritten, none added — for what is read after the draft
 * is held and belongs to each of them. No undo takes it back.
 */
export function restateEntries<T>(history: DraftHistory<T>, restate: (entry: T) => T): DraftHistory<T> {
  return {
    past: history.past.map(restate),
    present: restate(history.present),
    future: history.future.map(restate),
  };
}

export function undoEdit<T>(history: DraftHistory<T>): DraftHistory<T> {
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redoEdit<T>(history: DraftHistory<T>): DraftHistory<T> {
  if (history.future.length === 0) return history;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
  };
}
