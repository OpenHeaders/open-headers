/**
 * useTabSyncEffects — keeps open tabs in sync with the underlying
 * entities they reference.
 *
 *   - **Display label** is NOT mirrored here. Tab labels are derived at
 *     render time via `tabDisplayLabel(tab, lookups)` in `tab-display.ts`.
 *     `tab.label` lives on the struct only as the seed value set at
 *     open time + a fallback for the brief race window before the
 *     entity cache catches up. SoC: tab struct = identity + mode +
 *     entity reference; label = projection.
 *
 *   - **Rule type** (the `ruleType` discriminator on edit tabs) IS
 *     mirrored: it drives the type-specific tab icon and the rule-type
 *     menu. Unlike a name, a rule's type is bounded enum and rarely
 *     changes — the mirror is cheap and decoupling it from the icon
 *     pipeline would be more code than value.
 *
 *   - **Request method** is mirrored for the same reason — the method
 *     tag in the tab strip needs the live value, and the icon pipeline
 *     reads `tab.ruleType` to render it.
 *
 *   - **Deletion cleanup** — when an entity disappears between two
 *     snapshots, force-close every tab whose backing id was present
 *     last render and is absent now. The check is a TRANSITION (prev
 *     had it, current doesn't), not a snapshot absence: entity-list
 *     caches are briefly stale after a creation, and closing a tab for
 *     an entity-that-was-just-created-but-not-yet-reloaded would be a
 *     data-destroying user-facing bug. Transition-based close only
 *     fires for actual disappearances.
 */

import type { CollectionTree, Environment, LiveVariable, LiveWorkflow, Request, Rule, Template, TreeNode } from '@openheaders/core/types';
import { useEffect, useRef } from 'react';
import type { WorkbenchTab } from '../types';

interface UseTabSyncEffectsOptions {
  rules: Rule[];
  localCollectionTrees: CollectionTree[];
  environments: Environment[];
  requests: Request[];
  requestCollectionTrees: CollectionTree[];
  templates: Template[];
  templateCollectionTrees: CollectionTree[];
  liveVariables: LiveVariable[];
  liveWorkflows: LiveWorkflow[];
  allTabs: WorkbenchTab[];
  updateTab: (tabId: string, updates: Partial<WorkbenchTab>) => void;
  closeTab: (tabId: string, force?: boolean) => void;
}

export function useTabSyncEffects({
  rules,
  localCollectionTrees,
  environments,
  requests,
  requestCollectionTrees,
  templates,
  templateCollectionTrees,
  liveVariables,
  liveWorkflows,
  allTabs,
  updateTab,
  closeTab,
}: UseTabSyncEffectsOptions): void {
  // Type/method mirror — narrow projection: only the icon-driving
  // discriminators ride here. The display label derives at render time
  // (see file header).
  useEffect(() => {
    for (const tab of allTabs) {
      if (tab.mode === 'edit' && tab.ruleUid) {
        const rule = rules.find((r) => r.uid === tab.ruleUid);
        if (rule && rule.type !== tab.ruleType) updateTab(tab.id, { ruleType: rule.type });
      } else if (tab.mode === 'request-edit' && tab.requestUid) {
        const req = requests.find((r) => r.uid === tab.requestUid);
        if (req && req.method !== tab.ruleType) updateTab(tab.id, { ruleType: req.method });
      }
    }
  }, [rules, requests, allTabs, updateTab]);

  // Close tabs whose backing entity was deleted.
  const prevEntityIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set<string>();
    for (const r of rules) currentIds.add(r.uid);
    for (const col of localCollectionTrees) {
      currentIds.add(col.uid);
      const walk = (nodes: TreeNode[]) => {
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
      const walk = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          currentIds.add(n.uid);
          if (n.type === 'folder') walk(n.children);
        }
      };
      walk(col.tree);
    }
    for (const tpl of templates) currentIds.add(tpl.uid);
    for (const col of templateCollectionTrees) {
      currentIds.add(col.uid);
      const walk = (nodes: TreeNode[]) => {
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
    templates,
    templateCollectionTrees,
    liveVariables,
    liveWorkflows,
    allTabs,
    closeTab,
  ]);
}
