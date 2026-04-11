/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * Mirrors the desktop V5 shell layout exactly:
 *   TopBar | ActivityBar | Sidebar | TabBar + BreadcrumbBar + Editor | BottomPanel | Inspector | StatusBar
 *
 * Tab state extracted to useTabs hook. Dirty confirmation in useTabLifecycle hook.
 */

import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { Allotment, LayoutPriority } from 'allotment';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import ActivityBar from './components/ActivityBar';
import BottomPanel from './components/BottomPanel';
import BreadcrumbBar from './components/BreadcrumbBar';
import CollectionOverview from './components/CollectionOverview';
import EmptyState from './components/EmptyState';
import FolderOverview from './components/FolderOverview';
import Inspector from './components/Inspector';
import RuleEditor from './components/RuleEditor';
import SaveToCollectionModal from './components/SaveToCollectionModal';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import TemplateEditor from './components/TemplateEditor';
import TopBar from './components/TopBar';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabs } from './hooks/useTabs';
import { TEMPLATES_BY_TYPE } from './rule-templates';
import type { PanelVisibility, RulesTab } from './types';

const RULE_TYPE_LABELS: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
  delay: 'Delay Rule',
  body: 'API Request Body Rule',
  mock: 'API Response Rule',
};

// ── Inner component (needs RuleContext) ────────────────────────────

const RulesAppInner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const {
    rules,
    isStatusLoaded,
    deleteLocalRule,
    updateLocalRule,
    localCollections,
    localCollectionTrees,
    createLocalRule,
    createLocalCollection,
    createLocalFolder,
    renameLocalCollection,
    renameLocalFolder,
    templates,
  } = useRules();

  // ── Tab state (extracted hook) ────────────────────────────────
  const {
    tabs,
    activeTabId,
    recentlyClosed,
    addTab,
    closeTab: rawCloseTab,
    switchTab,
    updateTab,
    replaceTab,
    reorderTab,
    closeOtherTabs,
    closeAllTabs,
    closeUnmodifiedTabs,
    closeTabsToLeft,
    closeTabsToRight,
    reopenTab,
    dirtyMap,
    saveRefMap,
  } = useTabs();

  // ── Tab lifecycle (dirty confirmation) ────────────────────────
  const {
    handleCloseTab,
    handleCloseOther,
    handleCloseAll,
    handleCloseUnmodified,
    handleCloseToLeft,
    handleCloseToRight,
  } = useTabLifecycle({ tabs, closeTab: rawCloseTab, switchTab, saveRefMap });

  // ── Panels ────────────────────────────────────────────────────
  const [panels, setPanels] = useState<PanelVisibility>({ sidebar: true, bottomPanel: false, inspector: false });
  const [bottomPanelTab, setBottomPanelTab] = useState('traffic');
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);

  const togglePanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }, []);

  // Register inspector open callback for useInspectorNav
  const { onOpenInspector, openDocs } = useInspectorNav();
  onOpenInspector.current = useCallback(() => {
    setPanels((prev) => ({ ...prev, inspector: true }));
  }, []);

  // ── Save to Collection modal state ────────────────────────────
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveModalTabId, setSaveModalTabId] = useState<string | null>(null);
  const [saveModalDraftData, setSaveModalDraftData] = useState<Record<string, unknown> | null>(null);
  const [saveModalEntityName, setSaveModalEntityName] = useState('');

  // ── Auto-generated name helper ────────────────────────────────
  const generateDraftName = useCallback(
    (type: string) => {
      const label = RULE_TYPE_LABELS[type] ?? 'Rule';
      const baseName = `New ${label}`;
      const existingNames = new Set(rules.map((r) => r.name));
      for (const tab of tabs) existingNames.add(tab.label);
      if (!existingNames.has(baseName)) return baseName;
      let counter = 2;
      while (existingNames.has(`${baseName} (${counter})`)) counter++;
      return `${baseName} (${counter})`;
    },
    [rules, tabs],
  );

  // ── Tab operations ────────────────────────────────────────────

  const openCreateTab = useCallback(
    (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => {
      if (context?.collectionId) {
        const draftName = generateDraftName(type);

        // If a template is specified, use its conditions and form values to build the rule
        const template = templateKey ? (TEMPLATES_BY_TYPE[type] ?? []).find((t) => t.key === templateKey) : undefined;
        const baseConditions = template?.conditions ?? ([] as V5.RuleCondition[]);
        const base = { name: draftName, type, enabled: true, conditions: baseConditions };

        let rule: Omit<V5.Rule, 'uid' | 'path'>;
        switch (type) {
          case 'header': {
            const fv = template?.formValues ?? {};
            rule = {
              ...base,
              type: 'header',
              action: {
                requestHeaders: (fv.requestHeaders as V5.HeaderModification[]) ?? [
                  { operation: 'override' as const, headerName: '', value: '' },
                ],
                responseHeaders: (fv.responseHeaders as V5.HeaderModification[]) ?? [],
              },
            } as Omit<V5.HeaderRule, 'uid' | 'path'>;
            break;
          }
          case 'block':
            rule = { ...base, type: 'block', action: { statusCode: 403 } } as Omit<V5.BlockRule, 'uid' | 'path'>;
            break;
          case 'redirect':
            rule = { ...base, type: 'redirect', action: { matchPattern: '', redirectTo: '' } } as Omit<
              V5.RedirectRule,
              'uid' | 'path'
            >;
            break;
          case 'query-param':
            rule = { ...base, type: 'query-param', action: { params: [] } } as Omit<V5.QueryParamRule, 'uid' | 'path'>;
            break;
          case 'inject':
            rule = {
              ...base,
              type: 'inject',
              action: { injectType: 'script', source: 'code', code: '', position: 'body-end' },
            } as Omit<V5.InjectRule, 'uid' | 'path'>;
            break;
          case 'delay':
            rule = {
              ...base,
              type: 'delay',
              action: { delayMs: 1000 },
            } as Omit<V5.DelayRule, 'uid' | 'path'>;
            break;
          case 'body':
            rule = {
              ...base,
              type: 'body',
              action: {
                bodyType: 'static',
                body: '',
                resourceType: 'rest',
              },
            } as Omit<V5.BodyRule, 'uid' | 'path'>;
            break;
          case 'mock':
            rule = {
              ...base,
              type: 'mock',
              action: {
                statusCode: 0,
                responseBody: '',
                contentType: 'application/json',
                responseHeaders: {},
                bodyType: 'static',
              },
            } as Omit<V5.MockRule, 'uid' | 'path'>;
            break;
          default:
            return;
        }
        void createLocalRule(rule, context.collectionId, context.folderPath).then((created) => {
          if (created) {
            const editId = `edit-${created.uid}`;
            const tab: RulesTab = {
              id: editId,
              label: created.name,
              ruleType: created.type,
              dirty: false,
              mode: 'edit',
              ruleUid: created.uid,
              templateKey,
            };
            addTab(tab);
            setPendingRenameTabId(editId);
          }
        });
        return;
      }

      const resolveAndCreate = async () => {
        let collectionId: string;
        if (localCollections.length > 0) {
          collectionId = localCollections[0].uid;
        } else {
          const col = await createLocalCollection('My Rules');
          if (!col) return;
          collectionId = col.uid;
        }
        openCreateTab(type, { collectionId }, templateKey);
      };
      void resolveAndCreate();
    },
    [generateDraftName, createLocalRule, localCollections, createLocalCollection, addTab],
  );

  const openEditTab = useCallback(
    (uid: string) => {
      const existing = tabs.find((t) => t.mode === 'edit' && t.ruleUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const rule = rules.find((r) => r.uid === uid);
      const id = `edit-${uid}`;
      const tab: RulesTab = {
        id,
        label: rule?.name ?? 'Rule',
        ruleType: rule?.type ?? 'header',
        dirty: false,
        mode: 'edit',
        ruleUid: uid,
      };
      addTab(tab);
    },
    [tabs, rules, addTab, switchTab],
  );

  const openCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `col-${uid}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) {
        switchTab(id);
        return;
      }
      const tab: RulesTab = { id, label: name, ruleType: '', dirty: false, mode: 'collection-overview', entityId: uid };
      addTab(tab);
      if (autoRename) setPendingRenameTabId(id);
    },
    [tabs, addTab, switchTab],
  );

  const openFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `folder-${uid}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) {
        switchTab(id);
        return;
      }
      const tab: RulesTab = { id, label: name, ruleType: '', dirty: false, mode: 'folder-overview', entityId: uid };
      addTab(tab);
      if (autoRename) setPendingRenameTabId(id);
    },
    [tabs, addTab, switchTab],
  );

  const openTemplateEditTab = useCallback(
    (uid: string) => {
      const existing = tabs.find((t) => t.mode === 'template-edit' && t.templateUid === uid);
      if (existing) {
        switchTab(existing.id);
        return;
      }
      const tpl = templates.find((t) => t.uid === uid);
      const id = `tpl-edit-${uid}`;
      const tab: RulesTab = {
        id,
        label: tpl?.name ?? 'Template',
        ruleType: tpl?.ruleType ?? '',
        dirty: false,
        mode: 'template-edit',
        templateUid: uid,
      };
      addTab(tab);
    },
    [tabs, templates, addTab, switchTab],
  );

  // Template collection/folder overview reuses the same overview components
  // but with different tab IDs to avoid collisions with rule collections.
  const openTemplateCollectionOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `tpl-col-${uid}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) {
        switchTab(id);
        return;
      }
      const tab: RulesTab = { id, label: name, ruleType: '', dirty: false, mode: 'collection-overview', entityId: uid };
      addTab(tab);
      if (autoRename) setPendingRenameTabId(id);
    },
    [tabs, addTab, switchTab],
  );

  const openTemplateFolderOverview = useCallback(
    (uid: string, name: string, autoRename = false) => {
      const id = `tpl-folder-${uid}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) {
        switchTab(id);
        return;
      }
      const tab: RulesTab = { id, label: name, ruleType: '', dirty: false, mode: 'folder-overview', entityId: uid };
      addTab(tab);
      if (autoRename) setPendingRenameTabId(id);
    },
    [tabs, addTab, switchTab],
  );

  // ── Dirty tracking ────────────────────────────────────────────

  const handleDirtyChange = useCallback(
    (tabId: string, dirty: boolean) => {
      dirtyMap.current.set(tabId, dirty);
      updateTab(tabId, { dirty });
    },
    [dirtyMap, updateTab],
  );

  const registerSaveRef = useCallback(
    (tabId: string, saveFn: () => void) => {
      saveRefMap.current.set(tabId, saveFn);
    },
    [saveRefMap],
  );

  const saveAsTemplateRefMap = useRef<Map<string, () => void>>(new Map());
  const registerSaveAsTemplateRef = useCallback((tabId: string, fn: () => void) => {
    saveAsTemplateRefMap.current.set(tabId, fn);
  }, []);

  const handleSaveAsTemplate = useCallback(() => {
    if (activeTabId) saveAsTemplateRefMap.current.get(activeTabId)?.();
  }, [activeTabId]);

  // ── Draft save flow ───────────────────────────────────────────

  const handleSaveDraft = useCallback(
    (tabId: string, draftData: Record<string, unknown>) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      setSaveModalTabId(tabId);
      setSaveModalDraftData(draftData);
      setSaveModalEntityName((draftData.name as string) || tab.label);
      setSaveModalOpen(true);
    },
    [tabs],
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

  // ── Handle rule saved (edit mode) ─────────────────────────────

  const handleSaved = useCallback(
    (tabId: string, uid: string) => {
      const rule = rules.find((r) => r.uid === uid);
      updateTab(tabId, { label: rule?.name ?? undefined, dirty: false });
    },
    [rules, updateTab],
  );

  // ── Clear stale rename state on tab switch ─────────────────────

  useEffect(() => {
    if (pendingRenameTabId && pendingRenameTabId !== activeTabId) {
      setPendingRenameTabId(null);
    }
  }, [activeTabId, pendingRenameTabId]);

  // ── Initial hash — deferred until data is loaded ───────────────
  // Must wait for isStatusLoaded so localCollections is populated.
  // Without this, openCreateTab sees empty collections and creates
  // a duplicate "My Rules" collection every time.

  const hashProcessedRef = useRef(false);
  const openCreateTabRef = useRef(openCreateTab);
  const openEditTabRef = useRef(openEditTab);
  const openDocsRef = useRef(openDocs);
  openCreateTabRef.current = openCreateTab;
  openEditTabRef.current = openEditTab;
  openDocsRef.current = openDocs;

  useEffect(() => {
    if (!isStatusLoaded || hashProcessedRef.current) return;
    hashProcessedRef.current = true;
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return;
    const parts = hash.split('/');
    if (parts[0] === 'create' && parts[1]) {
      // #/create/{type} or #/create/{type}/{templateKey}
      openCreateTabRef.current(parts[1], undefined, parts[2]);
    } else if (parts[0] === 'edit' && parts[1]) {
      openEditTabRef.current(parts[1]);
    } else if (parts[0] === 'docs' && parts[1]) {
      // #/docs/{sectionId} — open inspector sidebar at the specified doc section
      openDocsRef.current(parts[1]);
    }
  }, [isStatusLoaded]);

  // ── Sync tab labels with rule changes ─────────────────────────

  useEffect(() => {
    for (const tab of tabs) {
      if (tab.mode === 'edit' && tab.ruleUid) {
        const rule = rules.find((r) => r.uid === tab.ruleUid);
        if (rule && rule.name !== tab.label) updateTab(tab.id, { label: rule.name, ruleType: rule.type });
      } else if (tab.mode === 'template-edit' && tab.templateUid) {
        const tpl = templates.find((t) => t.uid === tab.templateUid);
        if (tpl && tpl.name !== tab.label) updateTab(tab.id, { label: tpl.name });
      }
    }
  }, [rules, templates, tabs, updateTab]);

  // ── Close tabs when their backing entity is deleted ─────────────
  // Single set of all known entity IDs (rules + collections + folders).
  // When an ID disappears between renders, its tab is force-closed.

  const prevEntityIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set<string>();
    for (const r of rules) currentIds.add(r.uid);
    for (const col of localCollectionTrees) {
      currentIds.add(col.uid);
      const walk = (nodes: V5.TreeNode[]) => {
        for (const n of nodes) {
          currentIds.add(n.uid);
          if (n.type === 'folder') walk(n.children);
        }
      };
      walk(col.tree);
    }

    if (prevEntityIds.current.size > 0) {
      for (const tab of tabs) {
        const entityId = tab.ruleUid ?? tab.entityId;
        if (entityId && !currentIds.has(entityId)) rawCloseTab(tab.id, true);
      }
    }

    prevEntityIds.current = currentIds;
  }, [rules, localCollectionTrees, tabs, rawCloseTab]);

  const handleDeleteRule = useCallback(
    async (uid: string) => {
      await deleteLocalRule(uid);
    },
    [deleteLocalRule],
  );

  // ── Active tab + breadcrumbs ──────────────────────────────────

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

  const breadcrumbs = useMemo(() => {
    if (!activeTab) return [];

    if (activeTab.mode === 'collection-overview') return ['Rules', activeTab.label];

    if (activeTab.mode === 'folder-overview' && activeTab.entityId) {
      for (const col of localCollectionTrees) {
        const trail: string[] = [];
        const findFolder = (nodes: V5.TreeNode[]): boolean => {
          for (const n of nodes) {
            if (n.type === 'folder' && n.uid === activeTab.entityId) return true;
            if (n.type === 'folder') {
              trail.push(n.name);
              if (findFolder(n.children)) return true;
              trail.pop();
            }
          }
          return false;
        };
        if (findFolder(col.tree)) return ['Rules', col.name, ...trail, activeTab.label];
      }
      return ['Rules', activeTab.label];
    }

    if (activeTab.mode === 'edit' && activeTab.ruleUid) {
      const rule = rules.find((r) => r.uid === activeTab.ruleUid);
      if (rule) {
        for (const col of localCollectionTrees) {
          const trail: string[] = [];
          const findRule = (nodes: V5.TreeNode[]): boolean => {
            for (const n of nodes) {
              if (n.type === 'rule' && n.uid === rule.uid) return true;
              if (n.type === 'folder') {
                trail.push(n.name);
                if (findRule(n.children)) return true;
                trail.pop();
              }
            }
            return false;
          };
          if (findRule(col.tree)) return ['Rules', col.name, ...trail, activeTab.label];
        }
      }
      return ['Rules', activeTab.label];
    }

    return ['Rules', activeTab.label];
  }, [activeTab, rules, localCollectionTrees]);

  const handleBreadcrumbRename = useCallback(
    (newName: string) => {
      if (!activeTab) return;
      if (activeTab.mode === 'collection-overview' && activeTab.entityId) {
        void renameLocalCollection(activeTab.entityId, newName);
        updateTab(activeTab.id, { label: newName });
      } else if (activeTab.mode === 'folder-overview' && activeTab.entityId) {
        void renameLocalFolder(activeTab.entityId, newName);
        updateTab(activeTab.id, { label: newName });
      } else if (activeTab.mode === 'edit' && activeTab.ruleUid) {
        // Persist name immediately — don't require Save button
        void updateLocalRule(activeTab.ruleUid, { name: newName });
        updateTab(activeTab.id, { label: newName });
      } else if (activeTab.mode === 'create') {
        updateTab(activeTab.id, { label: newName, draftName: newName });
      }
      setPendingRenameTabId(null);
    },
    [activeTab, renameLocalCollection, renameLocalFolder, updateLocalRule, updateTab],
  );

  const handleSave = useCallback(() => {
    if (activeTabId) saveRefMap.current.get(activeTabId)?.();
  }, [activeTabId, saveRefMap]);

  // ── Cmd+S ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  return (
    <div className="rules-shell" data-theme={isDarkMode ? 'dark' : 'light'} style={{ background: token.colorBgLayout }}>
      <TopBar />

      <div className="rules-main">
        <ActivityBar sidebarVisible={panels.sidebar} onToggleSidebar={() => togglePanel('sidebar')} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Allotment proportionalLayout={false}>
            <Allotment.Pane
              preferredSize={250}
              minSize={180}
              maxSize={400}
              visible={panels.sidebar}
              priority={LayoutPriority.Low}
            >
              <Sidebar
                activeTabId={activeTabId}
                onSelectRule={openEditTab}
                onCreateRule={openCreateTab}
                onDeleteRule={handleDeleteRule}
                onOpenCollectionOverview={openCollectionOverview}
                onOpenFolderOverview={openFolderOverview}
                onSelectTemplate={openTemplateEditTab}
                onOpenTemplateCollectionOverview={openTemplateCollectionOverview}
                onOpenTemplateFolderOverview={openTemplateFolderOverview}
              />
            </Allotment.Pane>

            <Allotment.Pane priority={LayoutPriority.High}>
              <Allotment vertical proportionalLayout={false}>
                <Allotment.Pane>
                  <div className="rules-editor-area" style={{ background: token.colorBgContainer }}>
                    <TabBar
                      tabs={tabs}
                      activeTabId={activeTabId}
                      rules={rules}
                      templates={templates}
                      onSwitch={switchTab}
                      onClose={handleCloseTab}
                      onCreateRule={openCreateTab}
                      onReorder={reorderTab}
                      onCloseOther={handleCloseOther}
                      onCloseAll={handleCloseAll}
                      onCloseUnmodified={handleCloseUnmodified}
                      onCloseToLeft={handleCloseToLeft}
                      onCloseToRight={handleCloseToRight}
                      recentlyClosed={recentlyClosed}
                      onReopenTab={reopenTab}
                    />
                    {activeTab && (
                      <BreadcrumbBar
                        segments={breadcrumbs}
                        isDirty={activeTab.mode === 'create' || activeTab.dirty}
                        onSave={activeTab.mode === 'create' || activeTab.mode === 'edit' ? handleSave : undefined}
                        onSaveAsTemplate={
                          activeTab.mode === 'create' || activeTab.mode === 'edit' ? handleSaveAsTemplate : undefined
                        }
                        onRename={handleBreadcrumbRename}
                        autoRenameKey={pendingRenameTabId === activeTabId ? pendingRenameTabId : null}
                      />
                    )}
                    <div className="rules-editor-content">
                      {!activeTab && <EmptyState onCreateRule={openCreateTab} />}
                      {tabs.map((tab) => (
                        <div
                          key={tab.id}
                          style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}
                        >
                          {(tab.mode === 'create' || tab.mode === 'edit') && (
                            <RuleEditor
                              mode={tab.mode}
                              ruleType={tab.createType}
                              ruleUid={tab.ruleUid}
                              tabId={tab.id}
                              draftName={tab.draftName}
                              initialTemplateKey={tab.templateKey}
                              onSaved={(uid) => handleSaved(tab.id, uid)}
                              onSaveDraft={tab.mode === 'create' ? handleSaveDraft : undefined}
                              onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
                              registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
                              registerSaveAsTemplateRef={(fn) => registerSaveAsTemplateRef(tab.id, fn)}
                            />
                          )}
                          {tab.mode === 'collection-overview' && tab.entityId && (
                            <CollectionOverview
                              collectionUid={tab.entityId}
                              onSelectRule={openEditTab}
                              onCreateRule={openCreateTab}
                              onOpenFolderOverview={openFolderOverview}
                            />
                          )}
                          {tab.mode === 'folder-overview' && tab.entityId && (
                            <FolderOverview
                              folderUid={tab.entityId}
                              onSelectRule={openEditTab}
                              onCreateRule={openCreateTab}
                              onOpenFolderOverview={openFolderOverview}
                            />
                          )}
                          {tab.mode === 'template-edit' && tab.templateUid && (
                            <TemplateEditor
                              templateUid={tab.templateUid}
                              onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
                              registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Allotment.Pane>

                <Allotment.Pane preferredSize={200} minSize={100} maxSize={500} visible={panels.bottomPanel}>
                  <BottomPanel activeTab={bottomPanelTab} onTabChange={setBottomPanelTab} />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>

            <Allotment.Pane preferredSize={500} minSize={280} maxSize={600} visible={panels.inspector}>
              <Inspector onClose={() => togglePanel('inspector')} />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>

      <StatusBar panels={panels} onTogglePanel={togglePanel} />

      <SaveToCollectionModal
        open={saveModalOpen}
        entityName={saveModalEntityName}
        collectionTrees={localCollectionTrees}
        collections={localCollections}
        onSave={(params) => void handleSaveModalConfirm(params)}
        onCreateCollection={createLocalCollection}
        onCreateFolder={createLocalFolder}
        onCancel={() => setSaveModalOpen(false)}
      />
    </div>
  );
};

const RulesApp: React.FC = () => (
  <RuleProvider>
    <InspectorNavProvider>
      <RulesAppInner />
    </InspectorNavProvider>
  </RuleProvider>
);

export default RulesApp;
