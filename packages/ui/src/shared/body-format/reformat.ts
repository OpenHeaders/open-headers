/**
 * Whitespace-only body reformatting over the jsonish token stream.
 *
 * `formatBody` and `minifyBody` re-emit the SAME tokens with different
 * inter-token whitespace — never `JSON.parse`/`JSON.stringify`, whose
 * round-trip corrupts big integers, normalizes number forms and
 * `\uXXXX` escapes, and drops duplicate keys. Both are idempotent and
 * fail open: text that doesn't tokenize returns verbatim.
 *
 * `reformatBody` is the save-time step: re-emit edited text in the
 * captured original's profile so the stored (served) body stays in the
 * wire format.
 */

import type { BodyProfile } from './profile';
import { tokenizeJsonish } from './tokenize';

/** Can this body carry the formatted-view affordance? */
export function isFormattableBody(text: string): boolean {
  return tokenizeJsonish(text) !== null;
}

export const DEFAULT_BODY_INDENT = '  ';

export function minifyBody(text: string): string {
  const tokens = tokenizeJsonish(text);
  if (!tokens) return text;
  let out = '';
  for (const tok of tokens) out += tok.text;
  return out;
}

export function formatBody(text: string, indent: string = DEFAULT_BODY_INDENT): string {
  const tokens = tokenizeJsonish(text);
  if (!tokens) return text;
  const parts: string[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind !== 'punct') {
      parts.push(tok.text);
      continue;
    }
    const ch = tok.text;
    if (ch === '{' || ch === '[') {
      const next = tokens[i + 1];
      const closer = ch === '{' ? '}' : ']';
      if (next && next.kind === 'punct' && next.text === closer) {
        // Empty containers stay glued — `{}` / `[]`.
        parts.push(ch, closer);
        i++;
        continue;
      }
      depth++;
      parts.push(ch, '\n', indent.repeat(depth));
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth--;
      parts.push('\n', indent.repeat(depth), ch);
      continue;
    }
    if (ch === ',') {
      parts.push(',', '\n', indent.repeat(depth));
      continue;
    }
    parts.push(': ');
  }
  return parts.join('');
}

export function reformatBody(text: string, profile: BodyProfile): string {
  if (profile.kind === 'unknown') return text;
  const body = profile.kind === 'minified' ? minifyBody(text) : formatBody(text, profile.indent);
  if (profile.trailingNewline && !body.endsWith('\n')) return `${body}\n`;
  return body;
}
