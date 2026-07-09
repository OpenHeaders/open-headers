/**
 * Breadcrumb path computation for a single editor tab. Extracted so
 * EditorGroupRenderer can compute per-leaf breadcrumbs without App.tsx
 * having to render only one breadcrumb tied to the globally-focused
 * tab. The logic is identical to what lived inline as a useMemo;
 * moving it into a pure function keeps each leaf independent.
 *
 * The leaf segment (the entity's own label) is supplied by the caller
 * as `displayLabel` — typically `tabDisplayLabel(tab, lookups)` from
 * `tab-display.ts`. SoC: this module only computes the parent trail;
 * the leaf-name source of truth lives in one place, used by both the
 * tab strip and the breadcrumb so they can never disagree.
 */

import type { CollectionTree, Request, Rule, TreeNode } from '@openheaders/core/types';
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
    case 'request-create':
      return 'Scratch Request';
    case 'rule-create':
      return 'Scratch Rule';
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
  displayLabel: string,
  rules: Rule[],
  localCollectionTrees: CollectionTree[],
  requestCollectionTrees: readonly CollectionTree[] = [],
  requests: readonly Request[] = [],
  templateCollectionTrees: readonly CollectionTree[] = [],
): string[] {
  if (!tab) return [];

  if (tab.mode === 'settings') return ['Settings'];

  if (tab.mode === 'workspace-manager') return ['Workspaces'];
  if (tab.mode === 'env-edit') return ['Environments', displayLabel];
  if (tab.mode === 'workspace-vars') return ['Workspace Variables'];
  if (tab.mode === 'vault') return ['Vault'];
  if (tab.mode === 'script-packages') return ['Package Library'];
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
        const findRequest = (nodes: TreeNode[]): boolean => {
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
        if (findRequest(col.tree)) return ['API Requests', col.name, ...trail, displayLabel];
      }
    }
    return ['API Requests', displayLabel];
  }
  if (tab.mode === 'response-example') {
    // Frozen example under a request — extend the parent request's
    // trail with the example's own label.
    if (tab.requestUid) {
      const req = requests.find((r) => r.uid === tab.requestUid);
      if (req) {
        const hit = computeRequestTrail(req.uid, requestCollectionTrees);
        if (hit) return ['API Requests', hit.collectionName, ...hit.folderTrail, req.name, displayLabel];
        return ['API Requests', req.name, displayLabel];
      }
    }
    return ['API Requests', displayLabel];
  }
  if (tab.mode === 'request-create') {
    const colId = tab.preferredCollectionId;
    const col = colId ? requestCollectionTrees.find((c) => c.uid === colId) : null;
    const folderTrail = tab.preferredFolderPath
      ? tab.preferredFolderPath.split('/').filter((seg) => seg.length > 0)
      : [];
    if (col) return ['API Requests', col.name, ...folderTrail, displayLabel];
    return ['API Requests', displayLabel];
  }
  if (tab.mode === 'rule-create') {
    const colId = tab.preferredCollectionId;
    const col = colId ? localCollectionTrees.find((c) => c.uid === colId) : null;
    const folderTrail = tab.preferredFolderPath
      ? tab.preferredFolderPath.split('/').filter((seg) => seg.length > 0)
      : [];
    if (col) return ['Rules', col.name, ...folderTrail, displayLabel];
    return ['Rules', displayLabel];
  }

  if (tab.mode === 'live-workflow-edit') return ['Workflows', displayLabel];
  if (tab.mode === 'live-workflow-create') return ['Workflows', displayLabel];
  if (tab.mode === 'live-variable-edit') return ['Live Variables', displayLabel];
  if (tab.mode === 'live-variable-create') return ['Live Variables', displayLabel];
  if (tab.mode === 'live-vars') return ['Live Variables'];

  if (tab.mode === 'collection-overview') {
    // Family-disambiguate by entity uid — collection-overview is a
    // single tab mode shared by rule / request / template collection
    // openers. Pre-session-50 the breadcrumb hard-coded "Rules" which
    // misled users on a request- or template-collection overview tab.
    const uid = tab.entityId;
    if (uid) {
      if (requestCollectionTrees.some((c) => c.uid === uid)) return ['API Requests', displayLabel];
      if (templateCollectionTrees.some((c) => c.uid === uid)) return ['Templates', displayLabel];
    }
    return ['Rules', displayLabel];
  }

  if (tab.mode === 'folder-overview' && tab.entityId) {
    // Family-disambiguate by folder uid lookup. Folder uids are
    // globally unique; the walk visits rule → request → template
    // trees and emits the family-prefixed breadcrumb. Falls through
    // to "Rules" as the default when the uid hasn't loaded yet.
    const findIn = (trees: readonly CollectionTree[]): { collectionName: string; trail: string[] } | null => {
      for (const col of trees) {
        const trail: string[] = [];
        const walk = (nodes: TreeNode[]): boolean => {
          for (const n of nodes) {
            if (n.type === 'folder' && n.uid === tab.entityId) return true;
            if (n.type === 'folder') {
              trail.push(n.name);
              if (walk(n.children)) return true;
              trail.pop();
            }
          }
          return false;
        };
        if (walk(col.tree)) return { collectionName: col.name, trail };
      }
      return null;
    };
    const ruleHit = findIn(localCollectionTrees);
    if (ruleHit) return ['Rules', ruleHit.collectionName, ...ruleHit.trail, displayLabel];
    const requestHit = findIn(requestCollectionTrees);
    if (requestHit) return ['API Requests', requestHit.collectionName, ...requestHit.trail, displayLabel];
    const templateHit = findIn(templateCollectionTrees);
    if (templateHit) return ['Templates', templateHit.collectionName, ...templateHit.trail, displayLabel];
    return ['Rules', displayLabel];
  }

  if (tab.mode === 'edit' && tab.ruleUid) {
    const rule = rules.find((r) => r.uid === tab.ruleUid);
    if (rule) {
      for (const col of localCollectionTrees) {
        const trail: string[] = [];
        const findRule = (nodes: TreeNode[]): boolean => {
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
        if (findRule(col.tree)) return ['Rules', col.name, ...trail, displayLabel];
      }
    }
    return ['Rules', displayLabel];
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
          const findFolder = (nodes: TreeNode[]): boolean => {
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
            const findRule = (nodes: TreeNode[]): boolean => {
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
        const findFolder = (nodes: TreeNode[]): boolean => {
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
    return ['Rules', displayLabel];
  }

  return ['Rules', displayLabel];
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
  collectionTrees: readonly CollectionTree[],
): { collectionName: string; folderTrail: string[] } | null {
  for (const col of collectionTrees) {
    const folderTrail: string[] = [];
    const find = (nodes: TreeNode[]): boolean => {
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
