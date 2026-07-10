import { initialCircuitSnapshot } from '@openheaders/core/live';
import type {
  Collection,
  Environment,
  HeaderRule,
  LiveVariable,
  LiveWorkflow,
  Rule,
  Variable,
  Vault,
  WorkflowRunCache,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/oracle/entity/environment-store', () => {
  return {
    getEnvironments: vi.fn(() => [] as Environment[]),
    getActiveEnvironmentId: vi.fn(() => null as string | null),
    getDefaultEnvironmentId: vi.fn(() => null as string | null),
    getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as WorkspaceVariables),
    getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as Vault),
  };
});

vi.mock('@openheaders/oracle/entity/rule-store', () => {
  return {
    getCollections: vi.fn(() => [] as Collection[]),
    getRules: vi.fn(() => [] as Rule[]),
  };
});

// Live stores — mocked so the LiveRegistry-building path in
// `variables-resolver` has deterministic inputs.
vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  getLiveVariables: vi.fn(() => [] as LiveVariable[]),
  onLiveVariableStoreChange: vi.fn(() => () => {}),
}));
vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  listWorkflowRunCaches: vi.fn(() => Promise.resolve([])),
  onLiveCacheStoreChange: vi.fn(() => () => {}),
}));
vi.mock('@openheaders/oracle/live/live-workflow-store', () => ({
  getLiveWorkflows: vi.fn(() => [] as LiveWorkflow[]),
  getLiveWorkflowsForWorkspace: vi.fn(() => [] as LiveWorkflow[]),
}));

import {
  getActiveEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '@openheaders/oracle/entity/environment-store';
import { getCollections, getRules } from '@openheaders/oracle/entity/rule-store';
import { listWorkflowRunCaches } from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariables } from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflows } from '@openheaders/oracle/live/live-workflow-store';
import {
  __resetForTests,
  getLastAggregatedResolutionErrors,
  getLastResolutionErrors,
  getResolvedRules,
  hydrateLiveCacheMirror,
  resolveRulesForCompile,
} from '@openheaders/oracle/rule-engine/variables-resolver';

const mockEnvs = getEnvironments as ReturnType<typeof vi.fn>;
const mockActiveEnvId = getActiveEnvironmentId as ReturnType<typeof vi.fn>;
const mockWsVars = getWorkspaceVariables as ReturnType<typeof vi.fn>;
const mockVault = getVault as ReturnType<typeof vi.fn>;
const mockCollections = getCollections as ReturnType<typeof vi.fn>;
const mockStoreRules = getRules as ReturnType<typeof vi.fn>;
const mockLiveVars = getLiveVariables as ReturnType<typeof vi.fn>;
const mockLiveWorkflows = getLiveWorkflows as ReturnType<typeof vi.fn>;
const mockListCaches = listWorkflowRunCaches as ReturnType<typeof vi.fn>;

// ── Helpers ────────────────────────────────────────────────────────

function makeHeaderRule(overrides: Partial<HeaderRule> & { path: string; uid: string }): HeaderRule {
  return {
    schemaVersion: 5,
    name: 'R',
    type: 'header',
    enabled: true,
    conditions: [{ uid: 'tcd00062', type: 'request-domains', values: ['api.openheaders.io'] }],
    action: {
      requestHeaders: [
        { uid: 'thm00105', operation: 'override', headerName: 'Authorization', value: 'Bearer {{TOKEN}}' },
      ],
      responseHeaders: [],
    },
    ...overrides,
  } as HeaderRule;
}

function env(name: string, variables: Variable[], uid = `e-${name}`): Environment {
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
    mockLiveVars.mockReturnValue([]);
    mockLiveWorkflows.mockReturnValue([]);
    mockListCaches.mockResolvedValue([]);
  });

  it('resolves workspace variable when no higher scope defines it', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: '9cdd8c2b', name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer ws-token');
  });

  it('lets active environment override workspace scope', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: '3e440f9f', name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });
    mockEnvs.mockReturnValue([
      env('staging', [{ uid: '3b5f8511', name: 'TOKEN', value: 'staging-token', type: 'default' }], 'e-staging'),
    ]);
    mockActiveEnvId.mockReturnValue('e-staging');

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer staging-token');
  });

  it('lets vault secret override environment scope', () => {
    mockEnvs.mockReturnValue([
      env('prod', [{ uid: 'ae67a31b', name: 'TOKEN', value: 'env-token', type: 'default' }], 'e-prod'),
    ]);
    mockActiveEnvId.mockReturnValue('e-prod');
    mockVault.mockReturnValue({
      schemaVersion: 5,

      secrets: [{ uid: '16f5bde2', kind: 'string', name: 'TOKEN', value: 'vault-token' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer vault-token');
  });

  it('resolves collection-scoped variables for rules inside that collection', () => {
    const collection: Collection = {
      schemaVersion: 5,
      uid: 'c-1',
      path: 'rules/my-coll-abcd',
      name: 'My Coll',
      variables: [{ uid: '3f066e26', name: 'TOKEN', value: 'coll-token', type: 'default' }],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    };
    mockCollections.mockReturnValue([collection]);
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: 'd35930ff', name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer coll-token');
  });

  it('falls back to workspace scope for rules outside any collection', () => {
    const collection: Collection = {
      schemaVersion: 5,
      uid: 'c-1',
      path: 'rules/my-coll-abcd',
      name: 'My Coll',
      variables: [{ uid: '3a87a72f', name: 'TOKEN', value: 'coll-token', type: 'default' }],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    };
    mockCollections.mockReturnValue([collection]);
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: 'a9c960e1', name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const orphan = makeHeaderRule({ uid: 'r1', path: 'rules/other-coll-wxyz/r1' });
    const [resolved] = resolveRulesForCompile([orphan]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer ws-token');
  });

  it('treats null activeEnvironmentId as "no environment" (Postman semantics)', () => {
    mockEnvs.mockReturnValue([
      env('staging', [{ uid: '66aa1c7d', name: 'TOKEN', value: 'staging-token', type: 'default' }], 'e-staging'),
    ]);
    mockActiveEnvId.mockReturnValue(null);
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: '8fc7f0da', name: 'TOKEN', value: 'ws-token', type: 'default' }],
    });

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer ws-token');
  });

  it('leaves unresolved variables as-is', () => {
    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const [resolved] = resolveRulesForCompile([rule]) as HeaderRule[];

    expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer {{TOKEN}}');
  });

  it('does not mutate input rules', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: 'deb417d2', name: 'TOKEN', value: 'ws', type: 'default' }],
    });
    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });
    const originalValue = rule.action.requestHeaders?.[0].value;

    resolveRulesForCompile([rule]);

    expect(rule.action.requestHeaders?.[0].value).toBe(originalValue);
  });

  it('reflects env switch across sequential compile calls', () => {
    const stagingEnv = env(
      'staging',
      [{ uid: '0c34ad14', name: 'TOKEN', value: 'staging', type: 'default' }],
      'e-staging',
    );
    const prodEnv = env('prod', [{ uid: '431b4c8b', name: 'TOKEN', value: 'prod', type: 'default' }], 'e-prod');
    mockEnvs.mockReturnValue([stagingEnv, prodEnv]);

    const rule = makeHeaderRule({ uid: 'r1', path: 'rules/my-coll-abcd/r1' });

    mockActiveEnvId.mockReturnValue('e-staging');
    const [first] = resolveRulesForCompile([rule]) as HeaderRule[];
    expect(first.action.requestHeaders?.[0].value).toBe('Bearer staging');

    mockActiveEnvId.mockReturnValue('e-prod');
    const [second] = resolveRulesForCompile([rule]) as HeaderRule[];
    expect(second.action.requestHeaders?.[0].value).toBe('Bearer prod');
  });

  it('resolves variables in rule conditions too', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: 'cb3b2211', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });

    const rule = makeHeaderRule({
      uid: 'r1',
      path: 'rules/my-coll-abcd/r1',
      conditions: [{ uid: 'tcd00063', type: 'request-domains', values: ['{{HOST}}'] }],
    });

    const [resolved] = resolveRulesForCompile([rule]);

    expect(resolved.conditions[0].values).toEqual(['api.openheaders.io']);
  });

  it('caches the resolved snapshot for consumers like request-tracker', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: '39ce96b2', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    const rule = makeHeaderRule({
      uid: 'r1',
      path: 'rules/my-coll-abcd/r1',
      conditions: [{ uid: 'tcd00064', type: 'request-domains', values: ['{{HOST}}'] }],
    });
    mockStoreRules.mockReturnValue([rule]);

    expect(getResolvedRules()).toEqual([]);

    resolveRulesForCompile([rule]);

    const snapshot = getResolvedRules();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].conditions[0].values).toEqual(['api.openheaders.io']);
  });

  it('does not overwrite the snapshot when compiling a subset', () => {
    mockWsVars.mockReturnValue({
      schemaVersion: 5,
      version: 1,
      variables: [{ uid: 'd9e946c8', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    const r1 = makeHeaderRule({
      uid: 'r1',
      path: 'rules/my-coll-abcd/r1',
      conditions: [{ uid: 'tcd00065', type: 'request-domains', values: ['{{HOST}}'] }],
    });
    const r2 = makeHeaderRule({
      uid: 'r2',
      path: 'rules/my-coll-abcd/r2',
      conditions: [{ uid: 'tcd00066', type: 'request-domains', values: ['other.openheaders.io'] }],
    });
    mockStoreRules.mockReturnValue([r1, r2]);

    // Full compile populates the snapshot.
    resolveRulesForCompile([r1, r2]);
    expect(getResolvedRules()).toHaveLength(2);

    // Test-run scope compiles only r1 — snapshot must stay at 2.
    resolveRulesForCompile([r1]);
    expect(getResolvedRules()).toHaveLength(2);
  });

  describe('resolution error diagnostics', () => {
    it('records per-rule errors when a reference is unresolved', () => {
      const rule = makeHeaderRule({ uid: 'r1', path: 'rules/test' });
      mockStoreRules.mockReturnValue([rule]);
      resolveRulesForCompile([rule]);
      const errors = getLastResolutionErrors();
      expect(errors.has('r1')).toBe(true);
      expect(errors.get('r1')?.[0].reference).toBe('TOKEN');
    });

    it('leaves the per-rule map empty when every reference resolves', () => {
      mockWsVars.mockReturnValue({
        schemaVersion: 5,
        version: 1,
        variables: [{ uid: '23ceaffa', name: 'TOKEN', value: 'x', type: 'default' }],
      });
      const rule = makeHeaderRule({ uid: 'r1', path: 'rules/test' });
      mockStoreRules.mockReturnValue([rule]);
      resolveRulesForCompile([rule]);
      expect(getLastResolutionErrors().size).toBe(0);
    });

    it('getLastAggregatedResolutionErrors dedupes references across rules', () => {
      const r1 = makeHeaderRule({ uid: 'r1', path: 'rules/a' });
      const r2 = makeHeaderRule({ uid: 'r2', path: 'rules/b' });
      mockStoreRules.mockReturnValue([r1, r2]);
      resolveRulesForCompile([r1, r2]);
      const agg = getLastAggregatedResolutionErrors();
      expect(agg.map((e) => e.reference)).toEqual(['TOKEN']);
    });

    it('getLastAggregatedResolutionErrors filters out reserved-namespace references', () => {
      const rule = makeHeaderRule({
        uid: 'r1',
        path: 'rules/test',
        action: {
          requestHeaders: [
            { uid: 'thm00106', operation: 'override', headerName: 'X-Ts', value: '{{dynamic.timestamp}}' },
          ],
          responseHeaders: [],
        },
      });
      mockStoreRules.mockReturnValue([rule]);
      resolveRulesForCompile([rule]);
      const agg = getLastAggregatedResolutionErrors();
      expect(agg.map((e) => e.reference)).not.toContain('dynamic.timestamp');
    });

    it('subset compile does NOT overwrite persisted errors', () => {
      const r1 = makeHeaderRule({ uid: 'r1', path: 'rules/a' });
      const r2 = makeHeaderRule({ uid: 'r2', path: 'rules/b' });
      mockStoreRules.mockReturnValue([r1, r2]);
      resolveRulesForCompile([r1, r2]);
      expect(getLastResolutionErrors().size).toBe(2);
      // Subset compile — snapshot must NOT be replaced with the partial view.
      resolveRulesForCompile([r1]);
      expect(getLastResolutionErrors().size).toBe(2);
    });
  });

  // ── {{live.X}} resolution gated by workflow effectiveness (LF3) ────
  describe('live-variable resolution — backing workflow effectiveness (LF3)', () => {
    function liveVar(overrides: Partial<LiveVariable> = {}): LiveVariable {
      return {
        schemaVersion: 5,
        uid: 'livvar01',
        path: 'live-variables/lv-livvar01',
        name: 'LIVETOKEN',
        workflowUid: 'wflowAAA',
        stepId: 'fetch',
        captureName: 'v',
        enabled: true,
        published: true,
        ...overrides,
      };
    }

    function liveWorkflow(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
      return {
        schemaVersion: 5,
        uid: 'wflowAAA',
        path: 'live-workflows/wf-wflowAAA',
        name: 'WF',
        enabled: true,
        published: true,
        refresh: { kind: 'interval', seconds: 300 },
        steps: [
          {
            uid: 'stpfetch',
            id: 'fetch',
            requestUid: 'reqfetch1',
            captures: [{ uid: 'capvxxxx', name: 'v', extractor: { kind: 'whole-body' } }],
          },
        ],
        ...overrides,
      };
    }

    function cachedRun(): WorkflowRunCache {
      return {
        workflowUid: 'wflowAAA',
        environmentId: null,
        stepCaptures: { fetch: { v: 'cached-token' } },
        stepResponseBytes: { fetch: 10 },
        extractedAt: 1_700_000_000_000,
        expiresAt: null,
        consecutiveFailures: 0,
        lastExtractorOk: true,
        circuit: initialCircuitSnapshot(),
      };
    }

    function liveRule(): HeaderRule {
      return makeHeaderRule({
        uid: 'r1',
        path: 'rules/my-coll-abcd/r1',
        action: {
          requestHeaders: [
            { uid: 'thm00105', operation: 'override', headerName: 'Authorization', value: 'Bearer {{live.LIVETOKEN}}' },
          ],
          responseHeaders: [],
        },
      });
    }

    it('resolves {{live.X}} when the backing workflow is effective', async () => {
      mockLiveVars.mockReturnValue([liveVar()]);
      mockLiveWorkflows.mockReturnValue([liveWorkflow()]);
      mockListCaches.mockResolvedValue([cachedRun()]);
      await hydrateLiveCacheMirror();

      const [resolved] = resolveRulesForCompile([liveRule()]) as HeaderRule[];
      expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer cached-token');
    });

    it('does not feed a cached value when the backing workflow is disabled', async () => {
      mockLiveVars.mockReturnValue([liveVar()]);
      mockLiveWorkflows.mockReturnValue([liveWorkflow({ enabled: false })]);
      mockListCaches.mockResolvedValue([cachedRun()]);
      await hydrateLiveCacheMirror();

      resolveRulesForCompile([liveRule()]);
      // LV skipped → `{{live.LIVETOKEN}}` unresolved → the rule is blocked.
      expect(getLastResolutionErrors().get('r1')?.length ?? 0).toBeGreaterThan(0);
    });

    it('does not feed a cached value when the backing workflow is an unpublished draft', async () => {
      mockLiveVars.mockReturnValue([liveVar()]);
      mockLiveWorkflows.mockReturnValue([liveWorkflow({ published: false })]);
      mockListCaches.mockResolvedValue([cachedRun()]);
      await hydrateLiveCacheMirror();

      resolveRulesForCompile([liveRule()]);
      expect(getLastResolutionErrors().get('r1')?.length ?? 0).toBeGreaterThan(0);
    });

    it('does not feed a cached value when the backing workflow no longer exists', async () => {
      mockLiveVars.mockReturnValue([liveVar()]);
      mockLiveWorkflows.mockReturnValue([]);
      mockListCaches.mockResolvedValue([cachedRun()]);
      await hydrateLiveCacheMirror();

      resolveRulesForCompile([liveRule()]);
      expect(getLastResolutionErrors().get('r1')?.length ?? 0).toBeGreaterThan(0);
    });

    it('still serves a manual override when the backing workflow is disabled', async () => {
      // An override is a user-set value independent of workflow execution —
      // disabling the workflow stops the cache feed, not the override.
      mockLiveVars.mockReturnValue([liveVar({ manualOverride: { value: 'override-token' } })]);
      mockLiveWorkflows.mockReturnValue([liveWorkflow({ enabled: false })]);
      mockListCaches.mockResolvedValue([cachedRun()]);
      await hydrateLiveCacheMirror();

      const [resolved] = resolveRulesForCompile([liveRule()]) as HeaderRule[];
      expect(resolved.action.requestHeaders?.[0].value).toBe('Bearer override-token');
    });
  });
});
