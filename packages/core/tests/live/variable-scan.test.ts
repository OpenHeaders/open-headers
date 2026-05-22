import { describe, expect, it } from 'vitest';
import { type VariableScopeSnapshot, workflowVariableFingerprint } from '../../src/live/variable-scan';

/** Build a scope snapshot, defaulting every namespace to an empty map. */
function makeScope(overrides: Partial<Record<keyof VariableScopeSnapshot, Map<string, string>>> = {}): VariableScopeSnapshot {
  return {
    envVars: overrides.envVars ?? new Map(),
    vaultVars: overrides.vaultVars ?? new Map(),
    workspaceVars: overrides.workspaceVars ?? new Map(),
    collectionVars: overrides.collectionVars ?? new Map(),
  };
}

describe('workflowVariableFingerprint', () => {
  it('is stable for the same templates + scope', () => {
    const templates = ['https://api.openheaders.io/{{env.path}}'];
    const scope = makeScope({ envVars: new Map([['path', 'v1']]) });
    expect(workflowVariableFingerprint(templates, scope)).toEqual(workflowVariableFingerprint(templates, scope));
  });

  it('refsKey is stable across variable-value edits; valuesKey flips', () => {
    const templates = ['{{env.token}}'];
    const before = workflowVariableFingerprint(templates, makeScope({ envVars: new Map([['token', 'aaa']]) }));
    const after = workflowVariableFingerprint(templates, makeScope({ envVars: new Map([['token', 'bbb']]) }));
    expect(after.refsKey).toBe(before.refsKey);
    expect(after.valuesKey).not.toBe(before.valuesKey);
  });

  it('refsKey flips when a reference is added or dropped', () => {
    const scope = makeScope({ envVars: new Map([['a', '1'], ['b', '2']]) });
    const oneRef = workflowVariableFingerprint(['{{env.a}}'], scope);
    const twoRefs = workflowVariableFingerprint(['{{env.a}}', '{{env.b}}'], scope);
    expect(twoRefs.refsKey).not.toBe(oneRef.refsKey);
  });

  it('is unaffected by edits to a variable the templates do not reference', () => {
    const templates = ['{{env.used}}'];
    const before = workflowVariableFingerprint(
      templates,
      makeScope({ envVars: new Map([['used', 'x'], ['unused', 'a']]) }),
    );
    const after = workflowVariableFingerprint(
      templates,
      makeScope({ envVars: new Map([['used', 'x'], ['unused', 'b']]) }),
    );
    expect(after).toEqual(before);
  });

  it('distinguishes the same name across namespaces', () => {
    const envScope = makeScope({ envVars: new Map([['token', 'v']]) });
    const vaultScope = makeScope({ vaultVars: new Map([['token', 'v']]) });
    expect(workflowVariableFingerprint(['{{env.token}}'], envScope).refsKey).not.toBe(
      workflowVariableFingerprint(['{{vault.token}}'], vaultScope).refsKey,
    );
  });

  it('tracks vault, workspace, and collection references', () => {
    const tpl = ['{{vault.s}}{{workspace.w}}{{collection.c}}'];
    const base = workflowVariableFingerprint(
      tpl,
      makeScope({
        vaultVars: new Map([['s', '1']]),
        workspaceVars: new Map([['w', '1']]),
        collectionVars: new Map([['c', '1']]),
      }),
    );
    for (const ns of ['vaultVars', 'workspaceVars', 'collectionVars'] as const) {
      const edited = workflowVariableFingerprint(tpl, makeScope({ vaultVars: new Map([['s', '1']]), workspaceVars: new Map([['w', '1']]), collectionVars: new Map([['c', '1']]), [ns]: new Map([[ns === 'vaultVars' ? 's' : ns === 'workspaceVars' ? 'w' : 'c', '2']]) }));
      expect(edited.valuesKey).not.toBe(base.valuesKey);
    }
  });

  it('a flat {{X}} reference folds in every scope of the resolution chain', () => {
    const tpl = ['{{shared}}'];
    const base = workflowVariableFingerprint(tpl, makeScope());
    // A change in any of vault / env / collection / workspace flips it.
    expect(workflowVariableFingerprint(tpl, makeScope({ vaultVars: new Map([['shared', 'v']]) })).valuesKey).not.toBe(
      base.valuesKey,
    );
    expect(workflowVariableFingerprint(tpl, makeScope({ envVars: new Map([['shared', 'v']]) })).valuesKey).not.toBe(
      base.valuesKey,
    );
    expect(
      workflowVariableFingerprint(tpl, makeScope({ workspaceVars: new Map([['shared', 'v']]) })).valuesKey,
    ).not.toBe(base.valuesKey);
  });

  it('ignores dynamic and file references — neither is a user-edited variable', () => {
    const withReserved = workflowVariableFingerprint(['{{dynamic.uuid}}{{file.logo}}{{env.real}}'], makeScope());
    const onlyReal = workflowVariableFingerprint(['{{env.real}}'], makeScope());
    expect(withReserved.refsKey).toBe(onlyReal.refsKey);
  });

  it('is order-independent across templates referencing the same variables', () => {
    const scope = makeScope({ envVars: new Map([['a', '1'], ['b', '2']]) });
    expect(workflowVariableFingerprint(['{{env.a}}', '{{env.b}}'], scope)).toEqual(
      workflowVariableFingerprint(['{{env.b}}', '{{env.a}}'], scope),
    );
  });

  it('distinguishes an absent variable from an explicitly-empty one', () => {
    const absent = workflowVariableFingerprint(['{{env.token}}'], makeScope());
    const empty = workflowVariableFingerprint(['{{env.token}}'], makeScope({ envVars: new Map([['token', '']]) }));
    expect(empty.valuesKey).not.toBe(absent.valuesKey);
  });

  it('has an empty ref set for templates with no variable references', () => {
    const plain = workflowVariableFingerprint(['https://api.openheaders.io/static'], makeScope());
    const empty = workflowVariableFingerprint([], makeScope());
    expect(plain.refsKey).toBe(empty.refsKey);
  });
});
