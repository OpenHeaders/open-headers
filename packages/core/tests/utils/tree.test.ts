import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../../src/types/v5/collection';
import { buildBreadcrumbTrail, findNodeChildren } from '../../src/utils/tree';

// ── Fixtures ────────────────────────────────────────────────────────

const tree: TreeNode[] = [
  {
    type: 'rule',
    uid: 'r1',
    name: 'X-Debug',
    path: 'rules/my-rules-abc1/x-debug-r1',
    ruleType: 'header',
    enabled: true,
  },
  {
    type: 'folder',
    uid: 'f1',
    name: 'Auth',
    path: 'rules/my-rules-abc1/auth-f1',
    children: [
      {
        type: 'rule',
        uid: 'r2',
        name: 'Bearer Token',
        path: 'rules/my-rules-abc1/auth-f1/bearer-token-r2',
        ruleType: 'header',
        enabled: true,
      },
      {
        type: 'folder',
        uid: 'f2',
        name: 'OAuth',
        path: 'rules/my-rules-abc1/auth-f1/oauth-f2',
        children: [
          {
            type: 'rule',
            uid: 'r3',
            name: 'OAuth Header',
            path: 'rules/my-rules-abc1/auth-f1/oauth-f2/oauth-header-r3',
            ruleType: 'header',
            enabled: false,
          },
        ],
      },
    ],
  },
  {
    type: 'folder',
    uid: 'f3',
    name: 'CORS',
    path: 'rules/my-rules-abc1/cors-f3',
    children: [],
  },
];

// ── findNodeChildren ────────────────────────────────────────────────

describe('findNodeChildren', () => {
  it('returns top-level nodes when folderPath is undefined', () => {
    const result = findNodeChildren(tree, undefined);
    expect(result).toBe(tree);
  });

  it('finds children of a top-level folder', () => {
    const result = findNodeChildren(tree, 'rules/my-rules-abc1/auth-f1');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].name).toBe('Bearer Token');
    expect(result![1].name).toBe('OAuth');
  });

  it('finds children of a nested folder', () => {
    const result = findNodeChildren(tree, 'rules/my-rules-abc1/auth-f1/oauth-f2');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('OAuth Header');
  });

  it('returns empty array for an empty folder', () => {
    const result = findNodeChildren(tree, 'rules/my-rules-abc1/cors-f3');
    expect(result).not.toBeNull();
    expect(result).toHaveLength(0);
  });

  it('returns null when path not found', () => {
    const result = findNodeChildren(tree, 'rules/nonexistent-xyz9');
    expect(result).toBeNull();
  });
});

// ── buildBreadcrumbTrail ────────────────────────────────────────────

describe('buildBreadcrumbTrail', () => {
  it('returns empty array when targetPath is undefined', () => {
    expect(buildBreadcrumbTrail(tree, undefined)).toEqual([]);
  });

  it('builds single-segment trail for top-level folder', () => {
    const trail = buildBreadcrumbTrail(tree, 'rules/my-rules-abc1/auth-f1');
    expect(trail).toEqual([{ name: 'Auth', path: 'rules/my-rules-abc1/auth-f1' }]);
  });

  it('builds multi-segment trail for nested folder', () => {
    const trail = buildBreadcrumbTrail(tree, 'rules/my-rules-abc1/auth-f1/oauth-f2');
    expect(trail).toEqual([
      { name: 'Auth', path: 'rules/my-rules-abc1/auth-f1' },
      { name: 'OAuth', path: 'rules/my-rules-abc1/auth-f1/oauth-f2' },
    ]);
  });

  it('returns empty array when path not found', () => {
    expect(buildBreadcrumbTrail(tree, 'rules/nonexistent-xyz9')).toEqual([]);
  });

  it('builds trail for empty folder', () => {
    const trail = buildBreadcrumbTrail(tree, 'rules/my-rules-abc1/cors-f3');
    expect(trail).toEqual([{ name: 'CORS', path: 'rules/my-rules-abc1/cors-f3' }]);
  });
});
