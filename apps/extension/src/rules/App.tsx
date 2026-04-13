/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * Mirrors the desktop V5 shell layout exactly:
 *   TopBar | ActivityBar | Sidebar | TabBar + BreadcrumbBar + Editor | BottomPanel | Inspector | StatusBar
 *
 * Tab state extracted to useTabs hook. Dirty confirmation in useTabLifecycle hook.
 */

import { FolderOutlined } from '@ant-design/icons';
import { RuleProvider } from '@context/RuleContext';
import { useTheme } from '@context/ThemeContext';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { runtime } from '@utils/browser-api';
import { Allotment, LayoutPriority } from 'allotment';
import type { InputRef } from 'antd';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'allotment/dist/style.css';
import ActivityBar from './components/ActivityBar';
import BottomPanel from './components/BottomPanel';
import BreadcrumbBar from './components/BreadcrumbBar';
import CollectionOverview from './components/CollectionOverview';
import type { CommandPaletteGroup, CommandPaletteItem, CommandPaletteSection } from './components/CommandPalette';
import CommandPalette from './components/CommandPalette';
import EmptyState from './components/EmptyState';
import FolderOverview from './components/FolderOverview';
import Inspector from './components/Inspector';
import RuleEditor from './components/RuleEditor';
import RuleFlow from './components/RuleFlow';
import RunReportView from './components/RunReportView';
import SaveToCollectionModal from './components/SaveToCollectionModal';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { buildRuleIcon } from './components/shared/rule-icon';
import TabBar from './components/TabBar';
import TemplateEditor from './components/TemplateEditor';
import TopBar from './components/TopBar';
import { renderTwoToneIcon } from './components/TwoToneIconPicker';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabs } from './hooks/useTabs';
import { shortcutLabel, useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { TEMPLATES_BY_TYPE } from './rule-templates';
import type { PanelVisibility, RuleFlowScope, RulesTab } from './types';

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

  // ── Responsive layout ─────────────────────────────────────────
  const layout = useResponsiveLayout();

  // ── Panels ────────────────────────────────────────────────────
  const [panels, setPanels] = useState<PanelVisibility>({ sidebar: true, bottomPanel: false, inspector: false });
  const [bottomPanelTab, setBottomPanelTab] = useState('traffic');
  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // Auto-collapse sidebar on narrow viewports (first-open only)
  const sidebarAutoCollapsedRef = useRef(false);
  useEffect(() => {
    if (!layout.ready || sidebarAutoCollapsedRef.current) return;
    sidebarAutoCollapsedRef.current = true;
    if (layout.shouldCollapseSidebar) {
      setPanels((prev) => ({ ...prev, sidebar: false }));
    }
  }, [layout.ready, layout.shouldCollapseSidebar]);

  // Focus management ref
  const sidebarToggleRef = useRef<HTMLDivElement>(null);

  const togglePanel = useCallback((panel: keyof PanelVisibility) => {
    setPanels((prev) => {
      const next = { ...prev, [panel]: !prev[panel] };

      // Focus management: sidebar collapse → focus activity bar toggle
      if (panel === 'sidebar' && !next.sidebar) {
        requestAnimationFrame(() => sidebarToggleRef.current?.focus());
      }

      // Clear docs-focused wide mode when inspector closes
      if (panel === 'inspector' && !next.inspector) {
        setInspectorWide(false);
      }

      return next;
    });
  }, []);

  // Inspector "docs-focused" mode: when opened via #/docs/ hash, use wider size.
  // Initialized synchronously from hash so preferredSize is correct on first render —
  // allotment only reads preferredSize on initial pane mount (no cached size on fresh page load).
  const [inspectorWide, setInspectorWide] = useState(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash.startsWith('docs/');
  });

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
      // #/docs/{sectionId} — open inspector in wide mode for focused reading
      setInspectorWide(true);
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

  // Keyboard shortcuts help — toggle inspector with shortcuts section
  const handleShowShortcuts = useCallback(() => {
    if (panels.inspector) {
      togglePanel('inspector');
    } else {
      openDocs('keyboard-shortcuts');
    }
  }, [panels.inspector, togglePanel, openDocs]);

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
      if (!panels.sidebar) togglePanel('sidebar');
      sidebarFilterRef.current?.focus();
    },
    onCommandPalette: () => setCommandPaletteOpen(true),
    onShowShortcuts: handleShowShortcuts,
    hasActiveTab: () => activeTabId != null,
  });

  // Compute coordinated sidebar size when inspector opens
  const coordinatedSidebarPreferred = panels.inspector
    ? (layout.getCoordinatedSidebarSize(true) ?? layout.sizes.sidebar.preferred)
    : layout.sizes.sidebar.preferred;

  // Sync panels state when allotment snaps a pane closed or user drags it back open
  const handleHorizontalResize = useCallback(
    (panelSizes: number[]) => {
      layout.onPanelResize(panelSizes);
      setPanels((prev) => {
        const sidebarOpen = panelSizes[0] != null ? panelSizes[0] > 0 : prev.sidebar;
        const inspectorOpen = panelSizes[2] != null ? panelSizes[2] > 0 : prev.inspector;
        if (sidebarOpen === prev.sidebar && inspectorOpen === prev.inspector) return prev;
        // Clear docs-focused wide mode when inspector closes
        if (!inspectorOpen && prev.inspector) setInspectorWide(false);
        return { ...prev, sidebar: sidebarOpen, inspector: inspectorOpen };
      });
    },
    [layout],
  );

  const handleVerticalResize = useCallback(
    (panelSizes: number[]) => {
      layout.onVerticalResize(panelSizes);
      setPanels((prev) => {
        const bottomOpen = panelSizes[1] != null ? panelSizes[1] > 0 : prev.bottomPanel;
        if (bottomOpen === prev.bottomPanel) return prev;
        return { ...prev, bottomPanel: bottomOpen };
      });
    },
    [layout],
  );

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
    setBottomPanelTab('test-runs');
    setPanels((prev) => (prev.bottomPanel ? prev : { ...prev, bottomPanel: true }));
  }, []);

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

  return (
    <div className="rules-shell" data-theme={isDarkMode ? 'dark' : 'light'} style={{ background: token.colorBgLayout }}>
      <TopBar onCommandPalette={() => setCommandPaletteOpen(true)} />

      <div className="rules-main">
        <ActivityBar
          sidebarVisible={panels.sidebar}
          onToggleSidebar={() => togglePanel('sidebar')}
          ref={sidebarToggleRef}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Allotment proportionalLayout={false} onChange={handleHorizontalResize}>
            <Allotment.Pane
              preferredSize={coordinatedSidebarPreferred}
              minSize={layout.sizes.sidebar.min}
              maxSize={layout.sizes.sidebar.max}
              visible={panels.sidebar}
              priority={LayoutPriority.Low}
              snap
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
                filterRef={sidebarFilterRef}
              />
            </Allotment.Pane>

            <Allotment.Pane priority={LayoutPriority.High} minSize={layout.sizes.editorMin}>
              <Allotment vertical proportionalLayout={false} onChange={handleVerticalResize}>
                <Allotment.Pane>{editorArea}</Allotment.Pane>

                <Allotment.Pane
                  preferredSize={layout.sizes.bottom.preferred}
                  minSize={layout.sizes.bottom.min}
                  maxSize={layout.sizes.bottom.max}
                  visible={panels.bottomPanel}
                  snap
                >
                  <BottomPanel
                    activeTab={bottomPanelTab}
                    onTabChange={setBottomPanelTab}
                    contextOwner={contextOwner}
                    onOpenTestRun={openRunReport}
                    activeRunId={activeTab?.mode === 'run-report' ? (activeTab.testRunId ?? null) : null}
                  />
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>

            <Allotment.Pane
              preferredSize={
                inspectorWide
                  ? Math.max(layout.sizes.inspector.preferred, Math.round((window.innerWidth - 64) * 0.4))
                  : layout.sizes.inspector.preferred
              }
              minSize={layout.sizes.inspector.min}
              maxSize={inspectorWide ? Math.round((window.innerWidth - 64) * 0.5) : layout.sizes.inspector.max}
              visible={panels.inspector}
              snap
            >
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
