import type { InspectorRequest } from './types';

export interface FilterConfig {
  matchCase: boolean;
  wholeWord: boolean;
  regexMode: boolean;
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  matchCase: false,
  wholeWord: false,
  regexMode: false,
};

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

function matchProperty(entry: InspectorRequest, key: PropertyFilterKey, value: string): boolean {
  switch (key) {
    case 'domain': {
      try {
        const hostname = new URL(entry.url).hostname.toLowerCase();
        return hostname.includes(value.toLowerCase());
      } catch {
        return false;
      }
    }
    case 'status-code': {
      if (entry.statusCode == null) return false;
      return String(entry.statusCode) === value;
    }
    case 'method':
      return entry.method.toLowerCase() === value.toLowerCase();
    case 'mime-type': {
      const mime = (entry.mimeType ?? '').toLowerCase();
      return mime.includes(value.toLowerCase());
    }
    case 'has-response-header': {
      const headers = entry.harEntry?.response?.headers;
      if (!headers) return false;
      const target = value.toLowerCase();
      return headers.some((h) => h.name.toLowerCase() === target);
    }
    case 'larger-than': {
      const threshold = parseSize(value);
      if (Number.isNaN(threshold)) return false;
      return (entry.responseSize ?? 0) > threshold;
    }
    case 'is': {
      if (value.toLowerCase() === 'from-cache') {
        if (entry.statusCode === 304) return true;
        const har = entry.harEntry as unknown as Record<string, unknown>;
        return har._fromCache === true || har._servedFromCache === true;
      }
      return false;
    }
  }
}

function matchToken(entry: InspectorRequest, token: FilterToken, config: FilterConfig): boolean {
  switch (token.type) {
    case 'text': {
      const result = textMatches(entry.url, token.value, config);
      return token.negated ? !result : result;
    }
    case 'property': {
      const result = matchProperty(entry, token.key, token.value);
      return token.negated ? !result : result;
    }
    case 'regex': {
      if (!token.pattern) return true;
      return token.pattern.test(entry.url);
    }
  }
}

export function matchesUrlFilter(entry: InspectorRequest, tokens: FilterToken[], config: FilterConfig): boolean {
  for (const token of tokens) {
    if (!matchToken(entry, token, config)) return false;
  }
  return true;
}
