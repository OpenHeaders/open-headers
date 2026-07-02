/**
 * Live-family tab openers — the Live Variables list page, variable /
 * workflow edit tabs, and their unsaved-draft create paths.
 */

import { useCallback } from 'react';
import type { TabOpenerContext, UseTabOpenersApi } from './shared';

export type LiveOpeners = Pick<
  UseTabOpenersApi,
  | 'openLiveVariables'
  | 'openLiveVariableEdit'
  | 'openLiveWorkflowEdit'
  | 'openCreateLiveVariable'
  | 'openCreateLiveWorkflow'
>;

export function useLiveOpeners({ allTabs, addTab, switchTab, setPendingRenameTabId }: TabOpenerContext): LiveOpeners {
  const openLiveVariables = useCallback(() => {
    const id = 'live-vars';
    if (allTabs.some((t) => t.id === id)) {
      switchTab(id);
      return;
    }
    addTab({
      id,
      label: 'Live Variables',
      ruleType: '',
      dirty: false,
      mode: 'live-vars',
    });
  }, [allTabs, addTab, switchTab]);

  const openLiveVariableEdit = useCallback(
    (uid: string, name: string) => {
      const id = `live-var-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'live-variable-edit',
        liveVariableUid: uid,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openLiveWorkflowEdit = useCallback(
    (uid: string, name: string, seedStep?: { requestUid: string; requestName: string; method: string }) => {
      const id = `live-wf-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: seedStep !== undefined,
        mode: 'live-workflow-edit',
        liveWorkflowUid: uid,
        liveWorkflowSeedStep: seedStep,
      });
    },
    [allTabs, addTab, switchTab],
  );

  const openCreateLiveVariable = useCallback(() => {
    // Draft ids are timestamp-keyed so multiple new-LV tabs can
    // coexist — same pattern as `openCreateRequestTab`.
    const tabId = `live-var-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addTab({
      id: tabId,
      label: 'New Live Variable',
      ruleType: '',
      dirty: true,
      mode: 'live-variable-create',
    });
    setPendingRenameTabId(tabId);
  }, [addTab, setPendingRenameTabId]);

  const openCreateLiveWorkflow = useCallback(
    (context?: { seedStep?: { requestUid: string; requestName: string; method: string } }) => {
      // Pick a unique draft name so multiple "New Workflow" drafts can
      // coexist. Name drafts with a leading base + (2)/(3)/… suffix —
      // same approach as `openCreateRequestTab`.
      const baseName = 'New Workflow';
      const existingNames = new Set<string>();
      for (const tab of allTabs) existingNames.add(tab.label);
      let draftName = baseName;
      let counter = 2;
      while (existingNames.has(draftName)) {
        draftName = `${baseName} (${counter++})`;
      }

      const tabId = `live-wf-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addTab({
        id: tabId,
        label: draftName,
        ruleType: '',
        dirty: true,
        mode: 'live-workflow-create',
        draftName,
        liveWorkflowSeedStep: context?.seedStep,
      });
      setPendingRenameTabId(tabId);
    },
    [allTabs, addTab, setPendingRenameTabId],
  );

  return {
    openLiveVariables,
    openLiveVariableEdit,
    openLiveWorkflowEdit,
    openCreateLiveVariable,
    openCreateLiveWorkflow,
  };
}
