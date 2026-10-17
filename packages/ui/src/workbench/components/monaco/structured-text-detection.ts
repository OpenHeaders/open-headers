/**
 * structured-text-detection — what a plain-text buffer actually holds,
 * asked ONCE, on the user's Format click, never while typing.
 *
 * The format dropdown is the only thing that sets a message editor's
 * language, so JSON pasted under Text is plaintext to Monaco and has
 * no formatter. Rather than sniffing on every keystroke (the cost the
 * user would feel) or guessing at paste time (a silent change to a
 * control they own), the detection runs at the one moment the user
 * asked for structure: Format. A two-character bracket check rejects
 * prose in constant time; only a bracketed buffer pays the single
 * parse, and a buffer past the cap is left alone — the same ceiling
 * the response Pretty view keeps the formatter under.
 */

import type { LanguageId } from '../../languages/registry';

/** Past this many characters nothing is inspected — the parse would
 *  be felt on the main thread, and a payload that size is not the
 *  pasted-JSON case this serves. */
export const DETECT_CAP_CHARS = 1024 * 1024;

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

/** The structured language a plain-text buffer is written in, or
 *  `null` when it reads as prose, is empty, or is too large to ask. */
export function detectStructuredLanguage(text: string): LanguageId | null {
  if (text.length === 0 || text.length > DETECT_CAP_CHARS) return null;
  let start = 0;
  while (start < text.length && WHITESPACE.has(text[start])) start++;
  if (start === text.length) return null;
  let end = text.length - 1;
  while (end > start && WHITESPACE.has(text[end])) end--;
  const first = text[start];
  const last = text[end];
  const bracketed = (first === '{' && last === '}') || (first === '[' && last === ']');
  if (!bracketed) return null;
  try {
    JSON.parse(text);
    return 'json';
  } catch {
    return null;
  }
}
