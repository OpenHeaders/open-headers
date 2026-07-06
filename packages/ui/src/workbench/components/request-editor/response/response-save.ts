/**
 * Save-body support: pure filename derivation (unit-tested) plus the
 * one DOM step that hands the text to the browser as a download.
 */

import type { LanguageId } from '../../../languages/registry';

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
 * `response`. A segment without an extension gets one from the
 * detected body language.
 */
export function deriveSaveFilename(url: string, language: LanguageId): string {
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
  return HAS_EXTENSION.test(segment) ? segment : `${segment}.${SAVE_EXTENSIONS[language]}`;
}

/**
 * Hand the body text to the browser as a download via a transient
 * anchor — the workbench is an extension page, so no downloads
 * permission is needed. Saves the text we hold: a truncated body saves
 * truncated, never re-fetched.
 */
export function downloadBodyAsFile(body: string, url: string, language: LanguageId): void {
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = deriveSaveFilename(url, language);
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
