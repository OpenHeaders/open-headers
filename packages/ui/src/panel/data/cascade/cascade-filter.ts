/**
 * Lightweight filter grammar for the Initiator cascade tree.
 *
 * Plain space-separated tokens; each must match the row for it to pass.
 * A leading `-` negates the token. Supported forms:
 *
 *   foo                  → URL contains "foo" (case-insensitive)
 *   "exact phrase"       → quoted substring (case-insensitive)
 *   is:failed            → row's request is failed/blocked
 *   is:third-party       → row's origin ≠ pageOrigin
 *   type:js|css|img|...  → resource type match (alias-aware)
 *   status:404           → exact statusCode match
 *   size:>50kb           → transferred bytes > N (k/kb/m/mb suffix)
 *   -foo / -is:failed    → negation
 *
 * Quick toggles in the UI compile to synthetic tokens (`is:failed`,
 * `is:third-party`) so the same matching path covers both code paths.
 *
 * Free-text comparison rides the shared panel `TextMatchConfig`
 * (Match Case / Whole Word / Regex). Regex mode treats the whole input
 * as one pattern tested against the URL; property tokens are not
 * parsed in that mode. Matchers are precompiled at parse time — the
 * per-row path never constructs a RegExp.
 */

import type { InitiatorRowMeta } from '../initiator/initiator-row-meta';
import {
  buildNeedleMatcher,
  compileRegexQuery,
  DEFAULT_TEXT_MATCH_CONFIG,
  type TextMatchConfig,
  type TextMatcher,
} from '../text-match';

type Token =
  | { kind: 'text'; value: string; negated: boolean; match: TextMatcher }
  | { kind: 'property'; key: 'is' | 'type' | 'status' | 'size'; value: string; negated: boolean }
  | { kind: 'regex'; pattern: RegExp | null; negated: boolean };

const TYPE_ALIASES: Record<string, readonly string[]> = {
  js: ['script', 'javascript'],
  script: ['script', 'javascript'],
  css: ['stylesheet', 'css'],
  img: ['image', 'img'],
  image: ['image', 'img'],
  font: ['font'],
  doc: ['document'],
  html: ['document'],
  xhr: ['xhr'],
  fetch: ['fetch'],
  media: ['media'],
  ws: ['websocket'],
  websocket: ['websocket'],
};

const SIZE_RE = /^([<>]?=?)\s*(\d+(?:\.\d+)?)\s*(k|kb|m|mb)?$/i;

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

export function parseCascadeQuery(
  input: string,
  config: TextMatchConfig = DEFAULT_TEXT_MATCH_CONFIG,
): readonly Token[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (config.regexMode) {
    return [{ kind: 'regex', pattern: compileRegexQuery(trimmed, config).pattern, negated: false }];
  }

  const out: Token[] = [];
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
      if ((key === 'is' || key === 'type' || key === 'status' || key === 'size') && value) {
        out.push({ kind: 'property', key, value, negated });
        continue;
      }
    }
    out.push({ kind: 'text', value: s, negated, match: buildNeedleMatcher(s, config) });
  }
  return out;
}

/** True when the query is a regex-mode input that failed to parse. */
export function hasCascadeQueryError(tokens: readonly Token[]): boolean {
  return tokens.some((t) => t.kind === 'regex' && t.pattern === null);
}

function matchSize(value: string, bytes: number | null): boolean {
  if (bytes == null) return false;
  const m = SIZE_RE.exec(value);
  if (!m) return false;
  const op = m[1] || '>';
  const num = Number.parseFloat(m[2]);
  const unit = (m[3] ?? '').toLowerCase();
  const threshold =
    unit === 'k' || unit === 'kb' ? num * 1024 : unit === 'm' || unit === 'mb' ? num * 1024 * 1024 : num;
  switch (op) {
    case '>':
      return bytes > threshold;
    case '>=':
      return bytes >= threshold;
    case '<':
      return bytes < threshold;
    case '<=':
      return bytes <= threshold;
    case '=':
    case '==':
      return bytes === threshold;
    default:
      return bytes > threshold;
  }
}

function matchType(value: string, resourceType: string | null): boolean {
  if (!resourceType) return false;
  const want = value.toLowerCase();
  if (resourceType === want) return true;
  const aliases = TYPE_ALIASES[want];
  if (aliases && aliases.includes(resourceType)) return true;
  // Also match initiator-type aliases via resource type fallback.
  return false;
}

function matchOne(url: string, meta: InitiatorRowMeta, token: Token): boolean {
  if (token.kind === 'regex') {
    // A broken pattern matches everything — the input turns red instead
    // of silently hiding every row.
    if (token.pattern === null) return true;
    return token.pattern.test(url);
  }
  if (token.kind === 'text') {
    return token.match(url);
  }
  switch (token.key) {
    case 'is': {
      const v = token.value.toLowerCase();
      if (v === 'failed') return meta.isFailed;
      if (v === 'third-party' || v === '3p' || v === 'third_party') return meta.isThirdParty;
      if (v === 'slow') return (meta.durationMs ?? 0) > 1000;
      return false;
    }
    case 'type':
      return matchType(token.value, meta.resourceType);
    case 'status':
      return meta.statusCode != null && String(meta.statusCode) === token.value;
    case 'size':
      return matchSize(token.value, meta.sizeBytes);
  }
}

export function matchesCascadeQuery(url: string, meta: InitiatorRowMeta, tokens: readonly Token[]): boolean {
  for (const token of tokens) {
    const ok = matchOne(url, meta, token);
    if (token.negated ? ok : !ok) return false;
  }
  return true;
}
