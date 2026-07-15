/**
 * Pure formatters for the response panel: map a response Content-Type
 * to a viewer language, pretty-print bodies for the Pretty view, and
 * humanize byte counts.
 */

import type { LanguageId } from '../../../languages/registry';
import { parseLosslessJson, stringifyLossless } from './lossless-json';

/**
 * Viewer language from the response `Content-Type`. Substring checks on
 * purpose — media types arrive with parameters (`; charset=utf-8`),
 * vendor prefixes (`application/vnd.api+json`) and suffixes (`+xml`),
 * and all of those should light up the base grammar.
 */
export function contentTypeOf(headers: ReadonlyArray<{ key: string; value: string }>): string {
  return headers.find((h) => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() ?? '';
}

/** True for PDF media types (`application/pdf`, legacy `x-pdf`) — the
 *  response body pane offers its dedicated Preview for these. */
export function isPdfResponse(headers: ReadonlyArray<{ key: string; value: string }>): boolean {
  return contentTypeOf(headers).includes('pdf');
}

/** Media families the body pane can render natively — each maps to a
 *  dedicated Preview (browser PDF viewer, blob `<img>`, blob `<audio>`/
 *  `<video>`). Content-Type picks the RENDERER only; whether the body
 *  is text or bytes stays decided by the bytes (`bodyEncoding`). */
export type MediaPreviewKind = 'pdf' | 'image' | 'audio' | 'video';

export function mediaPreviewKind(headers: ReadonlyArray<{ key: string; value: string }>): MediaPreviewKind | null {
  const ct = contentTypeOf(headers);
  if (ct.includes('pdf')) return 'pdf';
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('audio/')) return 'audio';
  if (ct.startsWith('video/')) return 'video';
  return null;
}

/** True for newline-delimited JSON (`application/x-ndjson`, `…/jsonl`) —
 *  the body is json-highlighted per line, but a whole-body `JSON.parse`
 *  can never succeed, so the JSON preview/filter parse line-wise. */
export function isNdjsonResponse(headers: ReadonlyArray<{ key: string; value: string }>): boolean {
  const ct = contentTypeOf(headers);
  return ct.includes('ndjson') || ct.includes('jsonl') || ct.includes('json-seq');
}

/** The Content-Type `charset=` parameter, normalized — `null` when the
 *  header carries none. Display-only attribution: capture never
 *  re-encodes, the viewer just decodes prettier. */
export function contentTypeCharset(headers: ReadonlyArray<{ key: string; value: string }>): string | null {
  const match = /;\s*charset=["']?([\w.:-]+)/.exec(contentTypeOf(headers));
  return match ? match[1] : null;
}

export function detectBodyLanguage(headers: ReadonlyArray<{ key: string; value: string }>): LanguageId {
  const ct = contentTypeOf(headers);
  if (ct.includes('json')) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'javascript';
  if (ct.includes('css')) return 'css';
  if (ct.includes('markdown')) return 'markdown';
  if (ct.includes('yaml')) return 'yaml';
  return 'text';
}

/**
 * Synchronous half of the Pretty view. JSON re-indents losslessly —
 * number tokens a double can't hold exactly (int64 ids, k8s
 * resourceVersions) re-print as their wire source text instead of the
 * rounded double (falling back to the wire text on parse failure);
 * every other language passes through — markup/code languages are
 * pretty-printed asynchronously on top of this by `useFormattedBody`.
 */
export function prettyBody(body: string, language: LanguageId): string {
  if (language === 'json') {
    const parsed = parseLosslessJson(body);
    return parsed === null ? body : stringifyLossless(parsed.value);
  }
  return body;
}

/**
 * Line-wise Pretty for newline-delimited JSON: a whole-body parse can
 * never succeed, so each line re-indents as its own record — blocks
 * back to back, jq-style, losslessly like {@link prettyBody}. Lines
 * that don't parse stay verbatim; empty lines drop (they separate
 * nothing in ndjson).
 */
export function prettyNdjsonBody(body: string): string {
  return body
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const parsed = parseLosslessJson(line);
      return parsed === null ? line : stringifyLossless(parsed.value);
    })
    .join('\n');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
