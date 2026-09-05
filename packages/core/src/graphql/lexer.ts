/**
 * GraphQL lexer — the spec's lexical grammar as one forward scan:
 * punctuators (including the three-dot spread), names, integers,
 * floats, strings with the escape set (`\uXXXX` and `\u{…}` included),
 * block strings with the indentation algorithm, and the ignored tokens
 * (whitespace, line terminators, commas, comments, the BOM). Every
 * token carries its offsets; line and column are derived on demand by
 * `positionAt` so the hot path stays a single index.
 *
 * Lexical errors throw `GraphqlSyntaxError` internally; the parser's
 * public boundary converts them. `tokenize` is the tolerant public
 * form for tests and the completion model — it reports instead.
 */

import type { GraphqlError } from './types';
import { GraphqlSyntaxError } from './types';

export type TokenKind = 'punct' | 'name' | 'int' | 'float' | 'string' | 'blockString' | 'eof';

export interface Token {
  readonly kind: TokenKind;
  /** The punctuator / name / digits as written, or the DECODED string value. */
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

export interface LexResult {
  readonly tokens: readonly Token[];
  /** The first lexical error, or null when the whole source lexed. */
  readonly error: GraphqlError | null;
}

export interface LinePosition {
  /** 1-based. */
  readonly line: number;
  /** 1-based, in UTF-16 units. */
  readonly column: number;
}

/** Line / column of a character offset — for messages and editor markers. */
export function positionAt(source: string, offset: number): LinePosition {
  let line = 1;
  let lineStart = 0;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    const ch = source.charCodeAt(i);
    if (ch === 0x0a) {
      line++;
      lineStart = i + 1;
    } else if (ch === 0x0d) {
      if (source.charCodeAt(i + 1) === 0x0a) i++;
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

const PUNCTUATORS = new Set(['!', '$', '&', '(', ')', ':', '=', '@', '[', ']', '{', '|', '}']);

function isNameStart(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f;
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isNameContinue(code: number): boolean {
  return isNameStart(code) || isDigit(code);
}

function isWhiteSpaceOrTab(code: number): boolean {
  return code === 0x20 || code === 0x09;
}

function describeCharacter(source: string, index: number): string {
  const code = source.codePointAt(index);
  if (code === undefined) return 'end of input';
  if (code === 0x22) return 'the character `"`';
  if (code < 0x20 || code === 0x7f) return `the character U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
  return `the character \`${String.fromCodePoint(code)}\``;
}

/**
 * The spec's BlockStringValue algorithm: split into lines, remove the
 * common indentation (the first line excluded), drop leading and
 * trailing blank lines, rejoin with `\n`.
 */
export function dedentBlockString(raw: string): string {
  const lines = raw.split(/\r\n|[\n\r]/g);
  let commonIndent: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let indent = 0;
    while (indent < line.length && isWhiteSpaceOrTab(line.charCodeAt(indent))) indent++;
    if (indent === line.length) continue;
    if (commonIndent === null || indent < commonIndent) commonIndent = indent;
  }
  const trimmed = lines.map((line, index) => (index === 0 || commonIndent === null ? line : line.slice(commonIndent)));
  const isBlank = (line: string): boolean => {
    for (let i = 0; i < line.length; i++) if (!isWhiteSpaceOrTab(line.charCodeAt(i))) return false;
    return true;
  };
  let first = 0;
  while (first < trimmed.length && isBlank(trimmed[first])) first++;
  let last = trimmed.length;
  while (last > first && isBlank(trimmed[last - 1])) last--;
  return trimmed.slice(first, last).join('\n');
}

export class Lexer {
  private index = 0;
  private lookahead: Token | null = null;

  constructor(readonly source: string) {}

  /** The next token without consuming it. */
  peek(): Token {
    if (this.lookahead === null) this.lookahead = this.scan();
    return this.lookahead;
  }

  /** Consume and return the next token. */
  next(): Token {
    const token = this.peek();
    this.lookahead = null;
    return token;
  }

  private fail(message: string, start: number, end: number = start + 1): never {
    throw new GraphqlSyntaxError(message, start, Math.min(end, this.source.length));
  }

  private skipIgnored(): void {
    const source = this.source;
    while (this.index < source.length) {
      const code = source.charCodeAt(this.index);
      if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x2c || code === 0xfeff) {
        this.index++;
      } else if (code === 0x23) {
        while (this.index < source.length) {
          const c = source.charCodeAt(this.index);
          if (c === 0x0a || c === 0x0d) break;
          this.index++;
        }
      } else {
        return;
      }
    }
  }

  private scan(): Token {
    this.skipIgnored();
    const source = this.source;
    const start = this.index;
    if (start >= source.length) return { kind: 'eof', value: '', start, end: start };
    const ch = source[start];
    const code = source.charCodeAt(start);
    if (PUNCTUATORS.has(ch)) {
      this.index = start + 1;
      return { kind: 'punct', value: ch, start, end: this.index };
    }
    if (ch === '.') {
      if (source.startsWith('...', start)) {
        this.index = start + 3;
        return { kind: 'punct', value: '...', start, end: this.index };
      }
      this.fail('Unexpected `.` — did you mean `...`?', start);
    }
    if (isNameStart(code)) {
      let end = start + 1;
      while (end < source.length && isNameContinue(source.charCodeAt(end))) end++;
      this.index = end;
      return { kind: 'name', value: source.slice(start, end), start, end };
    }
    if (isDigit(code) || ch === '-') return this.scanNumber(start);
    if (ch === '"') {
      if (source.startsWith('"""', start)) return this.scanBlockString(start);
      return this.scanString(start);
    }
    this.fail(`Unexpected ${describeCharacter(source, start)}.`, start);
  }

  private scanNumber(start: number): Token {
    const source = this.source;
    let i = start;
    if (source[i] === '-') i++;
    if (source[i] === '0') {
      i++;
      if (i < source.length && isDigit(source.charCodeAt(i))) {
        this.fail(`Invalid number — unexpected digit after 0: \`${source[i]}\`.`, i);
      }
    } else if (i < source.length && isDigit(source.charCodeAt(i))) {
      while (i < source.length && isDigit(source.charCodeAt(i))) i++;
    } else {
      this.fail(`Invalid number — expected a digit but found ${describeCharacter(source, i)}.`, i);
    }
    let isFloat = false;
    if (source[i] === '.') {
      isFloat = true;
      i++;
      if (i >= source.length || !isDigit(source.charCodeAt(i))) {
        this.fail(`Invalid number — expected a digit but found ${describeCharacter(source, i)}.`, i);
      }
      while (i < source.length && isDigit(source.charCodeAt(i))) i++;
    }
    if (source[i] === 'e' || source[i] === 'E') {
      isFloat = true;
      i++;
      if (source[i] === '+' || source[i] === '-') i++;
      if (i >= source.length || !isDigit(source.charCodeAt(i))) {
        this.fail(`Invalid number — expected a digit but found ${describeCharacter(source, i)}.`, i);
      }
      while (i < source.length && isDigit(source.charCodeAt(i))) i++;
    }
    // A number may not run straight into a name or a second dot.
    if (i < source.length) {
      const after = source.charCodeAt(i);
      if (source[i] === '.' || isNameStart(after)) {
        this.fail(`Invalid number — expected a digit but found ${describeCharacter(source, i)}.`, i);
      }
    }
    this.index = i;
    return { kind: isFloat ? 'float' : 'int', value: source.slice(start, i), start, end: i };
  }

  private scanString(start: number): Token {
    const source = this.source;
    let i = start + 1;
    let value = '';
    let chunkStart = i;
    while (i < source.length) {
      const code = source.charCodeAt(i);
      if (code === 0x22) {
        value += source.slice(chunkStart, i);
        this.index = i + 1;
        return { kind: 'string', value, start, end: this.index };
      }
      if (code === 0x0a || code === 0x0d) break;
      if (code === 0x5c) {
        value += source.slice(chunkStart, i);
        const escaped = this.readEscape(i);
        value += escaped.value;
        i = escaped.end;
        chunkStart = i;
        continue;
      }
      if (code < 0x20 && code !== 0x09) {
        this.fail(`Invalid character within a string: ${describeCharacter(source, i)}.`, i);
      }
      i++;
    }
    this.fail('Unterminated string.', start, i);
  }

  /** `\…` at `backslash` — returns the decoded text and the index after it. */
  private readEscape(backslash: number): { value: string; end: number } {
    const source = this.source;
    const code = source[backslash + 1];
    switch (code) {
      case '"':
        return { value: '"', end: backslash + 2 };
      case '\\':
        return { value: '\\', end: backslash + 2 };
      case '/':
        return { value: '/', end: backslash + 2 };
      case 'b':
        return { value: '\b', end: backslash + 2 };
      case 'f':
        return { value: '\f', end: backslash + 2 };
      case 'n':
        return { value: '\n', end: backslash + 2 };
      case 'r':
        return { value: '\r', end: backslash + 2 };
      case 't':
        return { value: '\t', end: backslash + 2 };
      case 'u':
        return this.readUnicodeEscape(backslash);
      default:
        this.fail(`Invalid escape sequence: \`${source.slice(backslash, backslash + 2)}\`.`, backslash, backslash + 2);
    }
  }

  private readUnicodeEscape(backslash: number): { value: string; end: number } {
    const source = this.source;
    if (source[backslash + 2] === '{') {
      const close = source.indexOf('}', backslash + 3);
      const hex = close === -1 ? '' : source.slice(backslash + 3, close);
      if (close === -1 || hex.length === 0 || !/^[0-9A-Fa-f]+$/.test(hex)) {
        this.fail('Invalid Unicode escape sequence.', backslash, close === -1 ? backslash + 3 : close + 1);
      }
      const point = Number.parseInt(hex, 16);
      if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) {
        this.fail('Invalid Unicode escape sequence.', backslash, close + 1);
      }
      return { value: String.fromCodePoint(point), end: close + 1 };
    }
    const hex = source.slice(backslash + 2, backslash + 6);
    if (hex.length < 4 || !/^[0-9A-Fa-f]{4}$/.test(hex)) {
      this.fail('Invalid Unicode escape sequence.', backslash, backslash + 6);
    }
    const unit = Number.parseInt(hex, 16);
    // A surrogate pair written as two escapes joins into one code point.
    if (unit >= 0xd800 && unit <= 0xdbff && source.startsWith('\\u', backslash + 6)) {
      const lowHex = source.slice(backslash + 8, backslash + 12);
      if (/^[0-9A-Fa-f]{4}$/.test(lowHex)) {
        const low = Number.parseInt(lowHex, 16);
        if (low >= 0xdc00 && low <= 0xdfff) {
          return { value: String.fromCharCode(unit, low), end: backslash + 12 };
        }
      }
    }
    if (unit >= 0xd800 && unit <= 0xdfff) this.fail('Invalid Unicode escape sequence.', backslash, backslash + 6);
    return { value: String.fromCharCode(unit), end: backslash + 6 };
  }

  private scanBlockString(start: number): Token {
    const source = this.source;
    let i = start + 3;
    let raw = '';
    let chunkStart = i;
    while (i < source.length) {
      if (source.startsWith('"""', i)) {
        raw += source.slice(chunkStart, i);
        this.index = i + 3;
        return { kind: 'blockString', value: dedentBlockString(raw), start, end: this.index };
      }
      if (source.startsWith('\\"""', i)) {
        raw += `${source.slice(chunkStart, i)}"""`;
        i += 4;
        chunkStart = i;
        continue;
      }
      const code = source.charCodeAt(i);
      if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
        this.fail(`Invalid character within a block string: ${describeCharacter(source, i)}.`, i);
      }
      i++;
    }
    this.fail('Unterminated block string.', start, i);
  }
}

/** Lex a whole source. Tolerant: the token list holds everything
 *  before the first lexical error, which is reported, never thrown. */
export function tokenize(source: string): LexResult {
  const lexer = new Lexer(source);
  const tokens: Token[] = [];
  try {
    while (true) {
      const token = lexer.next();
      tokens.push(token);
      if (token.kind === 'eof') break;
    }
    return { tokens, error: null };
  } catch (error) {
    if (error instanceof GraphqlSyntaxError) {
      return { tokens, error: { message: error.message, start: error.start, end: error.end } };
    }
    throw error;
  }
}
