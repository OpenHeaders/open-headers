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
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { WorkbenchTab } from './types';

/**
 * Label for the grey "Scratch" breadcrumb segment injected before an
 * unsaved entity. Entity-typed ("Scratch Rule" vs "Scratch Request") so
 * the breadcrumb conveys both that the tab is transient AND what kind
 * of thing it will become once saved. Returns null for modes that
 * aren't create-modes.
 */
export function scratchLabelForMode(mode: WorkbenchTab['mode'], t: Translate): string | null {
  switch (mode) {
    case 'request-create':
      return t('workbench.scratch.request');
    case 'rule-create':
      return t('workbench.scratch.rule');
    case 'live-variable-create':
      return t('workbench.scratch.variable');
    case 'live-workflow-create':
      return t('workbench.scratch.workflow');
    default:
      return null;
  }
}

export function computeBreadcrumbs(
  tab: WorkbenchTab | undefined,
  displayLabel: string,
  rules: Rule[],
  localCollectionTrees: CollectionTree[],
  requestCollectionTrees: readonly CollectionTree[],
  requests: readonly Request[],
  templateCollectionTrees: readonly CollectionTree[],
  t: Translate,
): string[] {
  if (!tab) return [];

  if (tab.mode === 'settings') return [t('workbench.shell.breadcrumbs.settings')];
  if (tab.mode === 'whats-new') return [t('workbench.shell.breadcrumbs.whatsNew')];

  if (tab.mode === 'workspace-manager') return [t('workbench.shell.breadcrumbs.workspaces')];
  if (tab.mode === 'daemon-admin') return [t('workbench.shell.breadcrumbs.daemonAdmin')];
  if (tab.mode === 'env-edit') return [t('workbench.shell.breadcrumbs.environments'), displayLabel];
  if (tab.mode === 'spec-edit') return [t('workbench.shell.breadcrumbs.specs'), displayLabel];
  if (tab.mode === 'workspace-vars') return [t('workbench.shell.breadcrumbs.workspaceVariables')];
  if (tab.mode === 'vault') return [t('workbench.shell.breadcrumbs.vault')];
  if (tab.mode === 'script-packages') return [t('workbench.shell.breadcrumbs.packageLibrary')];
  if (tab.mode === 'collection-vars') {
    const col = tab.collectionUid ? localCollectionTrees.find((c) => c.uid === tab.collectionUid) : null;
    return col
      ? [t('workbench.shell.breadcrumbs.rules'), col.name, t('workbench.shell.breadcrumbs.variables')]
      : [t('workbench.shell.breadcrumbs.variables')];
  }
  if (tab.mode === 'request-collection-vars') {
    const col = tab.collectionUid ? requestCollectionTrees.find((c) => c.uid === tab.collectionUid) : null;
    return col
      ? [t('workbench.shell.breadcrumbs.requests'), col.name, t('workbench.shell.breadcrumbs.variables')]
      : [t('workbench.shell.breadcrumbs.variables')];
  }
  if (tab.mode === 'template-collection-vars') {
    const col = tab.collectionUid ? templateCollectionTrees.find((c) => c.uid === tab.collectionUid) : null;
    return col
      ? [t('workbench.shell.breadcrumbs.templates'), col.name, t('workbench.shell.breadcrumbs.variables')]
      : [t('workbench.shell.breadcrumbs.variables')];
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
        if (findRequest(col.tree)) {
          return [t('workbench.shell.breadcrumbs.apiRequests'), col.name, ...trail, displayLabel];
        }
      }
    }
    return [t('workbench.shell.breadcrumbs.apiRequests'), displayLabel];
  }
  if (tab.mode === 'response-example') {
    // Frozen example under a request — extend the parent request's
    // trail with the example's own label.
    if (tab.requestUid) {
      const req = requests.find((r) => r.uid === tab.requestUid);
      if (req) {
        const hit = computeRequestTrail(req.uid, requestCollectionTrees);
        if (hit) {
          return [
            t('workbench.shell.breadcrumbs.apiRequests'),
            hit.collectionName,
            ...hit.folderTrail,
            req.name,
            displayLabel,
          ];
        }
        return [t('workbench.shell.breadcrumbs.apiRequests'), req.name, displayLabel];
      }
    }
    return [t('workbench.shell.breadcrumbs.apiRequests'), displayLabel];
  }
  if (tab.mode === 'request-create') {
    const colId = tab.preferredCollectionId;
    const col = colId ? requestCollectionTrees.find((c) => c.uid === colId) : null;
    const folderTrail = tab.preferredFolderPath
      ? tab.preferredFolderPath.split('/').filter((seg) => seg.length > 0)
      : [];
    if (col) return [t('workbench.shell.breadcrumbs.apiRequests'), col.name, ...folderTrail, displayLabel];
    return [t('workbench.shell.breadcrumbs.apiRequests'), displayLabel];
  }
  if (tab.mode === 'rule-create') {
    const colId = tab.preferredCollectionId;
    const col = colId ? localCollectionTrees.find((c) => c.uid === colId) : null;
    const folderTrail = tab.preferredFolderPath
      ? tab.preferredFolderPath.split('/').filter((seg) => seg.length > 0)
      : [];
    if (col) return [t('workbench.shell.breadcrumbs.rules'), col.name, ...folderTrail, displayLabel];
    return [t('workbench.shell.breadcrumbs.rules'), displayLabel];
  }

  if (tab.mode === 'live-workflow-edit') return [t('workbench.shell.breadcrumbs.workflows'), displayLabel];
  if (tab.mode === 'live-workflow-create') return [t('workbench.shell.breadcrumbs.workflows'), displayLabel];
  if (tab.mode === 'live-variable-edit') return [t('workbench.shell.breadcrumbs.liveVariables'), displayLabel];
  if (tab.mode === 'live-variable-create') return [t('workbench.shell.breadcrumbs.liveVariables'), displayLabel];
  if (tab.mode === 'live-vars') return [t('workbench.shell.breadcrumbs.liveVariables')];

  if (tab.mode === 'collection-overview') {
    // Family-disambiguate by entity uid — collection-overview is a
    // single tab mode shared by rule / request / template collection
    // openers. Pre-session-50 the breadcrumb hard-coded "Rules" which
    // misled users on a request- or template-collection overview tab.
    const uid = tab.entityId;
    if (uid) {
      if (requestCollectionTrees.some((c) => c.uid === uid)) {
        return [t('workbench.shell.breadcrumbs.apiRequests'), displayLabel];
      }
      if (templateCollectionTrees.some((c) => c.uid === uid)) {
        return [t('workbench.shell.breadcrumbs.templates'), displayLabel];
      }
    }
    return [t('workbench.shell.breadcrumbs.rules'), displayLabel];
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
    if (ruleHit)
      return [t('workbench.shell.breadcrumbs.rules'), ruleHit.collectionName, ...ruleHit.trail, displayLabel];
    const requestHit = findIn(requestCollectionTrees);
    if (requestHit) {
      return [
        t('workbench.shell.breadcrumbs.apiRequests'),
        requestHit.collectionName,
        ...requestHit.trail,
        displayLabel,
      ];
    }
    const templateHit = findIn(templateCollectionTrees);
    if (templateHit) {
      return [
        t('workbench.shell.breadcrumbs.templates'),
        templateHit.collectionName,
        ...templateHit.trail,
        displayLabel,
      ];
    }
    return [t('workbench.shell.breadcrumbs.rules'), displayLabel];
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
        if (findRule(col.tree)) return [t('workbench.shell.breadcrumbs.rules'), col.name, ...trail, displayLabel];
      }
    }
    return [t('workbench.shell.breadcrumbs.rules'), displayLabel];
  }

  return [t('workbench.shell.breadcrumbs.rules'), displayLabel];
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
