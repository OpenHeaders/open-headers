/**
 * Pure formatters for the response panel: map a response Content-Type
 * to a viewer language, pretty-print bodies for the Pretty view, and
 * humanize byte counts.
 */

import type { LanguageId } from '../../../languages/registry';

/**
 * Viewer language from the response `Content-Type`. Substring checks on
 * purpose — media types arrive with parameters (`; charset=utf-8`),
 * vendor prefixes (`application/vnd.api+json`) and suffixes (`+xml`),
 * and all of those should light up the base grammar.
 */
export function detectBodyLanguage(headers: ReadonlyArray<{ key: string; value: string }>): LanguageId {
  const ct = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() ?? '';
  if (ct.includes('json')) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'javascript';
  if (ct.includes('css')) return 'css';
  if (ct.includes('markdown')) return 'markdown';
  return 'text';
}

/**
 * Synchronous half of the Pretty view. JSON re-indents (falling back
 * to the wire text on parse failure); every other language passes
 * through — markup/code languages are pretty-printed asynchronously on
 * top of this by `useFormattedBody`.
 */
export function prettyBody(body: string, language: LanguageId): string {
  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
