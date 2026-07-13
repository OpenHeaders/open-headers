/**
 * org-logo — validation for a custom Org logo (the brand mark an Org
 * admin can set in place of the derived host glyph).
 *
 * The logo persists as a base64 `data:` URI directly on the `Org` row,
 * so it replicates to every member through the same channels as the
 * Org name (handshake WELCOME → joined-org fold). That makes the
 * validation here a WIRE boundary, not just a form nicety: the schema
 * check runs on every received Org row, so a peer can never push an
 * oversized blob or an active-content SVG into local storage.
 *
 * Restrictions:
 *   - format allow-list: PNG, JPEG, WebP, SVG — checked by mime AND by
 *     magic bytes (a mislabelled payload is rejected);
 *   - hard byte cap ({@link ORG_LOGO_MAX_BYTES}) — this is an icon, not
 *     an asset store;
 *   - SVG must be inert: no scripts, no event handlers, no external
 *     references, no embedded foreign documents. Defense in depth —
 *     consumers render the logo via `<img src="data:…">`, which never
 *     executes SVG scripts, but stored content should be safe even if
 *     a future consumer renders it differently.
 */

export const ORG_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

export type OrgLogoMimeType = (typeof ORG_LOGO_MIME_TYPES)[number];

/** Hard cap on the DECODED logo payload. */
export const ORG_LOGO_MAX_BYTES = 64 * 1024;

/**
 * Cap on the encoded `data:` URI string — the longest allowed prefix
 * (`data:image/svg+xml;base64,`) plus the base64 expansion (4/3) of
 * {@link ORG_LOGO_MAX_BYTES}, rounded up to the 4-char quantum.
 */
export const ORG_LOGO_MAX_DATA_URI_LENGTH = 'data:image/svg+xml;base64,'.length + Math.ceil(ORG_LOGO_MAX_BYTES / 3) * 4;

export type OrgLogoRejectReason =
  | 'not-a-data-uri'
  | 'unsupported-format'
  | 'not-base64'
  | 'too-large'
  | 'corrupt-image'
  | 'unsafe-svg';

export type OrgLogoValidation = { ok: true; mime: OrgLogoMimeType } | { ok: false; reason: OrgLogoRejectReason };

const DATA_URI_PATTERN = /^data:([a-z0-9/+.-]+);base64,(.*)$/s;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map<string, number>([...B64_ALPHABET].map((c, i) => [c, i]));

/** Decode base64 to bytes; dependency-free so magic-byte checks run in any realm. */
function decodeBase64Bytes(value: string): Uint8Array {
  const stripped = value.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((stripped.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let offset = 0;
  for (const char of stripped) {
    buffer = (buffer << 6) | (B64_INDEX.get(char) ?? 0);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[offset++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

function hasMagicBytes(bytes: Uint8Array, expected: number[], at = 0): boolean {
  return expected.every((byte, i) => bytes[at + i] === byte);
}

/** Raster payloads must open with their format's signature. */
function matchesRasterSignature(mime: OrgLogoMimeType, bytes: Uint8Array): boolean {
  switch (mime) {
    case 'image/png':
      return hasMagicBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return hasMagicBytes(bytes, [0xff, 0xd8, 0xff]);
    case 'image/webp':
      return hasMagicBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasMagicBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}

/**
 * Active-content and external-reference patterns an inert logo SVG has
 * no business containing. Scanned over the lowercased document.
 */
const UNSAFE_SVG_PATTERNS: readonly RegExp[] = [
  /<script/,
  /<foreignobject/,
  /<iframe/,
  /<embed/,
  /<object/,
  /<link/,
  /<meta/,
  /javascript:/,
  /\son[a-z]+\s*=/,
  // External fetches: absolute or protocol-relative URLs in any
  // href/src/url() position. A self-contained logo references only
  // its own defs (`#id`) or inline data.
  /(href|src)\s*=\s*["']?\s*(https?:)?\/\//,
  /url\(\s*["']?\s*(https?:)?\/\//,
];

function checkSvg(bytes: Uint8Array): OrgLogoRejectReason | null {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).toLowerCase();
  if (!text.includes('<svg')) return 'corrupt-image';
  return UNSAFE_SVG_PATTERNS.some((pattern) => pattern.test(text)) ? 'unsafe-svg' : null;
}

/**
 * Validate a candidate Org-logo `data:` URI against the format
 * allow-list, the byte cap, the payload signature, and (for SVG) the
 * inert-content rules. Returns the reject reason so form surfaces can
 * explain the refusal.
 */
export function validateOrgLogoDataUri(value: string): OrgLogoValidation {
  if (value.length > ORG_LOGO_MAX_DATA_URI_LENGTH) return { ok: false, reason: 'too-large' };
  const match = DATA_URI_PATTERN.exec(value);
  if (!match) return { ok: false, reason: 'not-a-data-uri' };
  const [, mime, payload] = match;
  if (!(ORG_LOGO_MIME_TYPES as readonly string[]).includes(mime)) {
    return { ok: false, reason: 'unsupported-format' };
  }
  const logoMime = mime as OrgLogoMimeType;
  if (payload.length === 0 || payload.length % 4 !== 0 || !BASE64_PATTERN.test(payload)) {
    return { ok: false, reason: 'not-base64' };
  }
  const bytes = decodeBase64Bytes(payload);
  if (bytes.length > ORG_LOGO_MAX_BYTES) return { ok: false, reason: 'too-large' };
  if (logoMime === 'image/svg+xml') {
    const svgReject = checkSvg(bytes);
    if (svgReject) return { ok: false, reason: svgReject };
    return { ok: true, mime: logoMime };
  }
  if (!matchesRasterSignature(logoMime, bytes)) return { ok: false, reason: 'corrupt-image' };
  return { ok: true, mime: logoMime };
}

/** Boolean form for schema `v.check` at the wire/storage boundary. */
export function isValidOrgLogoDataUri(value: string): boolean {
  return validateOrgLogoDataUri(value).ok;
}
