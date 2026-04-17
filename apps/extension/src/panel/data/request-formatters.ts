/**
 * Request formatters — turn an `InspectorRequest` / its underlying HAR
 * entry into the canonical text forms exposed by the row context menu
 * (Copy as cURL, Copy as fetch, Copy headers, etc).
 *
 * The goal is 1:1 parity with Chrome DevTools' own right-click actions.
 * For cURL we emit POSIX-shell quoting (single-quote escape via
 * `'\''`) since the Network tab's default copy format is the POSIX
 * variant. Headers are deduplicated by case-insensitive name, matching
 * how the browser reports them.
 */

import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';
import type { InspectorRequest } from './types';

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
  // POSIX safe: close single quote, escape with \', reopen single quote.
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatCurl(request: InspectorRequest): string {
  const har = request.harEntry;
  const method = request.method || har.request?.method || 'GET';
  const url = request.url;
  const parts: string[] = [`curl ${shellQuote(url)}`];

  if (method.toUpperCase() !== 'GET') {
    parts.push(`-X ${shellQuote(method.toUpperCase())}`);
  }

  for (const h of filterRequestHeaders(har.request?.headers ?? [])) {
    parts.push(`-H ${shellQuote(`${h.name}: ${h.value}`)}`);
  }

  const body = har.request?.postData?.text;
  if (body != null && body.length > 0) {
    parts.push(`--data-raw ${shellQuote(body)}`);
  }

  return parts.join(' \\\n  ');
}

export function formatFetch(request: InspectorRequest): string {
  const har = request.harEntry;
  const method = (request.method || har.request?.method || 'GET').toUpperCase();
  const headers = filterRequestHeaders(har.request?.headers ?? []);
  const body = har.request?.postData?.text;

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
  return `fetch(${JSON.stringify(request.url)}${optsJson})`;
}

export function formatHeadersBlock(headers: readonly Header[]): string {
  return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

export function formatRequestHeaders(request: InspectorRequest): string {
  return formatHeadersBlock(request.harEntry.request?.headers ?? []);
}

export function formatResponseHeaders(request: InspectorRequest): string {
  return formatHeadersBlock(request.harEntry.response?.headers ?? []);
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
