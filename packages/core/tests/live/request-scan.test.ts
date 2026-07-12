import { describe, expect, it } from 'vitest';
import { requestExecutableFingerprint } from '../../src/live/request-scan';
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
    expect(requestExecutableFingerprint(makeRequest({ timeoutMs: 15000 }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ maxResponseBytes: 4096 }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ preRequestScript: 'oh.set("x", 1)' }))).not.toBe(base);
    expect(requestExecutableFingerprint(makeRequest({ postResponseScript: 'oh.capture()' }))).not.toBe(base);
  });

  it('is independent of object key order', () => {
    const a = makeRequest({ auth: { type: 'bearer', token: 'abc' } });
    const b = makeRequest({ auth: { token: 'abc', type: 'bearer' } as Request['auth'] });
    expect(requestExecutableFingerprint(a)).toBe(requestExecutableFingerprint(b));
  });
});
