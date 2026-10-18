/**
 * The reference grammar a Monaco buffer's variable plane reads — where
 * a reference stands on a line, which run the caret is composing, and
 * the edit a pick writes. The three hooks (decorations, hover, picker)
 * and the pure walkers take one; the body editors read `{{ref}}`
 * (`TEMPLATE_REF_GRAMMAR`), a script buffer reads the string argument
 * of the `oh` API's lookups (the script editor's own grammar), so the
 * plane only ever dresses text the runtime will resolve.
 */

import type { SuggestionContext, VariableSuggestion } from '@openheaders/core/variables';
import { TEMPLATE_REGEX } from '../highlight';
import { buildInsertEdit, type InsertEdit, type LineMeasure, measureLine } from './monaco-suggest-measure';

/** A closed reference on a line — 1-based columns, the end exclusive. */
export interface RefSpan {
  startColumn: number;
  endColumn: number;
  /** The reference the resolver reads, e.g. `env.HOST`. */
  inner: string;
}

/** The run before the caret, plus the scopes it may name — absent
 *  means the context's own. */
export interface OpenRun extends LineMeasure {
  allowed?: SuggestionContext['allowed'];
}

export interface MonacoRefGrammar {
  id: string;
  refs(lineText: string): RefSpan[];
  openRun(lineText: string, column: number): OpenRun | null;
  insert(
    lineText: string,
    lineNumber: number,
    startColumn: number,
    caretColumn: number,
    suggestion: VariableSuggestion,
  ): InsertEdit;
}

function templateRefs(lineText: string): RefSpan[] {
  const out: RefSpan[] = [];
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
  for (const match of lineText.matchAll(regex)) {
    const start = match.index ?? 0;
    out.push({ startColumn: start + 1, endColumn: start + match[0].length + 1, inner: match[1] });
  }
  return out;
}

/** The body editors' grammar: `{{ref}}` anywhere on the line. */
export const TEMPLATE_REF_GRAMMAR: MonacoRefGrammar = {
  id: 'template',
  refs: templateRefs,
  openRun: measureLine,
  insert: buildInsertEdit,
};
