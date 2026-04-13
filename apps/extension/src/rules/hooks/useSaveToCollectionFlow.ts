/**
 * useSaveToCollectionFlow — state machine for the "save draft →
 * SaveToCollectionModal → persist as edit tab" round-trip.
 *
 * The modal is surfaced by RuleEditor when a create-mode tab first tries
 * to save; the user picks a collection/folder and confirms. On confirm
 * we write the rule via the provided `createLocalRule` and replace the
 * draft tab with a fresh edit tab that points at the persisted uid.
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useState } from 'react';
import type { RulesTab } from '../types';

interface UseSaveToCollectionFlowOptions {
  allTabs: RulesTab[];
  createLocalRule: (
    rule: Omit<V5.Rule, 'uid' | 'path'>,
    collectionUid?: string,
    parentPath?: string,
  ) => Promise<V5.Rule | null>;
  replaceTab: (oldId: string, newTab: RulesTab) => void;
}

export interface SaveToCollectionFlowApi {
  saveModalOpen: boolean;
  saveModalEntityName: string;
  handleSaveDraft: (tabId: string, draftData: Record<string, unknown>) => void;
  handleSaveModalConfirm: (params: { name: string; collectionId: string; folderPath?: string }) => Promise<void>;
  closeSaveModal: () => void;
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
      setSaveModalTabId(tabId);
      setSaveModalDraftData(draftData);
      setSaveModalEntityName((draftData.name as string) || tab.label);
      setSaveModalOpen(true);
    },
    [allTabs],
  );

  const handleSaveModalConfirm = useCallback(
    async (params: { name: string; collectionId: string; folderPath?: string }) => {
      if (!saveModalTabId || !saveModalDraftData) return;
      const rule = { ...saveModalDraftData, name: params.name } as Omit<V5.Rule, 'uid' | 'path'>;
      const created = await createLocalRule(rule, params.collectionId, params.folderPath);
      if (created) {
        const editId = `edit-${created.uid}`;
        replaceTab(saveModalTabId, {
          id: editId,
          label: created.name,
          ruleType: created.type,
          dirty: false,
          mode: 'edit',
          ruleUid: created.uid,
        });
      }
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
