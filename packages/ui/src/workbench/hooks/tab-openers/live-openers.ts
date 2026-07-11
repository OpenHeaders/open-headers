/**
 * Live-family tab openers — the Live Variables list page, variable /
 * workflow edit tabs, and their unsaved-draft create paths.
 */

import { useCallback } from 'react';
import type { WorkflowSeedStep } from '../../types';
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
    (uid: string, name: string, seedSteps?: WorkflowSeedStep[]) => {
      const id = `live-wf-${uid}`;
      if (allTabs.some((t) => t.id === id)) {
        switchTab(id);
        return;
      }
      addTab({
        id,
        label: name,
        ruleType: '',
        dirty: seedSteps !== undefined && seedSteps.length > 0,
        mode: 'live-workflow-edit',
        liveWorkflowUid: uid,
        liveWorkflowSeedSteps: seedSteps,
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
    (context?: { seedSteps?: WorkflowSeedStep[]; name?: string }) => {
      // Pick a unique draft name so multiple "New Workflow" drafts can
      // coexist. Name drafts with a leading base + (2)/(3)/… suffix —
      // same approach as `openCreateRequestTab`. Seeding surfaces may
      // pre-name the draft after the source container. Only workflow
      // tabs count as collisions: a container-named seed must not get
      // suffixed just because that container's own overview tab is open.
      const baseName = context?.name?.trim() || 'New Workflow';
      const existingNames = new Set<string>();
      for (const tab of allTabs) {
        if (tab.mode === 'live-workflow-create' || tab.mode === 'live-workflow-edit') existingNames.add(tab.label);
      }
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
        liveWorkflowSeedSteps: context?.seedSteps,
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
