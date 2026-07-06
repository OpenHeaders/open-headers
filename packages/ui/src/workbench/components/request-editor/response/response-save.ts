/**
 * Pure filename derivation for the Body toolbar's Save action. The
 * DOM side (Blob + anchor click) lives in `ResponseBodyView`; this
 * module owns everything unit-testable.
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
