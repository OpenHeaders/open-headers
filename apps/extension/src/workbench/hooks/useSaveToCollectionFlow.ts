/**
 * useSaveToCollectionFlow — save-draft state machine.
 *
 * Every rule-creation tab opens as `mode: 'create'` (an unsaved draft).
 * On Save the tab hands its form values here:
 *
 *   - If the tab was opened *with* a preferred collection/folder (e.g.
 *     the user clicked "Add Rule" inside a specific folder in the
 *     sidebar) we persist directly there — the user already answered
 *     "where" by choosing the contextual affordance.
 *   - Otherwise we open `SaveToCollectionModal` and let the user pick.
 *
 * Either way, on successful persist we replace the draft tab with a
 * fresh `edit` tab that points at the newly-persisted uid, so the
 * user's state after Save is identical to "open an existing rule".
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useState } from 'react';
import type { WorkbenchTab } from '../types';

interface UseSaveToCollectionFlowOptions {
  allTabs: WorkbenchTab[];
  createLocalRule: (
    rule: Omit<V5.Rule, 'uid' | 'path'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<V5.Rule | null>;
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void;
}

export interface SaveToCollectionFlowApi {
  saveModalOpen: boolean;
  saveModalEntityName: string;
  handleSaveDraft: (tabId: string, draftData: Record<string, unknown>) => void;
  handleSaveModalConfirm: (params: { name: string; collectionId: string; folderPath?: string }) => Promise<void>;
  closeSaveModal: () => void;
}

/** Swap the draft tab for its post-save `edit` counterpart. */
function buildEditTab(
  oldTabId: string,
  created: V5.Rule,
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void,
): void {
  const editId = `edit-${created.uid}`;
  replaceTab(oldTabId, {
    id: editId,
    label: created.name,
    ruleType: created.type,
    dirty: false,
    mode: 'edit',
    ruleUid: created.uid,
  });
}

export function useSaveToCollectionFlow({
  allTabs,
  createLocalRule,
  replaceTab,
}: UseSaveToCollectionFlowOptions): SaveToCollectionFlowApi {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalTabId, setSaveModalTabId] = useState<string | null>(null);
  const [saveModalDraftData, setSaveModalDraftData] = useState<Record<string, unknown> | null>(null);
  const [saveModalEntityName, setSaveModalEntityName] = useState('');

  const handleSaveDraft = useCallback(
    (tabId: string, draftData: Record<string, unknown>) => {
      const tab = allTabs.find((t) => t.id === tabId);
      if (!tab) return;
      const name = (draftData.name as string) || tab.label;

      // Fast path: tab carries an explicit destination → skip the modal
      // and persist directly. This preserves the "Add Rule inside X"
      // UX where the user already chose the location.
      if (tab.preferredCollectionId) {
        const rule = { ...draftData, name } as Omit<V5.Rule, 'uid' | 'path'>;
        void createLocalRule(rule, tab.preferredCollectionId, tab.preferredFolderPath).then((created) => {
          if (created) buildEditTab(tabId, created, replaceTab);
        });
        return;
      }

      // Slow path: user opened the draft without a destination (inspector
      // handoff, top-level "New Rule" button). Ask them where to save.
      setSaveModalTabId(tabId);
      setSaveModalDraftData(draftData);
      setSaveModalEntityName(name);
      setSaveModalOpen(true);
    },
    [allTabs, createLocalRule, replaceTab],
  );

  const handleSaveModalConfirm = useCallback(
    async (params: { name: string; collectionId: string; folderPath?: string }) => {
      if (!saveModalTabId || !saveModalDraftData) return;
      const rule = { ...saveModalDraftData, name: params.name } as Omit<V5.Rule, 'uid' | 'path'>;
      const created = await createLocalRule(rule, params.collectionId, params.folderPath);
      if (created) buildEditTab(saveModalTabId, created, replaceTab);
      setSaveModalOpen(false);
      setSaveModalTabId(null);
      setSaveModalDraftData(null);
    },
    [saveModalTabId, saveModalDraftData, createLocalRule, replaceTab],
  );

  const closeSaveModal = useCallback(() => setSaveModalOpen(false), []);

  return {
    saveModalOpen,
    saveModalEntityName,
    handleSaveDraft,
    handleSaveModalConfirm,
    closeSaveModal,
  };
}
