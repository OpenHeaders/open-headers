/**
 * `{{ref}}` decorations for Monaco buffers — the line input's three
 * states (resolved, unresolved, editing) as inline decorations over
 * the lines in view. Pure: the hook hands in the visible lines and the
 * caret, this returns the ranges and their state. A closed reference
 * the caret sits inside is `editing`, and so is the open `{{query` run
 * being composed — the dress never flickers mid-edit, and the run
 * always has a painted span for a popover to anchor on.
 */

import type * as monaco from 'monaco-editor';
import { type RefState, TEMPLATE_REGEX } from '../highlight';
import { measureLine } from './monaco-suggest-measure';

export type RefDecorationState = RefState | 'editing';

const MONACO_REF_CLASS = 'oh-monaco-ref';
/** The composing run's span — the create popover's anchor. */
export const MONACO_REF_EDITING_CLASS = `${MONACO_REF_CLASS}-editing`;

export function refDecorationClass(state: RefDecorationState): string {
  return `${MONACO_REF_CLASS} ${MONACO_REF_CLASS}-${state}`;
}

export interface VisibleLine {
  lineNumber: number;
  text: string;
}

export interface RefDecoration {
  range: monaco.IRange;
  state: RefDecorationState;
}

export function collectRefDecorations(
  lines: ReadonlyArray<VisibleLine>,
  caret: monaco.IPosition | null,
  classify: (inner: string) => RefState,
): RefDecoration[] {
  const out: RefDecoration[] = [];
  for (const { lineNumber, text } of lines) {
    const caretOffset = caret !== null && caret.lineNumber === lineNumber ? caret.column - 1 : null;
    let caretInClosed = false;
    const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
    for (const match of text.matchAll(regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const editing = caretOffset !== null && caretOffset > start && caretOffset < end;
      if (editing) caretInClosed = true;
      out.push({
        range: { startLineNumber: lineNumber, startColumn: start + 1, endLineNumber: lineNumber, endColumn: end + 1 },
        state: editing ? 'editing' : classify(match[1]),
      });
    }
    if (caretOffset === null || caretInClosed || caret === null) continue;
    const open = measureLine(text, caret.column);
    if (!open) continue;
    out.push({
      range: {
        startLineNumber: lineNumber,
        startColumn: open.startColumn,
        endLineNumber: lineNumber,
        endColumn: caret.column,
      },
      state: 'editing',
    });
  }
  return out;
}
