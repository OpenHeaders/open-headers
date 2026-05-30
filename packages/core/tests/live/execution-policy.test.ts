import { describe, expect, it } from 'vitest';
import { deriveExecutionPolicy, type ExecutionPolicyInput } from '../../src/live/execution-policy';
import type { VariableScopeSnapshot } from '../../src/live/variable-scan';
import type { AuthConfig, OAuth2Flow, Request, Vault, VaultSecret } from '../../src/types';

// ── Factories ──────────────────────────────────────────────────────

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

function oauthAuth(flow: OAuth2Flow, credentialRef = 'cred-1'): AuthConfig {
  return {
    type: 'oauth2',
    credentialRef,
    flow,
    tokenEndpoint: 'https://idp.openheaders.io/token',
    clientId: 'client-1',
    scopes: [],
  };
}

function totpSecret(name: string): VaultSecret {
  return {
    uid: `vlt-${name}`,
    kind: 'totp',
    name,
    seed: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  };
}

function stringSecret(name: string, value = 'plain'): VaultSecret {
  return { uid: `vls-${name}`, kind: 'string', name, value };
}

function vault(secrets: VaultSecret[] = []): Vault {
  return { schemaVersion: 5, secrets };
}

function scope(
  overrides: Partial<Record<keyof VariableScopeSnapshot, Record<string, string>>> = {},
): VariableScopeSnapshot {
  const toMap = (r?: Record<string, string>) => new Map(Object.entries(r ?? {}));
  return {
    envVars: toMap(overrides.envVars),
    vaultVars: toMap(overrides.vaultVars),
    workspaceVars: toMap(overrides.workspaceVars),
    collectionVars: toMap(overrides.collectionVars),
  };
}

function input(overrides: Partial<ExecutionPolicyInput> & { requests?: Request[] } = {}): ExecutionPolicyInput {
  const requests = overrides.requests ?? [makeRequest()];
  const requestsByUid = overrides.requestsByUid ?? new Map(requests.map((r) => [r.uid, r]));
  return {
    workflow: overrides.workflow ?? { steps: requests.map((r) => ({ requestUid: r.uid })) },
    requestsByUid,
    vault: overrides.vault ?? vault(),
    scope: overrides.scope ?? scope(),
    optInExclusive: overrides.optInExclusive,
  };
}

// ── No signal ──────────────────────────────────────────────────────

describe('deriveExecutionPolicy — default idempotent', () => {
  it('classifies a plain workflow with no credential signal as idempotent', () => {
    const result = deriveExecutionPolicy(input());
    expect(result.policy).toBe('idempotent');
    expect(result.reasons).toEqual([]);
  });

  it('does not flag a flat {{X}} that resolves to a non-TOTP (string) vault entry', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/?k={{apiKey}}' });
    const result = deriveExecutionPolicy(input({ requests: [req], vault: vault([stringSecret('apiKey')]) }));
    expect(result.policy).toBe('idempotent');
  });

  it('skips disabled headers — a TOTP ref on a disabled row is not consumed', () => {
    const req = makeRequest({
      headers: [{ uid: 'h1', key: 'X-OTP', value: '{{vault.otp}}', enabled: false }],
    });
    const result = deriveExecutionPolicy(input({ requests: [req], vault: vault([totpSecret('otp')]) }));
    expect(result.policy).toBe('idempotent');
  });
});

// ── Direct TOTP ────────────────────────────────────────────────────

describe('deriveExecutionPolicy — direct TOTP consumption', () => {
  it('is exclusive when a step references {{vault.X}} of kind totp', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/?code={{vault.otp}}' });
    const result = deriveExecutionPolicy(input({ requests: [req], vault: vault([totpSecret('otp')]) }));
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'totp', vaultName: 'otp' }]);
  });

  it('is exclusive when a flat {{X}} resolves to a TOTP entry (vault wins the chain)', () => {
    const req = makeRequest({ body: { type: 'text', content: 'otp={{otp}}' } });
    const result = deriveExecutionPolicy(input({ requests: [req], vault: vault([totpSecret('otp')]) }));
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'totp', vaultName: 'otp' }]);
  });

  it('scans ALL steps, not just the first', () => {
    const a = makeRequest({ uid: 'reqA1', url: 'https://api.openheaders.io/login' });
    const b = makeRequest({ uid: 'reqB1', url: 'https://api.openheaders.io/?code={{vault.otp}}' });
    const result = deriveExecutionPolicy(input({ requests: [a, b], vault: vault([totpSecret('otp')]) }));
    expect(result.policy).toBe('exclusive');
  });
});

// ── Indirect TOTP (taint propagation) ──────────────────────────────

describe('deriveExecutionPolicy — indirect TOTP taint', () => {
  it('follows aliasing through an env var', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/?c={{env.OTP}}' });
    const result = deriveExecutionPolicy(
      input({
        requests: [req],
        vault: vault([totpSecret('seed')]),
        scope: scope({ envVars: { OTP: '{{vault.seed}}' } }),
      }),
    );
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'totp', vaultName: 'seed', indirectVia: 'OTP' }]);
  });

  it('follows concatenation through a workspace var', () => {
    const req = makeRequest({ body: { type: 'text', content: '{{combo}}' } });
    const result = deriveExecutionPolicy(
      input({
        requests: [req],
        vault: vault([totpSecret('t')]),
        scope: scope({ workspaceVars: { combo: 'prefix-{{vault.t}}-suffix' } }),
      }),
    );
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'totp', vaultName: 't', indirectVia: 'combo' }]);
  });

  it('propagates across a multi-hop variable chain to a fixpoint', () => {
    // a → b → vault.t. `a` is processed before `b` is known tainted on the
    // first pass; the fixpoint loop must catch it on a later pass.
    const req = makeRequest({ url: 'https://api.openheaders.io/?x={{env.a}}' });
    const result = deriveExecutionPolicy(
      input({
        requests: [req],
        vault: vault([totpSecret('t')]),
        scope: scope({ envVars: { a: '{{env.b}}', b: '{{vault.t}}' } }),
      }),
    );
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'totp', vaultName: 't', indirectVia: 'a' }]);
  });

  it('does not taint a variable chain that never reaches a TOTP entry', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/?x={{env.a}}' });
    const result = deriveExecutionPolicy(
      input({
        requests: [req],
        vault: vault([stringSecret('t')]),
        scope: scope({ envVars: { a: '{{env.b}}', b: '{{vault.t}}' } }),
      }),
    );
    expect(result.policy).toBe('idempotent');
  });
});

// ── Refresh-capable OAuth ──────────────────────────────────────────

describe('deriveExecutionPolicy — OAuth flows', () => {
  it('treats client-credentials as idempotent (no refresh token minted)', () => {
    const req = makeRequest({ auth: oauthAuth('client-credentials') });
    const result = deriveExecutionPolicy(input({ requests: [req] }));
    expect(result.policy).toBe('idempotent');
  });

  it('leans exclusive for authorization-code-pkce (unknown rotation)', () => {
    const req = makeRequest({ auth: oauthAuth('authorization-code-pkce', 'cred-pkce') });
    const result = deriveExecutionPolicy(input({ requests: [req] }));
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([
      { kind: 'rotating-oauth', credentialRef: 'cred-pkce', flow: 'authorization-code-pkce' },
    ]);
  });

  it('leans exclusive for device-code (unknown rotation)', () => {
    const req = makeRequest({ auth: oauthAuth('device-code', 'cred-dev') });
    const result = deriveExecutionPolicy(input({ requests: [req] }));
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'rotating-oauth', credentialRef: 'cred-dev', flow: 'device-code' }]);
  });
});

// ── Opt-in ─────────────────────────────────────────────────────────

describe('deriveExecutionPolicy — opt-in toggle', () => {
  it('escalates a no-signal workflow to exclusive when opted in', () => {
    const result = deriveExecutionPolicy(input({ optInExclusive: true }));
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([{ kind: 'opt-in' }]);
  });

  it('cannot downgrade a derived exclusive signal (not user-downgradable)', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/?c={{vault.otp}}' });
    const result = deriveExecutionPolicy(
      input({ requests: [req], vault: vault([totpSecret('otp')]), optInExclusive: false }),
    );
    expect(result.policy).toBe('exclusive');
  });
});

// ── Combination + edge cases ───────────────────────────────────────

describe('deriveExecutionPolicy — aggregation', () => {
  it('dedupes the same TOTP reason across multiple steps', () => {
    const a = makeRequest({ uid: 'reqA1', url: 'https://api.openheaders.io/?c={{vault.otp}}' });
    const b = makeRequest({ uid: 'reqB1', url: 'https://api.openheaders.io/v2?c={{vault.otp}}' });
    const result = deriveExecutionPolicy(input({ requests: [a, b], vault: vault([totpSecret('otp')]) }));
    expect(result.reasons).toEqual([{ kind: 'totp', vaultName: 'otp' }]);
  });

  it('collects distinct reasons from different signals', () => {
    const a = makeRequest({ uid: 'reqA1', url: 'https://api.openheaders.io/?c={{vault.otp}}' });
    const b = makeRequest({ uid: 'reqB1', auth: oauthAuth('device-code', 'cred-dev') });
    const result = deriveExecutionPolicy(input({ requests: [a, b], vault: vault([totpSecret('otp')]) }));
    expect(result.policy).toBe('exclusive');
    expect(result.reasons).toEqual([
      { kind: 'totp', vaultName: 'otp' },
      { kind: 'rotating-oauth', credentialRef: 'cred-dev', flow: 'device-code' },
    ]);
  });

  it('skips a step whose request is missing from the map', () => {
    const result = deriveExecutionPolicy(
      input({ workflow: { steps: [{ requestUid: 'ghost' }] }, requestsByUid: new Map() }),
    );
    expect(result.policy).toBe('idempotent');
  });
});

// ── credentialStepIds (C7 byproduct) ───────────────────────────────

describe('deriveExecutionPolicy — credentialStepIds', () => {
  it('is empty for an idempotent workflow', () => {
    const result = deriveExecutionPolicy(input());
    expect(result.credentialStepIds.size).toBe(0);
  });

  it('records the id of the TOTP-consuming step only', () => {
    const a = makeRequest({ uid: 'reqA1', url: 'https://api.openheaders.io/data' });
    const b = makeRequest({ uid: 'reqB1', url: 'https://api.openheaders.io/?c={{vault.otp}}' });
    const result = deriveExecutionPolicy(
      input({
        requests: [a, b],
        vault: vault([totpSecret('otp')]),
        requestsByUid: new Map([
          [a.uid, a],
          [b.uid, b],
        ]),
        workflow: {
          steps: [
            { id: 'fetch', requestUid: a.uid },
            { id: 'login', requestUid: b.uid },
          ],
        },
      }),
    );
    expect([...result.credentialStepIds]).toEqual(['login']);
  });

  it('records an OAuth-authed step id', () => {
    const req = makeRequest({ auth: oauthAuth('authorization-code-pkce') });
    const result = deriveExecutionPolicy(
      input({ requests: [req], workflow: { steps: [{ id: 'authed', requestUid: req.uid }] } }),
    );
    expect([...result.credentialStepIds]).toEqual(['authed']);
  });

  it('omits steps with no id even when they carry a credential signal', () => {
    const req = makeRequest({ url: 'https://api.openheaders.io/?c={{vault.otp}}' });
    const result = deriveExecutionPolicy(input({ requests: [req], vault: vault([totpSecret('otp')]) }));
    expect(result.policy).toBe('exclusive');
    expect(result.credentialStepIds.size).toBe(0);
  });
});
