/**
 * useDraftSave — draft tab creation and save-to-collection modal flow.
 *
 * Extracted from V5Shell to reduce component size. Handles:
 *   - Creating draft source/rule tabs (no collection context)
 *   - Save-to-collection modal state and confirmation
 *   - Persisting draft entities and transitioning tabs
 *   - Auto-expanding sidebar collections after save
 */

import type { CollectionSection, Environment, HeaderRule, Source } from '@openheaders/core';
import { useCallback, useRef, useState } from 'react';
import type { Tab, TabType } from './useTabs';

const TAB_TYPE_TO_SECTION: Partial<Record<TabType, CollectionSection>> = {
  request: 'requests',
  collection: 'requests',
  rule: 'rules',
  environment: 'environments',
};

export interface SaveModalProps {
  open: boolean;
  section: CollectionSection;
  entityName: string;
  onSave: (params: { name: string; collectionId: string; folderId?: string }) => void;
  onCancel: () => void;
}

interface UseDraftSaveOptions {
  sources: Source[];
  rules: HeaderRule[];
  environments: Environment[];
  tabs: Tab[];
  addSource: (source: Source) => Promise<Source | null>;
  addRule: (rule: Partial<HeaderRule>) => Promise<HeaderRule | null>;
  createEnvironment: (opts: { name: string; collectionId?: string; folderId?: string }) => Promise<Environment | null>;
  closeTab: (tabId: string, force?: boolean) => void;
  openTab: (tab: Omit<Tab, 'pinned' | 'unsaved'>) => void;
  ensureSidebarExpanded: (...keys: string[]) => void;
}

export function useDraftSave({
  sources,
  rules,
  environments,
  tabs,
  addSource,
  addRule,
  createEnvironment,
  closeTab,
  openTab,
  ensureSidebarExpanded,
}: UseDraftSaveOptions) {
  // ── Draft creation ──

  const createDraftSource = useCallback(() => {
    const existingNames = new Set(sources.map((s) => s.sourceName));
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
        sourceName: name,
        sourceMethod: 'GET',
        sourcePath: '',
        sourceType: 'http',
        sourceContent: null,
        requestOptions: { contentType: 'application/json' },
        jsonFilter: { enabled: false },
        refreshOptions: { enabled: false },
        activationState: 'inactive',
      },
    } as Parameters<typeof openTab>[0]);
  }, [sources, openTab]);

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
        description: '',
        isEnabled: true,
        domains: [],
        headerName: '',
        headerValue: '',
        tag: '',
        isResponse: false,
        isDynamic: false,
        sourceId: null,
        prefix: '',
        suffix: '',
        hasEnvVars: false,
        envVars: [],
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
      draftData: { name, variables: {} },
    } as Parameters<typeof openTab>[0]);
  }, [environments, openTab]);

  // ── Save to Collection modal ──

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalDraftTabId, setSaveModalDraftTabId] = useState<string | null>(null);
  const [saveModalDraftData, setSaveModalDraftData] = useState<Record<string, unknown> | null>(null);
  const [saveModalSection, setSaveModalSection] = useState<CollectionSection>('requests');
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
      setSaveModalEntityName((draftData.sourceName as string) || (draftData.name as string) || tab.label);
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

      if (tab.type === 'request') {
        const source = await addSource({
          ...draftData,
          sourceName: params.name,
          collectionId: params.collectionId,
          folderId: params.folderId,
          sourceId: '',
        } as Source);
        if (source) {
          closeTab(draftTabId, true);
          openTab({
            id: `source-${source.sourceId}`,
            type: 'request',
            label: source.sourceName || 'New Request',
            icon: (source.sourceMethod as string) || 'GET',
            entityId: source.sourceId,
          });
        }
      } else if (tab.type === 'rule') {
        const rule = await addRule({
          ...draftData,
          name: params.name,
          collectionId: params.collectionId,
          folderId: params.folderId,
        } as Partial<HeaderRule>);
        if (rule) {
          closeTab(draftTabId, true);
          openTab({ id: `rule-${rule.id}`, type: 'rule', label: rule.name, icon: 'rule', entityId: rule.id });
        }
      } else if (tab.type === 'environment') {
        const env = await createEnvironment({
          name: params.name,
          collectionId: params.collectionId,
          folderId: params.folderId,
        });
        if (env) {
          closeTab(draftTabId, true);
          openTab({ id: `env-${env.id}`, type: 'environment', label: env.name, icon: 'environment', entityId: env.id });
        }
      }

      // Auto-expand the collection (and folder) in the sidebar
      const keys = [`col-${params.collectionId}`];
      if (params.folderId) keys.push(`folder-${params.folderId}`);
      ensureSidebarExpanded(...keys);

      setSaveModalOpen(false);
      setSaveModalDraftTabId(null);
      setSaveModalDraftData(null);
    },
    [
      saveModalDraftTabId,
      saveModalDraftData,
      tabs,
      addSource,
      addRule,
      createEnvironment,
      closeTab,
      openTab,
      ensureSidebarExpanded,
    ],
  );

  const saveModalProps: SaveModalProps = {
    open: saveModalOpen,
    section: saveModalSection,
    entityName: saveModalEntityName,
    onSave: (params) => void handleSaveModalConfirm(params),
    onCancel: () => setSaveModalOpen(false),
  };

  return {
    createDraftSource,
    createDraftRule,
    createDraftEnvironment,
    handleSaveDraft,
    handleSaveDraftRef,
    saveModalProps,
  };
}
