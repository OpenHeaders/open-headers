/**
 * Resolve which rule / request / template / collection the focused tab
 * is about. Editor tabs carry a concrete entity whose templates the
 * panel walks; the *-collection-vars + overview surfaces carry only a
 * collection uid. The collection lookup walks every family so the
 * resolver's collection scope works regardless of which family the
 * focused entity belongs to.
 */

import type { CollectionTree, Request, Rule, Template, TreeNode } from '@openheaders/core/types';
import { type CollectionFamilies, findCollectionByPath } from '@openheaders/ui/shared/variables';
import type { WorkbenchTab } from '../../../types';
import type { ScopeKind } from './types';

export interface ScopeContext {
  activeRule: Rule | null;
  activeRequest: Request | null;
  activeTemplate: Template | null;
  activeCollectionId: string | null;
}

export interface ScopeContextInput {
  activeTab: WorkbenchTab | null;
  scopeKind: ScopeKind;
  rules: Rule[];
  requests: Request[];
  templates: Template[];
  families: CollectionFamilies;
  localCollectionTrees: readonly CollectionTree[];
  requestCollectionTrees: readonly CollectionTree[];
  templateCollectionTrees: readonly CollectionTree[];
}

export function resolveScopeContext(input: ScopeContextInput): ScopeContext {
  const {
    activeTab,
    scopeKind,
    rules,
    requests,
    templates,
    families,
    localCollectionTrees,
    requestCollectionTrees,
    templateCollectionTrees,
  } = input;

  if (!activeTab) return { activeRule: null, activeRequest: null, activeTemplate: null, activeCollectionId: null };

  let rule: Rule | null = null;
  let request: Request | null = null;
  let template: Template | null = null;
  if (scopeKind === 'rule' && activeTab.ruleUid) {
    rule = rules.find((r) => r.uid === activeTab.ruleUid) ?? null;
  } else if (scopeKind === 'request' && activeTab.requestUid) {
    request = requests.find((r) => r.uid === activeTab.requestUid) ?? null;
  } else if (scopeKind === 'template' && activeTab.templateUid) {
    template = templates.find((t) => t.uid === activeTab.templateUid) ?? null;
  }

  const entityForCollection: Rule | Request | Template | null = rule ?? request ?? template;
  let collId: string | null = null;
  if ((activeTab.mode === 'collection-overview' || activeTab.mode === 'folder-overview') && activeTab.entityId) {
    // Both overview surfaces stash the entity uid in `entityId`. For
    // collection-overview the uid IS a collection uid; for folder-
    // overview it's a folder uid that we resolve through the trees.
    if (activeTab.mode === 'collection-overview') {
      collId = activeTab.entityId;
    } else {
      const folderUid = activeTab.entityId;
      const treeFamilies: ReadonlyArray<readonly CollectionTree[]> = [
        localCollectionTrees,
        requestCollectionTrees,
        templateCollectionTrees,
      ];
      outer: for (const trees of treeFamilies) {
        for (const col of trees) {
          const stack: TreeNode[] = [...col.tree];
          while (stack.length > 0) {
            const node = stack.shift();
            if (!node) break;
            if (node.type === 'folder' && node.uid === folderUid) {
              collId = col.uid;
              break outer;
            }
            if (node.type === 'folder') stack.push(...node.children);
          }
        }
      }
    }
  } else if (
    (activeTab.mode === 'collection-vars' ||
      activeTab.mode === 'request-collection-vars' ||
      activeTab.mode === 'template-collection-vars') &&
    activeTab.collectionUid
  ) {
    collId = activeTab.collectionUid;
  } else if (entityForCollection) {
    collId = findCollectionByPath(entityForCollection.path, families)?.uid ?? null;
  }

  return { activeRule: rule, activeRequest: request, activeTemplate: template, activeCollectionId: collId };
}
