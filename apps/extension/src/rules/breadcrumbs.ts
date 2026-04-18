/**
 * Breadcrumb path computation for a single editor tab. Extracted so
 * EditorGroupRenderer can compute per-leaf breadcrumbs without App.tsx
 * having to render only one breadcrumb tied to the globally-focused
 * tab. The logic is identical to what lived inline as a useMemo;
 * moving it into a pure function keeps each leaf independent.
 */

import type { V5 } from '@openheaders/core/types';
import type { RulesTab } from './types';

export function computeBreadcrumbs(
  tab: RulesTab | undefined,
  rules: V5.Rule[],
  localCollectionTrees: V5.CollectionTree[],
): string[] {
  if (!tab) return [];

  if (tab.mode === 'settings') return ['Settings'];

  if (tab.mode === 'workspace-manager') return ['Workspaces'];
  if (tab.mode === 'env-edit') return ['Environments', tab.label];
  if (tab.mode === 'workspace-vars') return ['Workspace Variables'];
  if (tab.mode === 'vault') return ['Vault'];
  if (tab.mode === 'collection-vars') {
    const col = tab.collectionUid ? localCollectionTrees.find((c) => c.uid === tab.collectionUid) : null;
    return col ? ['Rules', col.name, 'Variables'] : ['Variables'];
  }
  if (tab.mode === 'request-edit') return ['API Requests', tab.label];
  if (tab.mode === 'request-create') return ['API Requests', tab.draftName ?? tab.label];

  if (tab.mode === 'collection-overview') return ['Rules', tab.label];

  if (tab.mode === 'folder-overview' && tab.entityId) {
    for (const col of localCollectionTrees) {
      const trail: string[] = [];
      const findFolder = (nodes: V5.TreeNode[]): boolean => {
        for (const n of nodes) {
          if (n.type === 'folder' && n.uid === tab.entityId) return true;
          if (n.type === 'folder') {
            trail.push(n.name);
            if (findFolder(n.children)) return true;
            trail.pop();
          }
        }
        return false;
      };
      if (findFolder(col.tree)) return ['Rules', col.name, ...trail, tab.label];
    }
    return ['Rules', tab.label];
  }

  if (tab.mode === 'edit' && tab.ruleUid) {
    const rule = rules.find((r) => r.uid === tab.ruleUid);
    if (rule) {
      for (const col of localCollectionTrees) {
        const trail: string[] = [];
        const findRule = (nodes: V5.TreeNode[]): boolean => {
          for (const n of nodes) {
            if (n.type === 'rule' && n.uid === rule.uid) return true;
            if (n.type === 'folder') {
              trail.push(n.name);
              if (findRule(n.children)) return true;
              trail.pop();
            }
          }
          return false;
        };
        if (findRule(col.tree)) return ['Rules', col.name, ...trail, tab.label];
      }
    }
    return ['Rules', tab.label];
  }

  if (tab.mode === 'run-report') {
    const ownerType = tab.testOwnerType;
    const ownerId = tab.testOwnerId;
    if (ownerType && ownerId) {
      if (ownerType === 'workspace') {
        return ['Rules', 'All Rules', 'Run Report'];
      }
      if (ownerType === 'collection') {
        const col = localCollectionTrees.find((c) => c.uid === ownerId);
        if (col) return ['Rules', col.name, 'Run Report'];
      }
      if (ownerType === 'folder') {
        for (const col of localCollectionTrees) {
          const trail: string[] = [];
          const findFolder = (nodes: V5.TreeNode[]): boolean => {
            for (const n of nodes) {
              if (n.type === 'folder' && n.uid === ownerId) {
                trail.push(n.name);
                return true;
              }
              if (n.type === 'folder') {
                trail.push(n.name);
                if (findFolder(n.children)) return true;
                trail.pop();
              }
            }
            return false;
          };
          if (findFolder(col.tree)) return ['Rules', col.name, ...trail, 'Run Report'];
        }
      }
      if (ownerType === 'rule') {
        const rule = rules.find((r) => r.uid === ownerId);
        if (rule) {
          for (const col of localCollectionTrees) {
            const trail: string[] = [];
            const findRule = (nodes: V5.TreeNode[]): boolean => {
              for (const n of nodes) {
                if (n.type === 'rule' && n.uid === rule.uid) return true;
                if (n.type === 'folder') {
                  trail.push(n.name);
                  if (findRule(n.children)) return true;
                  trail.pop();
                }
              }
              return false;
            };
            if (findRule(col.tree)) return ['Rules', col.name, ...trail, rule.name, 'Run Report'];
          }
        }
      }
    }
    return ['Rules', 'Run Report'];
  }

  if (tab.mode === 'rule-flow') {
    if (tab.flowScope === 'collection' && tab.entityId) {
      const col = localCollectionTrees.find((c) => c.uid === tab.entityId);
      if (col) return ['Rules', col.name, 'Flow'];
    }
    if (tab.flowScope === 'folder' && tab.entityId) {
      for (const col of localCollectionTrees) {
        const trail: string[] = [];
        const findFolder = (nodes: V5.TreeNode[]): boolean => {
          for (const n of nodes) {
            if (n.type === 'folder' && n.uid === tab.entityId) return true;
            if (n.type === 'folder') {
              trail.push(n.name);
              if (findFolder(n.children)) return true;
              trail.pop();
            }
          }
          return false;
        };
        if (findFolder(col.tree)) return ['Rules', col.name, ...trail, 'Flow'];
      }
    }
    return ['Rules', tab.label];
  }

  return ['Rules', tab.label];
}
