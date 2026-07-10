/**
 * Value-type detection — classifies a field's raw value so callers can
 * offer the matching editor on the TemplateInput action rail. Shaped as
 * a detector registry: each detector inspects the value and returns its
 * typed descriptor or null; the first hit wins. JWT is the only
 * registered detector today (base64 / URL-encoded / cookie strings are
 * planned follow-ups).
 */

import { isJWT } from './jwt';

export interface DetectedJWT {
  type: 'jwt';
  /** The bare token — any `Bearer ` prefix stripped. */
  token: string;
  /** Whatever preceded the token (e.g. `Bearer `), preserved so an
   *  edited token can be written back into the same shape. */
  prefix: string;
}

export type DetectedValue = DetectedJWT;

type Detector = (value: string) => DetectedValue | null;

const BEARER_PREFIX = /^(\s*Bearer\s+)(.+)$/i;

function detectJWT(value: string): DetectedJWT | null {
  const match = value.match(BEARER_PREFIX);
  const prefix = match ? match[1] : '';
  const candidate = match ? match[2] : value;
  return isJWT(candidate) ? { type: 'jwt', token: candidate, prefix } : null;
}

const DETECTORS: Detector[] = [detectJWT];

/** Classifies `value`, returning the first detector hit or null when no
 *  known value type matches (including template values — a `{{ref}}`
 *  never parses as a JWT segment, so refs fall through naturally). */
export function detectValueType(value: string | undefined): DetectedValue | null {
  if (!value) return null;
  for (const detect of DETECTORS) {
    const hit = detect(value);
    if (hit) return hit;
  }
  return null;
}
