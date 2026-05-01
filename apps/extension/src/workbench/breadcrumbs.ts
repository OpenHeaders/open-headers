/**
 * Breadcrumb path computation for a single editor tab. Extracted so
 * EditorGroupRenderer can compute per-leaf breadcrumbs without App.tsx
 * having to render only one breadcrumb tied to the globally-focused
 * tab. The logic is identical to what lived inline as a useMemo;
 * moving it into a pure function keeps each leaf independent.
 */

import type { V5 } from '@openheaders/core/types';
import type { WorkbenchTab } from './types';

/**
 * Label for the grey "Scratch" breadcrumb segment injected before an
 * unsaved entity. Entity-typed ("Scratch Rule" vs "Scratch Request") so
 * the breadcrumb conveys both that the tab is transient AND what kind
 * of thing it will become once saved. Returns null for modes that
 * aren't create-modes.
 */
export function scratchLabelForMode(mode: WorkbenchTab['mode']): string | null {
  switch (mode) {
    case 'create':
      return 'Scratch Rule';
    case 'request-create':
      return 'Scratch Request';
    case 'live-variable-create':
      return 'Scratch Variable';
    case 'live-workflow-create':
      return 'Scratch Workflow';
    default:
      return null;
  }
}

export function computeBreadcrumbs(
  tab: WorkbenchTab | undefined,
  rules: V5.Rule[],
  localCollectionTrees: V5.CollectionTree[],
  requestCollectionTrees: readonly V5.CollectionTree[] = [],
  requests: readonly V5.Request[] = [],
  templateCollectionTrees: readonly V5.CollectionTree[] = [],
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
  if (tab.mode === 'request-collection-vars') {
    const col = tab.collectionUid ? requestCollectionTrees.find((c) => c.uid === tab.collectionUid) : null;
    return col ? ['Requests', col.name, 'Variables'] : ['Variables'];
  }
  if (tab.mode === 'template-collection-vars') {
    const col = tab.collectionUid ? templateCollectionTrees.find((c) => c.uid === tab.collectionUid) : null;
    return col ? ['Templates', col.name, 'Variables'] : ['Variables'];
  }
  if (tab.mode === 'request-edit' && tab.requestUid) {
    const req = requests.find((r) => r.uid === tab.requestUid);
    if (req) {
      for (const col of requestCollectionTrees) {
        const trail: string[] = [];
        const findRequest = (nodes: V5.TreeNode[]): boolean => {
          for (const n of nodes) {
            if (n.type === 'request' && n.uid === req.uid) return true;
            if (n.type === 'folder') {
              trail.push(n.name);
              if (findRequest(n.children)) return true;
              trail.pop();
            }
          }
          return false;
        };
        if (findRequest(col.tree)) return ['API Requests', col.name, ...trail, tab.label];
      }
    }
    return ['API Requests', tab.label];
  }
  if (tab.mode === 'request-create') {
    const colId = tab.preferredCollectionId;
    const col = colId ? requestCollectionTrees.find((c) => c.uid === colId) : null;
    const folderTrail = tab.preferredFolderPath
      ? tab.preferredFolderPath.split('/').filter((seg) => seg.length > 0)
      : [];
    if (col) return ['API Requests', col.name, ...folderTrail, tab.draftName ?? tab.label];
    return ['API Requests', tab.draftName ?? tab.label];
  }

  if (tab.mode === 'live-workflow-edit') return ['Workflows', tab.label];
  if (tab.mode === 'live-workflow-create') return ['Workflows', tab.draftName ?? tab.label];
  if (tab.mode === 'live-variable-edit') return ['Live Variables', tab.label];
  if (tab.mode === 'live-variable-create') return ['Live Variables', tab.draftName ?? tab.label];
  if (tab.mode === 'live-vars') return ['Live Variables'];

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

/**
 * Resolve the collection + folder trail for a single request uid against
 * a list of request collection trees. Returns `null` when the request
 * isn't found (deleted, or viewer looking at a stale snapshot).
 *
 * Shape is intentionally structured (`{ collectionName, folderTrail }`)
 * rather than a pre-joined string so callers decide how to render —
 * e.g., the Workflow step editor builds a Select option showing
 * `<method> <name>` on one line and `collection / folder` on the next.
 */
export function computeRequestTrail(
  requestUid: string,
  collectionTrees: V5.CollectionTree[],
): { collectionName: string; folderTrail: string[] } | null {
  for (const col of collectionTrees) {
    const folderTrail: string[] = [];
    const find = (nodes: V5.TreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.type === 'request' && n.uid === requestUid) return true;
        if (n.type === 'folder') {
          folderTrail.push(n.name);
          if (find(n.children)) return true;
          folderTrail.pop();
        }
      }
      return false;
    };
    if (find(col.tree)) return { collectionName: col.name, folderTrail };
  }
  return null;
}
