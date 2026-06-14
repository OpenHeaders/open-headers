/**
 * HTTP authentication-scheme awareness for the value expander.
 *
 * A credential like `Bearer eyJ…` or `Basic dXNlcjpwYXNz` isn't itself a
 * JWT or base64 blob — the scheme word and space defeat detection. This
 * module recognizes the leading scheme (RFC 7235), and when stripping it
 * reveals a decodable credential, wraps the introspection so the expander
 * can show the scheme alongside the decoded token.
 *
 * The auth vocabulary lives here, kept out of the core `value-introspect`
 * detector so that stays purely about encodings.
 */

import { introspectValue, introspectionHasDepth, type ValueIntrospection } from './value-introspect';

// Well-known schemes whose credential is worth decoding (Bearer → JWT,
// Basic → base64 user:pass). Matched case-insensitively; the canonical
// casing here is what the readout shows as the label.
const AUTH_SCHEMES = ['Bearer', 'Basic', 'Token', 'DPoP', 'Digest', 'Negotiate'] as const;

/**
 * Splits `<scheme> <credential>` when the leading word is a recognized
 * auth scheme. Returns the canonical scheme casing and the trimmed
 * credential, or null when the value carries no known scheme.
 */
export function splitAuthScheme(value: string): { scheme: string; credential: string } | null {
  const sp = value.indexOf(' ');
  if (sp <= 0) return null;
  const head = value.slice(0, sp);
  const credential = value.slice(sp + 1).trim();
  if (!credential) return null;
  const canonical = AUTH_SCHEMES.find((s) => s.toLowerCase() === head.toLowerCase());
  return canonical ? { scheme: canonical, credential } : null;
}

/**
 * Like {@link introspectValue}, but first peels a recognized auth scheme:
 * `Bearer <jwt>` becomes a `prefixed` wrapper around the JWT introspection.
 * Only wraps when the credential actually decodes to something — a scheme
 * in front of opaque text falls back to plain introspection of the whole
 * value, so non-credential auth headers (`Basic realm="x"`) don't misfire.
 */
export function introspectWithAuthScheme(value: string): ValueIntrospection {
  const split = splitAuthScheme(value);
  if (split) {
    const inner = introspectValue(split.credential);
    if (introspectionHasDepth(inner)) {
      return { kind: 'prefixed', value, label: split.scheme, inner };
    }
  }
  return introspectValue(value);
}
