/**
 * A search's text as a shape — what the log's text field may ask a
 * history for, whatever then matches it: something to match, bounded,
 * with no control character. Checked before anything is compiled or
 * read.
 */

/** The longest text a search takes. */
export const LOG_SEARCH_MAX_TEXT = 200;

export function isValidLogSearchText(text: string): boolean {
  const needle = text.trim();
  if (needle.length === 0 || needle.length > LOG_SEARCH_MAX_TEXT) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control chars is the point
  return !/[\x00-\x1f\x7f]/.test(needle);
}
