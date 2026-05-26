import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry } from './inspector-row-projection';
import { classifyRequestState } from './request-state';

/**
 * Toolbar-level coarse filters — mirrors the "More filters" menu
 * conventions. `hide*` filters exclude matching rows; `only*` filters
 * restrict the list to matching rows only. Multiple filters compose
 * via AND (a row must pass every active filter).
 */
export interface FilterConfig {
  matchCase: boolean;
  wholeWord: boolean;
  regexMode: boolean;
  /** Hide `data:` / `blob:` URLs (usually inline images, fonts). */
  hideDataUrls: boolean;
  /** Hide `chrome-extension://` / `moz-extension://` / etc. URLs. */
  hideExtensionUrls: boolean;
  /** Show ONLY requests to a different origin from `pageOrigin`. */
  onlyThirdParty: boolean;
  /** Show ONLY requests the host reported as blocked. */
  onlyBlockedRequests: boolean;
  /** Inspected-window origin, used as the same-origin baseline for `onlyThirdParty`. */
  pageOrigin: string | null;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  matchCase: false,
  wholeWord: false,
  regexMode: false,
  hideDataUrls: false,
  hideExtensionUrls: false,
  onlyThirdParty: false,
  onlyBlockedRequests: false,
  pageOrigin: null,
};

const EXTENSION_URL_RE = /^(chrome|moz|edge|safari-web)-extension:\/\//i;

function isExtensionUrl(url: string): boolean {
  return EXTENSION_URL_RE.test(url);
}

export type PropertyFilterKey =
  | 'domain'
  | 'status-code'
  | 'method'
  | 'mime-type'
  | 'has-response-header'
  | 'larger-than'
  | 'is';

const PROPERTY_KEYS = new Set<string>([
  'domain',
  'status-code',
  'method',
  'mime-type',
  'has-response-header',
  'larger-than',
  'is',
]);

export type FilterToken =
  | { type: 'text'; value: string; negated: boolean }
  | { type: 'property'; key: PropertyFilterKey; value: string; negated: boolean }
  | { type: 'regex'; pattern: RegExp | null; error?: string };

function tokenizeInput(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function parseSize(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(k|m|kb|mb)?$/i);
  if (!match) return Number.NaN;
  const num = Number.parseFloat(match[1]);
  const suffix = (match[2] ?? '').toLowerCase();
  if (suffix === 'k' || suffix === 'kb') return num * 1024;
  if (suffix === 'm' || suffix === 'mb') return num * 1024 * 1024;
  return num;
}

export function parseFilter(input: string, config: FilterConfig): FilterToken[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (config.regexMode) {
    const flags = config.matchCase ? '' : 'i';
    try {
      return [{ type: 'regex', pattern: new RegExp(trimmed, flags) }];
    } catch {
      return [{ type: 'regex', pattern: null, error: 'Invalid regular expression' }];
    }
  }

  const raw = tokenizeInput(trimmed);
  const tokens: FilterToken[] = [];

  for (const segment of raw) {
    let negated = false;
    let s = segment;

    if (s.startsWith('-') && s.length > 1) {
      negated = true;
      s = s.slice(1);
    }

    const colonIdx = s.indexOf(':');
    if (colonIdx > 0) {
      const key = s.slice(0, colonIdx).toLowerCase();
      const value = s.slice(colonIdx + 1);
      if (PROPERTY_KEYS.has(key) && value) {
        tokens.push({ type: 'property', key: key as PropertyFilterKey, value, negated });
        continue;
      }
    }

    tokens.push({ type: 'text', value: s, negated });
  }

  return tokens;
}

export function hasFilterError(tokens: FilterToken[]): boolean {
  return tokens.some((t) => t.type === 'regex' && t.pattern === null);
}

function textMatches(haystack: string, needle: string, config: FilterConfig): boolean {
  const h = config.matchCase ? haystack : haystack.toLowerCase();
  const n = config.matchCase ? needle : needle.toLowerCase();

  if (config.wholeWord) {
    try {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, config.matchCase ? '' : 'i');
      return re.test(haystack);
    } catch {
      return h.includes(n);
    }
  }

  return h.includes(n);
}

function transferredBytes(lc: RequestLifecycle): number {
  const bs = currentHarEntry(lc)?.response?.bodySize;
  if (typeof bs === 'number' && bs >= 0) return bs;
  const cs = currentHarEntry(lc)?.response?.content?.size;
  if (typeof cs === 'number' && cs >= 0) return cs;
  return 0;
}

function isFromCache(lc: RequestLifecycle): boolean {
  if (lc.statusCode === 304) return true;
  if (lc.fromCache === true) return true;
  const har = currentHarEntry(lc);
  if (!har) return false;
  return har._fromCache === 'disk' || har._fromCache === 'memory' || har._servedFromCache === true;
}

function matchProperty(lc: RequestLifecycle, key: PropertyFilterKey, value: string): boolean {
  switch (key) {
    case 'domain': {
      try {
        const hostname = new URL(lc.url).hostname.toLowerCase();
        return hostname.includes(value.toLowerCase());
      } catch {
        return false;
      }
    }
    case 'status-code': {
      if (lc.statusCode == null) return false;
      return String(lc.statusCode) === value;
    }
    case 'method':
      return lc.method.toLowerCase() === value.toLowerCase();
    case 'mime-type': {
      const mime = (currentHarEntry(lc)?.response?.content?.mimeType ?? '').toLowerCase();
      return mime.includes(value.toLowerCase());
    }
    case 'has-response-header': {
      const headers = currentHarEntry(lc)?.response?.headers;
      if (!headers) return false;
      const target = value.toLowerCase();
      return headers.some((h) => h.name.toLowerCase() === target);
    }
    case 'larger-than': {
      const threshold = parseSize(value);
      if (Number.isNaN(threshold)) return false;
      return transferredBytes(lc) > threshold;
    }
    case 'is': {
      if (value.toLowerCase() === 'from-cache') return isFromCache(lc);
      return false;
    }
  }
}

function matchToken(lc: RequestLifecycle, token: FilterToken, config: FilterConfig): boolean {
  switch (token.type) {
    case 'text': {
      const result = textMatches(lc.url, token.value, config);
      return token.negated ? !result : result;
    }
    case 'property': {
      const result = matchProperty(lc, token.key, token.value);
      return token.negated ? !result : result;
    }
    case 'regex': {
      if (!token.pattern) return true;
      return token.pattern.test(lc.url);
    }
  }
}

export function matchesUrlFilter(lc: RequestLifecycle, tokens: FilterToken[], config: FilterConfig): boolean {
  for (const token of tokens) {
    if (!matchToken(lc, token, config)) return false;
  }
  return true;
}

function isDataOrBlobUrl(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:');
}

/**
 * Strict first-party check — returns true only when we're *sure* the
 * URL shares the page's origin. Unparseable URLs return false (we
 * can't assert same-origin), which keeps defensive "don't silently
 * hide unparseable rows" behavior in the `onlyThirdParty` branch.
 */
function isFirstParty(url: string, pageOrigin: string): boolean {
  try {
    return new URL(url).origin === pageOrigin;
  } catch {
    return false;
  }
}

/**
 * Coarse row filters applied before the URL-filter token pass. Kept
 * separate so the URL filter stays purely about URL/header/method
 * token semantics and toolbar toggles stay an obvious pre-filter.
 */
export function passesRowFilters(lc: RequestLifecycle, config: FilterConfig): boolean {
  if (config.hideDataUrls && isDataOrBlobUrl(lc.url)) return false;
  if (config.hideExtensionUrls && isExtensionUrl(lc.url)) return false;
  if (config.onlyThirdParty && config.pageOrigin != null && isFirstParty(lc.url, config.pageOrigin)) return false;
  if (config.onlyBlockedRequests) {
    const s = classifyRequestState(lc);
    if (s.kind !== 'blocked' && s.kind !== 'failed') return false;
  }
  return true;
}
