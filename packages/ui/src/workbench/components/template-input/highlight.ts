/**
 * `{{ref}}` highlighting for TemplateInput — turns the plain value into
 * HTML where each reference is wrapped in a classified span. The caller
 * supplies a `classify` fn (resolved / unresolved); a ref the caret
 * currently sits inside renders with the neutral `editing` class so it
 * doesn't flicker red/blue mid-edit.
 *
 * The HTTP URL bar also paints its `:name` path parameters through the
 * same three states (`classifyPathParam`): the token is found by the
 * core grammar's span scan, wears the ref classes, and carries
 * `data-path-param` instead of `data-ref` — so the variable popover
 * never opens on it (a path parameter is a request field, not a
 * variable).
 */

import { parsePathParamSpans } from '@openheaders/core/utils';

export type RefState = 'resolved' | 'unresolved';

export const TEMPLATE_REGEX = /\{\{([^}]*)\}\}/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Token {
  start: number;
  end: number;
  html: (editing: boolean) => string;
}

/** Render `value` as HTML with `{{ref}}` wrapped in classified spans.
 *  When `caret` is inside a ref's `[start, end)` range (exclusive of the
 *  braces on either side), that ref renders with the neutral `editing`
 *  class — a ref is incomplete until its closing braces. With
 *  `classifyPathParam`, each `:name` path token is wrapped the same way
 *  but reads LIVE at every keystroke: a path name has no closing
 *  delimiter, every prefix is already a complete name, so the colour
 *  answers as the user types. */
export function renderHighlightedHtml(
  value: string,
  caret: number | null,
  classify: (inner: string) => RefState,
  classifyPathParam?: (name: string) => RefState,
): string {
  if (value.length === 0) return '';
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
  const tokens: Token[] = [];
  for (const match of value.matchAll(regex)) {
    const start = match.index ?? 0;
    const inner = match[1];
    tokens.push({
      start,
      end: start + match[0].length,
      html: (editing) =>
        `<span class="oh-template-ref oh-template-ref-${editing ? 'editing' : classify(inner)}" data-ref="${escapeHtml(inner)}">${escapeHtml(match[0])}</span>`,
    });
  }
  if (classifyPathParam) {
    // A path token holds identifier characters only, so it never
    // overlaps a template; the two lists merge by position.
    for (const span of parsePathParamSpans(value)) {
      tokens.push({
        start: span.start,
        end: span.end,
        html: () =>
          `<span class="oh-template-ref oh-template-ref-${classifyPathParam(span.name)}" data-path-param="${escapeHtml(span.name)}">${escapeHtml(value.slice(span.start, span.end))}</span>`,
      });
    }
    tokens.sort((a, b) => a.start - b.start);
  }
  let out = '';
  let last = 0;
  for (const token of tokens) {
    if (token.start > last) out += escapeHtml(value.slice(last, token.start));
    out += token.html(caret !== null && caret > token.start && caret < token.end);
    last = token.end;
  }
  if (last < value.length) out += escapeHtml(value.slice(last));
  // With `white-space: pre-wrap`, a trailing `\n` doesn't open a visible
  // last line on its own — the sentinel `<br>` makes it render (and gives
  // the caret a landing spot) while contributing nothing to textContent,
  // so the value read-back stays exact.
  if (value.endsWith('\n')) out += '<br>';
  return out;
}
