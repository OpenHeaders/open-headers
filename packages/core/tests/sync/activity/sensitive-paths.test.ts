import { describe, expect, it } from 'vitest';

import {
  detectSensitiveRotation,
  isSensitiveHeaderName,
  isSensitiveLeafPath,
  isSensitiveSetMember,
} from '../../../src/sync';

describe('isSensitiveHeaderName', () => {
  it('matches Authorization-style header names case-insensitively', () => {
    expect(isSensitiveHeaderName('Authorization')).toBe(true);
    expect(isSensitiveHeaderName('authorization')).toBe(true);
    expect(isSensitiveHeaderName(' AUTHORIZATION ')).toBe(true);
    expect(isSensitiveHeaderName('Proxy-Authorization')).toBe(true);
    expect(isSensitiveHeaderName('cookie')).toBe(true);
    expect(isSensitiveHeaderName('Set-Cookie')).toBe(true);
    expect(isSensitiveHeaderName('X-Api-Key')).toBe(true);
    expect(isSensitiveHeaderName('X-Auth-Token')).toBe(true);
  });

  it('rejects non-sensitive headers', () => {
    expect(isSensitiveHeaderName('Content-Type')).toBe(false);
    expect(isSensitiveHeaderName('Accept')).toBe(false);
    expect(isSensitiveHeaderName('')).toBe(false);
    expect(isSensitiveHeaderName(undefined)).toBe(false);
    expect(isSensitiveHeaderName(null)).toBe(false);
  });
});

describe('isSensitiveLeafPath', () => {
  it('flags vault secrets value + seed', () => {
    expect(isSensitiveLeafPath('vault', 'secrets.s1.value')).toBe(true);
    expect(isSensitiveLeafPath('vault', 'secrets.abc.seed')).toBe(true);
    expect(isSensitiveLeafPath('vault', 'secrets.s1.name')).toBe(false);
  });

  it('flags oauth-bundle tokens', () => {
    expect(isSensitiveLeafPath('oauth-bundle', 'tokens.c1.accessToken')).toBe(true);
    expect(isSensitiveLeafPath('oauth-bundle', 'tokens.c1.refreshToken')).toBe(true);
    expect(isSensitiveLeafPath('oauth-bundle', 'tokens.c1.idToken')).toBe(true);
    expect(isSensitiveLeafPath('oauth-bundle', 'tokens.c1.expiresAt')).toBe(false);
  });

  it('returns false for unrelated entity types', () => {
    expect(isSensitiveLeafPath('rule', 'action.requestHeaders.0.value')).toBe(false);
    expect(isSensitiveLeafPath('environment', 'variables.0.value')).toBe(false);
  });
});

describe('isSensitiveSetMember', () => {
  it('gates rule header mods on header name', () => {
    expect(isSensitiveSetMember('rule', 'action.requestHeaders', { headerName: 'Authorization', value: 'x' })).toBe(
      true,
    );
    expect(isSensitiveSetMember('rule', 'action.responseHeaders', { headerName: 'Set-Cookie', value: 'x' })).toBe(
      true,
    );
    expect(isSensitiveSetMember('rule', 'action.requestHeaders', { headerName: 'Accept', value: 'x' })).toBe(false);
  });

  it('gates variable rows on type=secret across environment / workspace-variables / collection', () => {
    expect(isSensitiveSetMember('environment', 'variables', { type: 'secret', value: 's' })).toBe(true);
    expect(isSensitiveSetMember('workspace-variables', 'variables', { type: 'secret', value: 's' })).toBe(true);
    expect(isSensitiveSetMember('collection', 'variables', { type: 'secret', value: 's' })).toBe(true);
    expect(isSensitiveSetMember('environment', 'variables', { type: 'default', value: 's' })).toBe(false);
  });

  it('rejects non-object items and unrelated paths', () => {
    expect(isSensitiveSetMember('rule', 'action.requestHeaders', null)).toBe(false);
    expect(isSensitiveSetMember('rule', 'conditions', { headerName: 'Authorization' })).toBe(false);
    expect(isSensitiveSetMember('vault', 'secrets', { value: 'x' })).toBe(false);
  });
});

describe('detectSensitiveRotation', () => {
  it('flags vault secret value change', () => {
    const prior = { type: 'vault', id: 'vault', data: { secrets: [{ uid: 's1', value: 'old', kind: 'string' }] } };
    const next = { type: 'vault', id: 'vault', data: { secrets: [{ uid: 's1', value: 'new', kind: 'string' }] } };
    expect(detectSensitiveRotation('vault', prior.data, next.data)).toBe(true);
  });

  it('flags TOTP seed change', () => {
    const prior = { secrets: [{ uid: 's1', kind: 'totp', seed: 'AAAA' }] };
    const next = { secrets: [{ uid: 's1', kind: 'totp', seed: 'BBBB' }] };
    expect(detectSensitiveRotation('vault', prior, next)).toBe(true);
  });

  it('flags oauth-bundle access token rotation', () => {
    const prior = { tokens: [{ uid: 't1', accessToken: 'a', refreshToken: 'r' }] };
    const next = { tokens: [{ uid: 't1', accessToken: 'A', refreshToken: 'r' }] };
    expect(detectSensitiveRotation('oauth-bundle', prior, next)).toBe(true);
  });

  it('flags rule Authorization value rotation', () => {
    const prior = {
      action: { requestHeaders: [{ uid: 'h1', headerName: 'Authorization', value: 'Bearer A' }] },
    };
    const next = {
      action: { requestHeaders: [{ uid: 'h1', headerName: 'Authorization', value: 'Bearer B' }] },
    };
    expect(detectSensitiveRotation('rule', prior, next)).toBe(true);
  });

  it('ignores rule non-sensitive header value rotation', () => {
    const prior = {
      action: { requestHeaders: [{ uid: 'h1', headerName: 'Accept', value: 'application/json' }] },
    };
    const next = {
      action: { requestHeaders: [{ uid: 'h1', headerName: 'Accept', value: 'text/plain' }] },
    };
    expect(detectSensitiveRotation('rule', prior, next)).toBe(false);
  });

  it('flags env secret variable value change', () => {
    const prior = { variables: [{ uid: 'v1', name: 'API_KEY', value: 'k1', type: 'secret' }] };
    const next = { variables: [{ uid: 'v1', name: 'API_KEY', value: 'k2', type: 'secret' }] };
    expect(detectSensitiveRotation('environment', prior, next)).toBe(true);
  });

  it('ignores env non-secret variable change', () => {
    const prior = { variables: [{ uid: 'v1', name: 'BASE_URL', value: 'a', type: 'default' }] };
    const next = { variables: [{ uid: 'v1', name: 'BASE_URL', value: 'b', type: 'default' }] };
    expect(detectSensitiveRotation('environment', prior, next)).toBe(false);
  });

  it('skips when prior secret value was empty (initial set, not rotation)', () => {
    const prior = { secrets: [{ uid: 's1', value: '', kind: 'string' }] };
    const next = { secrets: [{ uid: 's1', value: 'new', kind: 'string' }] };
    expect(detectSensitiveRotation('vault', prior, next)).toBe(false);
  });

  it('returns false when items do not match by uid (those are creates / deletes)', () => {
    const prior = { secrets: [{ uid: 's1', value: 'old', kind: 'string' }] };
    const next = { secrets: [{ uid: 's2', value: 'new', kind: 'string' }] };
    expect(detectSensitiveRotation('vault', prior, next)).toBe(false);
  });

  it('returns false for unrelated entity type', () => {
    expect(detectSensitiveRotation('request', { x: 1 }, { x: 2 })).toBe(false);
  });
});
