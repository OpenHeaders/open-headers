/**
 * Coverage for `workspace-export-gatherer.ts`'s selection-scope
 * dependency expansion (design §2.3 + §12 q1).
 *
 * Asserts:
 *   • Selecting a rule that references {{env.X}} pulls in the env.
 *   • Selecting a rule that references {{workspace.X}} filters the
 *     workspace-vars blob to only the referenced names.
 *   • Selecting a rule that references {{live.X}} pulls in the
 *     live-variable AND its workflow (transitive).
 *   • Strict-literal mode bypasses both transitive expansion AND the
 *     workspace-vars filter is empty.
 */

import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getWorkspace: vi.fn((id: string) => (id === 'ws-test' ? { id: 'ws-test', name: 'Test WS' } : null)),
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...actual,
    extensionStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      getMany: vi.fn(async (specs: Record<string, { key: string }>) => {
        const out: Record<string, unknown> = {};
        for (const [name, spec] of Object.entries(specs)) out[name] = blobs.get(spec.key);
        return out;
      }),
    },
  };
});

let gatherer: typeof import('@/background/modules/workspace-export-gatherer');

beforeEach(async () => {
  blobs.clear();
  vi.resetModules();
  gatherer = await import('@/background/modules/workspace-export-gatherer');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────

function seedWorkspace(opts: {
  rules?: V5.Rule[];
  requests?: V5.Request[];
  environments?: V5.Environment[];
  workspaceVars?: V5.WorkspaceVariables;
  liveWorkflows?: V5.LiveWorkflow[];
  liveVariables?: V5.LiveVariable[];
  collections?: V5.Collection[];
}): void {
  blobs.set('oh.ws.ws-test.rules', opts.rules ?? []);
  blobs.set('oh.ws.ws-test.collections', opts.collections ?? []);
  blobs.set('oh.ws.ws-test.folders', []);
  blobs.set('oh.ws.ws-test.requests', opts.requests ?? []);
  blobs.set('oh.ws.ws-test.requestCollections', []);
  blobs.set('oh.ws.ws-test.requestFolders', []);
  blobs.set('oh.ws.ws-test.templates', []);
  blobs.set('oh.ws.ws-test.templateCollections', []);
  blobs.set('oh.ws.ws-test.templateFolders', []);
  blobs.set('oh.ws.ws-test.environments', opts.environments ?? []);
  blobs.set('oh.ws.ws-test.workspaceVars', opts.workspaceVars ?? { schemaVersion: 5, version: 1, variables: [] });
  blobs.set('oh.ws.ws-test.liveWorkflows', opts.liveWorkflows ?? []);
  blobs.set('oh.ws.ws-test.liveVariables', opts.liveVariables ?? []);
}

function makeHeaderRule(overrides: Partial<V5.Rule> = {}): V5.Rule {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'rul00001',
    path: 'rules/c1/auth-rul00001',
    name: 'Auth',
    type: 'header',
    enabled: true,
    conditions: [{ kind: 'url-pattern', pattern: 'https://api.openheaders.io/*' }],
    action: {
      requestHeaders: [{ name: 'Authorization', value: 'Bearer {{env.token}}', operation: 'set' }],
      responseHeaders: [],
    },
    ...overrides,
  } as V5.Rule;
}

const OPTS = {
  app: 'extension' as const,
  appVersion: '5.0.4',
  platform: 'chrome' as const,
};

// ── Tests ─────────────────────────────────────────────────────────

describe('gatherWorkspaceExport — selection scope transitive deps', () => {
  it('pulls in an env referenced via {{env.X}} from a selected rule', async () => {
    const rule = makeHeaderRule();
    const env: V5.Environment = {
      schemaVersion: 5,
      version: 1,
      uid: 'env00001',
      name: 'Prod',
      variables: [{ name: 'token', value: 'abc', type: 'default' }],
    } as V5.Environment;
    seedWorkspace({ rules: [rule], environments: [env] });

    const res = await gatherer.gatherWorkspaceExport(
      'ws-test',
      { kind: 'selection', selection: { rules: [rule.uid] } },
      OPTS,
    );

    expect(res).not.toBeNull();
    expect(res!.input.entities.environments.map((e) => e.uid)).toEqual(['env00001']);
  });

  it('filters workspaceVars to only names referenced by selected entities', async () => {
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ name: 'X-Region', value: '{{workspace.region}}', operation: 'set' }],
        responseHeaders: [],
      },
    } as Partial<V5.Rule>);
    seedWorkspace({
      rules: [rule],
      workspaceVars: {
        schemaVersion: 5,
        version: 1,
        variables: [
          { name: 'region', value: 'us-east', type: 'default' },
          { name: 'unrelated', value: 'leak-me', type: 'default' },
        ],
      },
    });

    const res = await gatherer.gatherWorkspaceExport(
      'ws-test',
      { kind: 'selection', selection: { rules: [rule.uid] } },
      OPTS,
    );

    const wsVars = res!.input.entities.workspaceVars;
    expect(wsVars.variables.map((v) => v.name)).toEqual(['region']);
  });

  it('pulls in a live-variable AND its workflow when a rule references {{live.X}}', async () => {
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [{ name: 'X-Trace', value: '{{live.trace_id}}', operation: 'set' }],
        responseHeaders: [],
      },
    } as Partial<V5.Rule>);
    const workflow = {
      schemaVersion: 5,
      version: 1,
      uid: 'wfl00001',
      path: 'live/wfl00001',
      name: 'Trace WF',
      enabled: true,
      steps: [],
    } as unknown as V5.LiveWorkflow;
    const liveVar = {
      schemaVersion: 5,
      version: 1,
      uid: 'liv00001',
      path: 'live/liv00001',
      name: 'trace_id',
      enabled: true,
      workflowUid: workflow.uid,
      stepId: 'step1',
      captureName: 'id',
    } as unknown as V5.LiveVariable;
    seedWorkspace({ rules: [rule], liveWorkflows: [workflow], liveVariables: [liveVar] });

    const res = await gatherer.gatherWorkspaceExport(
      'ws-test',
      { kind: 'selection', selection: { rules: [rule.uid] } },
      OPTS,
    );

    expect(res!.input.entities.liveVariables.map((lv) => lv.uid)).toEqual(['liv00001']);
    expect(res!.input.entities.liveWorkflows.map((wf) => wf.uid)).toEqual(['wfl00001']);
  });

  it('strictLiteral skips transitive deps AND ships empty workspaceVars', async () => {
    const rule = makeHeaderRule({
      action: {
        requestHeaders: [
          { name: 'Authorization', value: 'Bearer {{env.token}}', operation: 'set' },
          { name: 'X-Region', value: '{{workspace.region}}', operation: 'set' },
        ],
        responseHeaders: [],
      },
    } as Partial<V5.Rule>);
    const env: V5.Environment = {
      schemaVersion: 5,
      version: 1,
      uid: 'env00001',
      name: 'Prod',
      variables: [{ name: 'token', value: 'abc', type: 'default' }],
    } as V5.Environment;
    seedWorkspace({
      rules: [rule],
      environments: [env],
      workspaceVars: {
        schemaVersion: 5,
        version: 1,
        variables: [{ name: 'region', value: 'us-east', type: 'default' }],
      },
    });

    const res = await gatherer.gatherWorkspaceExport(
      'ws-test',
      { kind: 'selection', selection: { rules: [rule.uid] }, strictLiteral: true },
      OPTS,
    );

    expect(res!.input.entities.environments).toEqual([]);
    expect(res!.input.entities.workspaceVars.variables).toEqual([]);
  });

  it('workspace scope ships full workspaceVars unfiltered', async () => {
    const rule = makeHeaderRule();
    seedWorkspace({
      rules: [rule],
      workspaceVars: {
        schemaVersion: 5,
        version: 1,
        variables: [
          { name: 'a', value: '1', type: 'default' },
          { name: 'b', value: '2', type: 'default' },
        ],
      },
    });

    const res = await gatherer.gatherWorkspaceExport('ws-test', { kind: 'workspace' }, OPTS);

    expect(res!.input.entities.workspaceVars.variables.map((v) => v.name)).toEqual(['a', 'b']);
  });
});
