/**
 * Save-body support: pure filename derivation (unit-tested) plus the
 * one DOM step that hands the body to the browser as a download —
 * text verbatim, binary (`bodyEncoding: 'base64'`) as its decoded
 * wire bytes, so a captured PDF saves as a working PDF.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { LanguageId } from '../../../languages/registry';
import { fromBase64 } from './response-encoding';
import { contentTypeOf } from './response-format';

/** File extension per detected body language. */
const SAVE_EXTENSIONS: Record<LanguageId, string> = {
  javascript: 'js',
  css: 'css',
  json: 'json',
  xml: 'xml',
  html: 'html',
  text: 'txt',
  graphql: 'graphql',
  markdown: 'md',
  yaml: 'yaml',
  prometheus: 'txt',
  protobuf: 'proto',
};

/**
 * File extension per base media type — formats the language registry
 * can't name: binary families (images, archives, wasm, fonts, media)
 * plus text types whose grammar maps to a generic language (csv/tsv →
 * text, svg → xml, ndjson → json).
 */
const MEDIA_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/gzip': 'gz',
  'application/x-gzip': 'gz',
  'application/wasm': 'wasm',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/x-ndjson': 'ndjson',
  'application/jsonl': 'jsonl',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
};

/** Extension named by the response's own media type — parameters
 *  stripped; `undefined` when the type isn't in the map (the detected
 *  body language names one instead). */
export function saveExtensionForContentType(
  headers: ReadonlyArray<{ key: string; value: string }>,
): string | undefined {
  const base = contentTypeOf(headers).split(';')[0].trim();
  return MEDIA_TYPE_EXTENSIONS[base];
}

/** A trailing `.ext` the URL segment already carries — kept verbatim
 *  so `report.csv` never becomes `report.csv.txt`. */
const HAS_EXTENSION = /\.[A-Za-z0-9]{1,8}$/;

/**
 * Derive a download filename from the response's final URL: last
 * non-empty path segment (percent-decoded, sanitized), falling back to
 * `response`. A segment without an extension gets `extensionOverride`
 * when given (binary media types the language registry can't name,
 * e.g. `pdf`), else one from the detected body language.
 */
export function deriveSaveFilename(url: string, language: LanguageId, extensionOverride?: string): string {
  let segment = '';
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    segment = segments[segments.length - 1] ?? '';
  } catch {
    segment = '';
  }
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // Malformed percent-encoding — keep the raw segment.
  }
  segment = segment.replace(/[^\w.-]+/g, '_').replace(/^[._]+/, '');
  if (!segment) segment = 'response';
  return HAS_EXTENSION.test(segment) ? segment : `${segment}.${extensionOverride ?? SAVE_EXTENSIONS[language]}`;
}

/**
 * Hand the body to the browser as a download via a transient anchor —
 * the workbench is an extension page, so no downloads permission is
 * needed. Saves what we hold: a truncated body saves truncated, never
 * re-fetched; a binary body saves its decoded wire bytes.
 */
export function downloadBodyAsFile(
  response: Pick<ExecutedRequestSnapshot, 'body' | 'bodyEncoding' | 'headers' | 'url'>,
  language: LanguageId,
): void {
  const baseType = contentTypeOf(response.headers).split(';')[0].trim();
  const blob =
    response.bodyEncoding === 'base64'
      ? new Blob([fromBase64(response.body)], { type: baseType || 'application/octet-stream' })
      : // Text bodies hold valid UTF-8 by the capture law (anything else
        // rides base64), so the save is labeled utf-8 regardless of the
        // wire charset.
        new Blob([response.body], { type: `${baseType || 'text/plain'};charset=utf-8` });
  const extensionOverride =
    saveExtensionForContentType(response.headers) ?? (response.bodyEncoding === 'base64' ? 'bin' : undefined);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = deriveSaveFilename(response.url, language, extensionOverride);
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
