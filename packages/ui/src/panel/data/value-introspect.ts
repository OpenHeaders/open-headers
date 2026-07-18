/**
 * Pure introspection of an arbitrary string value — runs the shared
 * value-detection registry (the same rules that put edit icons on
 * workbench rails) and maps the hit onto the panel's view vocabulary.
 * Drives the inline value expander shared by the headers and cookies
 * tabs, and carries the registry hit itself so row surfaces can open
 * the shared viewer modals on it.
 *
 * JWT / JSON / URL-encoded / base64 keep their dedicated renderings
 * (parsed claims, JSON tree text, decoded panes); every other registry
 * kind maps to the generic `decoded` rendering — the compact codec's
 * single-text seed under the shared per-type title. The original raw
 * value is always preserved.
 */

import {
  compactDecodedText,
  decodeJWT,
  type DetectedValue,
  detectValueType,
} from '@openheaders/ui/shared/value-detection';

export interface JwtParts {
  header: unknown;
  payload: unknown;
  signature: string;
  /** Parsed `exp` if present, in unix seconds. */
  expSec?: number;
  /** Parsed `iat` if present, in unix seconds. */
  iatSec?: number;
  /** Parsed `nbf` if present. */
  nbfSec?: number;
}

export type ValueIntrospection =
  | { kind: 'plain'; value: string }
  | { kind: 'url-encoded'; value: string; decoded: string; detected: DetectedValue }
  | { kind: 'json'; value: string; parsed: unknown; detected: DetectedValue }
  | { kind: 'jwt'; value: string; jwt: JwtParts; detected: DetectedValue }
  | { kind: 'base64'; value: string; decoded: string; detected: DetectedValue }
  // Any other registry kind (timestamp, http-date, csp, hsts,
  // cache-control, link, auth-params, accept-list, query-string,
  // cookie, hex, data-uri, json-string, content-disposition) — the
  // expander renders the compact codec's decoded seed text under the
  // shared per-type title.
  | { kind: 'decoded'; value: string; type: DetectedValue['type']; decoded: string; detected: DetectedValue }
  // A recognized leading label (e.g. an HTTP auth scheme) wrapping the
  // introspection of the remainder. Structural only — the core
  // `introspectValue` never emits it; a composing layer that owns the
  // label vocabulary does (see auth-scheme.ts).
  | { kind: 'prefixed'; value: string; label: string; inner: ValueIntrospection };

function tryParseJson(s: string): unknown | null {
  const trimmed = s.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function jwtParts(token: string): JwtParts | null {
  let header: unknown;
  let payload: unknown;
  let signature: string;
  try {
    ({ header, payload, signature } = decodeJWT(token));
  } catch {
    return null;
  }
  const pl = payload as Record<string, unknown> | null;
  const expSec = typeof pl?.exp === 'number' ? pl.exp : undefined;
  const iatSec = typeof pl?.iat === 'number' ? pl.iat : undefined;
  const nbfSec = typeof pl?.nbf === 'number' ? pl.nbf : undefined;
  return {
    header,
    payload,
    signature,
    ...(expSec != null ? { expSec } : {}),
    ...(iatSec != null ? { iatSec } : {}),
    ...(nbfSec != null ? { nbfSec } : {}),
  };
}

export function introspectValue(rawValue: string): ValueIntrospection {
  const hit = detectValueType(rawValue);
  if (!hit) return { kind: 'plain', value: rawValue };
  switch (hit.type) {
    case 'jwt': {
      const jwt = jwtParts(hit.token);
      return jwt ? { kind: 'jwt', value: rawValue, jwt, detected: hit } : { kind: 'plain', value: rawValue };
    }
    case 'url-encoded': {
      // A URL-decode revealing JSON reads better as JSON.
      const parsed = tryParseJson(hit.decoded);
      if (parsed != null) return { kind: 'json', value: rawValue, parsed, detected: hit };
      return { kind: 'url-encoded', value: rawValue, decoded: hit.decoded, detected: hit };
    }
    case 'json':
      return { kind: 'json', value: rawValue, parsed: JSON.parse(hit.decoded), detected: hit };
    case 'base64':
      return { kind: 'base64', value: rawValue, decoded: hit.decoded, detected: hit };
    default:
      // Every remaining registry kind renders through the compact
      // codec's single-text seed (iso for epoch/date types, the
      // line-oriented decoded text for list types).
      return { kind: 'decoded', value: rawValue, type: hit.type, decoded: compactDecodedText(hit), detected: hit };
  }
}

export function introspectionHasDepth(i: ValueIntrospection): boolean {
  return i.kind !== 'plain';
}

/** The registry hit behind an introspection — peels a `prefixed`
 *  wrapper to the credential's own hit. Null for plain values. */
export function introspectionDetected(i: ValueIntrospection): DetectedValue | null {
  if (i.kind === 'prefixed') return introspectionDetected(i.inner);
  return i.kind === 'plain' ? null : i.detected;
}

/** The encoding kind to surface as a one-glyph hint — peels a `prefixed`
 *  wrapper down to the credential it carries. */
export function introspectionHint(i: ValueIntrospection): ValueIntrospection['kind'] {
  return i.kind === 'prefixed' ? introspectionHint(i.inner) : i.kind;
}
