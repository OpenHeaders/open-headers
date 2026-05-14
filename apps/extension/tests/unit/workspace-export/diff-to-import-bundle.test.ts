import type { DiffEntry, DiffResult, WorkspaceExport } from '@openheaders/core/workspace-export';
import type { MergeFile } from '@openheaders/ui/shared/merge-editor';
import {
  applyMergeResultsToEnvelope,
  diffResultToImportBundle,
  VAULT_SINGLETON_UID,
  WORKSPACE_VARS_SINGLETON_UID,
} from '@openheaders/ui/workbench/components/workspace-export/preview/diff-to-import-bundle';
import { describe, expect, it, vi } from 'vitest';

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
  workspaceVars: {
    state: 'no-collision',
    defaultStrategy: 'skip',
    allowedStrategies: ['skip'],
    targetHasContent: false,
  },
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

  it('falls back to entity.name then entity.uid when path is absent', () => {
    const noPath = { uid: 'rule-x', name: 'Header rule' };
    const noNameOrPath = { uid: 'rule-y' };
    const { bundle } = diffResultToImportBundle({
      ...emptyDiff,
      rules: [entry(noPath), entry(noNameOrPath)] as DiffEntry<unknown>[] as DiffResult['rules'],
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
    const { bundle } = diffResultToImportBundle(emptyDiff, {
      entities: { workspaceVars: undefined, vault: undefined },
    } as unknown as WorkspaceExport);
    expect(bundle.entities).toEqual([]);
  });

  // Below this point: applyMergeResultsToEnvelope tests live in their own
  // describe block at file-end. This first block keeps the
  // diffResultToImportBundle coverage intact.
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

describe('applyMergeResultsToEnvelope', () => {
  function file(group: string, id: string): MergeFile {
    return {
      id,
      label: id,
      language: 'yaml',
      group,
      kind: 'modify',
      theirs: '',
      mine: '',
      initialResult: '',
    };
  }

  const baseEnvelope = (overrides: Partial<WorkspaceExport['entities']> = {}): WorkspaceExport =>
    ({
      kind: 'workspace-export',
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests: [],
        templates: [],
        environments: [],
        liveWorkflows: [],
        liveVariables: [],
        workspaceVars: { variables: [] },
        ...overrides,
      },
    }) as unknown as WorkspaceExport;

  function diffWith(overrides: Partial<DiffResult> = {}): DiffResult {
    return { ...emptyDiff, ...overrides };
  }

  it('untouched files (no entry in results) leave envelope + strategies unchanged', () => {
    const envelope = baseEnvelope({ rules: [{ uid: 'r1', name: 'X' } as never] });
    const out = applyMergeResultsToEnvelope({
      envelope,
      files: [file('rule', 'r1')],
      results: new Map(),
      diff: diffWith(),
      deserialize: vi.fn(),
    });
    expect(out.envelope.entities).toEqual(envelope.entities);
    expect(out.strategies).toEqual({});
  });

  it('collision + non-empty result splices resolved entity and emits strategy=update', () => {
    const original = { uid: 'r1', name: 'Original' };
    const resolved = { uid: 'r1', name: 'Resolved' };
    const envelope = baseEnvelope({ rules: [original as never] });
    const deserialize = vi.fn().mockReturnValue(resolved);
    const out = applyMergeResultsToEnvelope({
      envelope,
      files: [file('rule', 'r1')],
      results: new Map([['r1', 'yaml-text']]),
      diff: diffWith({
        rules: [
          { entity: original, state: 'collision-uid', defaultStrategy: 'update', allowedStrategies: ['update'] },
        ] as DiffEntry<unknown>[] as DiffResult['rules'],
      }),
      deserialize,
    });
    expect(deserialize).toHaveBeenCalledWith('yaml-text', expect.objectContaining({ id: 'r1', group: 'rule' }));
    expect((out.envelope.entities.rules as unknown as Array<{ uid: string }>)[0]).toBe(resolved);
    expect(out.strategies).toEqual({ rules: { r1: 'update' } });
    // Original envelope was not mutated.
    expect((envelope.entities.rules as unknown as Array<{ uid: string }>)[0]).toBe(original);
  });

  it('non-collision + non-empty result emits strategy=new-uid', () => {
    const original = { uid: 'r1', name: 'New rule' };
    const envelope = baseEnvelope({ rules: [original as never] });
    const out = applyMergeResultsToEnvelope({
      envelope,
      files: [file('rule', 'r1')],
      results: new Map([['r1', 'yaml-text']]),
      diff: diffWith({
        rules: [
          { entity: original, state: 'no-collision', defaultStrategy: 'new-uid', allowedStrategies: ['new-uid'] },
        ] as DiffEntry<unknown>[] as DiffResult['rules'],
      }),
      deserialize: vi.fn().mockReturnValue({ uid: 'r1', name: 'Edited' }),
    });
    expect(out.strategies).toEqual({ rules: { r1: 'new-uid' } });
  });

  it('empty result emits strategy=skip and leaves envelope unchanged', () => {
    const original = { uid: 'r1', name: 'Skip me' };
    const envelope = baseEnvelope({ rules: [original as never] });
    const out = applyMergeResultsToEnvelope({
      envelope,
      files: [file('rule', 'r1')],
      results: new Map([['r1', '   \n  ']]),
      diff: diffWith({
        rules: [
          { entity: original, state: 'collision-uid', defaultStrategy: 'update', allowedStrategies: ['update'] },
        ] as DiffEntry<unknown>[] as DiffResult['rules'],
      }),
      deserialize: vi.fn(),
    });
    expect(out.strategies).toEqual({ rules: { r1: 'skip' } });
    expect(out.envelope.entities.rules).toEqual([original]);
  });

  it("workspaceVars singleton: non-empty → 'replace' + envelope swap, empty → 'skip'", () => {
    const original = { variables: [{ key: 'A', value: '1' }] };
    const resolved = { variables: [{ key: 'A', value: '2' }] };
    const envelope = baseEnvelope({ workspaceVars: original as never });
    const replace = applyMergeResultsToEnvelope({
      envelope,
      files: [file('workspaceVars', WORKSPACE_VARS_SINGLETON_UID)],
      results: new Map([[WORKSPACE_VARS_SINGLETON_UID, 'yaml']]),
      diff: diffWith(),
      deserialize: vi.fn().mockReturnValue(resolved),
    });
    expect(replace.envelope.entities.workspaceVars).toBe(resolved);
    expect(replace.strategies.workspaceVars).toBe('replace');

    const skip = applyMergeResultsToEnvelope({
      envelope,
      files: [file('workspaceVars', WORKSPACE_VARS_SINGLETON_UID)],
      results: new Map([[WORKSPACE_VARS_SINGLETON_UID, '']]),
      diff: diffWith(),
      deserialize: vi.fn(),
    });
    expect(skip.envelope.entities.workspaceVars).toBe(original);
    expect(skip.strategies.workspaceVars).toBe('skip');
  });

  it('vault singleton handled symmetrically', () => {
    const incomingVault = { secrets: [{ uid: 's1' }] };
    const resolvedVault = { secrets: [{ uid: 's1', edited: true }] };
    const envelope = baseEnvelope({ vault: incomingVault as never });
    const out = applyMergeResultsToEnvelope({
      envelope,
      files: [file('vault', VAULT_SINGLETON_UID)],
      results: new Map([[VAULT_SINGLETON_UID, 'yaml']]),
      diff: diffWith(),
      deserialize: vi.fn().mockReturnValue(resolvedVault),
    });
    expect(out.envelope.entities.vault).toBe(resolvedVault);
    expect(out.strategies.vault).toBe('replace');
  });

  it('mixed bundle: collision update + add new-uid + skip + singleton replace', () => {
    const ruleA = { uid: 'rule-a', name: 'A' };
    const ruleB = { uid: 'rule-b', name: 'B' };
    const envA = { uid: 'env-a', name: 'Env' };
    const wsv = { variables: [] };
    const envelope = baseEnvelope({
      rules: [ruleA as never, ruleB as never],
      environments: [envA as never],
      workspaceVars: wsv as never,
    });
    const deserialize = vi.fn((text: string, f: MergeFile) => {
      if (f.group === 'rule' && text === 'merged-a') return { uid: 'rule-a', name: 'Merged' };
      if (f.group === 'environment' && text === 'edited-env') return { uid: 'env-a', name: 'Edited' };
      if (f.group === 'workspaceVars') return { variables: [{ key: 'X', value: '1' }] };
      return null;
    });
    const out = applyMergeResultsToEnvelope({
      envelope,
      files: [
        file('rule', 'rule-a'),
        file('rule', 'rule-b'),
        file('environment', 'env-a'),
        file('workspaceVars', WORKSPACE_VARS_SINGLETON_UID),
      ],
      results: new Map([
        ['rule-a', 'merged-a'],
        ['rule-b', '  '],
        ['env-a', 'edited-env'],
        [WORKSPACE_VARS_SINGLETON_UID, 'yaml'],
      ]),
      diff: diffWith({
        rules: [
          { entity: ruleA, state: 'collision-uid', defaultStrategy: 'update', allowedStrategies: ['update'] },
          { entity: ruleB, state: 'no-collision', defaultStrategy: 'new-uid', allowedStrategies: ['new-uid'] },
        ] as DiffEntry<unknown>[] as DiffResult['rules'],
        environments: [
          { entity: envA, state: 'collision-uid', defaultStrategy: 'update', allowedStrategies: ['update'] },
        ] as DiffEntry<unknown>[] as DiffResult['environments'],
      }),
      deserialize,
    });
    expect(out.strategies).toEqual({
      rules: { 'rule-a': 'update', 'rule-b': 'skip' },
      environments: { 'env-a': 'update' },
      workspaceVars: 'replace',
    });
    const rules = out.envelope.entities.rules as unknown as Array<{ uid: string; name: string }>;
    expect(rules[0]).toEqual({ uid: 'rule-a', name: 'Merged' });
    // rule-b was skipped → envelope keeps original
    expect(rules[1]).toBe(ruleB);
  });

  it('deserialize errors propagate so the caller can surface the broken row', () => {
    const envelope = baseEnvelope({ rules: [{ uid: 'r1', name: 'X' } as never] });
    expect(() =>
      applyMergeResultsToEnvelope({
        envelope,
        files: [file('rule', 'r1')],
        results: new Map([['r1', 'yaml']]),
        diff: diffWith({
          rules: [
            {
              entity: { uid: 'r1', name: 'X' },
              state: 'collision-uid',
              defaultStrategy: 'update',
              allowedStrategies: ['update'],
            },
          ] as DiffEntry<unknown>[] as DiffResult['rules'],
        }),
        deserialize: () => {
          throw new Error('parse failed');
        },
      }),
    ).toThrow('parse failed');
  });
});
