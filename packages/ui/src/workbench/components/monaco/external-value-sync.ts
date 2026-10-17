/**
 * external-value-sync — brings a mounted Monaco buffer up to a new
 * `value` prop without disturbing the caret.
 *
 * The React wrapper's own value sync replaces the WHOLE buffer with
 * one full-range edit and lets Monaco park the caret at the end of
 * it, so any host-side write of the editor's value while the user is
 * typing — a prop that trails the model by a render, a normalized
 * round-trip, a sync echo — throws the caret to the end of the
 * document mid-keystroke (the macOS MQTT payload report). This module
 * owns that sync instead: it computes the ONE span that actually
 * changed, replaces only that, and hands Monaco the user's selections
 * carried across the edit, so a caret outside the span never moves
 * and the undo stack records exactly the change that happened.
 *
 * Read-only buffers take the plain `setValue` — a viewer's content is
 * a new document, not an edit, and there is no caret to keep.
 */

import type * as monaco from 'monaco-editor';

/** A single replacement, as offsets into the text BEFORE the edit. */
export interface TextSpanEdit {
  start: number;
  end: number;
  text: string;
}

/**
 * The smallest single span whose replacement turns `before` into
 * `after` — the common prefix and suffix stay untouched. `null` when
 * the texts already agree.
 */
export function minimalTextEdit(before: string, after: string): TextSpanEdit | null {
  if (before === after) return null;
  const maxPrefix = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < maxPrefix && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix++;
  const maxSuffix = maxPrefix - prefix;
  let suffix = 0;
  while (
    suffix < maxSuffix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }
  return {
    start: prefix,
    end: before.length - suffix,
    text: after.slice(prefix, after.length - suffix),
  };
}

/**
 * Where an offset of the old text lands after `edit`: untouched before
 * the span, shifted by the span's growth after it, and kept at its
 * relative place inside the span (clamped to the inserted text).
 */
export function shiftOffsetAcrossEdit(offset: number, edit: TextSpanEdit): number {
  if (offset <= edit.start) return offset;
  if (offset >= edit.end) return offset + edit.text.length - (edit.end - edit.start);
  return edit.start + Math.min(offset - edit.start, edit.text.length);
}

/** The editor surface the sync drives — the standalone editor
 *  satisfies it; tests hand in a fake. */
export type ExternalValueEditor = Pick<
  monaco.editor.IStandaloneCodeEditor,
  'getModel' | 'getSelections' | 'executeEdits' | 'pushUndoStop' | 'setValue'
>;

/** The Monaco namespace slice the sync needs — the selection class. */
export interface ExternalValueMonaco {
  Selection: typeof monaco.Selection;
}

/**
 * Apply `value` to the editor if the buffer differs. Returns whether an
 * edit was made, so the host can tell its own echo from a user edit.
 */
export function applyExternalValue(
  editor: ExternalValueEditor,
  monacoApi: ExternalValueMonaco,
  value: string,
  readOnly: boolean,
): boolean {
  const model = editor.getModel();
  if (!model) return false;
  const before = model.getValue();
  const edit = minimalTextEdit(before, value);
  if (edit === null) return false;
  if (readOnly) {
    editor.setValue(value);
    return true;
  }
  const selections = editor.getSelections() ?? [];
  const carried = selections.map((selection) => ({
    anchor: shiftOffsetAcrossEdit(
      model.getOffsetAt({ lineNumber: selection.selectionStartLineNumber, column: selection.selectionStartColumn }),
      edit,
    ),
    active: shiftOffsetAcrossEdit(
      model.getOffsetAt({ lineNumber: selection.positionLineNumber, column: selection.positionColumn }),
      edit,
    ),
  }));
  const range = rangeOfEdit(model, edit);
  editor.executeEdits('external-value-sync', [{ range, text: edit.text, forceMoveMarkers: true }], () =>
    carried.map(({ anchor, active }) => {
      const a = model.getPositionAt(anchor);
      const p = model.getPositionAt(active);
      return new monacoApi.Selection(a.lineNumber, a.column, p.lineNumber, p.column);
    }),
  );
  editor.pushUndoStop();
  return true;
}

function rangeOfEdit(model: monaco.editor.ITextModel, edit: TextSpanEdit): monaco.IRange {
  const start = model.getPositionAt(edit.start);
  const end = model.getPositionAt(edit.end);
  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}
