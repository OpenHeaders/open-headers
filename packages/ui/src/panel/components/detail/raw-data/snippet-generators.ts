/**
 * Code-snippet generators for the Raw Data tab.
 *
 * Each format takes the (already-derived) header list + a few flags and
 * emits a ready-to-paste string. Caller pre-resolves original-vs-post-
 * rule headers and pre-applies redaction; these functions only handle
 * format-specific escaping and shape.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { InspectorHarEntry } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { buildHarFromEntries } from '../../../data/har/har-export';

export type SnippetFormat =
  | 'curl-unix'
  | 'curl-windows'
  | 'fetch-browser'
  | 'fetch-node'
  | 'python-requests'
  | 'powershell'
  | 'http-raw'
  | 'har';

export interface SnippetFormatMeta {
  value: SnippetFormat;
  labelKey: MessageKey;
  group: 'shell' | 'js' | 'python' | 'win' | 'raw' | 'json';
  language: string;
}

export const SNIPPET_FORMATS: readonly SnippetFormatMeta[] = [
  { value: 'curl-unix', labelKey: 'panel.inspector.rawData.format.curlUnix', group: 'shell', language: 'bash' },
  {
    value: 'curl-windows',
    labelKey: 'panel.inspector.rawData.format.curlWindows',
    group: 'shell',
    language: 'powershell',
  },
  {
    value: 'fetch-browser',
    labelKey: 'panel.inspector.rawData.format.fetchBrowser',
    group: 'js',
    language: 'javascript',
  },
  { value: 'fetch-node', labelKey: 'panel.inspector.rawData.format.fetchNode', group: 'js', language: 'javascript' },
  {
    value: 'python-requests',
    labelKey: 'panel.inspector.rawData.format.pythonRequests',
    group: 'python',
    language: 'python',
  },
  { value: 'powershell', labelKey: 'panel.inspector.rawData.format.powershell', group: 'win', language: 'powershell' },
  { value: 'http-raw', labelKey: 'panel.inspector.rawData.format.httpRaw', group: 'raw', language: 'http' },
  { value: 'har', labelKey: 'panel.inspector.rawData.format.har', group: 'json', language: 'json' },
] as const;

interface NameValue {
  name: string;
  value: string;
}

export interface SnippetOptions {
  harEntry: InspectorHarEntry;
  headers: readonly NameValue[];
  format: SnippetFormat;
  includeHeaders: boolean;
  includeBody: boolean;
  /** Only consulted by the `har` format — used to emit `log.pages[]`
   *  + entry `pageref` so the snippet matches Chrome's exported HAR. */
  pageref?: string;
  pages?: readonly Page[];
}

export function generateSnippet(opts: SnippetOptions): string {
  switch (opts.format) {
    case 'curl-unix':
      return curlUnix(opts);
    case 'curl-windows':
      return curlWindows(opts);
    case 'fetch-browser':
      return fetchSnippet(opts, true);
    case 'fetch-node':
      return fetchSnippet(opts, false);
    case 'python-requests':
      return pythonRequests(opts);
    case 'powershell':
      return powershell(opts);
    case 'http-raw':
      return httpRaw(opts);
    case 'har':
      return harSingleEntry(opts);
  }
}

// ── shared helpers ─────────────────────────────────────────────────

function method(har: InspectorHarEntry): string {
  return (har.request?.method ?? 'GET').toUpperCase();
}

function url(har: InspectorHarEntry): string {
  return har.request?.url ?? '';
}

function bodyText(har: InspectorHarEntry, include: boolean): string | null {
  if (!include) return null;
  const t = har.request?.postData?.text;
  return t && t.length > 0 ? t : null;
}

function singleQuote(s: string): string {
  // bash single-quote escaping: end quote, escaped quote, re-open.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function doubleQuoteJs(s: string): string {
  return JSON.stringify(s);
}

// ── cURL (bash) ────────────────────────────────────────────────────

function curlUnix({ harEntry, headers, includeHeaders, includeBody }: SnippetOptions): string {
  const lines: string[] = [];
  lines.push(`curl ${singleQuote(url(harEntry))}`);
  const m = method(harEntry);
  if (m !== 'GET') lines.push(`  -X ${m}`);
  if (includeHeaders) {
    for (const h of headers) lines.push(`  -H ${singleQuote(`${h.name}: ${h.value}`)}`);
  }
  const body = bodyText(harEntry, includeBody);
  if (body !== null) lines.push(`  --data-raw ${singleQuote(body)}`);
  if ((harEntry.request?.headers ?? []).some((h) => h.name.toLowerCase() === 'accept-encoding')) {
    lines.push('  --compressed');
  }
  return lines.join(' \\\n');
}

// ── cURL (Windows / cmd.exe) ───────────────────────────────────────

function escapeDoubleQuoteCmd(s: string): string {
  // cmd.exe: " must be doubled; ^ used as a line continuation.
  return s.replace(/"/g, '""');
}

function curlWindows({ harEntry, headers, includeHeaders, includeBody }: SnippetOptions): string {
  const lines: string[] = [];
  lines.push(`curl "${escapeDoubleQuoteCmd(url(harEntry))}"`);
  const m = method(harEntry);
  if (m !== 'GET') lines.push(`  -X ${m}`);
  if (includeHeaders) {
    for (const h of headers) lines.push(`  -H "${escapeDoubleQuoteCmd(`${h.name}: ${h.value}`)}"`);
  }
  const body = bodyText(harEntry, includeBody);
  if (body !== null) lines.push(`  --data-raw "${escapeDoubleQuoteCmd(body)}"`);
  return lines.join(' ^\n');
}

// ── fetch ──────────────────────────────────────────────────────────

function fetchSnippet({ harEntry, headers, includeHeaders, includeBody }: SnippetOptions, browser: boolean): string {
  const m = method(harEntry);
  const init: string[] = [`  "method": ${doubleQuoteJs(m)}`];
  if (includeHeaders && headers.length > 0) {
    const hLines = headers.map((h) => `    ${doubleQuoteJs(h.name)}: ${doubleQuoteJs(h.value)}`).join(',\n');
    init.push(`  "headers": {\n${hLines}\n  }`);
  }
  const body = bodyText(harEntry, includeBody);
  if (body !== null) init.push(`  "body": ${doubleQuoteJs(body)}`);
  if (browser) init.push(`  "credentials": "include"`);
  return `await fetch(${doubleQuoteJs(url(harEntry))}, {\n${init.join(',\n')}\n});`;
}

// ── Python requests ────────────────────────────────────────────────

function pythonRequests({ harEntry, headers, includeHeaders, includeBody }: SnippetOptions): string {
  const lines: string[] = ['import requests', ''];
  const m = method(harEntry).toLowerCase();
  const args: string[] = [pyString(url(harEntry))];
  if (includeHeaders && headers.length > 0) {
    const h = headers.map((x) => `    ${pyString(x.name)}: ${pyString(x.value)},`).join('\n');
    args.push(`headers={\n${h}\n}`);
  }
  const body = bodyText(harEntry, includeBody);
  if (body !== null) args.push(`data=${pyString(body)}`);
  lines.push(`response = requests.${m}(${args.join(', ')})`);
  return lines.join('\n');
}

function pyString(s: string): string {
  // Triple-quote when the value contains newlines so the output stays
  // readable; otherwise prefer single-line repr-style.
  if (s.includes('\n')) {
    const escaped = s.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
    return `"""${escaped}"""`;
  }
  return JSON.stringify(s);
}

// ── PowerShell ─────────────────────────────────────────────────────

function powershell({ harEntry, headers, includeHeaders, includeBody }: SnippetOptions): string {
  const lines: string[] = [];
  if (includeHeaders && headers.length > 0) {
    const h = headers.map((x) => `  ${psString(x.name)} = ${psString(x.value)}`).join('\n');
    lines.push(`$headers = @{\n${h}\n}`);
    lines.push('');
  }
  const args: string[] = [`-Uri ${psString(url(harEntry))}`, `-Method ${method(harEntry)}`];
  if (includeHeaders && headers.length > 0) args.push('-Headers $headers');
  const body = bodyText(harEntry, includeBody);
  if (body !== null) args.push(`-Body ${psString(body)}`);
  lines.push(`Invoke-WebRequest ${args.join(' ')}`);
  return lines.join('\n');
}

function psString(s: string): string {
  // PowerShell single-quoted: only ' needs doubling.
  return `'${s.replace(/'/g, `''`)}'`;
}

// ── Raw HTTP ───────────────────────────────────────────────────────

function httpRaw({ harEntry, headers, includeHeaders, includeBody }: SnippetOptions): string {
  let path = '/';
  let host = '';
  try {
    const u = new URL(url(harEntry));
    path = `${u.pathname}${u.search}`;
    host = u.host;
  } catch {
    // leave defaults
  }
  const lines: string[] = [`${method(harEntry)} ${path} ${harEntry.request?.httpVersion ?? 'HTTP/1.1'}`];
  if (host) lines.push(`Host: ${host}`);
  if (includeHeaders) {
    for (const h of headers) {
      if (h.name.toLowerCase() === 'host') continue;
      lines.push(`${h.name}: ${h.value}`);
    }
  }
  lines.push('');
  const body = bodyText(harEntry, includeBody);
  if (body !== null) lines.push(body);
  return lines.join('\n');
}

// ── HAR (single entry, wrapped in the same log envelope as "Copy all as HAR") ──

function harSingleEntry({ harEntry, headers, includeHeaders, includeBody, pageref, pages }: SnippetOptions): string {
  const cloned: InspectorHarEntry = JSON.parse(JSON.stringify(harEntry)) as InspectorHarEntry;
  if (cloned.request) {
    cloned.request.headers = includeHeaders ? headers.map((h) => ({ name: h.name, value: h.value })) : [];
    if (!includeBody && cloned.request.postData) {
      cloned.request.postData = { ...cloned.request.postData, text: '', params: [] };
    }
  }
  return JSON.stringify(buildHarFromEntries([{ harEntry: cloned, pageref }], pages ?? []), null, 2);
}
