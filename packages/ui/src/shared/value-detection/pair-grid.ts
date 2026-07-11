/**
 * Pair-grid model — the structured VIEW over the line-per-segment
 * decoded text that cookie and query-string values edit as. The grid
 * never grows its own encoder: rows serialize back to the same decoded
 * line format, and the write path stays `encodeDetectedValue`, so
 * framing validation, prefix carry, and preview === written value all
 * remain codec-owned. A segment without `=` is a bare flag (cookie
 * `Secure` / `HttpOnly` / `Partitioned`); duplicate names are legal
 * (query strings repeat keys). Pure: no React.
 */

import type { DetectedValue } from './detect';

/** The detected types that edit as a name/value grid. */
export type PairGridType = 'cookie' | 'query-string';

/** One grid row. `value: null` is a bare flag segment (no `=`) —
 *  distinct from an empty-value pair (`name=`). */
export interface PairSegment {
  name: string;
  value: string | null;
}

/** Narrows a detected type to its grid shape; null keeps the plain
 *  text body. */
export function pairGridTypeOf(type: DetectedValue['type']): PairGridType | null {
  return type === 'cookie' || type === 'query-string' ? type : null;
}

/** Splits decoded line-per-segment text into rows. The split is at the
 *  FIRST `=` so values may carry their own (`a=b=c` → name `a`, value
 *  `b=c`), matching how both wire formats parse. */
export function decodePairSegments(text: string): PairSegment[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const eq = line.indexOf('=');
      return eq === -1 ? { name: line, value: null } : { name: line.slice(0, eq), value: line.slice(eq + 1) };
    });
}

// The cookie attribute-flag vocabulary — a new row typed as one of
// these with an empty value means the flag, not the pair `Secure=`.
const COOKIE_FLAG = /^(?:Secure|HttpOnly|Partitioned)$/i;

/**
 * Serializes rows back to decoded line-per-segment text. Rows left
 * entirely empty (the just-added blank row) drop; a named row with an
 * empty name or an illegal cell survives verbatim so the codec's
 * re-encode rejects it and Save stays disabled — validation is not
 * duplicated here.
 */
export function encodePairSegments(type: PairGridType, segments: PairSegment[]): string {
  return segments
    .filter((s) => s.name !== '' || (s.value ?? '') !== '')
    .map((s) => {
      if (s.value === null) return s.name;
      if (type === 'cookie' && s.value === '' && COOKIE_FLAG.test(s.name)) return s.name;
      return `${s.name}=${s.value}`;
    })
    .join('\n');
}
