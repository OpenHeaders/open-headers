/**
 * useTabSyncEffects — keeps open tabs in sync with the underlying
 * entities they reference. Two effects:
 *
 *   1) Label/type mirroring — when a rule or template is renamed or
 *      retyped, update the corresponding tab's displayed label/type.
 *
 *   2) Deletion cleanup — when a rule, collection, or folder disappears
 *      from the current snapshot, force-close every tab whose backing
 *      id is no longer present. A seeded `prevEntityIds` ref makes the
 *      very first render a no-op so we don't mass-close tabs on mount.
 */

import type { V5 } from '@openheaders/core/types';
import { useEffect, useRef } from 'react';
import type { RulesTab } from '../types';

interface UseTabSyncEffectsOptions {
  rules: V5.Rule[];
  templates: V5.Template[];
  localCollectionTrees: V5.CollectionTree[];
  environments: V5.Environment[];
  requests: V5.Request[];
  requestCollectionTrees: V5.CollectionTree[];
  allTabs: RulesTab[];
  updateTab: (tabId: string, updates: Partial<RulesTab>) => void;
  closeTab: (tabId: string, force?: boolean) => void;
}

export function useTabSyncEffects({
  rules,
  templates,
  localCollectionTrees,
  environments,
  requests,
  requestCollectionTrees,
  allTabs,
  updateTab,
  closeTab,
}: UseTabSyncEffectsOptions): void {
  // Label/type mirror.
  useEffect(() => {
    for (const tab of allTabs) {
      if (tab.mode === 'edit' && tab.ruleUid) {
        const rule = rules.find((r) => r.uid === tab.ruleUid);
        if (rule && rule.name !== tab.label) updateTab(tab.id, { label: rule.name, ruleType: rule.type });
      } else if (tab.mode === 'template-edit' && tab.templateUid) {
        const tpl = templates.find((t) => t.uid === tab.templateUid);
        if (tpl && tpl.name !== tab.label) updateTab(tab.id, { label: tpl.name });
      } else if (tab.mode === 'env-edit' && tab.environmentUid) {
        const env = environments.find((e) => e.uid === tab.environmentUid);
        if (env && env.name !== tab.label) updateTab(tab.id, { label: env.name });
      } else if (tab.mode === 'request-edit' && tab.requestUid) {
        const req = requests.find((r) => r.uid === tab.requestUid);
        if (req && (req.name !== tab.label || req.method !== tab.ruleType)) {
          updateTab(tab.id, { label: req.name, ruleType: req.method });
        }
      }
    }
  }, [rules, templates, environments, requests, allTabs, updateTab]);

  // Close tabs whose backing entity was deleted.
  const prevEntityIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set<string>();
    for (const r of rules) currentIds.add(r.uid);
    for (const col of localCollectionTrees) {
      currentIds.add(col.uid);
      const walk = (nodes: V5.TreeNode[]) => {
        for (const n of nodes) {
          currentIds.add(n.uid);
          if (n.type === 'folder') walk(n.children);
        }
      };
      walk(col.tree);
    }
    for (const env of environments) currentIds.add(env.uid);
    for (const req of requests) currentIds.add(req.uid);
    for (const col of requestCollectionTrees) {
      currentIds.add(col.uid);
      const walk = (nodes: V5.TreeNode[]) => {
        for (const n of nodes) {
          currentIds.add(n.uid);
          if (n.type === 'folder') walk(n.children);
        }
      };
      walk(col.tree);
    }

    if (prevEntityIds.current.size > 0) {
      for (const tab of allTabs) {
        // Collection-vars tabs key off `collectionUid`, env-edit tabs
        // off `environmentUid`, request-edit off `requestUid` — the
        // generic `ruleUid ?? entityId` fallback doesn't cover these.
        const entityId = tab.ruleUid ?? tab.entityId ?? tab.collectionUid ?? tab.environmentUid ?? tab.requestUid;
        if (entityId && !currentIds.has(entityId)) closeTab(tab.id, true);
      }
    }

    prevEntityIds.current = currentIds;
  }, [rules, localCollectionTrees, environments, requests, requestCollectionTrees, allTabs, closeTab]);
}
