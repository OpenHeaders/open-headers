/**
 * `{{ref}}` decorations for Monaco buffers — the line input's three
 * states (resolved, unresolved, editing) as inline decorations over
 * the lines in view. Pure: the hook hands in the visible lines, the
 * caret and the grammar, this returns the ranges and their state. A
 * closed reference the caret sits inside is `editing`, and so is the
 * open run being composed — the dress never flickers mid-edit, and the
 * run always has a painted span for a popover to anchor on.
 */

import type * as monaco from 'monaco-editor';
import type { RefState } from '../highlight';
import { type MonacoRefGrammar, type RefSpan, TEMPLATE_REF_GRAMMAR } from './ref-grammar';

export type RefDecorationState = RefState | 'editing';

export const MONACO_REF_CLASS = 'oh-monaco-ref';
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
  grammar: MonacoRefGrammar = TEMPLATE_REF_GRAMMAR,
): RefDecoration[] {
  const out: RefDecoration[] = [];
  for (const { lineNumber, text } of lines) {
    const caretOffset = caret !== null && caret.lineNumber === lineNumber ? caret.column - 1 : null;
    let caretInClosed = false;
    for (const span of grammar.refs(text)) {
      const start = span.startColumn - 1;
      const end = span.endColumn - 1;
      const editing = caretOffset !== null && caretOffset > start && caretOffset < end;
      if (editing) caretInClosed = true;
      out.push({
        range: {
          startLineNumber: lineNumber,
          startColumn: span.startColumn,
          endLineNumber: lineNumber,
          endColumn: span.endColumn,
        },
        state: editing ? 'editing' : classify(span.inner),
      });
    }
    if (caretOffset === null || caretInClosed || caret === null) continue;
    const open = grammar.openRun(text, caret.column);
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

export type RefAtColumn = RefSpan;

/** The closed reference on `lineText` that covers `column` (1-based),
 *  or null — the hover plane's lookup for the span under the pointer. */
export function findRefAt(
  lineText: string,
  column: number,
  grammar: MonacoRefGrammar = TEMPLATE_REF_GRAMMAR,
): RefAtColumn | null {
  const offset = column - 1;
  for (const span of grammar.refs(lineText)) {
    const start = span.startColumn - 1;
    const end = span.endColumn - 1;
    if (offset < start) return null;
    if (offset < end) return span;
  }
  return null;
}
