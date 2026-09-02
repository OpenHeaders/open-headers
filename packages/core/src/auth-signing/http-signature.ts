/**
 * HTTP Message Signatures (RFC 9421) with the Content-Digest field
 * (RFC 9530) — the IETF standard request signature: a signature base
 * built from the covered components (derived components such as
 * `@method` / `@target-uri` and the named header fields, each on its
 * own line in the configured order) plus the `@signature-params` line,
 * signed under the configured key and delivered as `Signature-Input`
 * (the covered list with its parameters, under a label) and `Signature`
 * (the base64 signature bytes under the same label).
 *
 * Pure WebCrypto like the other signers, on both runtimes: HMAC for
 * `hmac-sha256`, RSASSA-PKCS1-v1_5 for `rsa-v1_5-sha256`, RSA-PSS with
 * the 64-byte salt §3.3.1 fixes for `rsa-pss-sha512`, ECDSA P-256 /
 * P-384 for the two `ecdsa-*` values (WebCrypto's raw `r‖s` output IS
 * the §3.3.4 encoding), and Ed25519 (the runtime's own support — Node
 * 22 and the current browsers). Private keys arrive as PEM through
 * `pemToPkcs8`; the HMAC secret as text or base64 bytes.
 *
 * The signer takes the FINAL wire shape — method, URL with the query
 * appended, the header rows the executor holds, the serialized body
 * text — the way SigV4 does. A covered component the request does not
 * carry is an error (§2.5: the base MUST NOT be created); the executor
 * turns it into the send error naming the component. `Content-Digest`
 * is minted here over the body bytes when the config names a digest
 * algorithm, so listing `content-digest` covers what rides.
 *
 * Callers sign at EXECUTE time like the other schemes; the clock and
 * the nonce are injected so tests can pin the RFC's vectors.
 */

import { decodeBase64Bytes, encodeBase64Bytes } from '../utils/base64';
import { pemToPkcs8 } from './pem';

/** The six algorithms the "HTTP Signature Algorithms" registry names (§6.2). */
export const HTTP_SIGNATURE_ALGORITHMS = [
  'rsa-pss-sha512',
  'rsa-v1_5-sha256',
  'hmac-sha256',
  'ecdsa-p256-sha256',
  'ecdsa-p384-sha384',
  'ed25519',
] as const;

export type HttpSignatureAlgorithm = (typeof HTTP_SIGNATURE_ALGORITHMS)[number];

export function isHttpSignatureAlgorithm(value: string | undefined): value is HttpSignatureAlgorithm {
  return value !== undefined && (HTTP_SIGNATURE_ALGORITHMS as readonly string[]).includes(value);
}

/** The Content-Digest algorithms RFC 9530 registers as active. */
export const HTTP_SIGNATURE_DIGEST_ALGORITHMS = ['sha-256', 'sha-512'] as const;

export type HttpSignatureDigestAlgorithm = (typeof HTTP_SIGNATURE_DIGEST_ALGORITHMS)[number];

/** The derived components a REQUEST can cover (§2.2). `@query-param`
 *  takes a parameter and `@status` is a response component — neither
 *  is accepted. */
export const HTTP_SIGNATURE_DERIVED_COMPONENTS = [
  '@method',
  '@target-uri',
  '@authority',
  '@scheme',
  '@request-target',
  '@path',
  '@query',
] as const;

/** The covered set a fresh config starts with — the method and the
 *  full target, enough to bind a signature to one request. */
export const HTTP_SIGNATURE_DEFAULT_COMPONENTS = '@method @target-uri';

/** The `Signature-Input` / `Signature` dictionary key when none is set. */
export const HTTP_SIGNATURE_DEFAULT_LABEL = 'sig1';

/** The order the signature parameters serialize in — one fixed
 *  choice (§2.3: any order, but never changed once chosen). It matches
 *  every request vector in the RFC's Appendix B. */
const PARAMETER_ORDER = ['created', 'expires', 'keyid', 'alg', 'nonce', 'tag'] as const;

export interface HttpSignatureCredentials {
  algorithm: HttpSignatureAlgorithm;
  /** The asymmetric families — the PEM (or bare base64 DER) private key. */
  privateKey: string;
  /** `hmac-sha256` — the shared secret. */
  secret: string;
  /** The secret is base64-encoded key material; decode before keying. */
  secretBase64?: boolean;
  /** The `keyid` parameter — the verifier's handle on the key. Blank
   *  omits the parameter. */
  keyId?: string;
  /** The covered components, space- or comma-separated, in signing
   *  order: derived components (`@method`, `@target-uri`, …) and header
   *  field names. See {@link parseHttpSignatureComponents}. */
  components: string;
  /** Mint `Content-Digest` over the body bytes with this algorithm.
   *  Absent = no digest header is added. */
  contentDigest?: HttpSignatureDigestAlgorithm;
  /** The dictionary key both headers carry the signature under.
   *  Absent = {@link HTTP_SIGNATURE_DEFAULT_LABEL}. */
  label?: string;
  /** Write the `created` parameter (the signing instant). Absent = on. */
  created?: boolean;
  /** Write `expires` = created + this many seconds. Absent = no expiry. */
  expiresInSeconds?: number;
  /** Write a fresh random `nonce` parameter per send. Absent = none. */
  nonce?: boolean;
  /** Write the `alg` parameter naming the algorithm. Absent = off (the
   *  RFC leaves the algorithm to the key the verifier resolves). */
  includeAlgorithm?: boolean;
  /** The application `tag` parameter. Blank omits it. */
  tag?: string;
}

export interface HttpSignatureSignInput {
  method: string;
  /** Final wire URL — query string already appended. */
  url: string;
  /** The header rows the executor holds — the user's, the resolver's
   *  default Content-Type, anything a script added. A covered field is
   *  read from these by name; the runtime's own rows (`Host`,
   *  `Content-Length`, a form body's Content-Type) never appear here,
   *  so covering them is the error naming the field. */
  headers: ReadonlyArray<{ key: string; value: string }>;
  /** The serialized body text (raw / urlencoded). Absent = no body —
   *  the digest, when minted, covers the empty content. */
  body?: string;
  /** Unix seconds — injected so tests can pin the stamped parameters. */
  timestampSec: number;
  /** The nonce to write when the config asks for one — injected so
   *  tests can pin the RFC's vectors. */
  nonce: string;
}

export interface HttpSignatureBase {
  /** The signature base — the covered lines plus `@signature-params`. */
  base: string;
  /** The serialized signature parameters (the `Signature-Input` value
   *  after the label). */
  signatureInput: string;
  /** The `Content-Digest` value minted for the body, when configured. */
  contentDigest?: string;
}

export interface HttpSignatureSigned {
  /** Headers to set replace-not-append: `Content-Digest` when minted,
   *  then `Signature-Input` and `Signature`. */
  headers: Array<{ key: string; value: string }>;
  /** The base the signature covers — for the caller's diagnostics. */
  signatureBase: string;
}

/**
 * Parse the covered-components text: identifiers split on whitespace
 * and commas, lowercased (§2.1 — field names are lowercase component
 * names), each either a supported derived component or a header field
 * name. Duplicates are an error (§2.5 step 2.1); identifier
 * parameters (`;sf`, `;key`, `;bs`, `;req`, `;tr`, `;name`) are refused
 * by name — this signer covers whole request fields only.
 */
export function parseHttpSignatureComponents(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    if (raw === '') continue;
    const identifier = raw.toLowerCase();
    if (identifier.includes(';')) {
      throw new Error(`component "${raw}" carries a parameter — only whole components can be covered`);
    }
    if (identifier.startsWith('@')) {
      if (identifier === '@query-param') {
        throw new Error('"@query-param" needs a name parameter and is not supported — cover "@query" instead');
      }
      if (identifier === '@signature-params') {
        throw new Error('"@signature-params" is always the last line of the base and is never listed');
      }
      if (!(HTTP_SIGNATURE_DERIVED_COMPONENTS as readonly string[]).includes(identifier)) {
        throw new Error(`unknown derived component "${raw}"`);
      }
    } else if (!/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(identifier)) {
      throw new Error(`"${raw}" is not a valid header field name`);
    }
    if (out.includes(identifier)) throw new Error(`component "${raw}" is listed twice`);
    out.push(identifier);
  }
  return out;
}

/**
 * The `Content-Digest` field value (RFC 9530 §2) for a body: the
 * algorithm key and the digest bytes as a Structured Field byte
 * sequence — `sha-256=:<base64>:`.
 */
export async function contentDigestValue(algorithm: HttpSignatureDigestAlgorithm, body: string): Promise<string> {
  const hash = algorithm === 'sha-512' ? 'SHA-512' : 'SHA-256';
  const digest = await crypto.subtle.digest(hash, new TextEncoder().encode(body));
  return `${algorithm}=:${encodeBase64Bytes(new Uint8Array(digest))}:`;
}

/**
 * Build the signature base (§2.5) and the serialized signature
 * parameters (§2.3) for the request — the pure step ahead of signing,
 * exposed so the base can be pinned byte-exact without a key.
 */
export async function buildHttpSignatureBase(
  credentials: HttpSignatureCredentials,
  input: HttpSignatureSignInput,
): Promise<HttpSignatureBase> {
  const components = parseHttpSignatureComponents(credentials.components);
  const rows: Array<{ key: string; value: string }> = [...input.headers];
  let contentDigest: string | undefined;
  if (credentials.contentDigest !== undefined) {
    contentDigest = await contentDigestValue(credentials.contentDigest, input.body ?? '');
    rows.push({ key: 'Content-Digest', value: contentDigest });
  }

  const url = parseUrl(input.url);
  const lines: string[] = [];
  for (const component of components) {
    const value = component.startsWith('@')
      ? derivedComponentValue(component, input.method, url)
      : fieldComponentValue(component, rows, credentials.contentDigest === undefined);
    lines.push(`${sfString(component)}: ${value}`);
  }
  const signatureInput = serializeSignatureParams(components, credentials, input);
  lines.push(`"@signature-params": ${signatureInput}`);
  const base = lines.join('\n');
  return { base, signatureInput, ...(contentDigest !== undefined ? { contentDigest } : {}) };
}

/**
 * Sign the request: the headers to set (replace-not-append — a stale
 * user-set `Signature` under the same label would combine into two
 * dictionary members) and the base they cover.
 */
export async function signHttpMessage(
  credentials: HttpSignatureCredentials,
  input: HttpSignatureSignInput,
): Promise<HttpSignatureSigned> {
  const label = labelOf(credentials);
  const { base, signatureInput, contentDigest } = await buildHttpSignatureBase(credentials, input);
  const signature = await sign(credentials, new TextEncoder().encode(base));
  const headers: Array<{ key: string; value: string }> = [];
  if (contentDigest !== undefined) headers.push({ key: 'Content-Digest', value: contentDigest });
  headers.push({ key: 'Signature-Input', value: `${label}=${signatureInput}` });
  headers.push({ key: 'Signature', value: `${label}=:${encodeBase64Bytes(signature)}:` });
  return { headers, signatureBase: base };
}

// ── Components ─────────────────────────────────────────────────────

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new Error(`the request URL "${url}" is not absolute`);
  }
}

/** §2.2 — the derived components a request can cover, from the
 *  parsed target (the runtime sends the parsed form: lowercase host,
 *  default port dropped, the fragment never on the wire). */
function derivedComponentValue(component: string, method: string, url: URL): string {
  switch (component) {
    case '@method':
      return method.toUpperCase();
    case '@target-uri': {
      const target = new URL(url.href);
      target.hash = '';
      return target.href;
    }
    case '@authority':
      return url.host;
    case '@scheme':
      return url.protocol.slice(0, -1);
    case '@request-target':
      return `${url.pathname}${url.search}`;
    case '@path':
      return url.pathname || '/';
    case '@query':
      return url.search || '?';
    default:
      throw new Error(`unknown derived component "${component}"`);
  }
}

/**
 * §2.1 — the field's instances in order, each trimmed with obsolete
 * line folding collapsed to one space, joined by a comma and a space.
 * A field the request does not carry is the error (§2.5); a
 * `content-digest` gap names the digest setting when none is on.
 */
function fieldComponentValue(
  name: string,
  rows: ReadonlyArray<{ key: string; value: string }>,
  digestOff: boolean,
): string {
  const values: string[] = [];
  for (const row of rows) {
    if (row.key.toLowerCase() === name) values.push(row.value.trim().replace(/\r?\n[ \t]*/g, ' '));
  }
  if (values.length === 0) {
    if (name === 'content-digest' && digestOff) {
      throw new Error('"content-digest" is covered but no Content Digest algorithm is set');
    }
    throw new Error(`the request carries no "${name}" header to cover`);
  }
  const value = values.join(', ');
  if (!isAscii(value)) throw new Error(`the "${name}" header value is not ASCII and cannot be covered`);
  return value;
}

// ── Signature parameters (§2.3) ────────────────────────────────────

function serializeSignatureParams(
  components: readonly string[],
  credentials: HttpSignatureCredentials,
  input: HttpSignatureSignInput,
): string {
  const params = new Map<(typeof PARAMETER_ORDER)[number], string>();
  if (credentials.created !== false) params.set('created', String(input.timestampSec));
  if (credentials.expiresInSeconds !== undefined) {
    if (credentials.created === false) throw new Error('"expires" needs "created" — turn the created parameter on');
    params.set('expires', String(input.timestampSec + credentials.expiresInSeconds));
  }
  const keyId = credentials.keyId?.trim() ?? '';
  if (keyId !== '') params.set('keyid', sfString(keyId));
  if (credentials.includeAlgorithm === true) params.set('alg', sfString(credentials.algorithm));
  if (credentials.nonce === true) params.set('nonce', sfString(input.nonce));
  const tag = credentials.tag?.trim() ?? '';
  if (tag !== '') params.set('tag', sfString(tag));

  let out = `(${components.map((c) => sfString(c)).join(' ')})`;
  for (const name of PARAMETER_ORDER) {
    const value = params.get(name);
    if (value !== undefined) out += `;${name}=${value}`;
  }
  return out;
}

function labelOf(credentials: HttpSignatureCredentials): string {
  const label = credentials.label?.trim() ?? '';
  if (label === '') return HTTP_SIGNATURE_DEFAULT_LABEL;
  // A Structured Field dictionary key (RFC 8941 §3.1.2).
  if (!/^[a-z*][a-z0-9_\-.*]*$/.test(label)) {
    throw new Error(`the label "${label}" is not a valid key — lowercase letters, digits, "_", "-", "." and "*"`);
  }
  return label;
}

/** RFC 8941 §4.1.6 — an sf-string: printable ASCII in double quotes,
 *  `\` and `"` escaped. */
function sfString(value: string): string {
  if (!isAscii(value)) throw new Error(`"${value}" is not printable ASCII and cannot be a signature parameter`);
  return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

function isAscii(value: string): boolean {
  return /^[\x20-\x7e]*$/.test(value);
}

// ── Signing families (§3.3) ────────────────────────────────────────

async function sign(credentials: HttpSignatureCredentials, data: Uint8Array): Promise<Uint8Array> {
  const bytes = data as Uint8Array<ArrayBuffer>;
  switch (credentials.algorithm) {
    case 'hmac-sha256': {
      const key = await crypto.subtle.importKey(
        'raw',
        hmacKeyBytes(credentials) as Uint8Array<ArrayBuffer>,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      return new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes));
    }
    case 'rsa-pss-sha512': {
      const key = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer(credentials, null),
        { name: 'RSA-PSS', hash: 'SHA-512' },
        false,
        ['sign'],
      );
      // §3.3.1 — MGF1 with SHA-512 and a 64-byte salt.
      return new Uint8Array(await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 64 }, key, bytes));
    }
    case 'rsa-v1_5-sha256': {
      const key = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer(credentials, null),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      return new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, bytes));
    }
    case 'ecdsa-p256-sha256':
    case 'ecdsa-p384-sha384': {
      const p384 = credentials.algorithm === 'ecdsa-p384-sha384';
      const namedCurve = p384 ? 'P-384' : 'P-256';
      const key = await crypto.subtle.importKey(
        'pkcs8',
        privateKeyDer(credentials, namedCurve),
        { name: 'ECDSA', namedCurve },
        false,
        ['sign'],
      );
      // WebCrypto's ECDSA output is the fixed-width r‖s pair — the
      // §3.3.4 / §3.3.5 encoding.
      return new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: p384 ? 'SHA-384' : 'SHA-256' }, key, bytes),
      );
    }
    case 'ed25519': {
      let key: CryptoKey;
      try {
        key = await crypto.subtle.importKey('pkcs8', privateKeyDer(credentials, null), { name: 'Ed25519' }, false, [
          'sign',
        ]);
      } catch (err) {
        if (err instanceof Error && err.name === 'NotSupportedError') {
          throw new Error('this runtime has no Ed25519 support — pick another algorithm');
        }
        throw err;
      }
      return new Uint8Array(await crypto.subtle.sign('Ed25519', key, bytes));
    }
    default: {
      const _exhaustive: never = credentials.algorithm;
      void _exhaustive;
      throw new Error(`unknown algorithm "${String(credentials.algorithm)}"`);
    }
  }
}

function hmacKeyBytes(credentials: HttpSignatureCredentials): Uint8Array {
  if (credentials.secret === '') throw new Error('the shared secret is empty');
  if (credentials.secretBase64 === true) {
    const decoded = decodeBase64Bytes(credentials.secret);
    if (decoded === null || decoded.length === 0) throw new Error('the shared secret is not valid base64');
    return decoded;
  }
  return new TextEncoder().encode(credentials.secret);
}

function privateKeyDer(
  credentials: HttpSignatureCredentials,
  curve: 'P-256' | 'P-384' | null,
): Uint8Array<ArrayBuffer> {
  if (credentials.privateKey.trim() === '') throw new Error('the private key is empty');
  return pemToPkcs8(credentials.privateKey, curve) as Uint8Array<ArrayBuffer>;
}
