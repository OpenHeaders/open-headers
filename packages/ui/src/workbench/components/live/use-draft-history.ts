/**
 * An editor's draft with its undo history (the workflow runs plan,
 * Decisions log, S31) — one history a mounted editor, so one a tab.
 *
 * Two doors write the draft. `edit` is the user's: each call is an entry
 * an undo takes back, and typing in one field runs together into one
 * entry until a pause. `replace` is everything else — the draft read
 * again from what is saved, a teammate's change taken — and empties the
 * history, since its entries are whole drafts from before the change. A
 * replace that hands back the draft it was given changes nothing: a
 * save's echo keeps the history.
 */

import { isMac } from '@openheaders/ui/shared/platform';
import { useCallback, useMemo, useRef, useState } from 'react';
import { amendEdit, historyOf, pushEdit, redoEdit, restateEntries, undoEdit } from './draft-history';

/** How long typing in one field may rest and still be one entry. */
const TYPING_PAUSE_MS = 600;

export const UNDO_CHORD = 'mod+z';
/** Every chord that redoes — the platform's own, and the other platforms' habits. */
export const REDO_CHORDS: readonly string[] = ['mod+shift+z', 'mod+y'];
/** The redo chord a hint names on this platform. */
export const REDO_HINT_CHORD = isMac ? 'mod+shift+z' : 'mod+y';

const NOT_TYPED_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * Whether an element takes typed text — where a field's own undo acts,
 * and where one edit after another is one run of typing. A picker's
 * read-only input takes none.
 */
export function isTextEntry(el: Element | null): boolean {
  if (el === null) return false;
  if (el instanceof HTMLInputElement) return !el.readOnly && !el.disabled && !NOT_TYPED_INPUT_TYPES.has(el.type);
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  // A code editor may hold focus on a plain element of its own.
  return el.closest('.monaco-editor') !== null;
}

export interface DraftHistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export interface DraftWithHistory<T> {
  draft: T;
  /** A user's edit: an entry of the history. */
  edit: (next: T) => void;
  /** The draft replaced from outside the user's edits: the history is emptied, unless the draft comes back as it was. */
  replace: (update: (current: T) => T) => void;
  /** Every entry rewritten, the history kept: what is read late belongs to all of them, and is no edit. */
  restate: (update: (entry: T) => T) => void;
  history: DraftHistoryControls;
}

export function useDraftHistory<T>(initial: () => T): DraftWithHistory<T> {
  const [state, setState] = useState(() => historyOf(initial()));
  // The field the last edit was typed in, and when — what the next edit continues.
  const typingRef = useRef<{ field: Element; at: number } | null>(null);

  const edit = useCallback((next: T) => {
    const field = isTextEntry(document.activeElement) ? document.activeElement : null;
    const at = Date.now();
    const last = typingRef.current;
    const continues = field !== null && last !== null && last.field === field && at - last.at < TYPING_PAUSE_MS;
    typingRef.current = field === null ? null : { field, at };
    setState((current) => (continues ? amendEdit(current, next) : pushEdit(current, next)));
  }, []);

  const replace = useCallback((update: (current: T) => T) => {
    typingRef.current = null;
    setState((current) => {
      const next = update(current.present);
      return next === current.present ? current : historyOf(next);
    });
  }, []);

  const restate = useCallback((update: (entry: T) => T) => {
    setState((current) => restateEntries(current, update));
  }, []);

  const undo = useCallback(() => {
    typingRef.current = null;
    setState(undoEdit);
  }, []);

  const redo = useCallback(() => {
    typingRef.current = null;
    setState(redoEdit);
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const history = useMemo(() => ({ canUndo, canRedo, undo, redo }), [canUndo, canRedo, undo, redo]);

  return { draft: state.present, edit, replace, restate, history };
}
