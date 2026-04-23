/**
 * useTabSyncEffects — keeps open tabs in sync with the underlying
 * entities they reference. Two effects:
 *
 *   1) Label/type mirroring — when a rule or template is renamed or
 *      retyped, update the corresponding tab's displayed label/type.
 *
 *   2) Deletion cleanup — when a rule, collection, folder, request,
 *      etc. disappears between two snapshots, force-close every tab
 *      whose backing id was present last render and is absent now.
 *      The check is a TRANSITION (prev had it, current doesn't), not a
 *      snapshot absence, because entity-list caches are briefly stale
 *      after a creation in another code path: a just-created entity's
 *      uid is in a tab (via replaceTab's draft→edit swap) but may not
 *      yet be in the cache that this hook subscribes to, and closing a
 *      tab for an entity-that-was-just-created-but-not-yet-reloaded
 *      would be a data-destroying user-facing bug. Transition-based
 *      close only fires for actual disappearances.
 */

import type { V5 } from '@openheaders/core/types';
import { useEffect, useRef } from 'react';
import type { WorkbenchTab } from '../types';

interface UseTabSyncEffectsOptions {
  rules: V5.Rule[];
  templates: V5.Template[];
  localCollectionTrees: V5.CollectionTree[];
  environments: V5.Environment[];
  requests: V5.Request[];
  requestCollectionTrees: V5.CollectionTree[];
  liveVariables: V5.LiveVariable[];
  liveWorkflows: V5.LiveWorkflow[];
  allTabs: WorkbenchTab[];
  updateTab: (tabId: string, updates: Partial<WorkbenchTab>) => void;
  closeTab: (tabId: string, force?: boolean) => void;
}

export function useTabSyncEffects({
  rules,
  templates,
  localCollectionTrees,
  environments,
  requests,
  requestCollectionTrees,
  liveVariables,
  liveWorkflows,
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
      } else if (tab.mode === 'live-variable-edit' && tab.liveVariableUid) {
        const lv = liveVariables.find((v) => v.uid === tab.liveVariableUid);
        if (lv && lv.name !== tab.label) updateTab(tab.id, { label: lv.name });
      } else if (tab.mode === 'live-workflow-edit' && tab.liveWorkflowUid) {
        const wf = liveWorkflows.find((w) => w.uid === tab.liveWorkflowUid);
        const expected = wf ? wf.name : null;
        if (expected && expected !== tab.label) updateTab(tab.id, { label: expected });
      }
    }
  }, [rules, templates, environments, requests, liveVariables, liveWorkflows, allTabs, updateTab]);

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
    for (const lv of liveVariables) currentIds.add(lv.uid);
    for (const wf of liveWorkflows) currentIds.add(wf.uid);

    if (prevEntityIds.current.size > 0) {
      for (const tab of allTabs) {
        // Collection-vars tabs key off `collectionUid`, env-edit tabs
        // off `environmentUid`, request-edit off `requestUid`, live-*
        // tabs off `liveVariableUid` / `liveWorkflowUid` — the generic
        // `ruleUid ?? entityId` fallback doesn't cover these.
        const entityId =
          tab.ruleUid ??
          tab.entityId ??
          tab.collectionUid ??
          tab.environmentUid ??
          tab.requestUid ??
          tab.liveVariableUid ??
          tab.liveWorkflowUid;
        // Transition check: only close when we saw the entity before
        // AND it's gone now. See the hook docstring for why plain
        // absence (`!currentIds.has(entityId)`) is wrong — it races
        // with creations whose broadcast-driven reload hasn't landed.
        if (entityId && prevEntityIds.current.has(entityId) && !currentIds.has(entityId)) {
          closeTab(tab.id, true);
        }
      }
    }

    prevEntityIds.current = currentIds;
  }, [
    rules,
    localCollectionTrees,
    environments,
    requests,
    requestCollectionTrees,
    liveVariables,
    liveWorkflows,
    allTabs,
    closeTab,
  ]);
}
