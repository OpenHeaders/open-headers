/**
 * Undo/redo history for the contentEditable TemplateInput. The
 * component re-renders `innerHTML` on every keystroke to re-highlight
 * `{{ref}}` spans — that rewrite destroys the browser's native undo
 * stack, so the field keeps its own: flat (text, caret) snapshots,
 * consecutive typing coalesced into one entry, boundaries (paste,
 * suggestion insert, newline, external value swap) always standalone.
 *
 * Pure factory (no React) so the coalescing rules are unit-testable
 * with an injected clock; the input hook holds one instance in a ref.
 */

export interface EditableHistoryEntry {
  text: string;
  caret: number;
}

export interface EditableHistory {
  /** Snapshot the state after a change. Plain typing within the
   *  coalescing window folds into the previous entry so one undo
   *  reverts the whole burst; `boundary` records force a new entry. */
  record(text: string, caret: number, opts?: { boundary?: boolean }): void;
  /** Step back; null at the oldest entry. */
  undo(): EditableHistoryEntry | null;
  /** Step forward; null at the newest entry. */
  redo(): EditableHistoryEntry | null;
}

const COALESCE_MS = 500;
const MAX_ENTRIES = 200;

export function createEditableHistory(initial: string, now: () => number = Date.now): EditableHistory {
  const stack: EditableHistoryEntry[] = [{ text: initial, caret: initial.length }];
  let index = 0;
  let lastRecordAt = 0;
  let lastWasBoundary = true;

  return {
    record(text, caret, opts) {
      const top = stack[index];
      if (top.text === text) {
        // Caret-only movement — keep the entry, refresh its caret so an
        // undo that lands here restores where the user last was.
        if (caret >= 0) top.caret = caret;
        return;
      }
      const at = now();
      const boundary = opts?.boundary ?? false;
      const coalesce =
        !boundary && !lastWasBoundary && index > 0 && index === stack.length - 1 && at - lastRecordAt < COALESCE_MS;
      if (coalesce) {
        stack[index] = { text, caret };
      } else {
        stack.length = index + 1; // any redo tail dies on a new edit
        stack.push({ text, caret });
        if (stack.length > MAX_ENTRIES) stack.shift();
        index = stack.length - 1;
      }
      lastRecordAt = at;
      lastWasBoundary = boundary;
    },
    undo() {
      if (index === 0) return null;
      index--;
      lastWasBoundary = true; // the next edit starts a fresh entry
      return stack[index];
    },
    redo() {
      if (index >= stack.length - 1) return null;
      index++;
      lastWasBoundary = true;
      return stack[index];
    },
  };
}
