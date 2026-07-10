/**
 * Value-type detection — classifies a field's raw value so callers can
 * offer the matching editor on the TemplateInput action rail. Shaped as
 * a detector registry: each detector inspects the value and returns its
 * typed descriptor or null; the first hit wins. Registered today: JWT,
 * %XX URL-encoding, base64 text (cookie strings are a planned
 * follow-up). Order matters — a JWT is base64url-shaped, so it must
 * claim the value before the base64 detector sees it.
 */

import { tryDecodeBase64, tryDecodeUrlComponent } from './encodings';
import { isJWT } from './jwt';

export interface DetectedJWT {
  type: 'jwt';
  /** The bare token — any `Bearer ` prefix stripped. */
  token: string;
  /** Whatever preceded the token (e.g. `Bearer `), preserved so an
   *  edited token can be written back into the same shape. */
  prefix: string;
}

export interface DetectedUrlEncoded {
  type: 'url-encoded';
  decoded: string;
}

export interface DetectedBase64 {
  type: 'base64';
  decoded: string;
  /** Alphabet + padding shape of the original — preserved on re-encode. */
  urlSafe: boolean;
  padded: boolean;
}

export type DetectedValue = DetectedJWT | DetectedUrlEncoded | DetectedBase64;

type Detector = (value: string) => DetectedValue | null;

const BEARER_PREFIX = /^(\s*Bearer\s+)(.+)$/i;

function detectJWT(value: string): DetectedJWT | null {
  const match = value.match(BEARER_PREFIX);
  const prefix = match ? match[1] : '';
  const candidate = match ? match[2] : value;
  return isJWT(candidate) ? { type: 'jwt', token: candidate, prefix } : null;
}

function detectUrlEncoded(value: string): DetectedUrlEncoded | null {
  const decoded = tryDecodeUrlComponent(value);
  return decoded !== null ? { type: 'url-encoded', decoded } : null;
}

function detectBase64(value: string): DetectedBase64 | null {
  const hit = tryDecodeBase64(value);
  return hit ? { type: 'base64', ...hit } : null;
}

const DETECTORS: Detector[] = [detectJWT, detectUrlEncoded, detectBase64];

/** Classifies `value`, returning the first detector hit or null when no
 *  known value type matches (including template values — a `{{ref}}`
 *  never passes any detector's shape check, so refs fall through
 *  naturally). */
export function detectValueType(value: string | undefined): DetectedValue | null {
  if (!value) return null;
  for (const detect of DETECTORS) {
    const hit = detect(value);
    if (hit) return hit;
  }
  return null;
}
