/**
 * useTabOpeners — factory for every "open a tab" entry point consumed
 * by App.tsx. Centralizes the create/edit/overview/template/run/flow
 * tab construction so App.tsx stops carrying ~300 LOC of imperative
 * handlers that only exist to route a click into the correct WorkbenchTab
 * shape.
 *
 * Also owns `pendingRenameTabId` — the "just created, focus the
 * breadcrumb for rename" hint — because every creation path that needs
 * it lives in here.
 *
 * The openers themselves live in `tab-openers/`, one module per entity
 * family (rule / request / template / live / workspace); this hook
 * composes them over a shared `TabOpenerContext` and returns the merged
 * API surface declared in `tab-openers/shared.ts`.
 */

import type { Collection, Rule, Template } from '@openheaders/core/types';
import { useState } from 'react';
import type { ClosedTab, WorkbenchTab } from '../types';
import { useLiveOpeners } from './tab-openers/live-openers';
import { useRequestOpeners } from './tab-openers/request-openers';
import { useRuleOpeners } from './tab-openers/rule-openers';
import type { TabOpenerContext, UseTabOpenersApi } from './tab-openers/shared';
import { useTemplateOpeners } from './tab-openers/template-openers';
import { useWorkspaceOpeners } from './tab-openers/workspace-openers';

export { getRuleTypeLabel } from './tab-openers/shared';
export type { UseTabOpenersApi } from './tab-openers/shared';

interface UseTabOpenersOptions {
  rules: Rule[];
  templates: Template[];
  /** Local rule collections — used to resolve the parent path when a
   *  create gesture didn't pin one explicitly. */
  localCollections: Collection[];
  /** Request collections — used to resolve the parent path for
   *  request context-create gestures. */
  requestCollections: Collection[];
  /** Active workspace id — required for renderer-direct rule create. */
  workspaceId: string | null;
  /** Surface attribution carried on every emitted envelope (always
   *  `'workbench'` for this hook; threaded so tests can override). */
  surfaceId: string;
  allTabs: WorkbenchTab[];
  addTab: (tab: WorkbenchTab) => void;
  switchTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<WorkbenchTab>) => void;
  reopenTab?: (closed: ClosedTab) => void;
}

export function useTabOpeners({
  rules,
  templates,
  localCollections,
  requestCollections,
  workspaceId,
  surfaceId,
  allTabs,
  addTab,
  switchTab,
  updateTab,
}: UseTabOpenersOptions): UseTabOpenersApi {
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);
  const context: TabOpenerContext = { allTabs, addTab, switchTab, updateTab, setPendingRenameTabId };

  const ruleOpeners = useRuleOpeners({ rules, localCollections, workspaceId, surfaceId }, context);
  const requestOpeners = useRequestOpeners({ requestCollections, workspaceId, surfaceId }, context);
  const templateOpeners = useTemplateOpeners({ templates }, context);
  const liveOpeners = useLiveOpeners(context);
  const workspaceOpeners = useWorkspaceOpeners(context);

  return {
    pendingRenameTabId,
    setPendingRenameTabId,
    ...ruleOpeners,
    ...requestOpeners,
    ...templateOpeners,
    ...liveOpeners,
    ...workspaceOpeners,
  };
}
