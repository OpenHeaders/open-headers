/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * Mirrors the desktop V5 shell layout exactly:
 *   TopBar | ActivityBar | Sidebar | TabBar + BreadcrumbBar + Editor | BottomPanel | Inspector | StatusBar
 *
 * All three panels (sidebar, bottom, inspector) are toggleable via StatusBar SVGs.
 * Bottom panel and inspector show disabled/placeholder content for future enablement.
 */

import type { V5 } from '@openheaders/core/types';
import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { useRules } from '@hooks/useRules';
import { Allotment } from 'allotment';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import ActivityBar from './components/ActivityBar';
import BottomPanel from './components/BottomPanel';
import BreadcrumbBar from './components/BreadcrumbBar';
import EmptyState from './components/EmptyState';
import Inspector from './components/Inspector';
import RuleEditor from './components/RuleEditor';
import SaveToCollectionModal from './components/SaveToCollectionModal';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import TopBar from './components/TopBar';
import type { PanelVisibility, RulesTab } from './types';

const RULE_TYPE_LABELS: Record<string, string> = {
  header: 'Header Rule',
  block: 'Block Rule',
  redirect: 'Redirect Rule',
  'query-param': 'Query Param Rule',
  inject: 'Inject Rule',
};

let createCounter = 0;

// ── Inner component (needs RuleContext) ────────────────────────────

const RulesAppInner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const { rules, deleteLocalRule, localCollections, localCollectionTrees, createLocalRule, createLocalCollection, createLocalFolder, renameLocalCollection, renameLocalFolder } = useRules();

  const [tabs, setTabs] = useState<RulesTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [panels, setPanels] = useState<PanelVisibility>({
    sidebar: true,
    bottomPanel: false,
    inspector: false,
  });
  const [bottomPanelTab, setBottomPanelTab] = useState('traffic');
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);

  const dirtyMap = useRef<Map<string, boolean>>(new Map());
  const saveRefMap = useRef<Map<string, () => void>>(new Map());

  const togglePanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
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
    (type: string, context?: { collectionId: string; folderPath?: string }) => {
      if (context?.collectionId) {
        // Direct creation — collection/folder is known, skip the modal
        const draftName = generateDraftName(type);
        const base = { name: draftName, type, enabled: true, tags: [] as string[], domains: [] as string[] };
        let rule: Omit<V5.Rule, 'uid' | 'path'>;
        switch (type) {
          case 'header':
            rule = { ...base, type: 'header', action: { operation: 'override' as const, headerName: '', isResponse: false }, staticValue: '' } as Omit<V5.HeaderRule, 'uid' | 'path'>;
            break;
          case 'block':
            rule = { ...base, type: 'block', action: { statusCode: 403 } } as Omit<V5.BlockRule, 'uid' | 'path'>;
            break;
          case 'redirect':
            rule = { ...base, type: 'redirect', action: { matchPattern: '', redirectTo: '' } } as Omit<V5.RedirectRule, 'uid' | 'path'>;
            break;
          case 'query-param':
            rule = { ...base, type: 'query-param', action: { params: [] } } as Omit<V5.QueryParamRule, 'uid' | 'path'>;
            break;
          case 'inject':
            rule = { ...base, type: 'inject', action: { injectType: 'script', code: '', position: 'body-end' } } as Omit<V5.InjectRule, 'uid' | 'path'>;
            break;
          default:
            return;
        }
        void createLocalRule(rule, context.collectionId, context.folderPath).then((created) => {
          if (created) {
            const editId = `edit-${created.uid}`;
            const tab: RulesTab = { id: editId, label: created.name, ruleType: created.type, dirty: false, mode: 'edit', ruleUid: created.uid };
            setTabs((prev) => [...prev, tab]);
            setActiveTabId(editId);
            setPendingRenameTabId(editId);
          }
        });
        return;
      }

      // No context — auto-resolve collection (create "My Rules" if none exist)
      const resolveAndCreate = async () => {
        let collectionId: string;
        if (localCollections.length > 0) {
          collectionId = localCollections[0].uid;
        } else {
          const col = await createLocalCollection('My Rules');
          if (!col) return;
          collectionId = col.uid;
        }
        openCreateTab(type, { collectionId });
      };
      void resolveAndCreate();
    },
    [generateDraftName, createLocalRule, localCollections, createLocalCollection],
  );

  const openEditTab = useCallback(
    (uid: string) => {
      const existing = tabs.find((t) => t.mode === 'edit' && t.ruleUid === uid);
      if (existing) { setActiveTabId(existing.id); return; }
      const rule = rules.find((r) => r.uid === uid);
      const id = `edit-${uid}`;
      const tab: RulesTab = { id, label: rule?.name ?? 'Rule', ruleType: rule?.type ?? 'header', dirty: false, mode: 'edit', ruleUid: uid };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
    },
    [tabs, rules],
  );

  const openCollectionOverview = useCallback(
    (uid: string, name: string) => {
      const id = `col-${uid}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) { setActiveTabId(id); return; }
      const tab: RulesTab = { id, label: name, ruleType: '', dirty: false, mode: 'collection-overview', entityId: uid };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
      setPendingRenameTabId(id);
    },
    [tabs],
  );

  const openFolderOverview = useCallback(
    (uid: string, name: string) => {
      const id = `folder-${uid}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) { setActiveTabId(id); return; }
      const tab: RulesTab = { id, label: name, ruleType: '', dirty: false, mode: 'folder-overview', entityId: uid };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
      setPendingRenameTabId(id);
    },
    [tabs],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);
        dirtyMap.current.delete(tabId);
        saveRefMap.current.delete(tabId);
        if (tabId === activeTabId) {
          if (next.length === 0) setActiveTabId(null);
          else setActiveTabId(next[Math.min(idx, next.length - 1)].id);
        }
        return next;
      });
    },
    [activeTabId],
  );

  const switchTab = useCallback((tabId: string) => { setActiveTabId(tabId); }, []);

  // ── Dirty tracking ────────────────────────────────────────────

  const handleDirtyChange = useCallback((tabId: string, dirty: boolean) => {
    dirtyMap.current.set(tabId, dirty);
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, dirty } : t)));
  }, []);

  const registerSaveRef = useCallback((tabId: string, saveFn: () => void) => {
    saveRefMap.current.set(tabId, saveFn);
  }, []);

  // ── Draft save flow (triggered by breadcrumb Save on create tabs) ─

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
        setTabs((prev) =>
          prev.map((t) =>
            t.id === saveModalTabId
              ? { ...t, id: editId, label: created.name, ruleType: created.type, dirty: false, mode: 'edit' as const, ruleUid: created.uid, createType: undefined, draftName: undefined }
              : t,
          ),
        );
        dirtyMap.current.delete(saveModalTabId);
        if (activeTabId === saveModalTabId) setActiveTabId(editId);
      }
      setSaveModalOpen(false);
      setSaveModalTabId(null);
      setSaveModalDraftData(null);
    },
    [saveModalTabId, saveModalDraftData, createLocalRule, activeTabId],
  );

  // ── Handle rule saved (edit mode) ─────────────────────────────

  const handleSaved = useCallback(
    (tabId: string, uid: string) => {
      const rule = rules.find((r) => r.uid === uid);
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, label: rule?.name ?? t.label, dirty: false } : t)));
    },
    [rules],
  );

  // ── Initial hash ──────────────────────────────────────────────

  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return;
    const parts = hash.split('/');
    if (parts[0] === 'create' && parts[1]) openCreateTab(parts[1]);
    else if (parts[0] === 'edit' && parts[1]) openEditTab(parts[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync tab labels with rule changes ─────────────────────────

  useEffect(() => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.mode === 'edit' && tab.ruleUid) {
          const rule = rules.find((r) => r.uid === tab.ruleUid);
          if (rule && rule.name !== tab.label) return { ...tab, label: rule.name, ruleType: rule.type };
        }
        return tab;
      }),
    );
  }, [rules]);

  // ── Close tabs when rule deleted ──────────────────────────────

  const prevRuleUids = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentUids = new Set(rules.map((r) => r.uid));
    if (prevRuleUids.current.size > 0) {
      for (const tab of tabs) {
        if (tab.mode === 'edit' && tab.ruleUid && !currentUids.has(tab.ruleUid)) closeTab(tab.id);
      }
    }
    prevRuleUids.current = currentUids;
  }, [rules, tabs, closeTab]);

  const handleDeleteRule = useCallback(async (uid: string) => { await deleteLocalRule(uid); }, [deleteLocalRule]);

  // ── Active tab + breadcrumbs ──────────────────────────────────

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeTabId), [tabs, activeTabId]);

  const breadcrumbs = useMemo(() => {
    if (!activeTab) return [];

    if (activeTab.mode === 'collection-overview') {
      return ['Rules', activeTab.label];
    }

    if (activeTab.mode === 'folder-overview' && activeTab.entityId) {
      // Find folder's parent collection
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
        if (findFolder(col.tree)) {
          return ['Rules', col.name, ...trail, activeTab.label];
        }
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
          if (findRule(col.tree)) {
            return ['Rules', col.name, ...trail, activeTab.label];
          }
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
        setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, label: newName } : t)));
      } else if (activeTab.mode === 'folder-overview' && activeTab.entityId) {
        void renameLocalFolder(activeTab.entityId, newName);
        setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, label: newName } : t)));
      } else {
        setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, label: newName, draftName: t.mode === 'create' ? newName : t.draftName, dirty: true } : t)));
      }
      setPendingRenameTabId(null);
    },
    [activeTab, renameLocalCollection, renameLocalFolder],
  );

  const handleSave = useCallback(() => {
    if (activeTabId) saveRefMap.current.get(activeTabId)?.();
  }, [activeTabId]);

  // ── Cmd+S ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  return (
    <div className="rules-shell" data-theme={isDarkMode ? 'dark' : 'light'} style={{ background: token.colorBgLayout }}>
      {/* Top Bar */}
      <TopBar />

      {/* Main content area */}
      <div className="rules-main">
        {/* Activity Bar */}
        <ActivityBar sidebarVisible={panels.sidebar} onToggleSidebar={() => togglePanel('sidebar')} />

        {/* Resizable panels */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Allotment proportionalLayout={false}>
            {/* Left sidebar */}
            <Allotment.Pane preferredSize={250} minSize={180} maxSize={400} visible={panels.sidebar}>
              <Sidebar
                activeTabId={activeTabId}
                onSelectRule={openEditTab}
                onCreateRule={openCreateTab}
                onDeleteRule={handleDeleteRule}
                onOpenCollectionOverview={openCollectionOverview}
                onOpenFolderOverview={openFolderOverview}
              />
            </Allotment.Pane>

            {/* Center: editor + bottom panel */}
            <Allotment.Pane>
              <Allotment vertical proportionalLayout={false}>
                {/* Editor area */}
                <Allotment.Pane>
                  <div className="rules-editor-area" style={{ background: token.colorBgContainer }}>
                    <TabBar
                      tabs={tabs}
                      activeTabId={activeTabId}
                      onSwitch={switchTab}
                      onClose={closeTab}
                      onCreateRule={openCreateTab}
                    />
                    {activeTab && (
                      <BreadcrumbBar
                        segments={breadcrumbs}
                        isDirty={activeTab.mode === 'create' || activeTab.dirty}
                        onSave={activeTab.mode === 'create' || activeTab.mode === 'edit' ? handleSave : undefined}
                        onRename={handleBreadcrumbRename}
                        autoRenameKey={pendingRenameTabId === activeTabId ? pendingRenameTabId : null}
                      />
                    )}
                    <div className="rules-editor-content">
                      {!activeTab && <EmptyState onCreateRule={openCreateTab} />}
                      {tabs.map((tab) => (
                        <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}>
                          {(tab.mode === 'create' || tab.mode === 'edit') && (
                            <RuleEditor
                              mode={tab.mode}
                              ruleType={tab.createType}
                              ruleUid={tab.ruleUid}
                              tabId={tab.id}
                              draftName={tab.draftName}
                              onSaved={(uid) => handleSaved(tab.id, uid)}
                              onSaveDraft={tab.mode === 'create' ? handleSaveDraft : undefined}
                              onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
                              registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
                            />
                          )}
                          {tab.mode === 'collection-overview' && (
                            <div style={{ padding: '24px 32px' }}>
                              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Collection Overview</h4>
                              <p style={{ fontSize: 13, color: token.colorTextSecondary }}>
                                Expand this collection in the sidebar to add rules and folders.
                              </p>
                            </div>
                          )}
                          {tab.mode === 'folder-overview' && (
                            <div style={{ padding: '24px 32px' }}>
                              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Folder Overview</h4>
                              <p style={{ fontSize: 13, color: token.colorTextSecondary }}>
                                Expand this folder in the sidebar to add rules and subfolders.
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Allotment.Pane>

                {/* Bottom panel */}
                <Allotment.Pane preferredSize={200} minSize={100} maxSize={500} visible={panels.bottomPanel}>
                  <BottomPanel activeTab={bottomPanelTab} onTabChange={setBottomPanelTab} />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>

            {/* Right sidebar (Inspector) */}
            <Allotment.Pane preferredSize={300} minSize={220} maxSize={500} visible={panels.inspector}>
              <Inspector onClose={() => togglePanel('inspector')} />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar panels={panels} onTogglePanel={togglePanel} />

      {/* Save to Collection Modal */}
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
    <RulesAppInner />
  </RuleProvider>
);

export default RulesApp;
