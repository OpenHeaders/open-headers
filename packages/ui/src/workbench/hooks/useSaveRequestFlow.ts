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

import type {
  AuthConfig,
  CredentialsMode,
  ExecutedRequestSnapshot,
  HttpMethod,
  QueryParam,
  Request,
  RequestBody,
  RequestHeader,
  TlsVersion,
} from '@openheaders/core/types';
import { useCallback, useState } from 'react';
import { stashHandoffResponse } from '../components/request-editor/response-handoff';
import type { WorkbenchTab } from '../types';

interface UseSaveRequestFlowOptions {
  allTabs: WorkbenchTab[];
  createRequest: (input: {
    name: string;
    collectionUid?: string;
    parentPath?: string;
    seed?: Partial<Request>;
  }) => Promise<Request | null>;
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void;
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
 * `Partial<Request>` minus identity fields — name is separate so
 * the modal can prefill the naming input.
 */
export interface DraftData {
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  params: QueryParam[];
  auth: AuthConfig;
  body: RequestBody;
  credentialsMode?: CredentialsMode;
  followRedirects?: boolean;
  sslVerification?: boolean;
  tlsMinVersion?: TlsVersion;
  tlsMaxVersion?: TlsVersion;
  tlsCipherSuites?: string;
  allowHttp2?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  followOriginalHttpMethod?: boolean;
  followAuthorizationHeader?: boolean;
  preRequestScript?: string;
  postResponseScript?: string;
  /** Draft's last response, carried across the tab swap so the
   *  response panel survives the save (never persisted). */
  response?: ExecutedRequestSnapshot | null;
}

function buildEditTab(
  oldTabId: string,
  created: Request,
  replaceTab: (oldId: string, newTab: WorkbenchTab) => void,
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
            description: draftData.description,
            method: draftData.method,
            url: draftData.url,
            headers: draftData.headers,
            params: draftData.params,
            auth: draftData.auth,
            body: draftData.body,
            credentialsMode: draftData.credentialsMode,
            followRedirects: draftData.followRedirects,
            sslVerification: draftData.sslVerification,
            tlsMinVersion: draftData.tlsMinVersion,
            tlsMaxVersion: draftData.tlsMaxVersion,
            tlsCipherSuites: draftData.tlsCipherSuites,
            allowHttp2: draftData.allowHttp2,
            timeoutMs: draftData.timeoutMs,
            maxResponseBytes: draftData.maxResponseBytes,
            maxRedirects: draftData.maxRedirects,
            followOriginalHttpMethod: draftData.followOriginalHttpMethod,
            followAuthorizationHeader: draftData.followAuthorizationHeader,
            preRequestScript: draftData.preRequestScript,
            postResponseScript: draftData.postResponseScript,
          },
        }).then((created) => {
          if (!created) return;
          if (draftData.response) stashHandoffResponse(created.uid, draftData.response);
          buildEditTab(tabId, created, replaceTab);
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
          description: saveModalDraftData.description,
          method: saveModalDraftData.method,
          url: saveModalDraftData.url,
          headers: saveModalDraftData.headers,
          params: saveModalDraftData.params,
          auth: saveModalDraftData.auth,
          body: saveModalDraftData.body,
          credentialsMode: saveModalDraftData.credentialsMode,
          followRedirects: saveModalDraftData.followRedirects,
          sslVerification: saveModalDraftData.sslVerification,
          tlsMinVersion: saveModalDraftData.tlsMinVersion,
          tlsMaxVersion: saveModalDraftData.tlsMaxVersion,
          tlsCipherSuites: saveModalDraftData.tlsCipherSuites,
          allowHttp2: saveModalDraftData.allowHttp2,
          timeoutMs: saveModalDraftData.timeoutMs,
          maxResponseBytes: saveModalDraftData.maxResponseBytes,
          maxRedirects: saveModalDraftData.maxRedirects,
          followOriginalHttpMethod: saveModalDraftData.followOriginalHttpMethod,
          followAuthorizationHeader: saveModalDraftData.followAuthorizationHeader,
          preRequestScript: saveModalDraftData.preRequestScript,
          postResponseScript: saveModalDraftData.postResponseScript,
        },
      });
      if (created) {
        if (saveModalDraftData.response) stashHandoffResponse(created.uid, saveModalDraftData.response);
        buildEditTab(saveModalTabId, created, replaceTab);
      }
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
