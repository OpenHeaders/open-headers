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

import { createHash, createHmac } from 'node:crypto';
import { expect } from '@playwright/test';
import type { AwsSuiteCredentials, ExpectedAuthWire } from '../../../../../playground/scripts/auth-type-suite';

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
    | { kind: 'scheme'; scheme: string; token: string };
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
  }
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
