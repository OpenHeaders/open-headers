/**
 * The Monaco picker's string math, pure so the host adapter stays an
 * event plumber and these rules are tested on plain strings.
 *
 * A body editor opens on `{{` only: in JSON and code a lone `{` is
 * structure, and the line input's first-brace opening would pop the
 * list on every object. The insert consumes the `}}` Monaco's
 * auto-close already placed after the caret, so a pick replaces the
 * whole reference instead of leaving stray braces behind it.
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import type * as monaco from 'monaco-editor';
import { findExistingCloseEnd, PREFIX, SPLIT } from '../measure';

/** The `{{query` run that ends at the caret. No brace inside the
 *  query, so a closed `{{ref}}` stops matching once the caret passes
 *  its `}}`. */
const MEASURE_RX = /\{\{([^{}]*)$/;

export interface LineMeasure {
  /** 1-based column of the run's first `{`. */
  startColumn: number;
  /** The text between `{{` and the caret. */
  query: string;
}

/** The open `{{query` run before `column` (1-based) on `lineText`, or
 *  null when the caret is not composing a reference. */
export function measureLine(lineText: string, column: number): LineMeasure | null {
  const m = MEASURE_RX.exec(lineText.slice(0, column - 1));
  if (!m) return null;
  return { startColumn: m.index + 1, query: m[1] };
}

export interface InsertEdit {
  range: monaco.IRange;
  text: string;
  /** Where the caret lands: after `}}`, or after the dot of a scaffold
   *  so the list reopens narrowed to that scope. */
  caretColumn: number;
  scaffold: boolean;
}

/** The edit a pick writes: from the run's `{{` to the caret, plus any
 *  `}}` that already closes it, replaced by the whole reference. */
export function buildInsertEdit(
  lineText: string,
  lineNumber: number,
  startColumn: number,
  caretColumn: number,
  suggestion: VariableSuggestion,
): InsertEdit {
  const endOffset = findExistingCloseEnd(lineText, caretColumn - 1);
  const text = `${PREFIX}${suggestion.reference}${SPLIT}`;
  const scaffold = suggestion.preview.kind === 'namespace';
  const caretOffset = scaffold ? PREFIX.length + suggestion.reference.length : text.length;
  return {
    range: { startLineNumber: lineNumber, startColumn, endLineNumber: lineNumber, endColumn: endOffset + 1 },
    text,
    caretColumn: startColumn + caretOffset,
    scaffold,
  };
}
