import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AWS_SIGV4_UNSIGNED_PAYLOAD,
  type AwsSigV4Credentials,
  deriveAwsScope,
  resolveAwsScope,
  sha256Hex,
  signAwsSigV4,
} from '../../src/auth-signing/index';

/** SHA-256 of an empty payload — the constant every GET signs over. */
const EMPTY_PAYLOAD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/** The official AWS SigV4 test-suite credential set. */
const SUITE_CREDENTIALS: AwsSigV4Credentials = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  service: 'service',
  region: 'us-east-1',
};

const SUITE_DATE = new Date('2015-08-30T12:36:00Z');

function headerMap(headers: Array<{ key: string; value: string }>): Map<string, string> {
  return new Map(headers.map((h) => [h.key.toLowerCase(), h.value]));
}

// ── Independent reference implementation (node:crypto) ─────────────
//
// Re-derives the expected signature with a from-the-spec implementation
// that shares NO code with the production signer, so an error in the
// WebCrypto path can't self-confirm.

function refEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** The SDKs' unsigned set — the reference keeps its own copy. */
const REF_UNSIGNED = new Set([
  'authorization',
  'connection',
  'expect',
  'presigned-expires',
  'range',
  'user-agent',
  'x-amzn-trace-id',
]);

type RefInput = {
  method: string;
  url: string;
  payloadHash: string;
  now: Date;
  headers?: Array<{ key: string; value: string }>;
  /** Query mode: `url` is the SIGNED wire URL (the X-Amz-* params on
   *  it, X-Amz-Signature included — the reference drops that one). */
  query?: boolean;
};

function refSign(creds: AwsSigV4Credentials, input: RefInput): { signature: string; signedHeaders: string } {
  const url = new URL(input.url);
  const amzDate = input.now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = new Map<string, string>();
  for (const h of input.headers ?? []) {
    const name = h.key.toLowerCase();
    if (!REF_UNSIGNED.has(name)) canonicalHeaders.set(name, h.value.trim().replace(/\s+/g, ' '));
  }
  canonicalHeaders.set('host', url.host);
  if (!input.query) {
    canonicalHeaders.set('x-amz-date', amzDate);
    if (creds.sessionToken) canonicalHeaders.set('x-amz-security-token', creds.sessionToken);
    if (creds.service === 's3') canonicalHeaders.set('x-amz-content-sha256', input.payloadHash);
  }
  const names = [...canonicalHeaders.keys()].sort();
  const signedHeaders = names.join(';');
  const payloadHash = input.query && creds.service === 's3' ? 'UNSIGNED-PAYLOAD' : input.payloadHash;

  const path =
    creds.service === 's3'
      ? url.pathname || '/'
      : (url.pathname || '/')
          .replace(/\/{2,}/g, '/')
          .split('/')
          .map((s) => refEncode(s))
          .join('/');
  const queryPairs: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    if (input.query && key === 'X-Amz-Signature') return;
    queryPairs.push([refEncode(key), refEncode(value)]);
  });
  queryPairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));

  const canonicalRequest = [
    input.method.toUpperCase(),
    path,
    queryPairs.map(([k, v]) => `${k}=${v}`).join('&'),
    names.map((n) => `${n}:${canonicalHeaders.get(n)}\n`).join(''),
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${creds.region}/${creds.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  let key: Buffer = createHmac('sha256', `AWS4${creds.secretAccessKey}`).update(dateStamp).digest();
  key = createHmac('sha256', key).update(creds.region).digest();
  key = createHmac('sha256', key).update(creds.service).digest();
  key = createHmac('sha256', key).update('aws4_request').digest();
  return { signature: createHmac('sha256', key).update(stringToSign).digest('hex'), signedHeaders };
}

function expectMatchesReference(
  headers: Array<{ key: string; value: string }>,
  creds: AwsSigV4Credentials,
  input: RefInput,
): void {
  const ref = refSign(creds, input);
  const auth = headerMap(headers).get('authorization') ?? '';
  expect(auth).toContain(`SignedHeaders=${ref.signedHeaders}`);
  expect(auth).toContain(`Signature=${ref.signature}`);
}

describe('sha256Hex', () => {
  it('hashes the empty string to the well-known constant', async () => {
    expect(await sha256Hex('')).toBe(EMPTY_PAYLOAD_HASH);
  });
});

describe('signAwsSigV4', () => {
  it('reproduces the official test-suite get-vanilla signature', async () => {
    const { headers } = await signAwsSigV4(SUITE_CREDENTIALS, {
      method: 'GET',
      url: 'https://example.amazonaws.com/',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    const map = headerMap(headers);
    expect(map.get('x-amz-date')).toBe('20150830T123600Z');
    expect(map.get('authorization')).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    );
    expect(map.has('x-amz-security-token')).toBe(false);
    expect(map.has('x-amz-content-sha256')).toBe(false);
  });

  it('sorts query params by key then value into the canonical string', async () => {
    const input = {
      method: 'GET',
      url: 'https://api.openheaders.io/items?b=2&a=1&a=0&zed=last',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(SUITE_CREDENTIALS, input);
    expectMatchesReference(headers, SUITE_CREDENTIALS, input);
  });

  it('signs + emits the session token header for temporary credentials', async () => {
    const creds: AwsSigV4Credentials = { ...SUITE_CREDENTIALS, sessionToken: 'FQoGZXIvYXdzEXAMPLE' };
    const input = {
      method: 'POST',
      url: 'https://dynamodb.us-east-1.amazonaws.com/',
      headers: [],
      payloadHash: await sha256Hex('{"TableName":"openheaders"}'),
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(creds, input);
    const map = headerMap(headers);
    expect(map.get('x-amz-security-token')).toBe('FQoGZXIvYXdzEXAMPLE');
    expect(map.get('authorization')).toContain('x-amz-security-token');
    expectMatchesReference(headers, creds, input);
  });

  it('adds x-amz-content-sha256 for s3 and honors UNSIGNED-PAYLOAD', async () => {
    const creds: AwsSigV4Credentials = { ...SUITE_CREDENTIALS, service: 's3' };
    const input = {
      method: 'PUT',
      url: 'https://openheaders-bucket.s3.amazonaws.com/reports/2026.json',
      headers: [],
      payloadHash: AWS_SIGV4_UNSIGNED_PAYLOAD,
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(creds, input);
    const map = headerMap(headers);
    expect(map.get('x-amz-content-sha256')).toBe(AWS_SIGV4_UNSIGNED_PAYLOAD);
    expectMatchesReference(headers, creds, input);
  });

  it('folds an outgoing Content-Type into the signed headers', async () => {
    const input = {
      method: 'POST',
      url: 'https://api.openheaders.io/v1/ingest',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      payloadHash: await sha256Hex('{"ok":true}'),
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(SUITE_CREDENTIALS, input);
    const auth = headerMap(headers).get('authorization') ?? '';
    expect(auth).toContain('SignedHeaders=content-type;host;x-amz-date');
    expectMatchesReference(headers, SUITE_CREDENTIALS, input);
  });

  it('signs every shipping header — S3 rejects unsigned x-amz-* rows', async () => {
    const creds: AwsSigV4Credentials = { ...SUITE_CREDENTIALS, service: 's3' };
    const input = {
      method: 'PUT',
      url: 'https://openheaders-bucket.s3.amazonaws.com/reports/2026.json',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'x-amz-acl', value: 'private' },
        { key: 'X-Amz-Meta-Owner', value: '  john.doe   openheaders ' },
      ],
      payloadHash: await sha256Hex('{"ok":true}'),
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(creds, input);
    const auth = headerMap(headers).get('authorization') ?? '';
    expect(auth).toContain(
      'SignedHeaders=content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date;x-amz-meta-owner',
    );
    expectMatchesReference(headers, creds, input);
  });

  it('leaves the unsigned set out and mints over a user X-Amz-Date row', async () => {
    const input = {
      method: 'GET',
      url: 'https://api.openheaders.io/v1/users',
      headers: [
        { key: 'User-Agent', value: 'openheaders/1' },
        { key: 'Range', value: 'bytes=0-99' },
        { key: 'Authorization', value: 'Bearer stale' },
        { key: 'Connection', value: 'keep-alive' },
        { key: 'X-Amz-Date', value: '20000101T000000Z' },
      ],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(SUITE_CREDENTIALS, input);
    const map = headerMap(headers);
    expect(map.get('x-amz-date')).toBe('20150830T123600Z');
    expect(map.get('authorization')).toContain('SignedHeaders=host;x-amz-date,');
    expectMatchesReference(headers, SUITE_CREDENTIALS, input);
  });

  it('collapses repeated slashes for every service but s3', async () => {
    const url = 'https://api.openheaders.io//v1///users';
    const normalized = await signAwsSigV4(SUITE_CREDENTIALS, {
      method: 'GET',
      url,
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    const single = await signAwsSigV4(SUITE_CREDENTIALS, {
      method: 'GET',
      url: 'https://api.openheaders.io/v1/users',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    expect(headerMap(normalized.headers).get('authorization')).toBe(headerMap(single.headers).get('authorization'));

    const s3 = { ...SUITE_CREDENTIALS, service: 's3' };
    const verbatim = await signAwsSigV4(s3, {
      method: 'GET',
      url,
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    const s3Single = await signAwsSigV4(s3, {
      method: 'GET',
      url: 'https://api.openheaders.io/v1/users',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    expect(headerMap(verbatim.headers).get('authorization')).not.toBe(headerMap(s3Single.headers).get('authorization'));
    expectMatchesReference(verbatim.headers, s3, {
      method: 'GET',
      url,
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
  });

  it('keeps a non-default port in the signed host', async () => {
    const input = {
      method: 'GET',
      url: 'https://localhost:9000/openheaders-bucket/key.txt',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    };
    const creds: AwsSigV4Credentials = { ...SUITE_CREDENTIALS, service: 's3' };
    const { headers } = await signAwsSigV4(creds, input);
    expectMatchesReference(headers, creds, input);
  });
});

describe('deriveAwsScope', () => {
  it.each([
    ['dynamodb.us-east-1.amazonaws.com', { service: 'dynamodb', region: 'us-east-1' }],
    ['abc123.execute-api.eu-central-1.amazonaws.com', { service: 'execute-api', region: 'eu-central-1' }],
    ['s3.amazonaws.com', { service: 's3', region: 'us-east-1' }],
    ['openheaders-bucket.s3.amazonaws.com', { service: 's3', region: 'us-east-1' }],
    ['openheaders-bucket.s3.eu-west-1.amazonaws.com', { service: 's3', region: 'eu-west-1' }],
    ['openheaders-bucket.s3-eu-west-1.amazonaws.com', { service: 's3', region: 'eu-west-1' }],
    ['s3-ap-southeast-2.amazonaws.com', { service: 's3', region: 'ap-southeast-2' }],
    ['search-openheaders-a1b2.us-east-1.es.amazonaws.com', { service: 'es', region: 'us-east-1' }],
    ['email.us-west-2.amazonaws.com', { service: 'ses', region: 'us-west-2' }],
    ['sts.amazonaws.com', { service: 'sts' }],
    ['dynamodb.cn-north-1.amazonaws.com.cn', { service: 'dynamodb', region: 'cn-north-1' }],
    ['api.openheaders.io', {}],
    ['localhost:9000', {}],
  ])('%s', (host, expected) => {
    expect(deriveAwsScope(host)).toEqual(expected);
  });
});

describe('resolveAwsScope', () => {
  it('a set field wins, a blank one derives, a blank region falls back to us-east-1', () => {
    expect(resolveAwsScope({ service: '', region: '' }, 'dynamodb.eu-west-1.amazonaws.com')).toEqual({
      service: 'dynamodb',
      region: 'eu-west-1',
    });
    expect(resolveAwsScope({ service: ' execute-api ', region: '' }, 'api.openheaders.io')).toEqual({
      service: 'execute-api',
      region: 'us-east-1',
    });
    expect(resolveAwsScope({ service: '', region: 'eu-north-1' }, 'sts.amazonaws.com')).toEqual({
      service: 'sts',
      region: 'eu-north-1',
    });
    expect(resolveAwsScope({ service: '', region: '' }, 'api.openheaders.io')).toEqual({ region: 'us-east-1' });
  });

  it('signAwsSigV4 derives the scope from the host and refuses a blank service on a foreign host', async () => {
    const blank: AwsSigV4Credentials = { ...SUITE_CREDENTIALS, service: '', region: '' };
    const input = {
      method: 'GET',
      url: 'https://dynamodb.eu-west-1.amazonaws.com/',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    };
    const { headers } = await signAwsSigV4(blank, input);
    expect(headerMap(headers).get('authorization')).toContain('/20150830/eu-west-1/dynamodb/aws4_request');
    expectMatchesReference(headers, { ...blank, service: 'dynamodb', region: 'eu-west-1' }, input);

    await expect(signAwsSigV4(blank, { ...input, url: 'https://api.openheaders.io/v1/users' })).rejects.toThrow(
      /not an AWS endpoint/,
    );
  });
});

describe('signAwsSigV4 in query mode', () => {
  const QUERY_CREDENTIALS: AwsSigV4Credentials = { ...SUITE_CREDENTIALS, addTo: 'query' };

  function queryOf(url: string): Map<string, string> {
    return new Map([...new URL(url).searchParams.entries()]);
  }

  it('appends the X-Amz-* parameters after the user query, the signature last, no headers', async () => {
    const signed = await signAwsSigV4(QUERY_CREDENTIALS, {
      method: 'GET',
      url: 'https://api.openheaders.io/v1/users?b=2&a=1',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    expect(signed.headers).toEqual([]);
    expect(signed.url.startsWith('https://api.openheaders.io/v1/users?b=2&a=1&X-Amz-Algorithm=')).toBe(true);
    expect(signed.url.split('&').at(-1)?.startsWith('X-Amz-Signature=')).toBe(true);
    const q = queryOf(signed.url);
    expect(q.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(q.get('X-Amz-Credential')).toBe('AKIDEXAMPLE/20150830/us-east-1/service/aws4_request');
    expect(q.get('X-Amz-Date')).toBe('20150830T123600Z');
    expect(q.get('X-Amz-SignedHeaders')).toBe('host');
    expect(q.has('X-Amz-Expires')).toBe(false);
    expect(q.has('X-Amz-Security-Token')).toBe(false);
    const ref = refSign(QUERY_CREDENTIALS, {
      method: 'GET',
      url: signed.url,
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
      query: true,
    });
    expect(q.get('X-Amz-Signature')).toBe(ref.signature);
  });

  it('s3 carries X-Amz-Expires and signs UNSIGNED-PAYLOAD; the session token rides as a parameter', async () => {
    const creds: AwsSigV4Credentials = { ...QUERY_CREDENTIALS, service: 's3', sessionToken: 'FQoGZXIvYXdzEXAMPLE' };
    const payloadHash = await sha256Hex('{"ignored":true}');
    const signed = await signAwsSigV4(creds, {
      method: 'PUT',
      url: 'https://openheaders-bucket.s3.amazonaws.com/reports/2026.json',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      payloadHash,
      now: SUITE_DATE,
    });
    const q = queryOf(signed.url);
    expect(q.get('X-Amz-Expires')).toBe('86400');
    expect(q.get('X-Amz-Security-Token')).toBe('FQoGZXIvYXdzEXAMPLE');
    expect(q.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    const ref = refSign(creds, {
      method: 'PUT',
      url: signed.url,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      payloadHash,
      now: SUITE_DATE,
      query: true,
    });
    expect(q.get('X-Amz-Signature')).toBe(ref.signature);
    // A different payload hash must NOT change an s3 query signature.
    const other = await signAwsSigV4(creds, {
      method: 'PUT',
      url: 'https://openheaders-bucket.s3.amazonaws.com/reports/2026.json',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    expect(queryOf(other.url).get('X-Amz-Signature')).toBe(q.get('X-Amz-Signature'));
  });

  it('a non-s3 service signs the real payload hash and keeps the fragment out of the query', async () => {
    const creds: AwsSigV4Credentials = { ...QUERY_CREDENTIALS, service: 'execute-api' };
    const payloadHash = await sha256Hex('{"ok":true}');
    const signed = await signAwsSigV4(creds, {
      method: 'POST',
      url: 'https://abc123.execute-api.us-east-1.amazonaws.com/prod/items#frag',
      headers: [],
      payloadHash,
      now: SUITE_DATE,
    });
    expect(signed.url.endsWith('#frag')).toBe(true);
    const q = queryOf(signed.url);
    const ref = refSign(creds, { method: 'POST', url: signed.url, payloadHash, now: SUITE_DATE, query: true });
    expect(q.get('X-Amz-Signature')).toBe(ref.signature);
    const other = await signAwsSigV4(creds, {
      method: 'POST',
      url: 'https://abc123.execute-api.us-east-1.amazonaws.com/prod/items#frag',
      headers: [],
      payloadHash: EMPTY_PAYLOAD_HASH,
      now: SUITE_DATE,
    });
    expect(queryOf(other.url).get('X-Amz-Signature')).not.toBe(q.get('X-Amz-Signature'));
  });
});
