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
  // Prometheus/OpenMetrics exposition: its own media type, or the
  // `version=` parameter Prometheus servers stamp on text/plain
  // (`text/plain; version=0.0.4; charset=utf-8`).
  if (ct.includes('openmetrics-text')) return 'prometheus';
  if (ct.startsWith('text/plain') && /;\s*version=/.test(ct)) return 'prometheus';
  return 'text';
}

/** How much of a body the exposition-shape sniff reads — enough for a
 *  handful of families, cheap on a multi-MB /metrics dump. */
const METRICS_SNIFF_CHARS = 4096;

const METRICS_COMMENT_LINE = /^#(\s|$)/;
const METRICS_SAMPLE_LINE =
  /^[a-zA-Z_:][a-zA-Z0-9_:]*(?:\{.*\})?\s+(?:[+-]?(?:Inf|NaN)|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(\s|$)/;

/**
 * Shape sniff for servers that expose /metrics as bare `text/plain`:
 * the leading lines must all fit the exposition grammar AND include at
 * least one `# TYPE`/`# HELP` and one sample. Picks the DEFAULT view
 * only — the caller applies it when the Content-Type detected plain
 * text, and a manual language override always wins.
 */
export function sniffsAsMetricsBody(body: string): boolean {
  // Cut at the last complete line inside the sniff window — a partial
  // trailing line must not fail the shape test.
  const cut = body.length > METRICS_SNIFF_CHARS ? body.lastIndexOf('\n', METRICS_SNIFF_CHARS) : body.length;
  if (cut <= 0) return false;
  const lines = body
    .slice(0, cut)
    .split('\n')
    .filter((line) => line.trim() !== '');
  if (lines.length === 0) return false;
  let hasMeta = false;
  let hasSample = false;
  for (const line of lines) {
    if (/^#\s*(?:HELP|TYPE)\s+[a-zA-Z_:]/.test(line)) {
      hasMeta = true;
    } else if (METRICS_SAMPLE_LINE.test(line)) {
      hasSample = true;
    } else if (!METRICS_COMMENT_LINE.test(line)) {
      return false;
    }
  }
  return hasMeta && hasSample;
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
 * Record lines of a newline-delimited JSON body: empty lines drop
 * (they separate nothing), and RFC 7464 json-seq's leading record
 * separator (`\x1e`) strips per line — the one framing byte between
 * the ndjson siblings and a parseable record. Display-only, like every
 * line-wise path riding it; the wire body keeps its separators.
 */
export function ndjsonRecordLines(body: string): string[] {
  return body
    .split('\n')
    .map((line) => (line.charCodeAt(0) === 0x1e ? line.slice(1) : line))
    .filter((line) => line.trim() !== '');
}

/**
 * Line-wise Pretty for newline-delimited JSON: a whole-body parse can
 * never succeed, so each line re-indents as its own record — blocks
 * back to back, jq-style, losslessly like {@link prettyBody}. Lines
 * that don't parse stay verbatim; empty lines drop (they separate
 * nothing in ndjson).
 */
export function prettyNdjsonBody(body: string): string {
  return ndjsonRecordLines(body)
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
