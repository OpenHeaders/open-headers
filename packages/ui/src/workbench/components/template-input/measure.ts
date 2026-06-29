/**
 * Brace-measure helpers for TemplateInput — locate the `{{ }}` context
 * the caret sits in, so the suggestion popover knows what (if anything)
 * the user is composing.
 */

export const PREFIX = '{{';
export const SPLIT = '}}';

/** Open-brace context for the suggestion popover. A single `{` is enough
 *  to trigger — users reach for the variable list on the first brace, not
 *  the second. `double` flags `{{` (unambiguous template intent) vs a
 *  lone `{` (which might still be literal); the caller uses it to keep an
 *  empty list hidden for a lone brace. The query captures only non-brace
 *  chars, so a closed `{{ref}}` stops matching once the caret moves past
 *  its `}}`. */
const MEASURE_RX = /(\{\{?)([^{}]*)$/;

export interface Measure {
  start: number;
  query: string;
  double: boolean;
}

export function detectMeasure(text: string, caret: number): Measure | null {
  const before = text.slice(0, caret);
  const m = MEASURE_RX.exec(before);
  if (!m) return null;
  return { start: m.index, query: m[2], double: m[1].length === 2 };
}

/** When the caret sits inside an already-complete `{{ref}}`, find the
 *  position AFTER its closing `}}`. Returns the original caret position if
 *  there's no closing `}}` before the next `{{` (or no following text at
 *  all) — meaning the user is composing a brand-new ref and we shouldn't
 *  consume anything. */
export function findExistingCloseEnd(text: string, caret: number): number {
  const forward = text.slice(caret);
  const nextOpen = forward.indexOf(PREFIX);
  const nextClose = forward.indexOf(SPLIT);
  if (nextClose === -1) return caret;
  if (nextOpen !== -1 && nextOpen < nextClose) return caret;
  return caret + nextClose + SPLIT.length;
}
