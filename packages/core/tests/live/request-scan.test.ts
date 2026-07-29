import { describe, expect, it } from 'vitest';
import { collectRequestTemplateStrings, requestExecutableFingerprint } from '../../src/live/request-scan';
import type { Request } from '../../src/types';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'reqfetch1',
    path: 'requests/demo-reqfetch1',
    name: 'Fetch token',
    method: 'GET',
    url: 'https://api.openheaders.io/token',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

describe('requestExecutableFingerprint', () => {
  it('is stable for structurally-identical requests', () => {
    expect(requestExecutableFingerprint(makeRequest())).toBe(requestExecutableFingerprint(makeRequest()));
  });

  it('is unchanged by cosmetic edits (uid, path, name, description, schemaVersion)', () => {
    const base = requestExecutableFingerprint(makeRequest());
    expect(requestExecutableFingerprint(makeRequest({ uid: 'reqother1' }))).toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ path: 'requests/moved-reqfetch1' }))).toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ name: 'Renamed' }))).toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ description: 'new docs' }))).toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ schemaVersion: 6 }))).toBe(base);
  });

  it('changes when any executable field changes', () => {
    const base = requestExecutableFingerprint(makeRequest());
    expect(requestExecutableFingerprint(makeRequest({ method: 'POST' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ url: 'https://api.openheaders.io/token-v2' }))).not.toBe(base);
    expect(
      requestExecutableFingerprint(
        makeRequest({ headers: [{ uid: 'hdrenv01', key: 'X-Env', value: 'qa', enabled: true }] }),
      ),
    ).not.toBe(base);
    expect(
      requestExecutableFingerprint(
        makeRequest({ params: [{ uid: 'prmscp01', key: 'scope', value: 'admin', enabled: true }] }),
      ),
    ).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ auth: { type: 'bearer', token: '{{env.SEED}}' } }))).not.toBe(
      base,
    );
    expect(requestExecutableFingerprint(makeRequest({ body: { type: 'json', content: '{}' } }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ credentialsMode: 'include' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ followRedirects: false }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ sslVerification: false }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ tlsMinVersion: '1.0' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ tlsMaxVersion: '1.2' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ httpVersion: '2' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ resolveToAddress: '10.0.0.7' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ clientCertificateRef: 'gateway-mtls' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ proxyUrl: 'http://proxy.openheaders.io:3128' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ proxyCredentialRef: 'corp-proxy' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ unixSocketPath: '/var/run/openheaders/api.sock' }))).not.toBe(
      base,
    );
    expect(requestExecutableFingerprint(makeRequest({ cookieJar: true }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ timeoutMs: 15000 }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ maxResponseBytes: 4096 }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ maxRedirects: 5 }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ followOriginalHttpMethod: true }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ followAuthorizationHeader: true }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ preRequestScript: 'oh.set("x", 1)' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ postResponseScript: 'oh.capture()' }))).not.toBe(base);
  });

  it('is independent of object key order', () => {
    const a = makeRequest({ auth: { type: 'bearer', token: 'abc' } });
    const b = makeRequest({ auth: { token: 'abc', type: 'bearer' } as Request['auth'] });
    expect(requestExecutableFingerprint(a)).toBe(requestExecutableFingerprint(b));
  });
});

describe('collectRequestTemplateStrings — aws-sigv4 auth', () => {
  it('collects every SigV4 field so vault-templated credentials gate resolution', () => {
    const strings = collectRequestTemplateStrings(
      makeRequest({
        auth: {
          type: 'aws-sigv4',
          accessKeyId: '{{vault.aws_key_id}}',
          secretAccessKey: '{{vault.aws_secret}}',
          sessionToken: '{{vault.aws_session}}',
          service: 'execute-api',
          region: '{{env.AWS_REGION}}',
        },
      }),
    );
    expect(strings).toContain('{{vault.aws_key_id}}');
    expect(strings).toContain('{{vault.aws_secret}}');
    expect(strings).toContain('{{vault.aws_session}}');
    expect(strings).toContain('execute-api');
    expect(strings).toContain('{{env.AWS_REGION}}');
  });

  it('skips the absent sessionToken', () => {
    const strings = collectRequestTemplateStrings(
      makeRequest({
        auth: {
          type: 'aws-sigv4',
          accessKeyId: 'AKIDEXAMPLE',
          secretAccessKey: 'secret',
          service: 's3',
          region: 'us-east-1',
        },
      }),
    );
    expect(strings).toEqual(expect.arrayContaining(['AKIDEXAMPLE', 'secret', 's3', 'us-east-1']));
    expect(strings).toHaveLength(5);
  });
});

describe('collectRequestTemplateStrings — oauth1 auth', () => {
  it('collects every credential field so vault-templated secrets gate resolution', () => {
    const strings = collectRequestTemplateStrings(
      makeRequest({
        auth: {
          type: 'oauth1',
          consumerKey: '{{vault.oauth1_key}}',
          consumerSecret: '{{vault.oauth1_secret}}',
          token: '{{vault.oauth1_token}}',
          tokenSecret: '{{vault.oauth1_token_secret}}',
          signatureMethod: 'HMAC-SHA1',
          paramsLocation: 'header',
          realm: '{{env.OAUTH_REALM}}',
        },
      }),
    );
    expect(strings).toContain('{{vault.oauth1_key}}');
    expect(strings).toContain('{{vault.oauth1_secret}}');
    expect(strings).toContain('{{vault.oauth1_token}}');
    expect(strings).toContain('{{vault.oauth1_token_secret}}');
    expect(strings).toContain('{{env.OAUTH_REALM}}');
  });

  it('skips the absent token pair and realm on one-legged configs', () => {
    const strings = collectRequestTemplateStrings(
      makeRequest({
        auth: {
          type: 'oauth1',
          consumerKey: 'ck_openheaders',
          consumerSecret: 'cs_openheaders',
          signatureMethod: 'HMAC-SHA1',
          paramsLocation: 'query',
        },
      }),
    );
    expect(strings).toEqual(expect.arrayContaining(['ck_openheaders', 'cs_openheaders']));
    expect(strings).toHaveLength(3);
  });
});
