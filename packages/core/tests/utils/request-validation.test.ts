import { describe, expect, it } from 'vitest';
import type { Request } from '../../src/types/v5/request';
import type { ResolvedVariable } from '../../src/types/v5/variable';
import { isRequestComplete, isRequestResolvable, requestIncompleteReason } from '../../src/utils/request-validation';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
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

// ── isRequestResolvable — reference-gating ─────────────────────────

describe('isRequestResolvable', () => {
  const lookupFromMap = (values: Record<string, string>) => {
    return (name: string): ResolvedVariable | null => {
      const v = values[name];
      if (v === undefined) return null;
      return { name, value: v, scope: 'workspace', isSensitive: false };
    };
  };

  it('returns true when the request has no templates', () => {
    expect(isRequestResolvable(makeRequest({ url: 'https://api.openheaders.io/ping' }), () => null)).toBe(true);
  });

  it('returns true when every URL reference resolves', () => {
    const req = makeRequest({ url: 'https://{{HOST}}/ping' });
    expect(isRequestResolvable(req, lookupFromMap({ HOST: 'api.openheaders.io' }))).toBe(true);
  });

  it('returns false when a URL reference is unresolved — the executor refuses to ship `{{HOST}}` literally', () => {
    const req = makeRequest({ url: 'https://{{HOST}}/ping' });
    expect(isRequestResolvable(req, () => null)).toBe(false);
  });

  it('walks enabled headers (key + value) but skips disabled ones', () => {
    const req = makeRequest({
      headers: [
        { uid: 'disabld1', key: 'X-Disabled', value: '{{NEVER}}', enabled: false },
        { uid: 'enabledh', key: 'X-Auth', value: '{{TOKEN}}', enabled: true },
      ],
    });
    // Disabled header's unresolved ref doesn't block the request.
    expect(isRequestResolvable(req, lookupFromMap({ TOKEN: 'abc' }))).toBe(true);
    // Enabled header's unresolved ref does.
    expect(isRequestResolvable(req, lookupFromMap({ NEVER: 'x' }))).toBe(false);
  });

  it('walks enabled query params but skips disabled ones', () => {
    const req = makeRequest({
      params: [
        { uid: 'tzparam1', key: 'tz', value: '{{TZ}}', enabled: false },
        { uid: 'usrparam', key: 'user', value: '{{USER}}', enabled: true },
      ],
    });
    expect(isRequestResolvable(req, lookupFromMap({ USER: 'alice' }))).toBe(true);
    expect(isRequestResolvable(req, lookupFromMap({ TZ: 'UTC' }))).toBe(false);
  });

  it('walks basic auth fields (username + password)', () => {
    const req = makeRequest({ auth: { type: 'basic', username: '{{USER}}', password: '{{PASS}}' } });
    expect(isRequestResolvable(req, lookupFromMap({ USER: 'alice', PASS: 'secret' }))).toBe(true);
    expect(isRequestResolvable(req, lookupFromMap({ USER: 'alice' }))).toBe(false);
  });

  it('walks bearer auth token', () => {
    const req = makeRequest({ auth: { type: 'bearer', token: '{{TOKEN}}' } });
    expect(isRequestResolvable(req, lookupFromMap({ TOKEN: 'abc' }))).toBe(true);
    expect(isRequestResolvable(req, () => null)).toBe(false);
  });

  it('walks body content when the body has a string payload', () => {
    const req = makeRequest({
      body: { type: 'json', content: '{"user":"{{USER}}"}' },
    });
    expect(isRequestResolvable(req, lookupFromMap({ USER: 'alice' }))).toBe(true);
    expect(isRequestResolvable(req, () => null)).toBe(false);
  });

  it('accepts reserved-namespace references (`{{dynamic.X}}`) — intentionally unresolved until feature ships', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/t/{{dynamic.$timestamp}}' });
    // Pass a scoped lookup that returns null — `resolveTemplate` will
    // emit `reserved-namespace` for `dynamic.*`, which
    // `isRequestResolvable` filters out of the gate.
    expect(
      isRequestResolvable(
        req,
        () => null,
        () => null,
      ),
    ).toBe(true);
  });
});
