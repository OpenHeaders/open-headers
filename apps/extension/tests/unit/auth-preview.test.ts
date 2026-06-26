/**
 * `previewAuthContributions` — the Headers / Params tabs read this to
 * surface a read-only "this auth will add …" preview row. It must mirror
 * the executor's `applyAuth`: which auth types contribute an
 * `Authorization` header vs a query param, and under which `in` / `sendAs`
 * setting. Values are intentionally placeholders (never the resolved
 * secret), so we assert on key + destination, not on a concrete credential.
 */

import type { AuthConfig } from '@openheaders/core/types';
import { previewAuthContributions } from '@openheaders/ui/workbench/components/request-editor/auth-preview';
import { describe, expect, it } from 'vitest';

describe('previewAuthContributions', () => {
  it('contributes nothing for none / inherit', () => {
    for (const type of ['none', 'inherit'] as const) {
      const out = previewAuthContributions({ type });
      expect(out.headers).toEqual([]);
      expect(out.params).toEqual([]);
    }
  });

  it('basic + bearer add an Authorization header with their scheme', () => {
    const basic = previewAuthContributions({ type: 'basic', username: 'u', password: 'p' });
    expect(basic.headers).toHaveLength(1);
    expect(basic.headers[0].key).toBe('Authorization');
    expect(basic.headers[0].value).toMatch(/^Basic /);
    expect(basic.params).toEqual([]);

    const bearer = previewAuthContributions({ type: 'bearer', token: 't' });
    expect(bearer.headers[0].key).toBe('Authorization');
    expect(bearer.headers[0].value).toMatch(/^Bearer /);
  });

  it('never leaks the resolved credential into the preview value', () => {
    const basic = previewAuthContributions({ type: 'basic', username: 'admin', password: 'hunter2' });
    expect(basic.headers[0].value).not.toContain('hunter2');
    const bearer = previewAuthContributions({ type: 'bearer', token: 'super-secret-token' });
    expect(bearer.headers[0].value).not.toContain('super-secret-token');
  });

  it('api-key lands in the header or the query depending on `in`', () => {
    const inHeader = previewAuthContributions({ type: 'api-key', key: 'X-Api-Key', value: 's', in: 'header' });
    expect(inHeader.headers).toHaveLength(1);
    expect(inHeader.headers[0].key).toBe('X-Api-Key');
    expect(inHeader.params).toEqual([]);

    const inQuery = previewAuthContributions({ type: 'api-key', key: 'api_key', value: 's', in: 'query' });
    expect(inQuery.params).toHaveLength(1);
    expect(inQuery.params[0].key).toBe('api_key');
    expect(inQuery.headers).toEqual([]);
  });

  it('api-key with no key contributes nothing', () => {
    const out = previewAuthContributions({ type: 'api-key', key: '   ', value: 's', in: 'header' });
    expect(out.headers).toEqual([]);
    expect(out.params).toEqual([]);
  });

  it('oauth2 sends a Bearer header by default, or access_token on the URL when sendAs=query', () => {
    const base = {
      type: 'oauth2' as const,
      credentialRef: 'cred-1',
      flow: 'authorization-code-pkce' as const,
      tokenEndpoint: 'https://auth.openheaders.io/token',
      clientId: 'client-1',
      scopes: [],
    };
    const header = previewAuthContributions(base satisfies AuthConfig);
    expect(header.headers[0].key).toBe('Authorization');
    expect(header.headers[0].value).toMatch(/^Bearer /);

    const query = previewAuthContributions({ ...base, sendAs: 'query' });
    expect(query.params[0].key).toBe('access_token');
    expect(query.headers).toEqual([]);
  });
});
