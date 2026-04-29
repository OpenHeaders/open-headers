/**
 * Reference-integrity + variable-reference scan coverage for
 * `walkMissingDeps`. Gates 7 + 8 of the import validation pipeline.
 */

import { describe, expect, it } from 'vitest';
import type {
  Collection,
  Environment,
  HeaderRule,
  LiveVariable,
  LiveWorkflow,
  Request,
  Vault,
  WorkspaceVariables,
} from '../../src/types/v5/index';
import { buildWorkspaceExport, type TargetWorkspaceState, walkMissingDeps } from '../../src/workspace-export/index';

const FIXED_TIMESTAMP = '2026-04-27T18:30:00.000Z';

function makeWorkspaceVars(): WorkspaceVariables {
  return { schemaVersion: 5, variables: [] };
}

function baseInput(): Parameters<typeof buildWorkspaceExport>[0] {
  return {
    exportedAt: FIXED_TIMESTAMP,
    exportId: 'e8a1b2c3',
    source: { app: 'extension', appVersion: '5.0.4', platform: 'chrome' },
    scope: 'workspace',
    workspace: { uid: 'a1b2c3d4', name: 'Project' },
    entities: {
      collections: [],
      folders: [],
      rules: [],
      requests: [],
      templates: [],
      environments: [],
      workspaceVars: makeWorkspaceVars(),
      liveWorkflows: [],
      liveVariables: [],
    },
  };
}

function emptyTarget(): TargetWorkspaceState {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    liveWorkflows: [],
    liveVariables: [],
  };
}

function makeCollection(
  uid: string,
  name: string,
  path: string,
  vars: { name: string; value: string }[] = [],
): Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
    variables: vars.map((v) => ({ schemaVersion: 5, name: v.name, value: v.value, type: 'default' as const })),
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

function makeEnv(uid: string, name: string, vars: string[] = []): Environment {
  return {
    schemaVersion: 5,
    uid,
    path: `environments/${name}-${uid}`,
    name,
    variables: vars.map((n) => ({ schemaVersion: 5, name: n, value: 'x', type: 'default' as const })),
  };
}

function makeRuleWithRef(
  uid: string,
  name: string,
  ref: { collectionId?: string; folderId?: string; valueWithRefs?: string },
): HeaderRule {
  const r: HeaderRule = {
    schemaVersion: 5,
    uid,
    path: `rules/auth-col/${name}-${uid}`,
    name,
    type: 'header',
    enabled: true,
    conditions: ref.valueWithRefs ? [{ type: 'request-domains' as const, values: [ref.valueWithRefs] }] : [],
    action: { requestHeaders: [], responseHeaders: [] },
  };
  if (ref.collectionId) (r as HeaderRule & { collectionId: string }).collectionId = ref.collectionId;
  if (ref.folderId) (r as HeaderRule & { folderId: string }).folderId = ref.folderId;
  return r;
}

function makeWorkflow(uid: string, name: string, requestUids: string[]): LiveWorkflow {
  return {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `live/${name}-${uid}`,
    name,
    steps: requestUids.map((rid, i) => ({
      schemaVersion: 5,
      id: `step-${i}` as `step-${string}`,
      requestUid: rid,
      captures: [],
    })),
    refresh: { kind: 'manual' as const },
    enabled: true,
  };
}

function makeLiveVar(uid: string, name: string, workflowUid: string): LiveVariable {
  return {
    schemaVersion: 5,
    version: 1,
    uid,
    path: `live/${name}-${uid}`,
    name,
    workflowUid,
    stepId: 'step-0' as `step-${string}`,
    captureName: 'value' as `${string}`,
    enabled: true,
  };
}

// ── Container-id integrity ─────────────────────────────────────────

describe('walkMissingDeps — container ids', () => {
  it('flags Rule.collectionId that does not resolve in export or target', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { collectionId: 'colMISSING' })];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'collection' && d.name === 'colMISSING')).toBeDefined();
  });

  it('does NOT flag when collectionId resolves in target', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { collectionId: 'col00001' })];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.collections = [makeCollection('col00001', 'API', 'rules/api-col00001')];
    expect(walkMissingDeps(exp, target).filter((d) => d.type === 'collection')).toHaveLength(0);
  });

  it('does NOT flag when collectionId resolves inside the export itself', () => {
    const input = baseInput();
    input.entities.collections = [makeCollection('col00001', 'API', 'rules/api-col00001')];
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { collectionId: 'col00001' })];
    const exp = buildWorkspaceExport(input);
    expect(walkMissingDeps(exp, emptyTarget()).filter((d) => d.type === 'collection')).toHaveLength(0);
  });
});

// ── Workflow-step + LiveVariable integrity ─────────────────────────

describe('walkMissingDeps — live entities', () => {
  it('flags WorkflowStep.requestUid that does not resolve', () => {
    const input = baseInput();
    input.entities.liveWorkflows = [makeWorkflow('wf000001', 'TokenWF', ['reqMISSING'])];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'request')).toBeDefined();
  });

  it('flags LiveVariable.workflowUid that does not resolve', () => {
    const input = baseInput();
    input.entities.liveVariables = [makeLiveVar('lv000001', 'TOKEN', 'wfMISSING')];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'workflow')).toBeDefined();
  });

  it('does NOT flag when workflowUid resolves inside the export', () => {
    const input = baseInput();
    const wf = makeWorkflow('wf000001', 'TokenWF', []);
    // empty steps would fail schema; give it one step pointing at a request inside the export
    const req: Request = {
      schemaVersion: 5,
      uid: 'req00001',
      path: 'requests/api-col/x-req00001',
      name: 'x',
      method: 'GET',
      url: 'https://openheaders.io',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    };
    input.entities.requests = [req];
    wf.steps = [{ id: 'step-0' as `step-${string}`, requestUid: 'req00001', captures: [] }];
    input.entities.liveWorkflows = [wf];
    input.entities.liveVariables = [makeLiveVar('lv000001', 'TOKEN', 'wf000001')];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.filter((d) => d.type === 'workflow')).toHaveLength(0);
    expect(deps.filter((d) => d.type === 'request')).toHaveLength(0);
  });
});

// ── Variable-reference scan ────────────────────────────────────────

describe('walkMissingDeps — variable references', () => {
  it('flags missing {{env.X}} reference', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: 'https://{{env.HOST}}/api' })];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'env' && d.name === 'HOST')).toBeDefined();
  });

  it('does NOT flag {{env.X}} when an export environment defines it', () => {
    const input = baseInput();
    input.entities.environments = [makeEnv('env00001', 'staging', ['HOST'])];
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: 'https://{{env.HOST}}/api' })];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.filter((d) => d.type === 'env')).toHaveLength(0);
  });

  it('does NOT flag {{env.X}} when target defines it (cross-env satisfies)', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: 'https://{{env.HOST}}/api' })];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    target.environments = [makeEnv('env00099', 'prod', ['HOST'])];
    expect(walkMissingDeps(exp, target).filter((d) => d.type === 'env')).toHaveLength(0);
  });

  it('flags missing {{vault.X}} as `secret` type', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: '{{vault.API_KEY}}' })];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'secret' && d.name === 'API_KEY')).toBeDefined();
  });

  it('flags missing {{live.X}} as `workflow` type', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: '{{live.TOKEN}}' })];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'workflow' && d.name === 'TOKEN')).toBeDefined();
  });

  it('flags missing {{workspace.X}} and {{collection.X}}', () => {
    const input = baseInput();
    input.entities.rules = [
      makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: '{{workspace.WS}}-{{collection.CV}}' }),
    ];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    expect(deps.find((d) => d.type === 'workspace-var' && d.name === 'WS')).toBeDefined();
    expect(deps.find((d) => d.type === 'workspace-var' && d.name === 'CV')).toBeDefined();
  });

  it('aggregates `referencedBy` when multiple entities reference the same missing dep', () => {
    const input = baseInput();
    input.entities.rules = [
      makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: '{{env.HOST}}' }),
      makeRuleWithRef('rul00002', 'Other', { valueWithRefs: '{{env.HOST}}' }),
    ];
    const exp = buildWorkspaceExport(input);
    const deps = walkMissingDeps(exp, emptyTarget());
    const dep = deps.find((d) => d.type === 'env' && d.name === 'HOST');
    expect(dep?.referencedBy).toEqual(['rules:rul00001', 'rules:rul00002']);
  });

  it('uses target vault to resolve {{vault.X}}', () => {
    const input = baseInput();
    input.entities.rules = [makeRuleWithRef('rul00001', 'Auth', { valueWithRefs: '{{vault.API_KEY}}' })];
    const exp = buildWorkspaceExport(input);
    const target = emptyTarget();
    const vault: Vault = {
      schemaVersion: 5,
      secrets: [{ kind: 'string', name: 'API_KEY', value: 'shh' }],
    };
    target.vault = vault;
    const deps = walkMissingDeps(exp, target);
    expect(deps.filter((d) => d.type === 'secret')).toHaveLength(0);
  });
});
