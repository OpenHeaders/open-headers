import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/background/modules/environment-store', () => {
  return {
    getEnvironments: vi.fn(() => [] as V5.Environment[]),
    getActiveEnvironmentId: vi.fn(() => null as string | null),
    getDefaultEnvironmentId: vi.fn(() => null as string | null),
    getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as V5.WorkspaceVariables),
    getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as V5.Vault),
  };
});

vi.mock('@/background/modules/rule-store', () => {
  return {
    getCollections: vi.fn(() => [] as V5.Collection[]),
    getRules: vi.fn(() => [] as V5.Rule[]),
  };
});

import {
  getActiveEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '@/background/modules/environment-store';
import { getCollections, getRules } from '@/background/modules/rule-store';
import { __resetForTests, getResolvedRules, resolveRulesForCompile } from '@/background/modules/variables-resolver';

const mockEnvs = getEnvironments as ReturnType<typeof vi.fn>;
const mockActiveEnvId = getActiveEnvironmentId as ReturnType<typeof vi.fn>;
const mockWsVars = getWorkspaceVariables as ReturnType<typeof vi.fn>;
const mockVault = getVault as ReturnType<typeof vi.fn>;
const mockCollections = getCollections as ReturnType<typeof vi.fn>;
const mockStoreRules = getRules as ReturnType<typeof vi.fn>;

// ── Helpers ────────────────────────────────────────────────────────

function makeHeaderRule(overrides: Partial<V5.HeaderRule> & { path: string; uid: string }): V5.HeaderRule {
  return {
    schemaVersion: 5,
    name: 'R',
    type: 'header',
    enabled: true,
    conditions: [{ type: 'request-domains', values: ['api.openheaders.io'] }],
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'Bearer {{TOKEN}}' }],
      responseHeaders: [],
    },
    ...overrides,
  } as V5.HeaderRule;
}

function env(name: string, variables: V5.Variable[], uid = `e-${name}`): V5.Environment {
  return { schemaVersion: 5, uid, name, variables };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('VariablesResolver (extension)', () => {
  beforeEach(() => {
    __resetForTests();
    mockEnvs.mockReturnValue([]);
    mockActiveEnvId.mockReturnValue(null);
    mockWsVars.mockReturnValue({ schemaVersion: 5, variables: [] });
    mockVault.mockReturnValue({ schemaVersion: 5, secrets: [] });
    mockCollections.mockReturnValue([]);
    mockStoreRules.mockReturnValue([]);
  });

  it('resolves workspace variable when no higher scope defines it', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer ws-token');
  });

  it('lets active environment override workspace scope', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });
    mockEnvs.mockReturnValue([
      env('staging', [{ name: 'TOKEN', value: 'staging-token', type: 'default' }], 'e-staging'),
    ]);
    mockActiveEnvId.mockReturnValue('e-staging');

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer staging-token');
  });

  it('lets vault secret override environment scope', () => {
    mockEnvs.mockReturnValue([env('prod', [{ name: 'TOKEN', value: 'env-token', type: 'default' }], 'e-prod')]);
    mockActiveEnvId.mockReturnValue('e-prod');
    mockVault.mockReturnValue({
      schemaVersion: 5,
      secrets: [{ name: 'TOKEN', value: 'vault-token' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer vault-token');
  });

  it('resolves collection-scoped variables for rules inside that collection', () => {
    const collection: V5.Collection = {
      schemaVersion: 5,
      uid: 'c-1',
      path: 'rules/my-coll-abcd',
      name: 'My Coll',
      variables: [{ name: 'TOKEN', value: 'coll-token', type: 'default' }],
    };
    mockCollections.mockReturnValue([collection]);
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer coll-token');
  });

  it('falls back to workspace scope for rules outside any collection', () => {
    const collection: V5.Collection = {
      schemaVersion: 5,
      uid: 'c-1',
      path: 'rules/my-coll-abcd',
      name: 'My Coll',
      variables: [{ name: 'TOKEN', value: 'coll-token', type: 'default' }],
    };
    mockCollections.mockReturnValue([collection]);
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const orphan = makeHeaderRule({ uid: 'r1', path: 'rules/other-coll-wxyz/r1' });
    const [resolved] = resolveRulesForCompile([orphan]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer ws-token');
  });

  it('treats null activeEnvironmentId as "no environment" (Postman semantics)', () => {
    mockEnvs.mockReturnValue([
      env('staging', [{ name: 'TOKEN', value: 'staging-token', type: 'default' }], 'e-staging'),
    ]);
    mockActiveEnvId.mockReturnValue(null);
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer ws-token');
  });

  it('leaves unresolved variables as-is', () => {
    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as V5.HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer {{TOKEN}}');
  });

  it('does not mutate input rules', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'TOKEN', value: 'ws', type: 'default' }],
    });
    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const originalValue = rule.action.requestHeaders?.[0].value;

    resolveRulesForCompile([rule]);

    expect(rule.action.requestHeaders?.[0].value).toBe(originalValue);
  });

  it('reflects env switch across sequential compile calls', () => {
    const stagingEnv = env('staging', [{ name: 'TOKEN', value: 'staging', type: 'default' }], 'e-staging');
    const prodEnv = env('prod', [{ name: 'TOKEN', value: 'prod', type: 'default' }], 'e-prod');
    mockEnvs.mockReturnValue([stagingEnv, prodEnv]);

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });

    mockActiveEnvId.mockReturnValue('e-staging');
    const [first] = resolveRulesForCompile([rule]) as V5.HeaderRule[];
    expect(first.action.requestHeaders?.[0].value).toBe('Bearer staging');

    mockActiveEnvId.mockReturnValue('e-prod');
    const [second] = resolveRulesForCompile([rule]) as V5.HeaderRule[];
    expect(second.action.requestHeaders?.[0].value).toBe('Bearer prod');
  });

  it('resolves variables in rule conditions too', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });

    const rule = makeHeaderRule({
      uid: 'r1',
      path: 'rules/my-coll-abcd/r1',
      conditions: [{ type: 'request-domains', values: ['{{HOST}}'] }],
    });

    const [resolved] = resolveRulesForCompile([rule]);

    expect(resolved.conditions[0].values).toEqual(['api.openheaders.io']);
  });

  it('caches the resolved snapshot for consumers like request-tracker', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    const rule = makeHeaderRule({
      uid: 'r1',
      path: 'rules/my-coll-abcd/r1',
      conditions: [{ type: 'request-domains', values: ['{{HOST}}'] }],
    });
    mockStoreRules.mockReturnValue([rule]);

    expect(getResolvedRules()).toEqual([]);

    resolveRulesForCompile([rule]);

    const snapshot = getResolvedRules();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].conditions[0].values).toEqual(['api.openheaders.io']);
  });

  it('does not overwrite the snapshot when compiling a test-run subset', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    const r1 = makeHeaderRule({
      uid: 'r1',
      path: 'rules/my-coll-abcd/r1',
      conditions: [{ type: 'request-domains', values: ['{{HOST}}'] }],
    });
    const r2 = makeHeaderRule({
      uid: 'r2',
      path: 'rules/my-coll-abcd/r2',
      conditions: [{ type: 'request-domains', values: ['other.openheaders.io'] }],
    });
    mockStoreRules.mockReturnValue([r1, r2]);

    // Full compile populates the snapshot.
    resolveRulesForCompile([r1, r2]);
    expect(getResolvedRules()).toHaveLength(2);

    // Test-run scope compiles only r1 — snapshot must stay at 2.
    resolveRulesForCompile([r1]);
    expect(getResolvedRules()).toHaveLength(2);
  });
});
