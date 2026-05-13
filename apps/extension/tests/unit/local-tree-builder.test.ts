/**
 * Unit tests for the renderer-side local tree builders. These
 * functions are the read-path-side counterpart of the SW's
 * `rule-store.buildTreeForParent` / `template-store.buildTreeForParent`
 * boot-fallback path; diverged tabs in MWPT per-tab mode use them to
 * compose a `CollectionTree[]` from materialized snapshots without
 * needing a live oracle for the diverged workspace.
 *
 * Invariant: the persisted `folders` / `collections` / `rules` arrays
 * already carry orderedSet-projected order (the cache writes them on
 * every oracle broadcast), so path-string parent filtering reproduces
 * the same shape the SW would emit via `oracle.liveOrderedSetItems`.
 */

import type { Collection, Rule, RuleType, Template } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { buildLocalCollectionTrees, buildTemplateCollectionTrees } from '@/shared/local-tree-builder';
import type { PersistedLocalFolder } from '@/shared/storage';

const collection = (path: string, name: string): Collection => ({
  schemaVersion: 5,
  uid: `c-${name}`,
  path,
  name,
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
});

const folder = (path: string, name: string): PersistedLocalFolder => ({
  schemaVersion: 1,
  uid: `f-${name}`,
  path,
  name,
});

describe('buildLocalCollectionTrees', () => {
  it('emits a tree of folder + rule nodes under each collection', () => {
    const collections = [collection('rules/cA', 'cA'), collection('rules/cB', 'cB')];
    const folders = [folder('rules/cA/inner', 'inner'), folder('rules/cB/x', 'x')];
    const rules = [
      {
        schemaVersion: 5,
        uid: 'r1',
        path: 'rules/cA/inner/r1',
        name: 'r1',
        type: 'header' as RuleType,
        enabled: true,
      } as Rule,
      {
        schemaVersion: 5,
        uid: 'r2',
        path: 'rules/cA/r2',
        name: 'r2',
        type: 'header' as RuleType,
        enabled: false,
      } as Rule,
    ];

    const trees = buildLocalCollectionTrees(collections, folders, rules);

    expect(trees).toHaveLength(2);
    const cA = trees[0];
    expect(cA.uid).toBe('c-cA');
    expect(cA.tree).toHaveLength(2);
    const innerNode = cA.tree[0];
    expect(innerNode.type).toBe('folder');
    if (innerNode.type === 'folder') {
      expect(innerNode.children).toHaveLength(1);
      expect(innerNode.children[0].uid).toBe('r1');
    }
    expect(cA.tree[1].type).toBe('rule');
    expect(cA.tree[1].uid).toBe('r2');

    // cB has its folder but no rules in it
    const cB = trees[1];
    expect(cB.tree).toHaveLength(1);
    expect(cB.tree[0].type).toBe('folder');
  });

  it('returns rule nodes with type + enabled fields preserved', () => {
    const collections = [collection('rules/c', 'c')];
    const rules = [
      {
        schemaVersion: 5,
        uid: 'r-disabled',
        path: 'rules/c/r-disabled',
        name: 'disabled',
        type: 'block' as RuleType,
        enabled: false,
      } as Rule,
    ];
    const [tree] = buildLocalCollectionTrees(collections, [], rules);
    const ruleNode = tree.tree[0];
    expect(ruleNode.type).toBe('rule');
    if (ruleNode.type === 'rule') {
      expect(ruleNode.ruleType).toBe('block');
      expect(ruleNode.enabled).toBe(false);
    }
  });

  it('handles empty inputs without throwing', () => {
    expect(buildLocalCollectionTrees([], [], [])).toEqual([]);
  });

  it('does not include children whose path is unrelated to any collection', () => {
    const collections = [collection('rules/c', 'c')];
    const folders = [folder('rules/orphan', 'orphan')]; // not under c
    const rules = [
      {
        schemaVersion: 5,
        uid: 'r-orphan',
        path: 'rules/orphan/r-orphan',
        name: 'orphan',
        type: 'header' as RuleType,
        enabled: true,
      } as Rule,
    ];
    const [tree] = buildLocalCollectionTrees(collections, folders, rules);
    expect(tree.tree).toEqual([]);
  });
});

describe('buildTemplateCollectionTrees', () => {
  it('emits template nodes with ruleType + icon preserved', () => {
    const collections = [collection('templates/c', 'c')];
    const templates = [
      {
        schemaVersion: 5,
        uid: 't1',
        path: 'templates/c/t1',
        name: 't1',
        ruleType: 'header' as RuleType,
        icon: 'star',
      } as Template,
    ];
    const [tree] = buildTemplateCollectionTrees(collections, [], templates);
    const node = tree.tree[0];
    expect(node.type).toBe('template');
    if (node.type === 'template') {
      expect(node.ruleType).toBe('header');
      expect(node.icon).toBe('star');
    }
  });
});
