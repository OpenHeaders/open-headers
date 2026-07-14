/**
 * Save-body support: pure filename derivation (unit-tested) plus the
 * one DOM step that hands the body to the browser as a download —
 * text verbatim, binary (`bodyEncoding: 'base64'`) as its decoded
 * wire bytes, so a captured PDF saves as a working PDF.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { LanguageId } from '../../../languages/registry';
import { fromBase64 } from './response-encoding';
import { isPdfResponse } from './response-format';

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
};

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
  const isPdf = isPdfResponse(response.headers);
  const blob =
    response.bodyEncoding === 'base64'
      ? new Blob([fromBase64(response.body)], { type: isPdf ? 'application/pdf' : 'application/octet-stream' })
      : new Blob([response.body], { type: 'text/plain;charset=utf-8' });
  const extensionOverride = isPdf ? 'pdf' : response.bodyEncoding === 'base64' ? 'bin' : undefined;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = deriveSaveFilename(response.url, language, extensionOverride);
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
