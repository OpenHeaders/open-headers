/**
 * Request formatters — turn a `RequestLifecycle` / its current HAR
 * entry into the canonical text forms exposed by the row context menu
 * (Copy as cURL, Copy as fetch, Copy headers, etc).
 *
 * The goal is 1:1 parity with Chrome DevTools' own right-click actions.
 * For cURL we emit POSIX-shell quoting (single-quote escape via
 * `'\''`) since the Network tab's default copy format is the POSIX
 * variant. Headers are deduplicated by case-insensitive name, matching
 * how the browser reports them.
 *
 * Until a HAR lands for the current hop, formatters that need request
 * headers / body fall back to the lifecycle's url + method only.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { currentHarEntry } from './inspector-row-projection';

type Header = { name: string; value: string };

const EXCLUDED_REQUEST_HEADER_PREFIXES = [':'];
const EXCLUDED_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length']);

function filterRequestHeaders(headers: readonly Header[]): Header[] {
  return headers.filter((h) => {
    if (!h.name) return false;
    if (EXCLUDED_REQUEST_HEADER_PREFIXES.some((p) => h.name.startsWith(p))) return false;
    if (EXCLUDED_REQUEST_HEADERS.has(h.name.toLowerCase())) return false;
    return true;
  });
}

function shellQuote(value: string): string {
  if (value === '') return "''";
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatCurl(lc: RequestLifecycle): string {
  const har = currentHarEntry(lc);
  const method = (lc.method || har?.request?.method || 'GET').toUpperCase();
  const url = lc.url;
  const parts: string[] = [`curl ${shellQuote(url)}`];

  if (method !== 'GET') {
    parts.push(`-X ${shellQuote(method)}`);
  }

  for (const h of filterRequestHeaders(har?.request?.headers ?? [])) {
    parts.push(`-H ${shellQuote(`${h.name}: ${h.value}`)}`);
  }

  const body = har?.request?.postData?.text;
  if (body != null && body.length > 0) {
    parts.push(`--data-raw ${shellQuote(body)}`);
  }

  return parts.join(' \\\n  ');
}

export function formatFetch(lc: RequestLifecycle): string {
  const har = currentHarEntry(lc);
  const method = (lc.method || har?.request?.method || 'GET').toUpperCase();
  const headers = filterRequestHeaders(har?.request?.headers ?? []);
  const body = har?.request?.postData?.text;

  const init: Record<string, unknown> = {};
  if (headers.length > 0) {
    const hObj: Record<string, string> = {};
    for (const h of headers) {
      hObj[h.name] = h.value;
    }
    init.headers = hObj;
  }
  if (method !== 'GET') init.method = method;
  if (body != null && body.length > 0) init.body = body;

  const optsJson = Object.keys(init).length === 0 ? '' : `, ${JSON.stringify(init, null, 2)}`;
  return `fetch(${JSON.stringify(lc.url)}${optsJson})`;
}

export function formatHeadersBlock(headers: readonly Header[]): string {
  return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

export function formatRequestHeaders(lc: RequestLifecycle): string {
  return formatHeadersBlock(currentHarEntry(lc)?.request?.headers ?? []);
}

export function formatResponseHeaders(lc: RequestLifecycle): string {
  return formatHeadersBlock(currentHarEntry(lc)?.response?.headers ?? []);
}

export function formatStatusLine(har: InspectorHarEntry): string {
  const res = har.response;
  if (!res) return '';
  const version = res.httpVersion ?? 'HTTP/1.1';
  return `${version} ${res.status} ${res.statusText ?? ''}`.trim();
}

export function formatRequestLine(har: InspectorHarEntry): string {
  const req = har.request;
  if (!req) return '';
  const version = req.httpVersion ?? 'HTTP/1.1';
  return `${req.method} ${req.url} ${version}`.trim();
}
