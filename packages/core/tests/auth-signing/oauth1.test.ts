import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildOAuth1SignatureBaseString, type OAuth1Credentials, signOAuth1 } from '../../src/auth-signing/index';

/** RFC 5849 §3.4.1.1 example request (errata 2550 corrections applied). */
const RFC_URL = 'http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b';
const RFC_OAUTH_PARAMS: Array<[string, string]> = [
  ['oauth_consumer_key', '9djdj82h48djs9d2'],
  ['oauth_token', 'kkk9d7dh3k39sjv7'],
  ['oauth_signature_method', 'HMAC-SHA1'],
  ['oauth_timestamp', '137131201'],
  ['oauth_nonce', '7d8f3e4a'],
];
const RFC_BODY_PARAMS = [
  { name: 'c2', value: '' },
  { name: 'a3', value: '2 q' },
];
const RFC_BASE_STRING =
  'POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3D2%2520q%26a3%3Da%26b5%3D%253D%25253D' +
  '%26c%2540%3D%26c2%3D%26oauth_consumer_key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a' +
  '%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D137131201%26oauth_token%3Dkkk9d7dh3k39sjv7';

const CREDENTIALS: OAuth1Credentials = {
  consumerKey: 'oh-consumer-key',
  consumerSecret: 'oh-consumer-secret',
  token: 'oh-token',
  tokenSecret: 'oh-token-secret',
  signatureMethod: 'HMAC-SHA1',
  paramsLocation: 'header',
};

const SIGN_INPUT = {
  method: 'GET',
  url: 'https://api.openheaders.io/v1/items?page=2&sort=name',
  timestampSec: 1373131200,
  nonce: 'openheaders-nonce',
};

// ── Independent reference implementation (node:crypto) ─────────────
//
// Re-derives the expected signature with a from-the-spec implementation
// that shares NO code with the production signer, so an error in the
// WebCrypto path can't self-confirm.

function refEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function refSignature(
  creds: OAuth1Credentials,
  input: { method: string; url: string; timestampSec: number; nonce: string },
  bodyParams: ReadonlyArray<{ name: string; value: string }> = [],
): string {
  const url = new URL(input.url);
  const pairs: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    pairs.push([refEncode(key), refEncode(value)]);
  });
  for (const p of bodyParams) pairs.push([refEncode(p.name), refEncode(p.value)]);
  const oauthParams: Array<[string, string]> = [
    ['oauth_consumer_key', creds.consumerKey],
    ['oauth_nonce', input.nonce],
    ['oauth_signature_method', creds.signatureMethod],
    ['oauth_timestamp', String(input.timestampSec)],
    ['oauth_version', '1.0'],
  ];
  if (creds.token) oauthParams.push(['oauth_token', creds.token]);
  for (const [k, v] of oauthParams) pairs.push([refEncode(k), refEncode(v)]);
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const base = [
    input.method.toUpperCase(),
    refEncode(`${url.protocol}//${url.host}${url.pathname}`),
    refEncode(pairs.map(([k, v]) => `${k}=${v}`).join('&')),
  ].join('&');
  const key = `${refEncode(creds.consumerSecret)}&${refEncode(creds.tokenSecret ?? '')}`;
  return createHmac('sha1', key).update(base).digest('base64');
}

function headerParams(authorization: string): Map<string, string> {
  expect(authorization.startsWith('OAuth ')).toBe(true);
  const out = new Map<string, string>();
  for (const part of authorization.slice('OAuth '.length).split(', ')) {
    const eq = part.indexOf('=');
    out.set(part.slice(0, eq), part.slice(eq + 1).replace(/^"|"$/g, ''));
  }
  return out;
}

describe('buildOAuth1SignatureBaseString', () => {
  it('reproduces the RFC 5849 §3.4.1.1 base string byte-exact', () => {
    expect(buildOAuth1SignatureBaseString('POST', RFC_URL, RFC_OAUTH_PARAMS, RFC_BODY_PARAMS)).toBe(RFC_BASE_STRING);
  });

  it('signs the RFC base string to the errata-corrected signature', () => {
    const signature = createHmac('sha1', 'j49sk3j29djd&dh893hdasih9').update(RFC_BASE_STRING).digest('base64');
    expect(signature).toBe('r6/TJjbCOr97/+UU0NsvSne7s5g=');
  });

  it('keeps a non-default port in the base URI and elides a default one', () => {
    expect(buildOAuth1SignatureBaseString('GET', 'https://api.openheaders.io:8443/x', [], [])).toContain(
      refEncode('https://api.openheaders.io:8443/x'),
    );
    expect(buildOAuth1SignatureBaseString('GET', 'https://api.openheaders.io:443/x', [], [])).toContain(
      refEncode('https://api.openheaders.io/x'),
    );
  });
});

describe('signOAuth1', () => {
  it('emits an Authorization header matching the reference implementation', async () => {
    const result = await signOAuth1(CREDENTIALS, SIGN_INPUT);
    expect(result.queryParams).toEqual([]);
    expect(result.headers).toHaveLength(1);
    const params = headerParams(result.headers[0].value);
    expect(result.headers[0].key).toBe('Authorization');
    expect(params.get('oauth_consumer_key')).toBe('oh-consumer-key');
    expect(params.get('oauth_token')).toBe('oh-token');
    expect(params.get('oauth_signature_method')).toBe('HMAC-SHA1');
    expect(params.get('oauth_timestamp')).toBe('1373131200');
    expect(params.get('oauth_nonce')).toBe('openheaders-nonce');
    expect(params.get('oauth_version')).toBe('1.0');
    expect(decodeURIComponent(params.get('oauth_signature') ?? '')).toBe(refSignature(CREDENTIALS, SIGN_INPUT));
  });

  it('folds urlencoded body fields into the signature', async () => {
    const bodyParams = [
      { name: 'status', value: 'openheaders release notes' },
      { name: 'tags', value: 'a&b=c' },
    ];
    const result = await signOAuth1(CREDENTIALS, { ...SIGN_INPUT, method: 'POST', bodyParams });
    const params = headerParams(result.headers[0].value);
    expect(decodeURIComponent(params.get('oauth_signature') ?? '')).toBe(
      refSignature(CREDENTIALS, { ...SIGN_INPUT, method: 'POST' }, bodyParams),
    );
  });

  it('signs one-legged calls without a token param', async () => {
    const creds: OAuth1Credentials = { ...CREDENTIALS, token: undefined, tokenSecret: undefined };
    const result = await signOAuth1(creds, SIGN_INPUT);
    const params = headerParams(result.headers[0].value);
    expect(params.has('oauth_token')).toBe(false);
    expect(decodeURIComponent(params.get('oauth_signature') ?? '')).toBe(refSignature(creds, SIGN_INPUT));
  });

  it('sends the PLAINTEXT signature verbatim without hashing', async () => {
    const creds: OAuth1Credentials = { ...CREDENTIALS, signatureMethod: 'PLAINTEXT' };
    const result = await signOAuth1(creds, SIGN_INPUT);
    const params = headerParams(result.headers[0].value);
    expect(params.get('oauth_signature_method')).toBe('PLAINTEXT');
    expect(decodeURIComponent(params.get('oauth_signature') ?? '')).toBe('oh-consumer-secret&oh-token-secret');
  });

  it('leads the header with an HTTP-quoted realm, never signed', async () => {
    const creds: OAuth1Credentials = { ...CREDENTIALS, realm: 'Photos "archive"' };
    const result = await signOAuth1(creds, SIGN_INPUT);
    expect(result.headers[0].value.startsWith('OAuth realm="Photos \\"archive\\"", oauth_consumer_key=')).toBe(true);
    const params = headerParams(result.headers[0].value);
    // The realm does not join the base string — signature matches the
    // realm-less reference.
    expect(decodeURIComponent(params.get('oauth_signature') ?? '')).toBe(refSignature(CREDENTIALS, SIGN_INPUT));
  });

  it('returns query pairs instead of a header for paramsLocation query', async () => {
    const creds: OAuth1Credentials = { ...CREDENTIALS, paramsLocation: 'query' };
    const result = await signOAuth1(creds, SIGN_INPUT);
    expect(result.headers).toEqual([]);
    const byKey = new Map(result.queryParams.map((p) => [p.key, p.value]));
    expect(byKey.get('oauth_consumer_key')).toBe('oh-consumer-key');
    // Query values are returned raw — the caller's appendQueryParams
    // owns the encoding.
    expect(byKey.get('oauth_signature')).toBe(refSignature(CREDENTIALS, SIGN_INPUT));
  });

  it('percent-encodes reserved characters in credentials per §3.6', async () => {
    const creds: OAuth1Credentials = {
      ...CREDENTIALS,
      consumerKey: 'key with spaces&more',
      consumerSecret: 'sécret/+=',
      tokenSecret: "it's (rare)*!",
    };
    const result = await signOAuth1(creds, SIGN_INPUT);
    const params = headerParams(result.headers[0].value);
    expect(params.get('oauth_consumer_key')).toBe('key%20with%20spaces%26more');
    expect(decodeURIComponent(params.get('oauth_signature') ?? '')).toBe(refSignature(creds, SIGN_INPUT));
  });
});
