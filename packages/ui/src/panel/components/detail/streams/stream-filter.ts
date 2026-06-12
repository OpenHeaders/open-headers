/**
 * Regex filter compilation for the message-stream grids, with the
 * host's exact fallback semantics — the two tabs differ on purpose:
 *
 *   - `'literal'` (Messages): an invalid pattern degrades to a
 *     case-insensitive literal substring match, so a user typing `(`
 *     mid-pattern still filters by what they typed.
 *   - `'never'` (EventStream): an invalid pattern matches nothing
 *     until it parses.
 *
 * Both compile case-insensitive. An empty input means "no filter".
 */

export type StreamRegexFallback = 'literal' | 'never';

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function compileStreamFilter(text: string, fallback: StreamRegexFallback): RegExp | null {
  if (!text) return null;
  try {
    return new RegExp(text, 'i');
  } catch {
    if (fallback === 'literal') return new RegExp(escapeForRegex(text), 'i');
    return /(?!)/i;
  }
}
