/**
 * Filter grammar for the Headers tab. Same tokenizer shape as
 * `cascade-filter.ts` so the two surfaces feel identical from the
 * keyboard. Each token must match for a row to pass; leading `-`
 * negates. The matcher is pure — it consumes a row + a small derived
 * `HeaderRowMeta` and returns a boolean.
 *
 * Supported forms:
 *
 *   foo                    → name or value contains "foo" (case-insensitive)
 *   "exact phrase"         → quoted substring (case-insensitive)
 *   name:cookie            → header name contains "cookie"
 *   value:no-cache         → header value contains "no-cache"
 *   is:rule                → row was added/modified/removed by a rule
 *   is:server              → row came from the server (no rule)
 *   is:system              → row was injected by an Open Headers system feature
 *   is:overridable         → row's header is NOT in the DNR protected list
 *   is:protected           → row's header IS in the DNR protected list
 *   is:request             → row is a request header
 *   is:response            → row is a response header
 *   is:auth|cors|caching|security|content|cookies|tracing|other
 *                          → row's category matches
 *   is:drifted             → rule-attributed row with edited-since-fire
 *   -foo / -is:rule        → negate any token
 *
 * Quick toolbar toggles compile to synthetic tokens (`is:rule`,
 * `is:security`, …) so the same matching path covers both.
 */

import type { HeaderCategory } from './header-category';

export type HeaderFilterToken =
  | { kind: 'text'; value: string; negated: boolean }
  | { kind: 'name'; value: string; negated: boolean }
  | { kind: 'value'; value: string; negated: boolean }
  | { kind: 'is'; value: string; negated: boolean };

export interface HeaderRowMeta {
  name: string;
  value: string;
  direction: 'request' | 'response';
  origin: 'server' | 'rule' | 'system';
  category: HeaderCategory;
  /** True when DNR would reject a rule targeting this header (host,
   *  content-length, sec-ch-ua, …). Used by `is:overridable`. */
  protectedHeader: boolean;
  /** True for rule-attributed rows that have drifted since fire — the
   *  rule was edited, or a `{{var}}` it references resolves differently
   *  now. The view computes this from `isAttributionEdited` + value/name
   *  drift checks. */
  drifted: boolean;
}

const KNOWN_IS: ReadonlySet<string> = new Set([
  'rule',
  'server',
  'system',
  'overridable',
  'protected',
  'request',
  'response',
  'drifted',
  // Category tokens — match the keys in `header-category.ts`.
  'routing',
  'auth',
  'cors',
  'caching',
  'security',
  'cookies',
  'content',
  'connection',
  'client-hints',
  'fetch-metadata',
  'performance',
  'privacy',
  'server-id',
  'proxy',
  'tracing',
  'other',
]);

function tokenizeRaw(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (cur) {
        out.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function parseHeaderQuery(input: string): readonly HeaderFilterToken[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const out: HeaderFilterToken[] = [];
  for (const raw of tokenizeRaw(trimmed)) {
    let s = raw;
    let negated = false;
    if (s.startsWith('-') && s.length > 1) {
      negated = true;
      s = s.slice(1);
    }
    const colon = s.indexOf(':');
    if (colon > 0) {
      const key = s.slice(0, colon).toLowerCase();
      const value = s.slice(colon + 1);
      if (value) {
        if (key === 'name') {
          out.push({ kind: 'name', value, negated });
          continue;
        }
        if (key === 'value') {
          out.push({ kind: 'value', value, negated });
          continue;
        }
        if (key === 'is' && KNOWN_IS.has(value.toLowerCase())) {
          out.push({ kind: 'is', value: value.toLowerCase(), negated });
          continue;
        }
      }
    }
    out.push({ kind: 'text', value: s, negated });
  }
  return out;
}

function matchOne(meta: HeaderRowMeta, token: HeaderFilterToken): boolean {
  if (token.kind === 'text') {
    const needle = token.value.toLowerCase();
    return meta.name.toLowerCase().includes(needle) || meta.value.toLowerCase().includes(needle);
  }
  if (token.kind === 'name') {
    return meta.name.toLowerCase().includes(token.value.toLowerCase());
  }
  if (token.kind === 'value') {
    return meta.value.toLowerCase().includes(token.value.toLowerCase());
  }
  // is:*
  switch (token.value) {
    case 'rule':
      return meta.origin === 'rule';
    case 'server':
      return meta.origin === 'server';
    case 'system':
      return meta.origin === 'system';
    case 'overridable':
      return !meta.protectedHeader;
    case 'protected':
      return meta.protectedHeader;
    case 'request':
      return meta.direction === 'request';
    case 'response':
      return meta.direction === 'response';
    case 'drifted':
      return meta.drifted;
    case 'routing':
    case 'auth':
    case 'cors':
    case 'caching':
    case 'security':
    case 'content':
    case 'cookies':
    case 'connection':
    case 'client-hints':
    case 'fetch-metadata':
    case 'performance':
    case 'privacy':
    case 'server-id':
    case 'proxy':
    case 'tracing':
    case 'other':
      return meta.category === token.value;
    default:
      return false;
  }
}

export function matchesHeaderQuery(meta: HeaderRowMeta, tokens: readonly HeaderFilterToken[]): boolean {
  for (const token of tokens) {
    const ok = matchOne(meta, token);
    if (token.negated ? ok : !ok) return false;
  }
  return true;
}
