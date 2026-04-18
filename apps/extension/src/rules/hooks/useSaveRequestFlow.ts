/**
 * useSaveRequestFlow — save-draft state machine for request drafts.
 *
 * Mirrors `useSaveToCollectionFlow` (rules). Every request-create tab
 * opens as an unsaved draft; on Save the editor hands its form values
 * here, which either persists directly to a preferred destination or
 * opens `SaveToCollectionModal` for the user to pick one. Either way
 * the draft tab is replaced with a fresh `request-edit` tab so the
 * post-save state matches "opened an existing request".
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useState } from 'react';
import type { RulesTab } from '../types';

interface UseSaveRequestFlowOptions {
  allTabs: RulesTab[];
  createRequest: (input: {
    name: string;
    collectionUid?: string;
    parentPath?: string;
    seed?: Partial<V5.Request>;
  }) => Promise<V5.Request | null>;
  replaceTab: (oldId: string, newTab: RulesTab) => void;
}

export interface SaveRequestFlowApi {
  saveModalOpen: boolean;
  saveModalEntityName: string;
  handleSaveDraft: (tabId: string, draftData: DraftData) => void;
  handleSaveModalConfirm: (params: { name: string; collectionId: string; folderPath?: string }) => Promise<void>;
  closeSaveModal: () => void;
}

/**
 * Shape the RequestEditor hands to `handleSaveDraft`. Mirrors a
 * `Partial<V5.Request>` minus identity fields — name is separate so
 * the modal can prefill the naming input.
 */
export interface DraftData {
  name: string;
  method: V5.HttpMethod;
  url: string;
  headers: V5.RequestHeader[];
  params: V5.QueryParam[];
  auth: V5.AuthConfig;
  body: V5.RequestBody;
}

function buildEditTab(
  oldTabId: string,
  created: V5.Request,
  replaceTab: (oldId: string, newTab: RulesTab) => void,
): void {
  const editId = `request-${created.uid}`;
  replaceTab(oldTabId, {
    id: editId,
    label: created.name,
    ruleType: created.method,
    dirty: false,
    mode: 'request-edit',
    requestUid: created.uid,
  });
}

export function useSaveRequestFlow({
  allTabs,
  createRequest,
  replaceTab,
}: UseSaveRequestFlowOptions): SaveRequestFlowApi {
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalTabId, setSaveModalTabId] = useState<string | null>(null);
  const [saveModalDraftData, setSaveModalDraftData] = useState<DraftData | null>(null);
  const [saveModalEntityName, setSaveModalEntityName] = useState('');

  const handleSaveDraft = useCallback(
    (tabId: string, draftData: DraftData) => {
      const tab = allTabs.find((t) => t.id === tabId);
      if (!tab) return;
      const name = draftData.name || tab.label;

      // Fast path: the tab knows where it wants to live.
      if (tab.preferredCollectionId) {
        void createRequest({
          name,
          collectionUid: tab.preferredCollectionId,
          parentPath: tab.preferredFolderPath,
          seed: {
            method: draftData.method,
            url: draftData.url,
            headers: draftData.headers,
            params: draftData.params,
            auth: draftData.auth,
            body: draftData.body,
          },
        }).then((created) => {
          if (created) buildEditTab(tabId, created, replaceTab);
        });
        return;
      }

      // Slow path: ask the user to pick a destination.
      setSaveModalTabId(tabId);
      setSaveModalDraftData(draftData);
      setSaveModalEntityName(name);
      setSaveModalOpen(true);
    },
    [allTabs, createRequest, replaceTab],
  );

  const handleSaveModalConfirm = useCallback(
    async (params: { name: string; collectionId: string; folderPath?: string }) => {
      if (!saveModalTabId || !saveModalDraftData) return;
      const created = await createRequest({
        name: params.name,
        collectionUid: params.collectionId,
        parentPath: params.folderPath,
        seed: {
          method: saveModalDraftData.method,
          url: saveModalDraftData.url,
          headers: saveModalDraftData.headers,
          params: saveModalDraftData.params,
          auth: saveModalDraftData.auth,
          body: saveModalDraftData.body,
        },
      });
      if (created) buildEditTab(saveModalTabId, created, replaceTab);
      setSaveModalOpen(false);
      setSaveModalTabId(null);
      setSaveModalDraftData(null);
    },
    [saveModalTabId, saveModalDraftData, createRequest, replaceTab],
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
