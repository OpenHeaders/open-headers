/**
 * `/api/echo` auth assertions shared by the request e2e specs — one
 * reading of the reflection's `auth` / `headers` / `query` blocks per
 * expected-wire kind (`playground/scripts/auth-type-suite.ts`), so the
 * RPC and DOM layers assert the same vocabulary.
 *
 * The SigV4 kind is a full recompute: the signature the echo received
 * is re-derived from the echoed request — method, path, query, the
 * headers SignedHeaders names, the empty-payload hash — with a
 * from-the-spec node:crypto implementation (the core pins' reference)
 * that shares no code with the production signer, so a wrong canonical
 * form can't self-confirm.
 */

import { createHash, createHmac, createPublicKey, verify as nodeVerify } from 'node:crypto';
import { expect } from '@playwright/test';
import { API_ECHO_URL } from '../../../../../playground/scripts/api-client-matrix';
import type {
  AwsSuiteCredentials,
  EdgeGridSuiteCredentials,
  ExpectedAuthWire,
} from '../../../../../playground/scripts/auth-type-suite';

/** The auth-bearing slice of the `/api/echo` reflection (`playground/server/api-echo.ts`). */
export interface EchoAuthResponse {
  method: string;
  /** Path + query as received. */
  url: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[]>;
  auth:
    | { kind: 'none' }
    | { kind: 'basic'; username: string; password: string }
    | { kind: 'bearer'; token: string }
    | { kind: 'scheme'; scheme: string; token: string }
    | {
        kind: 'dpop';
        token: string;
        jkt: string;
        proof: { verified: true; htm: string; htu: string; ath: true; nonce: string | null };
      }
    | { kind: 'dpop-invalid'; reason: string };
}

const JWT_COMPACT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const EMPTY_PAYLOAD_HASH = createHash('sha256').update('').digest('hex');

export function assertEchoAuth(echo: EchoAuthResponse, expected: ExpectedAuthWire): void {
  switch (expected.kind) {
    case 'none':
      expect(echo.auth.kind).toBe('none');
      break;
    case 'basic':
      expect(echo.auth).toMatchObject({ kind: 'basic', username: expected.username, password: expected.password });
      break;
    case 'bearer':
      expect(echo.auth).toMatchObject({ kind: 'bearer', token: expected.token });
      break;
    case 'header':
      // api-key in a header — no Authorization, the key rides its own header.
      expect(echo.auth.kind).toBe('none');
      expect(echo.headers[expected.name]).toBe(expected.value);
      break;
    case 'query':
      // api-key in the query string / oauth2 sendAs:query.
      expect(echo.query[expected.name]).toBe(expected.value);
      break;
    case 'scheme':
      expect(echo.auth).toMatchObject({ kind: 'scheme', scheme: expected.scheme });
      break;
    case 'bearer-jwt':
      expect(echo.auth.kind).toBe('bearer');
      expect((echo.auth as { token: string }).token).toMatch(JWT_COMPACT);
      break;
    case 'sigv4':
      assertSigV4(echo, expected.addTo, expected.credentials);
      break;
    case 'edgegrid':
      assertEdgeGrid(echo, expected.credentials);
      break;
    case 'asap':
      assertAsap(echo, expected);
      break;
    case 'http-signature':
      assertHttpSignature(echo, expected);
      break;
    case 'dpop':
      // The echo verified the proof for this GET under the header JWK,
      // the token's hash in `ath`, and the token's binding to that key.
      expect(echo.auth).toMatchObject({
        kind: 'dpop',
        token: expected.token,
        proof: { verified: true, htm: 'GET', ath: true },
      });
      expect((echo.auth as { jkt: string }).jkt).toMatch(/^[A-Za-z0-9_-]{43}$/);
      break;
  }
}

// ── HTTP Message Signature verification (RFC 9421) ──────────────────

/**
 * The signature base rebuilt from what the server saw — each covered
 * component in the Signature-Input's own order, derived ones from the
 * echoed request line and Host, fields from the echoed headers — and
 * the echoed Signature verified over it under the suite key's public
 * half (ECDSA P-256, the raw r‖s encoding) or the shared secret
 * (HMAC). Shares no code with the production signer.
 */
function assertHttpSignature(
  echo: EchoAuthResponse,
  expected: Extract<ExpectedAuthWire, { kind: 'http-signature' }>,
): void {
  const label = expected.label ?? 'sig1';
  const input = single(echo.headers['signature-input']);
  const signature = single(echo.headers.signature);
  expect(input.startsWith(`${label}=(`)).toBe(true);
  expect(signature.startsWith(`${label}=:`)).toBe(true);
  expect(signature.endsWith(':')).toBe(true);
  const params = input.slice(label.length + 1);
  const listEnd = params.indexOf(')');
  const covered = params
    .slice(1, listEnd)
    .split(' ')
    .filter((c) => c !== '')
    .map((c) => c.replace(/^"|"$/g, ''));
  expect(covered).toEqual(expected.components.split(' '));
  expect(params).toContain(`;keyid="${expected.keyId}"`);
  const created = Number(params.match(/;created=(\d+)/)?.[1]);
  expect(Math.abs(created - Date.now() / 1000)).toBeLessThan(300);

  const origin = new URL(API_ECHO_URL).origin;
  const target = new URL(echo.url, origin);
  const componentValue = (component: string): string => {
    switch (component) {
      case '@method':
        return echo.method.toUpperCase();
      case '@target-uri':
        return target.href;
      case '@authority':
        return single(echo.headers.host);
      case '@scheme':
        return target.protocol.slice(0, -1);
      case '@request-target':
        return echo.url;
      case '@path':
        return target.pathname;
      case '@query':
        return target.search || '?';
      default:
        return single(echo.headers[component]).trim();
    }
  };
  if (covered.includes('content-digest')) {
    // A bodiless GET digests the empty content.
    expect(single(echo.headers['content-digest'])).toBe(
      `sha-256=:${createHash('sha256').update('').digest('base64')}:`,
    );
  }
  const base = [...covered.map((c) => `"${c}": ${componentValue(c)}`), `"@signature-params": ${params}`].join('\n');
  const sig = Buffer.from(signature.slice(label.length + 2, -1), 'base64');
  if (expected.algorithm === 'hmac-sha256') {
    expect(sig.toString('base64')).toBe(createHmac('sha256', expected.secret).update(base).digest('base64'));
    return;
  }
  expect(sig).toHaveLength(64);
  expect(
    nodeVerify(
      'sha256',
      Buffer.from(base),
      { key: createPublicKey(expected.publicKeyPem), dsaEncoding: 'ieee-p1363' },
      sig,
    ),
  ).toBe(true);
}

// ── ASAP verification ───────────────────────────────────────────────

/** The echoed bearer JWT verified under the suite key's public half
 *  (ES256 — node needs the JOSE r‖s encoding named), its header and
 *  claims checked against the seeded identity and the scheme's rules:
 *  a UUID jti, exp − iat = the one-hour default, sub = the issuer. */
function assertAsap(
  echo: EchoAuthResponse,
  expected: { publicKeyPem: string; issuer: string; audience: string; keyId: string },
): void {
  expect(echo.auth.kind).toBe('bearer');
  const jwt = (echo.auth as { token: string }).token;
  const [h, p, s] = jwt.split('.');
  expect(s).toBeDefined();
  const header = JSON.parse(Buffer.from(h ?? '', 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(p ?? '', 'base64url').toString('utf8'));
  expect(header).toEqual({ typ: 'JWT', kid: expected.keyId, alg: 'ES256' });
  expect(claims).toMatchObject({ iss: expected.issuer, sub: expected.issuer, aud: expected.audience });
  expect(claims.exp - claims.iat).toBe(3600);
  expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
  const key = createPublicKey(expected.publicKeyPem);
  expect(
    nodeVerify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(s ?? '', 'base64url'),
    ),
  ).toBe(true);
}

// ── EdgeGrid recompute ──────────────────────────────────────────────

/** The signature re-derived from the echoed request: the tab-joined
 *  data (method, scheme, host, path + query, no listed headers, the
 *  empty GET content hash, the header prefix) under the timestamp
 *  keyed signing chain — from the spec, sharing nothing with the
 *  signer. */
function assertEdgeGrid(echo: EchoAuthResponse, creds: EdgeGridSuiteCredentials): void {
  expect(echo.auth).toMatchObject({ kind: 'scheme', scheme: 'EG1-HMAC-SHA256' });
  const token = (echo.auth as { token: string }).token;
  const part = (name: string): string => token.match(new RegExp(`${name}=([^;]+);`))?.[1] ?? '';
  expect(part('client_token')).toBe(creds.clientToken);
  expect(part('access_token')).toBe(creds.accessToken);
  const timestamp = part('timestamp');
  const nonce = part('nonce');
  expect(timestamp).toMatch(/^\d{8}T\d{2}:\d{2}:\d{2}\+0000$/);
  expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
  const signature = token.match(/signature=([^;]+)$/)?.[1] ?? '';

  const prefix =
    `EG1-HMAC-SHA256 client_token=${creds.clientToken};access_token=${creds.accessToken};` +
    `timestamp=${timestamp};nonce=${nonce};`;
  const data = [
    echo.method.toUpperCase(),
    new URL(API_ECHO_URL).protocol.slice(0, -1),
    single(echo.headers.host),
    echo.url,
    '',
    '',
    prefix,
  ].join('\t');
  const key = createHmac('sha256', creds.clientSecret).update(timestamp).digest('base64');
  expect(signature).toBe(createHmac('sha256', key).update(data).digest('base64'));
}

// ── SigV4 recompute ─────────────────────────────────────────────────

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(', ') : (value ?? '');
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The three facts the echoed signature carries, read off either shape. */
function signedFacts(
  echo: EchoAuthResponse,
  addTo: 'header' | 'query',
): { credential: string; signedHeaders: string; signature: string; amzDate: string } {
  if (addTo === 'query') {
    expect(echo.auth.kind).toBe('none');
    expect(echo.query['X-Amz-Algorithm']).toBe('AWS4-HMAC-SHA256');
    return {
      credential: single(echo.query['X-Amz-Credential']),
      signedHeaders: single(echo.query['X-Amz-SignedHeaders']),
      signature: single(echo.query['X-Amz-Signature']),
      amzDate: single(echo.query['X-Amz-Date']),
    };
  }
  expect(echo.auth).toMatchObject({ kind: 'scheme', scheme: 'AWS4-HMAC-SHA256' });
  const token = (echo.auth as { token: string }).token;
  const part = (name: string): string => token.match(new RegExp(`${name}=([^,\\s]+)`))?.[1] ?? '';
  return {
    credential: part('Credential'),
    signedHeaders: part('SignedHeaders'),
    signature: part('Signature'),
    amzDate: single(echo.headers['x-amz-date']),
  };
}

function assertSigV4(echo: EchoAuthResponse, addTo: 'header' | 'query', creds: AwsSuiteCredentials): void {
  const facts = signedFacts(echo, addTo);
  const [accessKeyId, dateStamp, region, service, terminal] = facts.credential.split('/');
  expect(accessKeyId).toBe(creds.accessKeyId);
  expect(region).toBe(creds.region);
  expect(service).toBe(creds.service);
  expect(terminal).toBe('aws4_request');
  expect(facts.amzDate).toMatch(/^\d{8}T\d{6}Z$/);
  expect(facts.amzDate.startsWith(dateStamp ?? '')).toBe(true);

  // Canonical request over what the server saw — the headers the
  // signature names, from the reflection, in the spec's byte order.
  const url = new URL(echo.url, `http://${single(echo.headers.host)}`);
  const names = facts.signedHeaders.split(';');
  const canonicalHeaders = names
    .map((name) => `${name}:${single(echo.headers[name]).trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const pairs: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    if (addTo === 'query' && key === 'X-Amz-Signature') return;
    pairs.push([encodeRfc3986(key), encodeRfc3986(value)]);
  });
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const canonicalRequest = [
    echo.method.toUpperCase(),
    url.pathname
      .replace(/\/{2,}/g, '/')
      .split('/')
      .map((segment) => encodeRfc3986(segment))
      .join('/'),
    pairs.map(([k, v]) => `${k}=${v}`).join('&'),
    canonicalHeaders,
    facts.signedHeaders,
    EMPTY_PAYLOAD_HASH,
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    facts.amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  let key: Buffer = createHmac('sha256', `AWS4${creds.secretAccessKey}`)
    .update(dateStamp ?? '')
    .digest();
  key = createHmac('sha256', key)
    .update(region ?? '')
    .digest();
  key = createHmac('sha256', key)
    .update(service ?? '')
    .digest();
  key = createHmac('sha256', key).update('aws4_request').digest();
  expect(facts.signature).toBe(createHmac('sha256', key).update(stringToSign).digest('hex'));
}
