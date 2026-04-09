/**
 * useDraftSave — draft tab creation and save-to-collection modal flow.
 *
 * Extracted from V5Shell to reduce component size. Handles:
 *   - Creating draft request/rule tabs (no collection context)
 *   - Save-to-collection modal state and confirmation
 *   - Persisting draft entities and transitioning tabs
 *   - Auto-expanding sidebar collections after save
 */

import type { V5 } from '@openheaders/core/types';
import { useCallback, useRef, useState } from 'react';
import type { Tab, TabType } from './useTabs';

const TAB_TYPE_TO_SECTION: Partial<Record<TabType, V5.WorkspaceSection>> = {
  request: 'requests',
  collection: 'requests',
  rule: 'rules',
  environment: 'environments',
};

export interface SaveModalProps {
  open: boolean;
  section: V5.WorkspaceSection;
  entityName: string;
  onSave: (params: { name: string; collectionId: string; folderId?: string }) => void;
  onCancel: () => void;
}

interface UseDraftSaveOptions {
  requests: V5.RequestNode[];
  rules: V5.Rule[];
  environments: V5.Environment[];
  tabs: Tab[];
  createEnvironment: (opts: { name: string }) => Promise<V5.Environment | null>;
  addRequest: (collectionUid: string, request: Omit<V5.Request, 'uid' | 'path'>) => Promise<V5.Request | null>;
  addRule: (collectionUid: string, rule: Omit<V5.Rule, 'uid' | 'path'>) => Promise<V5.Rule | null>;
  closeTab: (tabId: string, force?: boolean) => void;
  openTab: (tab: Omit<Tab, 'pinned' | 'unsaved'>) => void;
  ensureSidebarExpanded: (...keys: string[]) => void;
}

export function useDraftSave({
  requests,
  rules,
  environments,
  tabs,
  createEnvironment,
  addRequest,
  addRule,
  closeTab,
  openTab,
  ensureSidebarExpanded,
}: UseDraftSaveOptions) {
  // ── Draft creation ──

  const createDraftRequest = useCallback(() => {
    const existingNames = new Set(requests.map((r) => r.name));
    let name = 'New Request';
    let counter = 2;
    while (existingNames.has(name)) {
      name = `New Request (${counter})`;
      counter++;
    }
    const draftId = `draft-request-${Date.now()}`;
    openTab({
      id: draftId,
      type: 'request',
      label: name,
      icon: 'GET',
      draft: true,
      draftData: {
        name,
        method: 'GET',
        url: '',
      },
    } as Parameters<typeof openTab>[0]);
  }, [requests, openTab]);

  const createDraftRule = useCallback(() => {
    const existingNames = new Set(rules.map((r) => r.name));
    let name = 'New Rule';
    let counter = 2;
    while (existingNames.has(name)) {
      name = `New Rule (${counter})`;
      counter++;
    }
    const draftId = `draft-rule-${Date.now()}`;
    openTab({
      id: draftId,
      type: 'rule',
      label: name,
      icon: 'rule',
      draft: true,
      draftData: {
        type: 'header',
        name,
        enabled: true,
        domains: [],
        tags: [],
        action: {
          operation: 'add',
          headerName: '',
          isResponse: false,
        },
        staticValue: '',
      },
    } as Parameters<typeof openTab>[0]);
  }, [rules, openTab]);

  const createDraftEnvironment = useCallback(() => {
    const existingNames = new Set(environments.map((e) => e.name));
    let name = 'New Environment';
    let counter = 2;
    while (existingNames.has(name)) {
      name = `New Environment (${counter})`;
      counter++;
    }
    const draftId = `draft-env-${Date.now()}`;
    openTab({
      id: draftId,
      type: 'environment',
      label: name,
      icon: 'environment',
      draft: true,
      draftData: { name, variables: [] },
    } as Parameters<typeof openTab>[0]);
  }, [environments, openTab]);

  // ── Save to Collection modal ──

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalDraftTabId, setSaveModalDraftTabId] = useState<string | null>(null);
  const [saveModalDraftData, setSaveModalDraftData] = useState<Record<string, unknown> | null>(null);
  const [saveModalSection, setSaveModalSection] = useState<V5.WorkspaceSection>('requests');
  const [saveModalEntityName, setSaveModalEntityName] = useState('');

  const handleSaveDraftRef = useRef<(tabId: string, draftData: Record<string, unknown>) => void>(() => {});

  const handleSaveDraft = useCallback(
    (tabId: string, draftData: Record<string, unknown>) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const section = TAB_TYPE_TO_SECTION[tab.type];
      if (!section) return;
      setSaveModalDraftTabId(tabId);
      setSaveModalDraftData(draftData);
      setSaveModalSection(section);
      setSaveModalEntityName((draftData.name as string) || tab.label);
      setSaveModalOpen(true);
    },
    [tabs],
  );
  handleSaveDraftRef.current = handleSaveDraft;

  const handleSaveModalConfirm = useCallback(
    async (params: { name: string; collectionId: string; folderId?: string }) => {
      const draftTabId = saveModalDraftTabId;
      const draftData = saveModalDraftData;
      if (!draftTabId || !draftData) return;
      const tab = tabs.find((t) => t.id === draftTabId);
      if (!tab) return;

      if (tab.type === 'environment') {
        const env = await createEnvironment({ name: params.name });
        if (env) {
          closeTab(draftTabId, true);
          openTab({
            id: `env-${env.name}`,
            type: 'environment',
            label: env.name,
            icon: 'environment',
            entityId: env.name,
          });
        }
      } else if (tab.type === 'request') {
        const method = (draftData.method as V5.HttpMethod) || 'GET';
        const created = await addRequest(params.collectionId, {
          name: params.name,
          method,
          url: (draftData.url as string) || '',
          headers: [],
          params: [],
          auth: { type: 'none' },
          body: { type: 'none' },
        });
        if (created) {
          closeTab(draftTabId, true);
          openTab({
            id: `request-${created.uid}`,
            type: 'request',
            label: created.name,
            icon: created.method,
            entityId: created.uid,
          });
        }
      } else if (tab.type === 'rule') {
        const created = await addRule(params.collectionId, {
          type: (draftData.type as V5.RuleType) || 'header',
          name: params.name,
          enabled: draftData.enabled !== false,
          domains: (draftData.domains as string[]) || [],
          action: draftData.action as V5.HeaderAction,
          staticValue: (draftData.staticValue as string) || '',
        } as Omit<V5.HeaderRule, 'uid' | 'path'>);
        if (created) {
          closeTab(draftTabId, true);
          openTab({
            id: `rule-${created.uid}`,
            type: 'rule',
            label: created.name,
            icon: 'rule',
            entityId: created.uid,
          });
        }
      }

      // Auto-expand the collection in the sidebar
      const keys = [`col-${params.collectionId}`];
      if (params.folderId) keys.push(`folder-${params.folderId}`);
      ensureSidebarExpanded(...keys);

      setSaveModalOpen(false);
      setSaveModalDraftTabId(null);
      setSaveModalDraftData(null);
    },
    [saveModalDraftTabId, saveModalDraftData, tabs, createEnvironment, addRequest, addRule, closeTab, openTab, ensureSidebarExpanded],
  );

  const saveModalProps: SaveModalProps = {
    open: saveModalOpen,
    section: saveModalSection,
    entityName: saveModalEntityName,
    onSave: (params) => void handleSaveModalConfirm(params),
    onCancel: () => setSaveModalOpen(false),
  };

  return {
    createDraftRequest,
    createDraftRule,
    createDraftEnvironment,
    handleSaveDraft,
    handleSaveDraftRef,
    saveModalProps,
  };
}
