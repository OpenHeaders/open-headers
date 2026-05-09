import type { DiffEntry, DiffResult, WorkspaceExport } from '@openheaders/core/workspace-export';
import { describe, expect, it } from 'vitest';
import {
  VAULT_SINGLETON_UID,
  WORKSPACE_VARS_SINGLETON_UID,
  diffResultToImportBundle,
} from '@/workbench/components/workspace-export/preview/diff-to-import-bundle';

function entry<T extends { uid: string }>(entity: T, matchedTarget?: T): DiffEntry<T> {
  return {
    entity,
    state: matchedTarget ? 'collision-uid' : 'no-collision',
    matchedTarget,
    defaultStrategy: matchedTarget ? 'update' : 'new-uid',
    allowedStrategies: matchedTarget ? ['update', 'skip', 'new-uid'] : ['new-uid', 'skip'],
  };
}

const emptyDiff: DiffResult = {
  collections: [],
  folders: [],
  rules: [],
  requests: [],
  templates: [],
  environments: [],
  liveWorkflows: [],
  liveVariables: [],
  workspaceVars: { state: 'no-collision', defaultStrategy: 'skip', allowedStrategies: ['skip'], targetHasContent: false },
  vault: { state: 'no-collision', defaultStrategy: 'skip', allowedStrategies: ['skip'], targetHasContent: false },
};

describe('diffResultToImportBundle', () => {
  it('returns an empty bundle + workspace for an empty diff', () => {
    const { bundle, workspace } = diffResultToImportBundle(emptyDiff);
    expect(bundle.entities).toEqual([]);
    expect(workspace.findByPathOrUid({ uid: 'x', entityType: 'rule', path: '', entity: null })).toBeUndefined();
  });

  it('projects each non-collision entity as a pure-add bundle entry', () => {
    const ruleA = { uid: 'rule-a', name: 'Auth', path: 'rules/openheaders.io/auth.yaml' };
    const reqA = { uid: 'req-a', name: 'Login', path: 'requests/login.yaml' };
    const { bundle, workspace } = diffResultToImportBundle({
      ...emptyDiff,
      rules: [entry(ruleA)] as DiffEntry<unknown>[] as DiffResult['rules'],
      requests: [entry(reqA)] as DiffEntry<unknown>[] as DiffResult['requests'],
    });
    expect(bundle.entities).toHaveLength(2);
    expect(bundle.entities[0]).toEqual({
      uid: 'rule-a',
      entityType: 'rule',
      path: 'rules/openheaders.io/auth.yaml',
      entity: ruleA,
    });
    expect(bundle.entities[1]).toEqual({
      uid: 'req-a',
      entityType: 'request',
      path: 'requests/login.yaml',
      entity: reqA,
    });
    expect(workspace.findByPathOrUid(bundle.entities[0])).toBeUndefined();
    expect(workspace.findByPathOrUid(bundle.entities[1])).toBeUndefined();
  });

  it('exposes matchedTarget for collisions through workspace.findByPathOrUid', () => {
    const incoming = { uid: 'env-a', name: 'Staging', path: 'env.yaml' };
    const local = { uid: 'env-a', name: 'Staging (local)', path: 'env.yaml' };
    const { bundle, workspace } = diffResultToImportBundle({
      ...emptyDiff,
      environments: [entry(incoming, local)] as DiffEntry<unknown>[] as DiffResult['environments'],
    });
    expect(workspace.findByPathOrUid(bundle.entities[0])).toBe(local);
  });

  it('preserves bucket order: collections, folders, rules, requests, templates, environments, workflows, variables', () => {
    const make = (kind: string, uid: string) => ({ uid, name: `${kind}-${uid}` });
    const { bundle } = diffResultToImportBundle({
      ...emptyDiff,
      collections: [entry(make('coll', '1'))] as DiffEntry<unknown>[] as DiffResult['collections'],
      folders: [entry(make('fold', '1'))] as DiffEntry<unknown>[] as DiffResult['folders'],
      rules: [entry(make('rule', '1'))] as DiffEntry<unknown>[] as DiffResult['rules'],
      requests: [entry(make('req', '1'))] as DiffEntry<unknown>[] as DiffResult['requests'],
      templates: [entry(make('tpl', '1'))] as DiffEntry<unknown>[] as DiffResult['templates'],
      environments: [entry(make('env', '1'))] as DiffEntry<unknown>[] as DiffResult['environments'],
      liveWorkflows: [entry(make('lw', '1'))] as DiffEntry<unknown>[] as DiffResult['liveWorkflows'],
      liveVariables: [entry(make('lv', '1'))] as DiffEntry<unknown>[] as DiffResult['liveVariables'],
    });
    expect(bundle.entities.map((e) => e.entityType)).toEqual([
      'collection',
      'folder',
      'rule',
      'request',
      'template',
      'environment',
      'liveWorkflow',
      'liveVariable',
    ]);
  });

  it("falls back to entity.name then entity.uid when path is absent", () => {
    const noPath = { uid: 'rule-x', name: 'Header rule' };
    const noNameOrPath = { uid: 'rule-y' };
    const { bundle } = diffResultToImportBundle({
      ...emptyDiff,
      rules: [
        entry(noPath),
        entry(noNameOrPath),
      ] as DiffEntry<unknown>[] as DiffResult['rules'],
    });
    expect(bundle.entities[0].path).toBe('Header rule');
    expect(bundle.entities[1].path).toBe('rule-y');
  });

  it('omits singletons when no envelope is supplied (bucket-only mode)', () => {
    const { bundle } = diffResultToImportBundle({
      ...emptyDiff,
      workspaceVars: {
        state: 'collision-uid',
        defaultStrategy: 'merge-vars',
        allowedStrategies: ['merge-vars'],
        targetHasContent: true,
      },
      vault: {
        state: 'collision-uid',
        defaultStrategy: 'merge-vars',
        allowedStrategies: ['merge-vars'],
        targetHasContent: true,
      },
    });
    expect(bundle.entities).toEqual([]);
  });

  it('projects workspaceVars singleton when envelope carries it (collision)', () => {
    const incomingVars = { variables: [{ key: 'API_BASE', value: 'https://api.openheaders.io' }] };
    const targetVars = { variables: [{ key: 'API_BASE', value: 'https://api.local' }] };
    const { bundle, workspace } = diffResultToImportBundle(
      {
        ...emptyDiff,
        workspaceVars: {
          state: 'collision-uid',
          defaultStrategy: 'merge-vars',
          allowedStrategies: ['merge-vars'],
          targetHasContent: true,
          target: targetVars,
        } as unknown as DiffResult['workspaceVars'],
      },
      { entities: { workspaceVars: incomingVars } } as unknown as WorkspaceExport,
    );
    expect(bundle.entities).toHaveLength(1);
    const f = bundle.entities[0];
    expect(f.uid).toBe(WORKSPACE_VARS_SINGLETON_UID);
    expect(f.entityType).toBe('workspaceVars');
    expect(f.path).toBe('workspaceVars');
    expect(f.entity).toBe(incomingVars);
    expect(workspace.findByPathOrUid(f)).toBe(targetVars);
  });

  it('projects vault singleton when envelope carries it', () => {
    const incomingVault = { secrets: [{ uid: 's1', kind: 'string', name: 'TOKEN' }] };
    const { bundle, workspace } = diffResultToImportBundle(
      {
        ...emptyDiff,
        vault: {
          state: 'no-collision',
          defaultStrategy: 'skip',
          allowedStrategies: ['skip'],
          targetHasContent: false,
        },
      },
      { entities: { vault: incomingVault, workspaceVars: { variables: [] } } } as unknown as WorkspaceExport,
    );
    expect(bundle.entities).toHaveLength(2);
    const wsVars = bundle.entities[0];
    const vault = bundle.entities[1];
    expect(wsVars.uid).toBe(WORKSPACE_VARS_SINGLETON_UID);
    expect(vault.uid).toBe(VAULT_SINGLETON_UID);
    expect(vault.entity).toBe(incomingVault);
    expect(workspace.findByPathOrUid(vault)).toBeUndefined();
  });

  it('skips workspaceVars when both sides empty (no diff to surface)', () => {
    const { bundle } = diffResultToImportBundle(
      emptyDiff,
      { entities: { workspaceVars: undefined, vault: undefined } } as unknown as WorkspaceExport,
    );
    expect(bundle.entities).toEqual([]);
  });

  it('skips singletons that are present locally but missing in incoming (no remove projection in v1)', () => {
    const targetVault = { secrets: [{ uid: 's1', kind: 'string', name: 'TOKEN' }] };
    const { bundle } = diffResultToImportBundle(
      {
        ...emptyDiff,
        vault: {
          state: 'collision-uid',
          defaultStrategy: 'merge-vars',
          allowedStrategies: ['merge-vars'],
          targetHasContent: true,
          target: targetVault,
        } as unknown as DiffResult['vault'],
      },
      { entities: { workspaceVars: undefined, vault: undefined } } as unknown as WorkspaceExport,
    );
    expect(bundle.entities).toEqual([]);
  });
});
