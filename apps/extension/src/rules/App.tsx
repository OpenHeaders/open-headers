/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * Shell layout is rendered by `ShellLayout`, which implements a
 * IDE-style tool-window model with six dock slots and drag-and-drop
 * between them. App.tsx owns data hooks (tabs, rules, templates), routes
 * tool-window content through a `renderToolWindow` prop, and wires
 * shortcuts + command palette entries into the `useToolLayout` state
 * machine. Persistence of dock assignments lives in `useResponsiveLayout`.
 */

import { FolderOutlined } from '@ant-design/icons';
import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { runtime } from '@utils/browser-api';
import type { InputRef } from 'antd';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import BottomPanel from './components/BottomPanel';
import BreadcrumbBar from './components/BreadcrumbBar';
import CollectionOverview from './components/CollectionOverview';
import type { CommandPaletteGroup, CommandPaletteItem, CommandPaletteSection } from './components/CommandPalette';
import CommandPalette from './components/CommandPalette';
import EmptyState from './components/EmptyState';
import FolderOverview from './components/FolderOverview';
import DocsPanel from './components/panels/DocsPanel';
import VariablesPanel from './components/panels/VariablesPanel';
import RuleEditor from './components/RuleEditor';
import RuleFlow from './components/RuleFlow';
import RunReportView from './components/RunReportView';
import SaveToCollectionModal from './components/SaveToCollectionModal';
import ShellLayout from './components/ShellLayout';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { buildRuleIcon } from './components/shared/rule-icon';
import TabBar from './components/TabBar';
import TemplateEditor from './components/TemplateEditor';
import TopBar from './components/TopBar';
import { renderTwoToneIcon } from './components/TwoToneIconPicker';
import { useFocusRegion } from './hooks/useFocusRegion';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { type ResponsiveLayout, useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabs } from './hooks/useTabs';
import { useToolLayout } from './hooks/useToolLayout';
import { shortcutLabel, useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { TEMPLATES_BY_TYPE } from './rule-templates';
import type { DockSlot, RuleFlowScope, RulesTab, ToolWindowId } from './types';

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

// ── Shell loader ────────────────────────────────────────────────────
//
// Mounts `useResponsiveLayout` first, then gates rendering of the full
// workspace until the persisted layout record has loaded from storage.
// This guarantees `useWorkspaceLayout` is initialized with the user's
// saved panel configuration on the very first render — no hydration
// effect that could race against early clicks. Once we fall through the
// gate, `layout.persistedWorkspace` is either the loaded record or null
// (fresh profile), and we pass it straight into `RulesAppWorkspace`.

const RulesAppInner: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { token } = theme.useToken();
  const layout = useResponsiveLayout();

  if (!layout.ready) {
    return (
      <div
        className="rules-shell rules-shell-loading"
        data-theme={isDarkMode ? 'dark' : 'light'}
        style={{ background: token.colorBgLayout }}
      />
    );
  }

  return <RulesAppWorkspace layout={layout} />;
};

// ── Workspace component (needs RuleContext + loaded layout) ─────────

interface RulesAppWorkspaceProps {
  layout: ResponsiveLayout;
}

const RulesAppWorkspace: React.FC<RulesAppWorkspaceProps> = ({ layout }) => {
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
    templateCollectionTrees,
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

  // ── Tool-window layout state machine ───────────────────────────
  // Authoritative state for the IDE-style six-dock shell. Owns
  // dock assignments, hidden list, bottomFullWidth, showLabels, and
  // the focused region accent. useResponsiveLayout feeds the persisted
  // snapshot in on mount and receives updates to persist back out.
  const tl = useToolLayout({
    initial: layout.persistedToolLayout ?? undefined,
    onPersist: layout.persistToolLayout,
  });

  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // Auto-collapse sidebar on narrow viewports (first-open only).
  const sidebarAutoCollapsedRef = useRef(false);
  useEffect(() => {
    if (sidebarAutoCollapsedRef.current) return;
    sidebarAutoCollapsedRef.current = true;
    if (layout.shouldCollapseSidebar) {
      tl.closeDock('left-top');
      tl.closeDock('left-bottom');
    }
  }, [layout.shouldCollapseSidebar, tl]);

  // Shell root ref for the focus-region tracker.
  const shellRef = useRef<HTMLDivElement>(null);
  const focus = useFocusRegion({
    shellRef,
    setFocusedRegion: tl.setFocusedRegion,
    setFocusedDock: tl.setFocusedDock,
  });

  // ── Region cycling — shared semantics for clicks and Alt+1..4 ───
  //
  // With the tool-window model, "toggling a region" maps to collapsing
  // every dock in that region (remembering which was active) or restoring
  // them. The region focus API runs independently via focus.focusRegion.
  const cycleRegion = useCallback(
    (region: 'left' | 'right' | 'bottom' | 'editor') => {
      if (region === 'editor') {
        focus.focusRegion('editor');
        return;
      }
      const isFocused = tl.state.focusedRegion === region;
      const isOpen = tl.isRegionOpen(region);

      if (isOpen && isFocused) {
        tl.toggleRegion(region);
        focus.focusRegion('editor');
        return;
      }
      if (!isOpen) {
        tl.toggleRegion(region);
      }
      focus.focusRegion(region);
    },
    [tl, focus],
  );

  const togglePanel = useCallback(
    (panel: 'sidebar' | 'bottomPanel' | 'inspector') => {
      const region: 'left' | 'right' | 'bottom' =
        panel === 'sidebar' ? 'left' : panel === 'inspector' ? 'right' : 'bottom';
      tl.toggleRegion(region);
    },
    [tl],
  );

  // Register right-pane-open callback for useInspectorNav. The hook's
  // openDocs() fires this when any deep-linked component (RuleEditor
  // condition help, shortcuts modal, etc.) wants to surface the docs.
  const { onOpenInspector, openDocs } = useInspectorNav();
  onOpenInspector.current = useCallback(() => {
    // Restore the Docs window if it was hidden, then activate it in its
    // current dock.
    if (tl.state.hidden.includes('docs')) tl.restoreWindow('docs');
    tl.activateWindow('docs');
  }, [tl]);

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
        testOwnerType: 'rule',
        testOwnerId: uid,
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
      const tab: RulesTab = {
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'collection-overview',
        entityId: uid,
        testOwnerType: 'collection',
        testOwnerId: uid,
      };
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
      const tab: RulesTab = {
        id,
        label: name,
        ruleType: '',
        dirty: false,
        mode: 'folder-overview',
        entityId: uid,
        testOwnerType: 'folder',
        testOwnerId: uid,
      };
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

  const openRunReport = useCallback(
    (
      runId: string,
      owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
      ownerName?: string,
    ) => {
      const id = `run-${runId}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) {
        switchTab(id);
        return;
      }
      // Tab label format `Test Run · <owner name>` — TabBar truncates
      // the suffix while keeping the prefix intact so the user always
      // sees that this is a run report. Falls back to plain "Test Run"
      // when the owner name isn't known (shouldn't happen via the
      // normal entry paths, but keeps the type loose).
      const label = ownerName ? `Test Run · ${ownerName}` : 'Test Run';
      const tab: RulesTab = {
        id,
        label,
        ruleType: '',
        dirty: false,
        mode: 'run-report',
        testRunId: runId,
        testOwnerType: owner?.type,
        testOwnerId: owner?.id,
      };
      addTab(tab);
    },
    [tabs, addTab, switchTab],
  );

  const openRuleFlow = useCallback(
    (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => {
      const id = entityId ? `flow-${entityId}` : `flow-${scope}`;
      const existing = tabs.find((t) => t.id === id);
      if (existing) {
        switchTab(id);
        return;
      }
      const flowLabel = label
        ? `Flow — ${label}`
        : scope === 'all-active'
          ? 'Flow — All Active Rules'
          : 'Flow — This Page';
      const tab: RulesTab = {
        id,
        label: flowLabel,
        ruleType: '',
        dirty: false,
        mode: 'rule-flow',
        entityId,
        flowScope: scope,
        flowTabUrl: tabUrl,
      };
      addTab(tab);
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
  const openRuleFlowRef = useRef(openRuleFlow);
  const openRunReportRef = useRef(openRunReport);
  openCreateTabRef.current = openCreateTab;
  openEditTabRef.current = openEditTab;
  openDocsRef.current = openDocs;
  openRuleFlowRef.current = openRuleFlow;
  openRunReportRef.current = openRunReport;

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
      // #/docs/{sectionId} — surface the Docs tool window via useInspectorNav.
      openDocsRef.current(parts[1]);
    } else if (parts[0] === 'flow') {
      // #/flow/this-page/https://example.com/path — URL is everything after scope
      const flowScope = parts[1] as RuleFlowScope;
      const flowUrl = parts.length > 2 ? parts.slice(2).join('/') : undefined;
      openRuleFlowRef.current(flowScope, undefined, undefined, flowUrl);
    } else if (parts[0] === 'test' && parts[1]) {
      // #/test/{runId} — open persisted test run report.
      // The widget URL only carries the run id, so we look up the run
      // here to recover its owner. Without the owner stamp the bottom
      // panel can't surface the contextual Test Runs tab, and the user
      // lands on a report tab with no owner trail.
      const runId = parts[1];
      runtime.sendMessage({ type: 'getTestRun', runId }, (response: unknown) => {
        const data = response as {
          success?: boolean;
          run?: { ownerType?: string; ownerId?: string; ownerNameAtRun?: string } | null;
        } | null;
        const run = data?.run ?? null;
        const ownerType = run?.ownerType as 'rule' | 'folder' | 'collection' | 'workspace' | undefined;
        const ownerId = run?.ownerId;
        const owner = ownerType && ownerId ? { type: ownerType, id: ownerId } : undefined;
        openRunReportRef.current(runId, owner, run?.ownerNameAtRun);
      });
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

    if (activeTab.mode === 'run-report') {
      // Walk to whatever owner this test result belongs to so the user
      // sees "Rules > Collection > Folder? > Rule? > Test Result". The
      // owner stamp comes from the bottom-panel click that opened it.
      const ownerType = activeTab.testOwnerType;
      const ownerId = activeTab.testOwnerId;
      if (ownerType && ownerId) {
        if (ownerType === 'workspace') {
          return ['Rules', 'All Rules', 'Run Report'];
        }
        if (ownerType === 'collection') {
          const col = localCollectionTrees.find((c) => c.uid === ownerId);
          if (col) return ['Rules', col.name, 'Run Report'];
        }
        if (ownerType === 'folder') {
          for (const col of localCollectionTrees) {
            const trail: string[] = [];
            const findFolder = (nodes: V5.TreeNode[]): boolean => {
              for (const n of nodes) {
                if (n.type === 'folder' && n.uid === ownerId) {
                  trail.push(n.name);
                  return true;
                }
                if (n.type === 'folder') {
                  trail.push(n.name);
                  if (findFolder(n.children)) return true;
                  trail.pop();
                }
              }
              return false;
            };
            if (findFolder(col.tree)) return ['Rules', col.name, ...trail, 'Run Report'];
          }
        }
        if (ownerType === 'rule') {
          const rule = rules.find((r) => r.uid === ownerId);
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
              if (findRule(col.tree)) return ['Rules', col.name, ...trail, rule.name, 'Run Report'];
            }
          }
        }
      }
      return ['Rules', 'Run Report'];
    }

    if (activeTab.mode === 'rule-flow') {
      if (activeTab.flowScope === 'collection' && activeTab.entityId) {
        const col = localCollectionTrees.find((c) => c.uid === activeTab.entityId);
        if (col) return ['Rules', col.name, 'Flow'];
      }
      if (activeTab.flowScope === 'folder' && activeTab.entityId) {
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
          if (findFolder(col.tree)) return ['Rules', col.name, ...trail, 'Flow'];
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

  // ── Tab navigation for shortcuts ─────────────────────────────

  const handlePrevTab = useCallback(() => {
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const prev = idx > 0 ? tabs[idx - 1] : tabs[tabs.length - 1];
    switchTab(prev.id);
  }, [tabs, activeTabId, switchTab]);

  const handleNextTab = useCallback(() => {
    if (tabs.length < 2 || !activeTabId) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    const next = idx < tabs.length - 1 ? tabs[idx + 1] : tabs[0];
    switchTab(next.id);
  }, [tabs, activeTabId, switchTab]);

  const handleCloseActiveTab = useCallback(() => {
    if (activeTabId) handleCloseTab(activeTabId);
  }, [activeTabId, handleCloseTab]);

  // Sidebar filter focus ref
  const sidebarFilterRef = useRef<InputRef>(null);

  // Keyboard shortcuts help — toggle the right pane pointing at the docs
  // "Keyboard shortcuts" section. If the right pane is already showing
  // docs, close it; otherwise open it to that section.
  const handleShowShortcuts = useCallback(() => {
    const docsSlot = tl.dockOf('docs');
    if (docsSlot && tl.state.docks[docsSlot].active === 'docs') {
      tl.toggleWindow('docs');
    } else {
      openDocs('keyboard-shortcuts');
    }
  }, [tl, openDocs]);

  // ── Command palette data ──────────────────────────────────────

  /** Navigable groups: rule collections, system templates, user template collections. */
  const cmdGroups = useMemo((): CommandPaletteGroup[] => {
    const result: CommandPaletteGroup[] = [];

    // Rule collections — drill in to see rules inside
    for (const col of localCollectionTrees) {
      const ruleItems: CommandPaletteItem[] = [];
      const walk = (nodes: V5.TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'rule') {
            const rule = rules.find((r) => r.uid === node.uid);
            ruleItems.push({
              id: `rule-${node.uid}`,
              icon: buildRuleIcon({ ruleType: node.ruleType, rule, isActive: node.enabled }),
              label: node.name,
              scope: RULE_TYPE_LABELS[node.ruleType] ?? 'Rule',
              onSelect: () => openEditTab(node.uid),
            });
          } else if (node.type === 'folder') {
            walk(node.children);
          }
        }
      };
      walk(col.tree);
      result.push({
        id: `col-${col.uid}`,
        icon: <FolderOutlined style={{ fontSize: 12 }} />,
        label: col.name,
        children: [{ id: `rules-in-${col.uid}`, title: 'Rules', items: ruleItems }],
      });
    }

    // System templates — grouped by rule type, selecting creates a rule from template
    const systemSections: CommandPaletteSection[] = [];
    for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
      if (tpls.length === 0) continue;
      systemSections.push({
        id: `sys-tpl-${ruleType}`,
        title: RULE_TYPE_LABELS[ruleType] ?? ruleType,
        items: tpls.map((tpl) => ({
          id: `sys-tpl-${tpl.key}`,
          icon: <span style={{ fontSize: 12 }}>{tpl.icon}</span>,
          label: tpl.name,
          scope: tpl.description,
          onSelect: () => openCreateTab(ruleType, undefined, tpl.key),
        })),
      });
    }
    result.push({
      id: 'sys-templates',
      icon: <FolderOutlined style={{ fontSize: 12 }} />,
      label: 'System Templates',
      children: systemSections,
    });

    // User template collections — drill in to see templates inside
    for (const col of templateCollectionTrees) {
      const tplItems: CommandPaletteItem[] = [];
      const walkTpl = (nodes: V5.TreeNode[]) => {
        for (const node of nodes) {
          if (node.type === 'template') {
            tplItems.push({
              id: `tpl-${node.uid}`,
              icon:
                renderTwoToneIcon(node.icon, { fontSize: 12 }) ||
                buildRuleIcon({ ruleType: node.ruleType, isActive: false }),
              label: node.name,
              scope: RULE_TYPE_LABELS[node.ruleType] ?? 'Template',
              onSelect: () => openTemplateEditTab(node.uid),
            });
          } else if (node.type === 'folder') {
            walkTpl(node.children);
          }
        }
      };
      walkTpl(col.tree);
      if (tplItems.length > 0) {
        result.push({
          id: `tpl-col-${col.uid}`,
          icon: <FolderOutlined style={{ fontSize: 12 }} />,
          label: col.name,
          children: [{ id: `tpls-in-${col.uid}`, title: 'Templates', items: tplItems }],
        });
      }
    }

    return result;
  }, [localCollectionTrees, templateCollectionTrees, rules, openEditTab, openCreateTab, openTemplateEditTab]);

  /** Flat sections: create commands, panel commands. */
  const cmdSections = useMemo((): CommandPaletteSection[] => {
    const result: CommandPaletteSection[] = [];

    // Create new rule commands
    const ruleTypes = ['header', 'block', 'redirect', 'query-param', 'inject', 'delay', 'body', 'mock'] as const;
    result.push({
      id: 'create',
      title: 'Create',
      items: [
        {
          id: 'cmd-create-rule',
          label: 'Create Rule...',
          shortcut: shortcutLabel('new-rule'),
          onSelect: () => {
            setCreateMenuOpen((prev) => {
              if (!prev) {
                const tryFocus = (attempts: number) => {
                  const firstItem = document.querySelector(
                    '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:not(.ant-dropdown-menu-item-disabled)',
                  ) as HTMLElement | null;
                  if (firstItem) {
                    firstItem.focus();
                  } else if (attempts > 0) {
                    requestAnimationFrame(() => tryFocus(attempts - 1));
                  }
                };
                requestAnimationFrame(() => tryFocus(5));
              }
              return !prev;
            });
          },
        },
        ...ruleTypes.map((type) => ({
          id: `cmd-new-${type}`,
          icon: buildRuleIcon({ ruleType: type, isActive: true }),
          label: `New ${RULE_TYPE_LABELS[type]}`,
          onSelect: () => openCreateTab(type),
        })),
      ],
    });

    // Panel / layout commands
    result.push({
      id: 'commands',
      title: 'Commands',
      items: [
        {
          id: 'cmd-toggle-sidebar',
          label: 'Toggle Sidebar',
          shortcut: shortcutLabel('toggle-sidebar'),
          onSelect: () => togglePanel('sidebar'),
        },
        {
          id: 'cmd-toggle-bottom',
          label: 'Toggle Bottom Panel',
          shortcut: shortcutLabel('toggle-bottom'),
          onSelect: () => togglePanel('bottomPanel'),
        },
        {
          id: 'cmd-toggle-inspector',
          label: 'Toggle Inspector',
          shortcut: shortcutLabel('toggle-inspector'),
          onSelect: () => togglePanel('inspector'),
        },
        {
          id: 'cmd-shortcuts',
          label: 'Keyboard Shortcuts',
          shortcut: '?',
          onSelect: handleShowShortcuts,
        },
      ],
    });

    return result;
  }, [openCreateTab, togglePanel, handleShowShortcuts]);

  // ── Global keyboard shortcuts ─────────────────────────────────

  useWorkspaceShortcuts({
    onToggleSidebar: () => togglePanel('sidebar'),
    onToggleBottomPanel: () => togglePanel('bottomPanel'),
    onToggleInspector: () => togglePanel('inspector'),
    onCloseTab: handleCloseActiveTab,
    onPrevTab: handlePrevTab,
    onNextTab: handleNextTab,
    onSave: handleSave,
    onNewRule: () => {
      setCreateMenuOpen((prev) => {
        if (!prev) {
          const tryFocus = (attempts: number) => {
            const firstItem = document.querySelector(
              '.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item:not(.ant-dropdown-menu-item-disabled)',
            ) as HTMLElement | null;
            if (firstItem) {
              firstItem.focus();
            } else if (attempts > 0) {
              requestAnimationFrame(() => tryFocus(attempts - 1));
            }
          };
          requestAnimationFrame(() => tryFocus(5));
        }
        return !prev;
      });
    },
    onFocusFilter: () => {
      if (!tl.isRegionOpen('left')) togglePanel('sidebar');
      sidebarFilterRef.current?.focus();
    },
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShowShortcuts: handleShowShortcuts,
    // Alt/Option + 1..4 delegates straight to the shared cycleRegion
    // helper. Same semantics as clicking the corresponding activity-bar
    // icon, so muscle memory stays consistent between keyboard and mouse.
    onFocusRegion: (region) => cycleRegion(region),
    hasActiveTab: () => activeTabId != null,
  });

  // Allotment onChange handlers — persist ratios to storage via the
  // responsive layout hook. We no longer need to mirror "pane dragged to
  // zero" into a state-machine collapse because ShellLayout's Allotment
  // panes use `visible` driven directly by tool-window dock state.
  const handleHorizontalResize = useCallback((panelSizes: number[]) => layout.onPanelResize(panelSizes), [layout]);

  const handleVerticalResize = useCallback((panelSizes: number[]) => layout.onVerticalResize(panelSizes), [layout]);

  // ── Test run owner context ────────────────────────────────────
  // The bottom panel's Test Runs tab only renders when the active
  // main-panel tab has an owner. We compute that here from the active
  // tab's stamped fields and pass both the owner and an "open it"
  // helper down to the overview pages and the bottom panel itself.

  const contextOwner = useMemo(() => {
    if (!activeTab?.testOwnerType || !activeTab.testOwnerId) return null;
    return { type: activeTab.testOwnerType, id: activeTab.testOwnerId };
  }, [activeTab]);

  const openTestRunsPanel = useCallback(() => {
    if (tl.state.hidden.includes('test-runs')) tl.restoreWindow('test-runs');
    tl.activateWindow('test-runs');
  }, [tl]);

  // Whenever the active main-panel tab is a run-report tab, auto-open
  // the bottom panel and focus its Test Runs tab. Covers both entry
  // paths — clicking a row in the bottom panel and landing here from the
  // in-page widget's "View results" link — so the user always sees the
  // owning bucket alongside the report. activeTab.id is in the deps so
  // switching from one run-report tab to another also re-triggers the
  // panel focus, even though only mode is read inside.
  // biome-ignore lint/correctness/useExhaustiveDependencies: id triggers re-run on tab switch
  useEffect(() => {
    if (activeTab?.mode === 'run-report') {
      openTestRunsPanel();
    }
  }, [activeTab?.mode, activeTab?.id, openTestRunsPanel]);

  // After the user deletes a run from inside the report tab, close that
  // tab and refocus the bottom panel's Test Runs list so they land
  // somewhere coherent (the original UX bug was a "run not found" empty
  // state).
  const handleRunReportDeleted = useCallback(
    (tabId: string) => {
      rawCloseTab(tabId, true);
      openTestRunsPanel();
    },
    [rawCloseTab, openTestRunsPanel],
  );

  // Editor area content (shared between both layouts)
  const editorArea = (
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
        createMenuOpen={createMenuOpen}
        onCreateMenuOpenChange={setCreateMenuOpen}
      />
      {activeTab && (
        <BreadcrumbBar
          segments={breadcrumbs}
          isDirty={activeTab.mode === 'create' || activeTab.dirty}
          onSave={activeTab.mode === 'create' || activeTab.mode === 'edit' ? handleSave : undefined}
          onSaveAsTemplate={activeTab.mode === 'create' || activeTab.mode === 'edit' ? handleSaveAsTemplate : undefined}
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
                onOpenRuleFlow={openRuleFlow}
                onOpenTestRuns={openTestRunsPanel}
              />
            )}
            {tab.mode === 'folder-overview' && tab.entityId && (
              <FolderOverview
                folderUid={tab.entityId}
                onSelectRule={openEditTab}
                onCreateRule={openCreateTab}
                onOpenFolderOverview={openFolderOverview}
                onOpenRuleFlow={openRuleFlow}
                onOpenTestRuns={openTestRunsPanel}
              />
            )}
            {tab.mode === 'template-edit' && tab.templateUid && (
              <TemplateEditor
                templateUid={tab.templateUid}
                onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
                registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
              />
            )}
            {tab.mode === 'rule-flow' && (
              <RuleFlow
                scope={tab.flowScope ?? 'all-active'}
                entityId={tab.entityId}
                initialTabUrl={tab.flowTabUrl}
                onSelectRule={openEditTab}
                onCreateRule={openCreateTab}
              />
            )}
            {tab.mode === 'run-report' && tab.testRunId && (
              <RunReportView
                runId={tab.testRunId}
                onSelectRule={openEditTab}
                onAfterDelete={() => handleRunReportDeleted(tab.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ── Tool window renderer — routes tool window ids to their content.
  // Each tool window's body is a React node the shell mounts inside its
  // active dock pane. Sidebar is the only dock body that needs rules
  // data wiring; the other windows are self-contained panels.
  const renderToolWindow = useCallback(
    (id: ToolWindowId, _slot: DockSlot): React.ReactNode => {
      switch (id) {
        case 'items':
          return (
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
              filterRef={sidebarFilterRef}
            />
          );
        case 'docs':
          return <DocsPanel onClose={() => tl.toggleWindow('docs')} />;
        case 'variables':
          return <VariablesPanel onClose={() => tl.toggleWindow('variables')} />;
        case 'page-traffic':
        case 'test-runs':
          return (
            <BottomPanel
              activeTab={id === 'test-runs' ? 'test-runs' : 'traffic'}
              onTabChange={() => {
                /* BottomPanel is now slot-scoped — tab strip lives on the dock */
              }}
              contextOwner={contextOwner}
              onOpenTestRun={openRunReport}
              activeRunId={activeTab?.mode === 'run-report' ? (activeTab.testRunId ?? null) : null}
            />
          );
        default:
          return null;
      }
    },
    [
      activeTabId,
      openEditTab,
      openCreateTab,
      handleDeleteRule,
      openCollectionOverview,
      openFolderOverview,
      openTemplateEditTab,
      openTemplateCollectionOverview,
      openTemplateFolderOverview,
      tl,
      contextOwner,
      openRunReport,
      activeTab,
    ],
  );

  return (
    <div
      ref={shellRef}
      className="rules-shell"
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{ background: token.colorBgLayout }}
    >
      <TopBar onCommandPalette={() => setCommandPaletteOpen(true)} />

      <ShellLayout
        tl={tl}
        responsive={layout}
        renderToolWindow={renderToolWindow}
        renderEditor={() => editorArea}
        onHorizontalResize={handleHorizontalResize}
        onVerticalResize={handleVerticalResize}
      />

      <StatusBar tl={tl} />

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

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        groups={cmdGroups}
        sections={cmdSections}
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
