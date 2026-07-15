/**
 * HTTP Digest Access Authentication — challenge parsing and response
 * computation per RFC 7616 (SHA-256) with RFC 2617/2069 (MD5, legacy
 * no-qop) compatibility.
 *
 * Pure and host-neutral like the SigV4 signer, with one deliberate
 * seam: SHA-256 rides WebCrypto in-module, while MD5 — absent from
 * WebCrypto — is a caller-supplied {@link DigestHashFn}. Node hosts
 * pass a `node:crypto` wrapper; a caller without one simply can't
 * satisfy MD5-only challenges ({@link selectDigestChallenge} skips
 * them), so no MD5 implementation is ever vendored here.
 *
 * The scheme is challenge/response — nothing is computable at resolve
 * time. The honoring transport sends the request, reads the 401's
 * `WWW-Authenticate` challenges, and calls
 * {@link buildDigestAuthorization} to derive the `Authorization`
 * header for the one retry of that hop. Randomness (`cnonce`) is
 * injected by the caller so tests can pin the RFC's vectors, mirroring
 * the SigV4 signer's injected `now`.
 */

import { sha256Hex } from './aws-sigv4';

export interface DigestCredentials {
  username: string;
  password: string;
}

/** Lowercase hex digest of a UTF-8 string. Sync or async — MD5 comes
 *  from `node:crypto` (sync), SHA-256 from WebCrypto (async). */
export type DigestHashFn = (text: string) => string | Promise<string>;

/** Algorithms this module can answer. SHA-512-256 (RFC 7616's third
 *  option) is intentionally absent — no measurable deployment; a
 *  challenge offering only it reads as unsupported. */
export type DigestAlgorithm = 'MD5' | 'MD5-sess' | 'SHA-256' | 'SHA-256-sess';

export type DigestQop = 'auth' | 'auth-int';

/** One parsed `Digest` challenge from a `WWW-Authenticate` header. */
export interface DigestChallenge {
  realm: string;
  nonce: string;
  /** Normalized; an absent wire `algorithm` means MD5 (RFC 7616 §3.3). */
  algorithm: DigestAlgorithm;
  /** Recognized qop tokens the server offered, in offer order. Empty =
   *  the legacy RFC 2069 computation (no qop, no nc/cnonce in the
   *  response hash). */
  qops: DigestQop[];
  /** Echoed verbatim in the Authorization header when present. */
  opaque?: string;
  /** `userhash="true"` — the username field carries `H(username:realm)`
   *  instead of the raw name (RFC 7616 §3.4.4). */
  userhash: boolean;
  /** Server says the request's nonce was stale. Informational — the
   *  transport's single-retry policy treats a 401 on the authorized
   *  resend as final either way. */
  stale: boolean;
}

/** Thrown when a selected challenge can't be answered — the transport
 *  maps the message onto its user-actionable error surface. */
export class DigestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DigestError';
  }
}

// ── Challenge parsing ───────────────────────────────────────────────

/**
 * One lexical token of a challenge header: either an `auth-param`
 * (`token=token` / `token="quoted"`) or a bare scheme token that opens
 * a new challenge. HTTP tokens per RFC 7230 §3.2.6.
 */
const CHALLENGE_TOKEN =
  /([!#$%&'*+\-.^_`|~A-Za-z0-9]+)\s*=\s*("(?:[^"\\]|\\.)*"|[!#$%&'*+\-.^_`|~A-Za-z0-9]+)|([!#$%&'*+\-.^_`|~A-Za-z0-9]+)/g;

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return value;
}

function normalizeAlgorithm(raw: string | undefined): DigestAlgorithm | null {
  if (raw === undefined) return 'MD5';
  switch (raw.toUpperCase()) {
    case 'MD5':
      return 'MD5';
    case 'MD5-SESS':
      return 'MD5-sess';
    case 'SHA-256':
      return 'SHA-256';
    case 'SHA-256-SESS':
      return 'SHA-256-sess';
    default:
      return null;
  }
}

/**
 * Parse every `Digest` challenge out of a `WWW-Authenticate` value.
 * The value may carry MULTIPLE challenges of mixed schemes separated
 * by commas (`Digest realm="a", nonce="b", Basic realm="c"`) — a bare
 * token (no `=`) opens a new challenge, auth-params attach to the
 * current one. Challenges with an unrecognized algorithm or missing
 * `realm`/`nonce` are dropped; the caller sees only answerable shapes
 * plus algorithm choice. Fetch `Headers` joins repeated
 * `WWW-Authenticate` headers with commas, which this grammar already
 * handles.
 */
export function parseDigestChallenges(headerValue: string): DigestChallenge[] {
  const out: DigestChallenge[] = [];
  const challenges: Array<Map<string, string>> = [];
  let current: Map<string, string> | null = null;
  CHALLENGE_TOKEN.lastIndex = 0;
  let match = CHALLENGE_TOKEN.exec(headerValue);
  while (match !== null) {
    const [, paramName, paramValue, bareToken] = match;
    if (bareToken !== undefined) {
      current = bareToken.toLowerCase() === 'digest' ? new Map() : null;
      if (current) challenges.push(current);
    } else if (current && paramName !== undefined && paramValue !== undefined) {
      const name = paramName.toLowerCase();
      if (!current.has(name)) current.set(name, unquote(paramValue));
    }
    match = CHALLENGE_TOKEN.exec(headerValue);
  }

  for (const c of challenges) {
    const realm = c.get('realm');
    const nonce = c.get('nonce');
    const algorithm = normalizeAlgorithm(c.get('algorithm'));
    if (realm === undefined || nonce === undefined || algorithm === null) continue;
    const qops: DigestQop[] = [];
    for (const token of (c.get('qop') ?? '').split(',')) {
      const qop = token.trim().toLowerCase();
      if ((qop === 'auth' || qop === 'auth-int') && !qops.includes(qop)) qops.push(qop);
    }
    const opaque = c.get('opaque');
    out.push({
      realm,
      nonce,
      algorithm,
      qops,
      ...(opaque !== undefined ? { opaque } : {}),
      userhash: c.get('userhash')?.toLowerCase() === 'true',
      stale: c.get('stale')?.toLowerCase() === 'true',
    });
  }
  return out;
}

/**
 * Pick the challenge to answer. Servers order challenges by preference
 * (RFC 7616 §2) — the first one this module can compute wins: SHA-256
 * family always; the MD5 family only when the caller can supply an MD5
 * primitive. `null` = nothing answerable (the 401 surfaces verbatim).
 */
export function selectDigestChallenge(
  challenges: ReadonlyArray<DigestChallenge>,
  options: { md5Available: boolean },
): DigestChallenge | null {
  for (const c of challenges) {
    if (c.algorithm === 'SHA-256' || c.algorithm === 'SHA-256-sess') return c;
    if (options.md5Available) return c;
  }
  return null;
}

// ── Authorization computation ───────────────────────────────────────

export interface DigestAuthorizationInput {
  method: string;
  /** Origin-form request-target — path plus query, exactly what rides
   *  the request line of the retry. */
  uri: string;
  /** Client nonce — caller-supplied randomness (tests pin the RFC
   *  vectors). Required even for RFC 2069 challenges (unused there). */
  cnonce: string;
  /** Nonce use count; the transport's single-retry policy makes this 1. */
  nonceCount: number;
  /** Wire body text for `qop=auth-int`, when the bytes are
   *  deterministically knowable ahead of dispatch (raw/urlencoded — the
   *  same discipline as SigV4's payload hash). `undefined` = not
   *  hashable (multipart); an auth-int-only challenge then fails. */
  body?: string;
}

/**
 * Compute the full `Digest …` Authorization header value answering
 * `challenge`. qop choice: `auth` when offered; else `auth-int` when
 * the body is hashable; else the legacy RFC 2069 computation when the
 * server offered no qop. Throws {@link DigestError} when the offered
 * qops can't be satisfied or the algorithm needs an MD5 primitive the
 * caller didn't pass.
 */
export async function buildDigestAuthorization(
  credentials: DigestCredentials,
  challenge: DigestChallenge,
  input: DigestAuthorizationInput,
  md5?: DigestHashFn,
): Promise<string> {
  const sess = challenge.algorithm === 'MD5-sess' || challenge.algorithm === 'SHA-256-sess';
  const hash: DigestHashFn = challenge.algorithm.startsWith('SHA-256') ? sha256Hex : requireMd5(md5);

  const qop = chooseQop(challenge, input);
  const nc = input.nonceCount.toString(16).padStart(8, '0');

  // A1 — credentials hash; -sess variants fold nonce + cnonce in once.
  let ha1 = await hash(`${credentials.username}:${challenge.realm}:${credentials.password}`);
  if (sess) ha1 = await hash(`${ha1}:${challenge.nonce}:${input.cnonce}`);

  // A2 — method + target; auth-int folds the entity-body hash in.
  const ha2 =
    qop === 'auth-int'
      ? await hash(`${input.method.toUpperCase()}:${input.uri}:${await hash(input.body ?? '')}`)
      : await hash(`${input.method.toUpperCase()}:${input.uri}`);

  const response =
    qop === undefined
      ? await hash(`${ha1}:${challenge.nonce}:${ha2}`)
      : await hash(`${ha1}:${challenge.nonce}:${nc}:${input.cnonce}:${qop}:${ha2}`);

  const username = challenge.userhash ? await hash(`${credentials.username}:${challenge.realm}`) : credentials.username;

  const parts = [
    `username="${quote(username)}"`,
    `realm="${quote(challenge.realm)}"`,
    `nonce="${quote(challenge.nonce)}"`,
    `uri="${quote(input.uri)}"`,
    `response="${response}"`,
    `algorithm=${challenge.algorithm}`,
  ];
  if (qop !== undefined) {
    parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${quote(input.cnonce)}"`);
  }
  if (challenge.opaque !== undefined) parts.push(`opaque="${quote(challenge.opaque)}"`);
  if (challenge.userhash) parts.push('userhash=true');
  return `Digest ${parts.join(', ')}`;
}

function chooseQop(challenge: DigestChallenge, input: DigestAuthorizationInput): DigestQop | undefined {
  if (challenge.qops.length === 0) return undefined;
  if (challenge.qops.includes('auth')) return 'auth';
  if (input.body !== undefined) return 'auth-int';
  throw new DigestError(
    'The server requires integrity protection (qop=auth-int), which needs the exact request body bytes ahead of dispatch — not knowable for this body type.',
  );
}

function requireMd5(md5: DigestHashFn | undefined): DigestHashFn {
  if (md5 === undefined) {
    throw new DigestError('The server offered only MD5 digest challenges, which this runtime cannot compute.');
  }
  return md5;
}

/** Escape a value for an HTTP quoted-string. */
function quote(value: string): string {
  return value.replace(/([\\"])/g, '\\$1');
}
