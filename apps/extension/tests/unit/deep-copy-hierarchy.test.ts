/**
 * Direct coverage for `deepCopyHierarchy` — the generic helper that
 * powers both `duplicateWorkspace` and (future PR 2) the workspace-import
 * `new-uid` strategy.
 *
 * Asserts the structural invariants the existing duplicate-workspace
 * flow relies on, so a regression here would be caught even without
 * end-to-end coverage of `duplicateWorkspace` itself.
 */

import type { V5 } from '@openheaders/core/types';
import { deepCopyHierarchy, type LocalFolder } from '@openheaders/core/workspace-export';
import { describe, expect, it } from 'vitest';

function makeCollection(uid: string, name: string, path: string): V5.Collection {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

function makeFolder(uid: string, name: string, path: string): LocalFolder {
  return { schemaVersion: 5, uid, name, path };
}

function makeRule(uid: string, name: string, path: string, partial: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    schemaVersion: 5,
    uid,
    path,
    name,
    type: 'header',
    enabled: true,
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
    ...partial,
  };
}

describe('deepCopyHierarchy — empty input', () => {
  it('returns empty arrays when there is nothing to copy', () => {
    const out = deepCopyHierarchy<V5.Rule>({
      entities: [],
      collections: [],
      folders: [],
      treePrefix: 'rules',
    });
    expect(out.entities).toEqual([]);
    expect(out.collections).toEqual([]);
    expect(out.folders).toEqual([]);
    expect(out.pathRemap.size).toBe(0);
    expect(out.entityUidRemap.size).toBe(0);
  });
});

describe('deepCopyHierarchy — collection + folder + entity', () => {
  it('regenerates uids and rebuilds paths under the given tree prefix', () => {
    const col = makeCollection('col00001', 'Auth', 'rules/old-col-path');
    const folder = makeFolder('fld00001', 'Tokens', 'rules/old-col-path/old-folder');
    const rule = makeRule('rul00001', 'X-Auth header', 'rules/old-col-path/old-folder/old-rule');

    const out = deepCopyHierarchy<V5.Rule>({
      entities: [rule],
      collections: [col],
      folders: [folder],
      treePrefix: 'rules',
    });

    expect(out.collections).toHaveLength(1);
    const newCol = out.collections[0];
    expect(newCol.uid).not.toBe('col00001');
    expect(newCol.uid).toMatch(/^[a-z0-9]{8}$/);
    expect(newCol.name).toBe('Auth');
    expect(newCol.path.startsWith('rules/auth-')).toBe(true);

    expect(out.folders).toHaveLength(1);
    const newFolder = out.folders[0];
    expect(newFolder.uid).not.toBe('fld00001');
    expect(newFolder.path.startsWith(`${newCol.path}/tokens-`)).toBe(true);

    expect(out.entities).toHaveLength(1);
    const newRule = out.entities[0];
    expect(newRule.uid).not.toBe('rul00001');
    expect(newRule.path.startsWith(`${newFolder.path}/x-auth-header-`)).toBe(true);

    expect(out.pathRemap.get(col.path)).toBe(newCol.path);
    expect(out.pathRemap.get(folder.path)).toBe(newFolder.path);
    // pathRemap is for containers ONLY — entities aren't in it.
    expect(out.pathRemap.has(rule.path)).toBe(false);

    expect(out.entityUidRemap.get('rul00001')).toBe(newRule.uid);
  });
});

describe('deepCopyHierarchy — nested folders', () => {
  it('walks parents before children so child paths reflect renamed parents', () => {
    const col = makeCollection('col00001', 'API', 'rules/api-col');
    // grand → child structure (path-depth is the sort key)
    const parent = makeFolder('flda0001', 'Auth', 'rules/api-col/auth-fld');
    const child = makeFolder('fldb0001', 'OAuth', 'rules/api-col/auth-fld/oauth-fld');

    const out = deepCopyHierarchy<V5.Rule>({
      entities: [],
      collections: [col],
      // Pass child first to verify the helper sorts shallow-first.
      folders: [child, parent],
      treePrefix: 'rules',
    });

    const newCol = out.collections[0];
    const newParent = out.folders.find((f) => f.uid !== child.uid && f.uid !== parent.uid && f.name === 'Auth');
    const newChild = out.folders.find((f) => f.uid !== child.uid && f.uid !== parent.uid && f.name === 'OAuth');
    expect(newParent).toBeDefined();
    expect(newChild).toBeDefined();
    if (!newParent || !newChild) throw new Error('unreachable');

    expect(newParent.path.startsWith(`${newCol.path}/auth-`)).toBe(true);
    // Child's path includes the renamed parent's slug + new uid.
    expect(newChild.path.startsWith(`${newParent.path}/oauth-`)).toBe(true);
  });

  it('preserves input array order in the returned folders', () => {
    const col = makeCollection('col00001', 'API', 'rules/api-col');
    const a = makeFolder('flda0001', 'A', 'rules/api-col/a');
    const b = makeFolder('fldb0001', 'B', 'rules/api-col/b');
    const c = makeFolder('fldc0001', 'C', 'rules/api-col/c');

    const out = deepCopyHierarchy<V5.Rule>({
      entities: [],
      collections: [col],
      folders: [c, a, b],
      treePrefix: 'rules',
    });

    expect(out.folders.map((f) => f.name)).toEqual(['C', 'A', 'B']);
  });
});

describe('deepCopyHierarchy — finalizeEntity callback', () => {
  it('exposes uid remaps so a rule can rewrite collectionId / folderId', () => {
    const col = makeCollection('col00001', 'Auth', 'rules/auth-col');
    const folder = makeFolder('fld00001', 'Tokens', 'rules/auth-col/tokens-fld');
    const rule = makeRule('rul00001', 'token-rule', 'rules/auth-col/tokens-fld/token-rule', {
      // biome-ignore lint/suspicious/noExplicitAny: testing dynamic field shape
    } as any);
    // Stamp collectionId / folderId post-construction (the schema doesn't
    // declare these, but the runtime carries them on rules — see the
    // existing rule remap logic in workspace-orchestrator).
    (rule as unknown as { collectionId?: string; folderId?: string }).collectionId = 'col00001';
    (rule as unknown as { collectionId?: string; folderId?: string }).folderId = 'fld00001';

    const out = deepCopyHierarchy<V5.Rule>({
      entities: [rule],
      collections: [col],
      folders: [folder],
      treePrefix: 'rules',
      finalizeEntity: (r, ctx) => {
        const withIds = r as V5.Rule & { collectionId?: string; folderId?: string };
        return {
          ...r,
          ...(withIds.collectionId && {
            collectionId: ctx.collectionUidRemap.get(withIds.collectionId) ?? withIds.collectionId,
          }),
          ...(withIds.folderId && { folderId: ctx.folderUidRemap.get(withIds.folderId) ?? withIds.folderId }),
        } as V5.Rule;
      },
    });

    const newRule = out.entities[0] as V5.Rule & { collectionId?: string; folderId?: string };
    const newCol = out.collections[0];
    const newFolder = out.folders[0];
    expect(newRule.collectionId).toBe(newCol.uid);
    expect(newRule.folderId).toBe(newFolder.uid);
  });
});

describe('deepCopyHierarchy — uid uniqueness', () => {
  it('generates fresh uids across consecutive calls (no cross-call collision)', () => {
    const col = makeCollection('col00001', 'Coll', 'rules/coll');
    const a = deepCopyHierarchy<V5.Rule>({ entities: [], collections: [col], folders: [], treePrefix: 'rules' });
    const b = deepCopyHierarchy<V5.Rule>({ entities: [], collections: [col], folders: [], treePrefix: 'rules' });
    expect(a.collections[0].uid).not.toBe(b.collections[0].uid);
  });
});
