/**
 * tokenizeJsonish — JSON-shaped token scanner for body text.
 *
 * The scanner exists so body formatting can be a WHITESPACE-ONLY
 * transform: every value token is kept as its verbatim source slice
 * (numbers are never parsed, so big integers, `1.0`, `1e3`, and
 * `\uXXXX` escapes survive untouched), and `{{…}}` template atoms are
 * opaque value tokens, so templated bodies tokenize too. Null means
 * "not a JSON-shaped body" — callers fail open to the raw text.
 *
 * The gate is shape, not grammar: the stream must start with a
 * container, brackets must balance, and nothing may follow the
 * top-level close — comma/colon placement is deliberately not
 * validated (a body the platform can't parse must still round-trip).
 */

export type JsonishTokenKind = 'punct' | 'string' | 'number' | 'literal' | 'template';

export interface JsonishToken {
  kind: JsonishTokenKind;
  /** Verbatim source slice — values are never reinterpreted. */
  text: string;
  start: number;
  end: number;
}

/** Bodies beyond this size skip tokenization (and with it every
 *  formatting affordance) — the scan is linear, but editors re-derive
 *  on each change, so huge payloads stay raw. */
export const MAX_TOKENIZE_LENGTH = 2_000_000;

const CH_TAB = 9;
const CH_LF = 10;
const CH_CR = 13;
const CH_SPACE = 32;
const CH_QUOTE = 34;
const CH_PLUS = 43;
const CH_COMMA = 44;
const CH_MINUS = 45;
const CH_DOT = 46;
const CH_ZERO = 48;
const CH_NINE = 57;
const CH_COLON = 58;
const CH_UPPER_E = 69;
const CH_BRACKET_OPEN = 91;
const CH_BACKSLASH = 92;
const CH_BRACKET_CLOSE = 93;
const CH_LOWER_E = 101;
const CH_BRACE_OPEN = 123;
const CH_BRACE_CLOSE = 125;

function isDigit(code: number): boolean {
  return code >= CH_ZERO && code <= CH_NINE;
}

function isWhitespace(code: number): boolean {
  return code === CH_SPACE || code === CH_TAB || code === CH_LF || code === CH_CR;
}

/** Would this char glue onto a literal/number if adjacent? (Guards
 *  `trueX` / `1x` from scanning as `true` + garbage.) */
function isWordChar(code: number): boolean {
  const isUnderscore = code === 95;
  return isDigit(code) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || isUnderscore;
}

export function tokenizeJsonish(text: string): JsonishToken[] | null {
  const n = text.length;
  if (n === 0 || n > MAX_TOKENIZE_LENGTH) return null;

  const tokens: JsonishToken[] = [];
  // Opener char codes — closers must match kind; imbalance fails.
  const stack: number[] = [];
  let topLevelClosed = false;
  let i = 0;

  while (i < n) {
    const c = text.charCodeAt(i);
    if (isWhitespace(c)) {
      i++;
      continue;
    }
    // Any token after the top-level container closed is trailing garbage.
    if (topLevelClosed) return null;
    const start = i;

    if (c === CH_BRACE_OPEN) {
      if (text.charCodeAt(i + 1) === CH_BRACE_OPEN) {
        // `{{…}}` template atom — never valid JSON, so the double brace
        // is unambiguous. Unterminated atoms fail the whole scan.
        const close = text.indexOf('}}', i + 2);
        if (close === -1) return null;
        i = close + 2;
        tokens.push({ kind: 'template', text: text.slice(start, i), start, end: i });
        continue;
      }
      stack.push(c);
      i++;
      tokens.push({ kind: 'punct', text: '{', start, end: i });
      continue;
    }

    if (c === CH_BRACKET_OPEN) {
      stack.push(c);
      i++;
      tokens.push({ kind: 'punct', text: '[', start, end: i });
      continue;
    }

    if (c === CH_BRACE_CLOSE || c === CH_BRACKET_CLOSE) {
      const opener = stack.pop();
      const expected = c === CH_BRACE_CLOSE ? CH_BRACE_OPEN : CH_BRACKET_OPEN;
      if (opener !== expected) return null;
      if (stack.length === 0) topLevelClosed = true;
      i++;
      tokens.push({ kind: 'punct', text: text.slice(start, i), start, end: i });
      continue;
    }

    if (c === CH_COMMA || c === CH_COLON) {
      i++;
      tokens.push({ kind: 'punct', text: text.slice(start, i), start, end: i });
      continue;
    }

    if (c === CH_QUOTE) {
      i++;
      let closed = false;
      while (i < n) {
        const sc = text.charCodeAt(i);
        if (sc === CH_BACKSLASH) {
          i += 2;
          continue;
        }
        if (sc === CH_QUOTE) {
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed || i > n) return null;
      tokens.push({ kind: 'string', text: text.slice(start, i), start, end: i });
      continue;
    }

    if (c === CH_MINUS || isDigit(c)) {
      i++;
      let sawDigit = isDigit(c);
      while (i < n && isDigit(text.charCodeAt(i))) {
        sawDigit = true;
        i++;
      }
      if (text.charCodeAt(i) === CH_DOT) {
        i++;
        while (i < n && isDigit(text.charCodeAt(i))) i++;
      }
      const expCode = text.charCodeAt(i);
      if (expCode === CH_LOWER_E || expCode === CH_UPPER_E) {
        i++;
        const signCode = text.charCodeAt(i);
        if (signCode === CH_PLUS || signCode === CH_MINUS) i++;
        while (i < n && isDigit(text.charCodeAt(i))) i++;
      }
      if (!sawDigit || (i < n && isWordChar(text.charCodeAt(i)))) return null;
      tokens.push({ kind: 'number', text: text.slice(start, i), start, end: i });
      continue;
    }

    let literal: 'true' | 'false' | 'null' | null = null;
    if (text.startsWith('true', i)) literal = 'true';
    else if (text.startsWith('false', i)) literal = 'false';
    else if (text.startsWith('null', i)) literal = 'null';
    if (literal !== null) {
      const end = i + literal.length;
      if (end < n && isWordChar(text.charCodeAt(end))) return null;
      i = end;
      tokens.push({ kind: 'literal', text: literal, start, end });
      continue;
    }

    return null;
  }

  const first = tokens[0];
  if (!first || first.kind !== 'punct' || (first.text !== '{' && first.text !== '[')) return null;
  if (stack.length !== 0) return null;
  return tokens;
}
