/**
 * `{{ref}}` highlighting for TemplateInput — turns the plain value into
 * HTML where each reference is wrapped in a classified span. The caller
 * supplies a `classify` fn (resolved / unresolved / reserved); a ref the
 * caret currently sits inside renders with the neutral `editing` class so
 * it doesn't flicker red/blue mid-edit.
 */

export type RefState = 'resolved' | 'unresolved' | 'reserved';

export const TEMPLATE_REGEX = /\{\{([^}]*)\}\}/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render `value` as HTML with `{{ref}}` wrapped in classified spans.
 *  When `caret` is inside a ref's `[start, end)` range (exclusive of the
 *  braces on either side), that ref renders with the neutral `editing`
 *  class. */
export function renderHighlightedHtml(
  value: string,
  caret: number | null,
  classify: (inner: string) => RefState,
): string {
  if (value.length === 0) return '';
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
  let out = '';
  let last = 0;
  for (const match of value.matchAll(regex)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > last) out += escapeHtml(value.slice(last, start));
    const inner = match[1];
    const editing = caret !== null && caret > start && caret < end;
    const state = editing ? 'editing' : classify(inner);
    out += `<span class="oh-template-ref oh-template-ref-${state}" data-ref="${escapeHtml(inner)}">${escapeHtml(match[0])}</span>`;
    last = end;
  }
  if (last < value.length) out += escapeHtml(value.slice(last));
  return out;
}
