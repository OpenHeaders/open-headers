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
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const { rules, deleteLocalRule, localCollections, localCollectionTrees, createLocalRule, createLocalCollection } = useRules();

  const [tabs, setTabs] = useState<RulesTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [panels, setPanels] = useState<PanelVisibility>({
    sidebar: true,
    bottomPanel: false,
    inspector: false,
  });
  const [bottomPanelTab, setBottomPanelTab] = useState('traffic');

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
    (type: string) => {
      createCounter++;
      const id = `create-${createCounter}`;
      const draftName = generateDraftName(type);
      const tab: RulesTab = { id, label: draftName, ruleType: type, dirty: false, mode: 'create', createType: type, draftName };
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(id);
    },
    [generateDraftName],
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
    if (activeTab.mode === 'edit' && activeTab.ruleUid) {
      const rule = rules.find((r) => r.uid === activeTab.ruleUid);
      const pathParts = rule?.path.split('/');
      const collectionSlug = pathParts && pathParts.length >= 2 ? pathParts[1] : 'Rules';
      return ['Rules', collectionSlug, activeTab.label];
    }
    return ['Rules', activeTab.label];
  }, [activeTab, rules]);

  const handleBreadcrumbRename = useCallback(
    (newName: string) => {
      if (!activeTab?.ruleUid) return;
      setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, label: newName, dirty: true } : t)));
    },
    [activeTab],
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

        {/* Left sidebar */}
        {panels.sidebar && (
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
            }}
          >
            <Sidebar
              activeTabId={activeTabId}
              onSelectRule={openEditTab}
              onCreateRule={openCreateTab}
              onDeleteRule={handleDeleteRule}
            />
          </div>
        )}

        {/* Center: editor + bottom panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Editor area */}
          <div className="rules-editor-area" style={{ background: token.colorBgContainer, flex: 1, minHeight: 0 }}>
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
                isDirty={activeTab.dirty}
                onSave={handleSave}
                onRename={activeTab.mode === 'edit' ? handleBreadcrumbRename : undefined}
              />
            )}
            <div className="rules-editor-content">
              {!activeTab && <EmptyState onCreateRule={openCreateTab} />}
              {tabs.map((tab) => (
                <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}>
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
                </div>
              ))}
            </div>
          </div>

          {/* Bottom panel */}
          {panels.bottomPanel && (
            <div style={{ height: 200, flexShrink: 0, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
              <BottomPanel activeTab={bottomPanelTab} onTabChange={setBottomPanelTab} />
            </div>
          )}
        </div>

        {/* Right sidebar (Inspector) */}
        {panels.inspector && (
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              overflow: 'hidden',
            }}
          >
            <Inspector onClose={() => togglePanel('inspector')} />
          </div>
        )}
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
