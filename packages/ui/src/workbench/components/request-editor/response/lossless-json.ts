/**
 * Lossless JSON for the display path. `JSON.parse` rounds number tokens
 * to the nearest double, so Pretty / the tree preview / JSONPath results
 * silently corrupt exactly the values debugging copies — int64 ids,
 * k8s resourceVersions, high-precision decimals. This parser accepts
 * the same texts `JSON.parse` accepts, but keeps the SOURCE TEXT of any
 * number token whose value a double cannot represent exactly (as a
 * {@link JsonNumber} leaf), and reports duplicate object keys (which
 * `JSON.parse` silently collapses to the last value — this parser
 * matches that, plus the report). Display-only: capture bytes are never
 * rewritten; consumers print `JsonNumber.source` verbatim via
 * {@link stringifyLossless}.
 */

/** A number token whose exact value a double cannot hold — carried as
 *  its wire source text. A class so no genuine JSON value (which can
 *  only parse to plain objects/arrays/primitives) can impersonate it. */
export class JsonNumber {
  readonly source: string;
  constructor(source: string) {
    this.source = source;
  }
  toString(): string {
    return this.source;
  }
}

export function isJsonNumber(value: unknown): value is JsonNumber {
  return value instanceof JsonNumber;
}

export interface LosslessParseResult {
  value: unknown;
  /** Object keys that appeared more than once (last value kept), in
   *  first-repeat order, deduplicated. */
  duplicateKeys: string[];
}

/** Duplicate-key report ceiling — a notice, not an index. */
const DUPLICATE_KEY_LIMIT = 20;

/**
 * Canonical decimal form `±digits e exponent` (leading/trailing zeros
 * stripped into the exponent) — two number texts denote the same
 * mathematical value iff their normal forms match.
 */
function normalizeNumberText(text: string): string | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const sign = match[1];
  let digits = match[2] + (match[3] ?? '');
  let exponent = Number(match[4] ?? '0') - (match[3]?.length ?? 0);
  let start = 0;
  while (start < digits.length - 1 && digits.charCodeAt(start) === 48) start++;
  digits = digits.slice(start);
  if (digits === '0') return '0';
  while (digits.endsWith('0')) {
    digits = digits.slice(0, -1);
    exponent++;
  }
  return `${sign}${digits}e${exponent}`;
}

/** True when `Number(source)` does not hold the exact value the token
 *  denotes — the values Pretty would silently rewrite. */
function losesPrecision(source: string): boolean {
  const value = Number(source);
  if (!Number.isFinite(value)) return true;
  const canonical = String(value);
  if (canonical === source) return false;
  return normalizeNumberText(source) !== normalizeNumberText(canonical);
}

const WHITESPACE = new Set([0x20, 0x09, 0x0a, 0x0d]);

/**
 * Strict JSON parse (same accept/reject set as `JSON.parse`) with
 * lossless numbers and a duplicate-key report. `null` on any syntax
 * error — callers treat it exactly like a `JSON.parse` throw.
 */
export function parseLosslessJson(text: string): LosslessParseResult | null {
  let pos = 0;
  const duplicates: string[] = [];
  const duplicateSeen = new Set<string>();

  const skipWhitespace = () => {
    while (pos < text.length && WHITESPACE.has(text.charCodeAt(pos))) pos++;
  };

  const parseString = (): string | null => {
    // Caller consumed the opening quote. Fast path: no escapes.
    let i = pos;
    while (i < text.length) {
      const code = text.charCodeAt(i);
      if (code === 0x22) {
        const raw = text.slice(pos, i);
        pos = i + 1;
        return raw;
      }
      if (code === 0x5c) break;
      if (code < 0x20) return null;
      i++;
    }
    // Escaped path — decode per the JSON string grammar.
    let out = text.slice(pos, i);
    pos = i;
    while (pos < text.length) {
      const code = text.charCodeAt(pos);
      if (code === 0x22) {
        pos++;
        return out;
      }
      if (code < 0x20) return null;
      if (code !== 0x5c) {
        const from = pos;
        while (pos < text.length) {
          const c = text.charCodeAt(pos);
          if (c === 0x22 || c === 0x5c || c < 0x20) break;
          pos++;
        }
        out += text.slice(from, pos);
        continue;
      }
      pos++;
      const esc = text[pos];
      pos++;
      switch (esc) {
        case '"':
          out += '"';
          break;
        case '\\':
          out += '\\';
          break;
        case '/':
          out += '/';
          break;
        case 'b':
          out += '\b';
          break;
        case 'f':
          out += '\f';
          break;
        case 'n':
          out += '\n';
          break;
        case 'r':
          out += '\r';
          break;
        case 't':
          out += '\t';
          break;
        case 'u': {
          const hex = text.slice(pos, pos + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
          out += String.fromCharCode(Number.parseInt(hex, 16));
          pos += 4;
          break;
        }
        default:
          return null;
      }
    }
    return null;
  };

  // Sticky, not `^`+slice — slicing the remaining text per number
  // token would go quadratic on number-heavy bodies.
  const NUMBER_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

  const parseValue = (): { value: unknown } | null => {
    skipWhitespace();
    if (pos >= text.length) return null;
    const code = text.charCodeAt(pos);
    if (code === 0x22) {
      pos++;
      const str = parseString();
      return str === null ? null : { value: str };
    }
    if (code === 0x7b) {
      // Object
      pos++;
      const obj: Record<string, unknown> = {};
      skipWhitespace();
      if (text.charCodeAt(pos) === 0x7d) {
        pos++;
        return { value: obj };
      }
      while (true) {
        skipWhitespace();
        if (text.charCodeAt(pos) !== 0x22) return null;
        pos++;
        const key = parseString();
        if (key === null) return null;
        if (Object.hasOwn(obj, key) && !duplicateSeen.has(key) && duplicates.length < DUPLICATE_KEY_LIMIT) {
          duplicateSeen.add(key);
          duplicates.push(key);
        }
        skipWhitespace();
        if (text.charCodeAt(pos) !== 0x3a) return null;
        pos++;
        const member = parseValue();
        if (member === null) return null;
        obj[key] = member.value;
        skipWhitespace();
        const sep = text.charCodeAt(pos);
        if (sep === 0x2c) {
          pos++;
          continue;
        }
        if (sep === 0x7d) {
          pos++;
          return { value: obj };
        }
        return null;
      }
    }
    if (code === 0x5b) {
      // Array
      pos++;
      const arr: unknown[] = [];
      skipWhitespace();
      if (text.charCodeAt(pos) === 0x5d) {
        pos++;
        return { value: arr };
      }
      while (true) {
        const item = parseValue();
        if (item === null) return null;
        arr.push(item.value);
        skipWhitespace();
        const sep = text.charCodeAt(pos);
        if (sep === 0x2c) {
          pos++;
          continue;
        }
        if (sep === 0x5d) {
          pos++;
          return { value: arr };
        }
        return null;
      }
    }
    if (code === 0x74 && text.startsWith('true', pos)) {
      pos += 4;
      return { value: true };
    }
    if (code === 0x66 && text.startsWith('false', pos)) {
      pos += 5;
      return { value: false };
    }
    if (code === 0x6e && text.startsWith('null', pos)) {
      pos += 4;
      return { value: null };
    }
    if (code === 0x2d || (code >= 0x30 && code <= 0x39)) {
      NUMBER_RE.lastIndex = pos;
      const match = NUMBER_RE.exec(text);
      if (!match) return null;
      const source = match[0];
      pos += source.length;
      return { value: losesPrecision(source) ? new JsonNumber(source) : Number(source) };
    }
    return null;
  };

  const root = parseValue();
  if (root === null) return null;
  skipWhitespace();
  if (pos !== text.length) return null;
  return { value: root.value, duplicateKeys: duplicates };
}

/**
 * `JSON.stringify(value, null, indent)` twin that prints
 * {@link JsonNumber} leaves as their wire source text. Only handles
 * what {@link parseLosslessJson} produces (plain objects/arrays/
 * primitives + JsonNumber) — display printing, not a general replacer.
 */
export function stringifyLossless(value: unknown, indent = 2): string {
  const pad = ' '.repeat(indent);
  const print = (node: unknown, depth: number): string => {
    if (isJsonNumber(node)) return node.source;
    if (node === null || node === undefined) return 'null';
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      return JSON.stringify(node);
    }
    const inner = pad.repeat(depth + 1);
    const outer = pad.repeat(depth);
    if (Array.isArray(node)) {
      if (node.length === 0) return '[]';
      return `[\n${node.map((item) => `${inner}${print(item, depth + 1)}`).join(',\n')}\n${outer}]`;
    }
    const entries = Object.entries(node);
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([key, member]) => `${inner}${JSON.stringify(key)}: ${print(member, depth + 1)}`)
      .join(',\n')}\n${outer}}`;
  };
  return print(value, 0);
}
