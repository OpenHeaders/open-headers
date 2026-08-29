/**
 * Coverage for `workspace/export-gatherer.ts`'s selection-scope
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

import type {
  Collection,
  Environment,
  Folder,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  TreeOrderRecord,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getWorkspace: vi.fn((id: string) => (id === 'ws-test' ? { id: 'ws-test', name: 'Test WS' } : null)),
}));

vi.mock('@openheaders/oracle/storage', async () => {
  const actual = await vi.importActual<typeof import('@openheaders/oracle/storage')>('@openheaders/oracle/storage');
  return {
    ...actual,
    hostStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      getValidated: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      getMany: vi.fn(async (specs: Record<string, { key: string }>) => {
        const out: Record<string, unknown> = {};
        for (const [name, spec] of Object.entries(specs)) out[name] = blobs.get(spec.key);
        return out;
      }),
    },
  };
});

let gatherer: typeof import('../../src/workspace/export-gatherer');

beforeEach(async () => {
  blobs.clear();
  vi.resetModules();
  gatherer = await import('../../src/workspace/export-gatherer');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────

function seedWorkspace(opts: {
  rules?: Rule[];
  folders?: Folder[];
  treeOrder?: TreeOrderRecord;
  requests?: Request[];
  environments?: Environment[];
  workspaceVars?: WorkspaceVariables;
  liveWorkflows?: LiveWorkflow[];
  liveVariables?: LiveVariable[];
  collections?: Collection[];
}): void {
  blobs.set('oh.ws.ws-test.rules', opts.rules ?? []);
  blobs.set('oh.ws.ws-test.collections', opts.collections ?? []);
  blobs.set('oh.ws.ws-test.folders', opts.folders ?? []);
  if (opts.treeOrder) blobs.set('oh.ws.ws-test.treeOrder', opts.treeOrder);
  blobs.set('oh.ws.ws-test.requests', opts.requests ?? []);
  blobs.set('oh.ws.ws-test.requestCollections', []);
  blobs.set('oh.ws.ws-test.requestFolders', []);
  blobs.set('oh.ws.ws-test.templates', []);
  blobs.set('oh.ws.ws-test.templateCollections', []);
  blobs.set('oh.ws.ws-test.templateFolders', []);
  blobs.set('oh.ws.ws-test.environments', opts.environments ?? []);
  blobs.set('oh.ws.ws-test.workspaceVars', opts.workspaceVars ?? { schemaVersion: 5, variables: [] });
  blobs.set('oh.ws.ws-test.liveWorkflows', opts.liveWorkflows ?? []);
  blobs.set('oh.ws.ws-test.liveVariables', opts.liveVariables ?? []);
}

function makeHeaderRule(overrides: Partial<Rule> = {}): Rule {
  return {
    schemaVersion: 5,
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
  } as Rule;
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
    const env: Environment = {
      schemaVersion: 5,
      version: 1,
      uid: 'env00001',
      name: 'Prod',
      variables: [{ uid: '970ccc1a', name: 'token', value: 'abc', type: 'default' }],
    } as Environment;
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
    } as Partial<Rule>);
    seedWorkspace({
      rules: [rule],
      workspaceVars: {
        schemaVersion: 5,
        variables: [
          { uid: 'd96baa6e', name: 'region', value: 'us-east', type: 'default' },
          { uid: 'e026f217', name: 'unrelated', value: 'leak-me', type: 'default' },
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
    } as Partial<Rule>);
    const workflow = {
      schemaVersion: 5,
      version: 1,
      uid: 'wfl00001',
      path: 'live/wfl00001',
      name: 'Trace WF',
      enabled: true,
      steps: [],
    } as unknown as LiveWorkflow;
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
    } as unknown as LiveVariable;
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
    } as Partial<Rule>);
    const env: Environment = {
      schemaVersion: 5,
      version: 1,
      uid: 'env00001',
      name: 'Prod',
      variables: [{ uid: 'ebc450f3', name: 'token', value: 'abc', type: 'default' }],
    } as Environment;
    seedWorkspace({
      rules: [rule],
      environments: [env],
      workspaceVars: {
        schemaVersion: 5,
        variables: [{ uid: '5bbe29b6', name: 'region', value: 'us-east', type: 'default' }],
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

  it('gathers the vault into the input regardless of scope (builder gates inclusion)', async () => {
    seedWorkspace({ rules: [makeHeaderRule()] });
    blobs.set('oh.ws.ws-test.vault', {
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'api-token', value: 's3cret' }],
    });

    const res = await gatherer.gatherWorkspaceExport('ws-test', { kind: 'workspace' }, OPTS);

    expect(res!.input.entities.vault?.secrets.map((s) => s.name)).toEqual(['api-token']);
  });

  it('workspace scope ships full workspaceVars unfiltered', async () => {
    const rule = makeHeaderRule();
    seedWorkspace({
      rules: [rule],
      workspaceVars: {
        schemaVersion: 5,
        variables: [
          { uid: 'ab9da5f0', name: 'a', value: '1', type: 'default' },
          { uid: 'b6bad7d1', name: 'b', value: '2', type: 'default' },
        ],
      },
    });

    const res = await gatherer.gatherWorkspaceExport('ws-test', { kind: 'workspace' }, OPTS);

    expect(res!.input.entities.workspaceVars.variables.map((v) => v.name)).toEqual(['a', 'b']);
  });
});

describe('gatherWorkspaceExport — child order', () => {
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'rules/api-col00001',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const folder: Folder = { schemaVersion: 5, uid: 'fld00001', path: 'rules/api-col00001/auth-fld00001', name: 'Auth' };
  const ruleA = makeHeaderRule({ uid: 'rula0001', path: 'rules/api-col00001/a-rula0001', name: 'a' });
  const ruleB = makeHeaderRule({ uid: 'rulb0001', path: 'rules/api-col00001/b-rulb0001', name: 'b' });
  const treeOrder: TreeOrderRecord = {
    schemaVersion: 5,
    containers: { 'collection:col00001': { children: ['rulb0001', 'fld00001', 'rula0001'] } },
  };

  it('stamps order: on every shipped container from the tree-order record — the merged, interleaved sequence', async () => {
    seedWorkspace({ collections: [collection], folders: [folder], rules: [ruleA, ruleB], treeOrder });
    const res = await gatherer.gatherWorkspaceExport('ws-test', { kind: 'workspace' }, OPTS);
    expect(res!.input.entities.collections[0].order).toEqual(['b-rulb0001', 'auth-fld00001', 'a-rula0001']);
    expect('order' in res!.input.entities.folders[0]).toBe(false);
  });

  it('a selection names only the children that ship', async () => {
    seedWorkspace({ collections: [collection], folders: [folder], rules: [ruleA, ruleB], treeOrder });
    const res = await gatherer.gatherWorkspaceExport(
      'ws-test',
      { kind: 'selection', selection: { collections: ['col00001'], rules: ['rulb0001'] }, strictLiteral: true },
      OPTS,
    );
    expect(res!.input.entities.collections[0].order).toEqual(['b-rulb0001']);
  });

  it('a workspace without a record exports its containers without order:', async () => {
    seedWorkspace({ collections: [collection], folders: [folder], rules: [ruleA, ruleB] });
    const res = await gatherer.gatherWorkspaceExport('ws-test', { kind: 'workspace' }, OPTS);
    expect('order' in res!.input.entities.collections[0]).toBe(false);
  });
});
