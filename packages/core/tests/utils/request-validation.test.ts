import { describe, expect, it } from 'vitest';
import type { Request } from '../../src/types/v5/request';
import { isRequestComplete, requestIncompleteReason } from '../../src/utils/request-validation';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'req00001',
    path: 'requests/demo-req00001',
    name: 'Demo',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

describe('isRequestComplete — url', () => {
  it('returns true for a request with a non-empty URL', () => {
    expect(isRequestComplete(makeRequest())).toBe(true);
  });

  it('returns false for an empty URL', () => {
    expect(isRequestComplete(makeRequest({ url: '' }))).toBe(false);
  });

  it('returns false for a whitespace-only URL', () => {
    expect(isRequestComplete(makeRequest({ url: '   ' }))).toBe(false);
  });

  it('accepts a templated URL verbatim — resolution happens at execute time', () => {
    expect(isRequestComplete(makeRequest({ url: '{{env.BASE}}/login' }))).toBe(true);
  });
});

describe('isRequestComplete — auth', () => {
  it('none is always complete', () => {
    expect(isRequestComplete(makeRequest({ auth: { type: 'none' } }))).toBe(true);
  });

  it('inherit is always complete', () => {
    expect(isRequestComplete(makeRequest({ auth: { type: 'inherit' } }))).toBe(true);
  });

  it('basic: requires a non-empty username', () => {
    expect(isRequestComplete(makeRequest({ auth: { type: 'basic', username: 'alice', password: '' } }))).toBe(true);
    expect(isRequestComplete(makeRequest({ auth: { type: 'basic', username: '', password: 'pw' } }))).toBe(false);
    expect(isRequestComplete(makeRequest({ auth: { type: 'basic', username: '   ', password: 'pw' } }))).toBe(false);
  });

  it('bearer: requires a non-empty token', () => {
    expect(isRequestComplete(makeRequest({ auth: { type: 'bearer', token: 'eyJ...' } }))).toBe(true);
    expect(isRequestComplete(makeRequest({ auth: { type: 'bearer', token: '' } }))).toBe(false);
  });

  it('api-key: requires non-empty key AND value', () => {
    expect(
      isRequestComplete(makeRequest({ auth: { type: 'api-key', key: 'X-API-Key', value: 'k', in: 'header' } })),
    ).toBe(true);
    expect(isRequestComplete(makeRequest({ auth: { type: 'api-key', key: '', value: 'k', in: 'header' } }))).toBe(
      false,
    );
    expect(isRequestComplete(makeRequest({ auth: { type: 'api-key', key: 'X', value: '', in: 'header' } }))).toBe(
      false,
    );
  });

  it('oauth2: always complete at the request level (runtime token state is separate)', () => {
    expect(
      isRequestComplete(
        makeRequest({
          auth: {
            type: 'oauth2',
            credentialRef: 'cred-abc',
            flow: 'client-credentials',
            tokenEndpoint: 'https://example.openheaders.io/token',
            clientId: 'client-id',
            scopes: [],
          },
        }),
      ),
    ).toBe(true);
  });
});

describe('isRequestComplete — works without storage fields (pre-save drafts)', () => {
  it('accepts an Omit<Request, "uid" | "path" | "schemaVersion" | "version">', () => {
    const draft = {
      name: 'Draft',
      method: 'GET' as const,
      url: 'https://openheaders.io',
      headers: [],
      params: [],
      auth: { type: 'none' as const },
      body: { type: 'none' as const },
    };
    expect(isRequestComplete(draft)).toBe(true);
  });
});

describe('requestIncompleteReason', () => {
  it('returns null when the request is complete', () => {
    expect(requestIncompleteReason(makeRequest())).toBeNull();
  });

  it('reports missing-url first', () => {
    expect(requestIncompleteReason(makeRequest({ url: '' }))).toBe('missing-url');
  });

  it('reports basic-missing-username when URL is set but username empty', () => {
    expect(requestIncompleteReason(makeRequest({ auth: { type: 'basic', username: '', password: 'pw' } }))).toBe(
      'basic-missing-username',
    );
  });

  it('reports bearer-missing-token when token empty', () => {
    expect(requestIncompleteReason(makeRequest({ auth: { type: 'bearer', token: '' } }))).toBe('bearer-missing-token');
  });

  it('reports api-key-missing-key before api-key-missing-value', () => {
    expect(requestIncompleteReason(makeRequest({ auth: { type: 'api-key', key: '', value: '', in: 'header' } }))).toBe(
      'api-key-missing-key',
    );
    expect(requestIncompleteReason(makeRequest({ auth: { type: 'api-key', key: 'X', value: '', in: 'header' } }))).toBe(
      'api-key-missing-value',
    );
  });
});
