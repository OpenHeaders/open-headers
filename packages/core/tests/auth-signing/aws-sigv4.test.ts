import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AWS_SIGV4_UNSIGNED_PAYLOAD,
  type AwsSigV4Credentials,
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

function refSign(
  creds: AwsSigV4Credentials,
  input: { method: string; url: string; payloadHash: string; now: Date; contentType?: string },
): { signature: string; signedHeaders: string } {
  const url = new URL(input.url);
  const amzDate = input.now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = new Map<string, string>([
    ['host', url.host],
    ['x-amz-date', amzDate],
  ]);
  if (creds.sessionToken) canonicalHeaders.set('x-amz-security-token', creds.sessionToken);
  if (creds.service === 's3') canonicalHeaders.set('x-amz-content-sha256', input.payloadHash);
  if (input.contentType) canonicalHeaders.set('content-type', input.contentType);
  const names = [...canonicalHeaders.keys()].sort();
  const signedHeaders = names.join(';');

  const path =
    creds.service === 's3'
      ? url.pathname || '/'
      : (url.pathname || '/')
          .split('/')
          .map((s) => refEncode(s))
          .join('/');
  const queryPairs: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => queryPairs.push([refEncode(key), refEncode(value)]));
  queryPairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));

  const canonicalRequest = [
    input.method.toUpperCase(),
    path,
    queryPairs.map(([k, v]) => `${k}=${v}`).join('&'),
    names.map((n) => `${n}:${canonicalHeaders.get(n)}\n`).join(''),
    signedHeaders,
    input.payloadHash,
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
  input: { method: string; url: string; payloadHash: string; now: Date; contentType?: string },
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
    const headers = await signAwsSigV4(SUITE_CREDENTIALS, {
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
    const headers = await signAwsSigV4(SUITE_CREDENTIALS, input);
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
    const headers = await signAwsSigV4(creds, input);
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
    const headers = await signAwsSigV4(creds, input);
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
    const headers = await signAwsSigV4(SUITE_CREDENTIALS, input);
    const auth = headerMap(headers).get('authorization') ?? '';
    expect(auth).toContain('SignedHeaders=content-type;host;x-amz-date');
    expectMatchesReference(headers, SUITE_CREDENTIALS, { ...input, contentType: 'application/json' });
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
    const headers = await signAwsSigV4(creds, input);
    expectMatchesReference(headers, creds, input);
  });
});
