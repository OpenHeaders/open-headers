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

// Three dot-separated base64url segment runs. JS regex matching is
// leftmost, so the char before a match can never be a segment char —
// only the dot boundaries need an explicit check.
const CANDIDATE = /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

// Bodies beyond this size skip detection — the affordance is a
// convenience, not worth a multi-hundred-KB scan on every change.
const MAX_SCAN_LENGTH = 512 * 1024;

/** Scans `text` for structurally valid JWTs (per `isJWT`), returning
 *  their offsets in document order. Dotted runs of more than three
 *  segments are rejected whole — a JWT is exactly three. */
export function scanForJWTs(text: string): JwtScanHit[] {
  if (!text || text.length > MAX_SCAN_LENGTH) return [];
  const hits: JwtScanHit[] = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const start = match.index;
    const end = start + match[0].length;
    if (text[start - 1] === '.' || text[end] === '.') continue;
    if (!isJWT(match[0])) continue;
    hits.push({ start, end, token: match[0] });
  }
  return hits;
}
