/**
 * useFormattedBody — async pretty-printing for the response Pretty
 * view. JSON is re-indented synchronously upstream (`prettyBody`);
 * markup and code languages go through the lazy Prettier pipeline
 * here, so the wire text paints first and the formatted text swaps in
 * when Prettier resolves. Formatting failure (or an unformattable
 * language) leaves the wire text in place.
 */

import { useEffect, useState } from 'react';
import { formatString } from '../../../languages/prettier';
import type { LanguageId } from '../../../languages/registry';

const FORMATTABLE = new Set<LanguageId>(['html', 'xml', 'css', 'javascript']);

/** Prettier runs on the main thread — beyond this size the wire text
 *  renders verbatim instead of janking the panel. */
const FORMAT_CAP_CHARS = 1024 * 1024;

export function useFormattedBody(text: string, language: LanguageId): string;
export function useFormattedBody(text: string | null, language: LanguageId): string | null;
export function useFormattedBody(text: string | null, language: LanguageId): string | null {
  // Keyed by source text: a stale format result for the previous body
  // never renders against the new one.
  const [formatted, setFormatted] = useState<{ source: string; result: string } | null>(null);

  useEffect(() => {
    if (text === null || text.length > FORMAT_CAP_CHARS || !FORMATTABLE.has(language)) return;
    let stale = false;
    formatString(text, language).then(
      (result) => {
        if (!stale) setFormatted({ source: text, result });
      },
      () => {},
    );
    return () => {
      stale = true;
    };
  }, [text, language]);

  return formatted !== null && formatted.source === text ? formatted.result : text;
}
