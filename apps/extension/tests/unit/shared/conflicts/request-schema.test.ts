/**
 * Per-leaf coverage for `REQUEST_SCHEMA` — Auth + Body discriminated
 * unions land per-leaf paths through the field-tree walker, replacing
 * the old opaque stable-stringified scalars at `auth` / `body`.
 */

import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { makeConflictAdapter } from '@/shared/conflicts/field-tree/make-conflict-adapter';
import { REQUEST_SCHEMA } from '@/shared/conflicts/field-tree/request-schema';

const adapter = makeConflictAdapter<V5.Request>({
  schema: REQUEST_SCHEMA,
  signature: (r) => r.uid,
});

function baseRequest(overrides: Partial<V5.Request> = {}): V5.Request {
  return {
    uid: 'req-0001',
    name: 'r',
    description: '',
    url: 'https://openheaders.io/api',
    method: 'GET',
    schemaVersion: 5,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  } as unknown as V5.Request;
}

describe('REQUEST_SCHEMA — Auth (OAuth2) per-leaf', () => {
  const req = baseRequest({
    auth: {
      type: 'oauth2',
      credentialRef: 'cred-1',
      flow: 'authorization-code-pkce',
      tokenEndpoint: 'https://openheaders.io/oauth/token',
      clientId: 'client-1',
      scopes: ['read', 'write'],
      extraTokenParams: [{ uid: 'tp000001', key: 'audience', value: 'a' }],
    } as unknown as V5.AuthConfig,
  });

  it('emits per-leaf paths for OAuth2 fields', () => {
    const baseline = adapter.tracking.extractBaseline(req);
    expect(baseline['auth.tokenEndpoint']).toBe('https://openheaders.io/oauth/token');
    expect(baseline['auth.clientId']).toBe('client-1');
    expect(baseline['auth.scopes']).toBe('read, write');
    expect(baseline['auth.extraTokenParams.tp000001.key']).toBe('audience');
    expect(baseline['auth.extraTokenParams.tp000001.value']).toBe('a');
  });

  it('emits union:auth structural marker', () => {
    const baseline = adapter.tracking.extractBaseline(req);
    expect(baseline['union:auth']).toContain('"kind":"oauth2"');
  });

  it('readPath returns leaf value for an oauth2 sub-leaf', () => {
    expect(adapter.tracking.readPath(req, 'auth.tokenEndpoint')).toBe(
      'https://openheaders.io/oauth/token',
    );
  });

  it('applyResolutionToEntity writes a per-leaf change into the auth object', () => {
    const target = JSON.parse(JSON.stringify(req)) as V5.Request;
    const ok = adapter.resolve.applyResolutionToEntity(target, 'auth.tokenEndpoint', {
      base: 'https://openheaders.io/oauth/token',
      theirs: 'https://openheaders.io/oauth/token-v2',
    });
    expect(ok).toBe(true);
    expect((target.auth as { tokenEndpoint: string }).tokenEndpoint).toBe(
      'https://openheaders.io/oauth/token-v2',
    );
  });

  it('union:auth whole-branch resolution swaps the auth branch + discriminator', () => {
    const target = JSON.parse(JSON.stringify(req)) as V5.Request;
    const ok = adapter.resolve.applyResolutionToEntity(target, 'union:auth', {
      base: '',
      theirs: '',
      rowPayload: { kind: 'bearer', branch: { type: 'bearer', token: 't-saved' } },
    });
    expect(ok).toBe(true);
    expect(target.auth).toEqual({ type: 'bearer', token: 't-saved' });
  });
});

describe('REQUEST_SCHEMA — Body (JSON) per-leaf', () => {
  const req = baseRequest({
    body: { type: 'json', content: '{"a":1}' } as V5.RequestBody,
  });

  it('emits a per-leaf path for json body content', () => {
    const baseline = adapter.tracking.extractBaseline(req);
    expect(baseline['body.content']).toBe('{"a":1}');
    expect(baseline['union:body']).toContain('"kind":"json"');
  });

  it('applyResolutionToEntity writes the new content into body.content', () => {
    const target = JSON.parse(JSON.stringify(req)) as V5.Request;
    const ok = adapter.resolve.applyResolutionToEntity(target, 'body.content', {
      base: '{"a":1}',
      theirs: '{"a":2}',
    });
    expect(ok).toBe(true);
    expect((target.body as { content: string }).content).toBe('{"a":2}');
  });

  it('union:body resolves whole-branch swap json → text', () => {
    const target = JSON.parse(JSON.stringify(req)) as V5.Request;
    const ok = adapter.resolve.applyResolutionToEntity(target, 'union:body', {
      base: '',
      theirs: '',
      rowPayload: { kind: 'text', branch: { type: 'text', content: 'hi' } },
    });
    expect(ok).toBe(true);
    expect(target.body).toEqual({ type: 'text', content: 'hi' });
  });
});
