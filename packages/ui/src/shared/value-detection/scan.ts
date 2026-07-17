/**
 * Buffer scanner — finds JWT-shaped values inside a larger text (a raw
 * request body, a script, …) so Monaco surfaces can mark them with an
 * "Edit JWT" link. Pure text → offsets; the Monaco wiring lives in
 * `useMonacoJwtEdit`.
 */

import { isJWT } from './jwt';

export interface JwtScanHit {
  /** 0-based char offset of the token's first character. */
  start: number;
  /** Offset one past the token's last character. */
  end: number;
  token: string;
}

// Bodies beyond this size skip detection — the affordance is a
// convenience, not worth a multi-hundred-KB scan on every change.
const MAX_SCAN_LENGTH = 512 * 1024;

/** base64url segment char: A–Z a–z 0–9 _ - */
function isSegmentChar(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 95 ||
    code === 45
  );
}

const DOT = 46;

/**
 * Scans `text` for structurally valid JWTs (per `isJWT`), returning
 * their offsets in document order. Works on MAXIMAL runs of segment
 * chars and dots: a run is a hit only when it splits into exactly three
 * non-empty segments — longer dotted runs (`a.b.c.d`), adjacent dots
 * and dot-flanked candidates are rejected whole, a JWT is exactly three.
 *
 * Single forward pass by charcode, no regex: a `[seg]+\.[seg]+\.[seg]+`
 * scan is O(n²) on a long dotless run (a base64 inline sourcemap in a
 * captured .js body) — every start position re-consumes the rest of the
 * run before failing, which froze the panel for seconds.
 */
export function scanForJWTs(text: string): JwtScanHit[] {
  if (!text || text.length > MAX_SCAN_LENGTH) return [];
  const hits: JwtScanHit[] = [];
  const len = text.length;
  let i = 0;
  while (i < len) {
    if (!isSegmentChar(text.charCodeAt(i)) && text.charCodeAt(i) !== DOT) {
      i++;
      continue;
    }
    // Maximal run of segment chars / dots starting at `i`; count its
    // dots and reject empty segments (leading/trailing/adjacent dots)
    // in the same pass.
    const start = i;
    let dots = 0;
    let prevWasDot = true; // a leading dot ⇒ empty first segment
    let emptySegment = false;
    while (i < len) {
      const code = text.charCodeAt(i);
      if (code === DOT) {
        if (prevWasDot) emptySegment = true;
        dots++;
        prevWasDot = true;
      } else if (isSegmentChar(code)) {
        prevWasDot = false;
      } else {
        break;
      }
      i++;
    }
    if (prevWasDot) emptySegment = true; // trailing dot ⇒ empty last segment
    if (dots !== 2 || emptySegment) continue;
    const token = text.slice(start, i);
    if (!isJWT(token)) continue;
    hits.push({ start, end: i, token });
  }
  return hits;
}
