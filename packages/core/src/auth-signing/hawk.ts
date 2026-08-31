/**
 * Hawk request signing (the `hawk.1.` HMAC scheme).
 *
 * Pure WebCrypto like the SigV4 and OAuth1 signers (`HMAC` with SHA-256
 * or SHA-1 — the scheme's only two algorithms — is available on both
 * runtimes). The signer takes the FINAL wire shape — method, URL with
 * query already appended, and optionally the wire payload + its
 * Content-Type for the payload integrity hash — and returns the one
 * `Authorization: Hawk …` header to set.
 *
 * The MAC covers the normalized request string: timestamp, nonce,
 * method, path+query, lowercased host, port (defaulted 80/443 by
 * scheme), the payload hash when opted in, `ext`, and — when `app` is
 * present — the `app`/`dlg` delegation pair. `user` deliberately does
 * not exist here: the header grammar has no such attribute.
 *
 * Callers sign at EXECUTE time, after pre-request scripts have mutated
 * the request — a signature computed any earlier is invalidated by the
 * first script mutation. Randomness (`nonce`) and the clock
 * (`timestampSec`) are injected so tests can pin the scheme's
 * published vectors, mirroring the OAuth1 signer.
 */

import { encodeBase64Bytes } from '../utils/base64';

export type HawkAlgorithm = 'sha256' | 'sha1';

export interface HawkCredentials {
  authId: string;
  authKey: string;
  algorithm: HawkAlgorithm;
  /** App-specific data — signed, and echoed as the `ext` attribute. */
  ext?: string;
  /** Delegation pair (`app` + `dlg`) — signed when `app` is present. */
  app?: string;
  /** See {@link app}; ignored without it, matching the scheme. */
  dlg?: string;
}

export interface HawkSignInput {
  method: string;
  /** Final wire URL — query string already appended. */
  url: string;
  /** Wire payload for the OPTIONAL integrity hash — the body text plus
   *  the Content-Type that rides the wire. Omit to sign without a
   *  `hash` attribute (bodyless sends, payloads whose bytes are not
   *  knowable ahead of dispatch). */
  payload?: { text: string; contentType: string };
  /** Unix seconds — injected so tests can pin vectors. */
  timestampSec: number;
  /** Client nonce — caller-supplied randomness. */
  nonce: string;
}

/** Sign the request, returning the headers to add. The caller must set
 *  them replace-not-append (a stale user-set `Authorization` would
 *  combine into garbage on the wire). */
export async function signHawk(
  credentials: HawkCredentials,
  input: HawkSignInput,
): Promise<Array<{ key: string; value: string }>> {
  const url = new URL(input.url);
  const hash = input.payload === undefined ? '' : await hawkPayloadHash(credentials.algorithm, input.payload);
  const mac = await hmacBase64(
    credentials.algorithm,
    credentials.authKey,
    buildHawkNormalizedString(credentials, input, url, hash),
  );

  // Attribute order matches the reference implementation's header
  // builder: id, ts, nonce, [hash], [ext], mac, [app, [dlg]].
  const parts = [
    `id="${escapeAttribute(credentials.authId)}"`,
    `ts="${input.timestampSec}"`,
    `nonce="${escapeAttribute(input.nonce)}"`,
  ];
  if (hash !== '') parts.push(`hash="${hash}"`);
  if (credentials.ext !== undefined && credentials.ext !== '') {
    parts.push(`ext="${escapeAttribute(credentials.ext)}"`);
  }
  parts.push(`mac="${mac}"`);
  if (credentials.app !== undefined && credentials.app !== '') {
    parts.push(`app="${escapeAttribute(credentials.app)}"`);
    if (credentials.dlg !== undefined && credentials.dlg !== '') {
      parts.push(`dlg="${escapeAttribute(credentials.dlg)}"`);
    }
  }
  return [{ key: 'Authorization', value: `Hawk ${parts.join(', ')}` }];
}

/**
 * The `hawk.1.header` normalized request string the MAC covers.
 * Exported so tests can pin the scheme's published vector byte-exact.
 */
export function buildHawkNormalizedString(
  credentials: Pick<HawkCredentials, 'ext' | 'app' | 'dlg'>,
  input: Pick<HawkSignInput, 'method' | 'timestampSec' | 'nonce'>,
  url: URL,
  hash: string,
): string {
  // Port defaults by scheme when the URL elides it (the URL parser
  // strips a default port).
  const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80';
  let normalized =
    `hawk.1.header\n${input.timestampSec}\n${input.nonce}\n${input.method.toUpperCase()}\n` +
    `${url.pathname}${url.search}\n${url.hostname.toLowerCase()}\n${port}\n${hash}\n`;
  if (credentials.ext !== undefined && credentials.ext !== '') {
    // First-occurrence-only escaping, replicating the reference
    // implementation byte-for-byte — servers normalize the received
    // ext the same way, so a "fixed" global escape would break the MAC
    // comparison for exts with repeated backslashes/newlines.
    normalized += credentials.ext.replace('\\', '\\\\').replace('\n', '\\n');
  }
  normalized += '\n';
  if (credentials.app !== undefined && credentials.app !== '') {
    normalized += `${credentials.app}\n${credentials.dlg ?? ''}\n`;
  }
  return normalized;
}

/** Base64 payload hash over `hawk.1.payload\n<content-type>\n<body>\n`
 *  — the Content-Type lowercased and stripped of its parameters, the
 *  way the validating server normalizes what it received. */
export async function hawkPayloadHash(
  algorithm: HawkAlgorithm,
  payload: { text: string; contentType: string },
): Promise<string> {
  const contentType = payload.contentType.split(';')[0].trim().toLowerCase();
  const data = `hawk.1.payload\n${contentType}\n${payload.text}\n`;
  const digest = await crypto.subtle.digest(webCryptoHash(algorithm), new TextEncoder().encode(data));
  return encodeBase64Bytes(new Uint8Array(digest));
}

/** Escape a value for the header's quoted attributes (backslash and
 *  double quote), per the reference implementation. */
function escapeAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function webCryptoHash(algorithm: HawkAlgorithm): 'SHA-256' | 'SHA-1' {
  return algorithm === 'sha1' ? 'SHA-1' : 'SHA-256';
}

async function hmacBase64(algorithm: HawkAlgorithm, key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key) as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: webCryptoHash(algorithm) },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return encodeBase64Bytes(new Uint8Array(signature));
}
