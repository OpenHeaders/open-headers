/**
 * Pure introspection of an arbitrary string value — detects JWTs, JSON,
 * base64 blobs, and percent-encoding. Drives the inline value expander
 * shared by the headers and cookies tabs.
 *
 * Detection runs the shared value-detection registry (the same rules
 * that put edit icons on workbench rails), then maps the hit onto the
 * panel's view vocabulary: kinds the expander has a decoded rendering
 * for keep their depth; everything else is `plain`. The original raw
 * value is always preserved.
 */

import { decodeJWT, detectValueType } from '@openheaders/ui/shared/value-detection';

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
  | { kind: 'url-encoded'; value: string; decoded: string }
  | { kind: 'json'; value: string; parsed: unknown }
  | { kind: 'jwt'; value: string; jwt: JwtParts }
  | { kind: 'base64'; value: string; decoded: string }
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
      return jwt ? { kind: 'jwt', value: rawValue, jwt } : { kind: 'plain', value: rawValue };
    }
    case 'url-encoded': {
      // A URL-decode revealing JSON reads better as JSON.
      const parsed = tryParseJson(hit.decoded);
      if (parsed != null) return { kind: 'json', value: rawValue, parsed };
      return { kind: 'url-encoded', value: rawValue, decoded: hit.decoded };
    }
    case 'json':
      return { kind: 'json', value: rawValue, parsed: JSON.parse(hit.decoded) };
    case 'base64':
      return { kind: 'base64', value: rawValue, decoded: hit.decoded };
    default:
      // Recognized by the registry (cookie list, CSP, timestamp, …)
      // but the expander has no decoded rendering for it.
      return { kind: 'plain', value: rawValue };
  }
}

export function introspectionHasDepth(i: ValueIntrospection): boolean {
  return i.kind !== 'plain';
}

/** The encoding kind to surface as a one-glyph hint — peels a `prefixed`
 *  wrapper down to the credential it carries. */
export function introspectionHint(i: ValueIntrospection): ValueIntrospection['kind'] {
  return i.kind === 'prefixed' ? introspectionHint(i.inner) : i.kind;
}
