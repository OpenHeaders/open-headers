/**
 * useSaveRuleFlow — save-draft state machine for rule drafts.
 *
 * Mirrors `useSaveRequestFlow`. Every `rule-create` tab opens as an
 * unsaved draft; on Save the editor hands its form values here, which
 * either persists directly to a preferred destination or opens
 * `SaveToCollectionModal` for the user to pick one. Either way the
 * draft tab is replaced with a fresh `edit` tab so the post-save state
 * matches "opened an existing rule".
 */

import type { Collection, Rule } from '@openheaders/core/types';
import {
  applyRuleCreate,
  applyRulePublish,
  type RuleMutationResult,
} from '@openheaders/ui/shared/sync/rule-write-client';
import { useCallback, useState } from 'react';
import type { WorkbenchTab } from '../types';

interface UseSaveRuleFlowOptions {
  allTabs: WorkbenchTab[];
  workspaceId: string | null;
  surfaceId: string;
  /** Local rule collections — used for fast-path collectionId → path
   *  resolution when the draft tab pinned a preferred destination. */
  localCollections: Collection[];
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void;
}

export interface SaveRuleFlowApi {
  saveModalOpen: boolean;
  saveModalEntityName: string;
  handleSaveDraft: (tabId: string, draftData: RuleDraftData) => void;
  handleSaveModalConfirm: (params: { name: string; collectionId: string; folderPath?: string }) => Promise<void>;
  closeSaveModal: () => void;
}

/**
 * Shape the RuleEditor (in `rule-create` mode) hands to
 * `handleSaveDraft`. Mirrors `RuleSeed` (Omit uid/path/schemaVersion)
 * with name surfaced separately so the modal can prefill the naming
 * input.
 */
export type RuleDraftData = Omit<Rule, 'uid' | 'path' | 'schemaVersion' | 'published'>;

function buildEditTab(
  oldTabId: string,
  created: Rule,
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

async function persist(
  tabId: string,
  draft: RuleDraftData,
  parentPath: string,
  workspaceId: string,
  surfaceId: string,
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void,
): Promise<RuleMutationResult> {
  const result = await applyRuleCreate(
    { rule: draft as Omit<Rule, 'uid' | 'path' | 'schemaVersion'>, parentPath },
    { workspaceId, surfaceId },
  );
  if (result.ok) {
    // Scratch Save is the user's "ship it" gesture — crossing the
    // publication gate is part of the gesture, not a separate step.
    // (Edit-mode Save in `RuleEditor` already does both update + publish;
    // this brings the create flow into parity.)
    await applyRulePublish(result.rule.uid, { workspaceId, surfaceId });
    buildEditTab(tabId, result.rule, replaceTab);
  }
  return result;
}

export function useSaveRuleFlow({
  allTabs,
  workspaceId,
  surfaceId,
  localCollections,
  replaceTab,
}: UseSaveRuleFlowOptions): SaveRuleFlowApi {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalTabId, setSaveModalTabId] = useState<string | null>(null);
  const [saveModalDraftData, setSaveModalDraftData] = useState<RuleDraftData | null>(null);
  const [saveModalEntityName, setSaveModalEntityName] = useState('');

  const handleSaveDraft = useCallback(
    (tabId: string, draftData: RuleDraftData) => {
      const tab = allTabs.find((t) => t.id === tabId);
      if (!tab || !workspaceId) return;
      const name = draftData.name || tab.label;

      // Fast path: tab pinned a preferred destination.
      const preferredCollection = tab.preferredCollectionId
        ? localCollections.find((c) => c.uid === tab.preferredCollectionId)
        : null;
      const fastParentPath = tab.preferredFolderPath ?? preferredCollection?.path;
      if (fastParentPath) {
        void persist(tabId, { ...draftData, name }, fastParentPath, workspaceId, surfaceId, replaceTab);
        return;
      }

      // Slow path: ask the user to pick a destination.
      setSaveModalTabId(tabId);
      setSaveModalDraftData(draftData);
      setSaveModalEntityName(name);
      setSaveModalOpen(true);
    },
    [allTabs, workspaceId, surfaceId, localCollections, replaceTab],
  );

  const handleSaveModalConfirm = useCallback(
    async (params: { name: string; collectionId: string; folderPath?: string }) => {
      if (!saveModalTabId || !saveModalDraftData || !workspaceId) return;
      const collection = localCollections.find((c) => c.uid === params.collectionId);
      const parentPath = params.folderPath ?? collection?.path;
      if (!parentPath) return;
      await persist(
        saveModalTabId,
        { ...saveModalDraftData, name: params.name },
        parentPath,
        workspaceId,
        surfaceId,
        replaceTab,
      );
      setSaveModalOpen(false);
      setSaveModalTabId(null);
      setSaveModalDraftData(null);
    },
    [saveModalTabId, saveModalDraftData, workspaceId, surfaceId, localCollections, replaceTab],
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
