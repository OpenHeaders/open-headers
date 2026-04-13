/**
 * Rules App — full-page rule management in its own browser tab.
 *
 * Shell layout (IDE tool-window model):
 *   TopBar
 *   ├── LeftActivityBar (top group → left pane, bottom group → bottom pane)
 *   ├── Left Allotment pane (Items / future left-top panels)
 *   ├── Editor + BottomPanel (vertical Allotment inside the middle pane)
 *   ├── Right Allotment pane (Docs / Variables / future right panels)
 *   └── RightActivityBar (permanent strip symmetric to the left one)
 *   StatusBar
 *
 * All layout state (which panels are open, which region has focus, whether
 * activity bars show labels) lives in useWorkspaceLayout. Size ratios still
 * live in useResponsiveLayout. Tab state is in useTabs; dirty confirmation
 * in useTabLifecycle.
 */

import {
  AppstoreOutlined,
  BookOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  ExperimentOutlined,
  FolderOutlined,
  FundViewOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
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
import ActivityBar, { type ActivityBarItem } from './components/ActivityBar';
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
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { buildRuleIcon } from './components/shared/rule-icon';
import TabBar from './components/TabBar';
import TemplateEditor from './components/TemplateEditor';
import TopBar from './components/TopBar';
import { renderTwoToneIcon } from './components/TwoToneIconPicker';
import { InspectorNavProvider, useInspectorNav } from './hooks/useInspectorNav';
import { useFocusRegion } from './hooks/useFocusRegion';
import { type ResponsiveLayout, useResponsiveLayout } from './hooks/useResponsiveLayout';
import { useTabLifecycle } from './hooks/useTabLifecycle';
import { useTabs } from './hooks/useTabs';
import { LEFT_BOTTOM_LAUNCHERS, useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import { shortcutLabel, useWorkspaceShortcuts } from './hooks/useWorkspaceShortcuts';
import { TEMPLATES_BY_TYPE } from './rule-templates';
import type { LeftPanelKey, RightPanelKey, RuleFlowScope, RulesTab } from './types';

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

  // ── Workspace layout state machine ────────────────────────────
  // Owns: leftPanel, rightPanel, bottomOpen, bottomTab, focusedRegion,
  // activityBarLabels. Mutations funnelled through this one API.
  // Initial values come from useResponsiveLayout's persisted bundle so
  // a refresh restores the exact panel configuration the user left with.
  const ws = useWorkspaceLayout({
    initial: layout.persistedWorkspace
      ? {
          leftPanel: layout.persistedWorkspace.leftPanel,
          rightPanel: layout.persistedWorkspace.rightPanel,
          bottomOpen: layout.persistedWorkspace.bottomOpen,
          activityBarLabels: layout.persistedWorkspace.activityBarLabels,
        }
      : undefined,
    initialBottomTab: layout.persistedWorkspace?.bottomTab,
    onPersist: layout.persistWorkspaceLayout,
  });

  // Legacy adapter for components that still speak the old PanelVisibility
  // vocabulary (StatusBar, cmd palette labels, shortcut handlers). We keep
  // it tiny — three booleans derived from the state machine plus a toggle
  // that maps the old keys back to the new setters. This avoids a churn
  // through half a dozen unrelated files.
  const panels = useMemo(
    () => ({
      sidebar: ws.layout.leftPanel !== null,
      bottomPanel: ws.layout.bottomOpen,
      inspector: ws.layout.rightPanel !== null,
    }),
    [ws.layout.leftPanel, ws.layout.bottomOpen, ws.layout.rightPanel],
  );

  // Remember the last top-group left panel so Cmd+B toggling restores it.
  const lastLeftTopRef = useRef<LeftPanelKey>(ws.layout.leftPanel ?? 'items');
  useEffect(() => {
    if (ws.layout.leftPanel !== null) lastLeftTopRef.current = ws.layout.leftPanel;
  }, [ws.layout.leftPanel]);

  // Same idea for the right panel: restore the previously-open panel when
  // the user reopens via Cmd+\ after closing with the same shortcut.
  const lastRightRef = useRef<RightPanelKey>(ws.layout.rightPanel ?? 'docs');
  useEffect(() => {
    if (ws.layout.rightPanel !== null) lastRightRef.current = ws.layout.rightPanel;
  }, [ws.layout.rightPanel]);

  const [pendingRenameTabId, setPendingRenameTabId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // Auto-collapse sidebar on narrow viewports (first-open only). No
  // longer gated on `layout.ready` because the loader gate upstream
  // guarantees layout is already loaded before this component mounts.
  const sidebarAutoCollapsedRef = useRef(false);
  useEffect(() => {
    if (sidebarAutoCollapsedRef.current) return;
    sidebarAutoCollapsedRef.current = true;
    if (layout.shouldCollapseSidebar) {
      ws.setLeftPanel(null);
    }
  }, [layout.shouldCollapseSidebar, ws.setLeftPanel]);

  // Focus management ref — retained so Cmd+B collapse can return focus to
  // the activity bar instead of stranding it inside the collapsing pane.
  const leftActivityBarRef = useRef<HTMLDivElement>(null);

  // Shell root ref for the focus-region tracker. The tracker owns the
  // full DOM↔region mapping — it observes focus changes AND exposes
  // `focusRegion(key)` for imperative moves. Nothing else in the shell
  // queries selectors or calls .focus() directly.
  const shellRef = useRef<HTMLDivElement>(null);
  const focus = useFocusRegion({ shellRef, setFocusedRegion: ws.setFocusedRegion });

  // ── Region cycling — shared semantics for clicks and Alt+N ────
  //
  // IDE-style three-state cycle:
  //   1. Region closed       → open it + focus into it
  //   2. Region open unfocused → just focus into it
  //   3. Region open focused  → close it + return focus to editor
  //
  // The left-top group additionally supports SWITCHING between keys
  // while the region is focused — clicking Recordings while Items is
  // open should swap the panel, not close it. `cycleLeftTop` handles
  // that; `cycleRegion` handles the generic case for Alt+N and for
  // right/bottom clicks (where there's currently only one key per
  // region in its natural group).
  //
  // cycleBottomLauncher mirrors cycleLeftTop for the bottom group.

  const cycleRegion = useCallback(
    (region: 'left' | 'right' | 'bottom' | 'editor') => {
      if (region === 'editor') {
        focus.focusRegion('editor');
        return;
      }
      const isFocused = ws.layout.focusedRegion === region;
      const isOpen =
        region === 'left'
          ? ws.layout.leftPanel !== null
          : region === 'right'
            ? ws.layout.rightPanel !== null
            : ws.layout.bottomOpen;

      if (isOpen && isFocused) {
        if (region === 'left') ws.setLeftPanel(null);
        else if (region === 'right') ws.setRightPanel(null);
        else ws.setBottomOpen(false);
        focus.focusRegion('editor');
        return;
      }

      if (!isOpen) {
        if (region === 'left') ws.setLeftPanel(lastLeftTopRef.current);
        else if (region === 'right') ws.setRightPanel(lastRightRef.current);
        else ws.setBottomOpen(true);
      }
      focus.focusRegion(region);
    },
    [ws, focus],
  );

  const cycleLeftTop = useCallback(
    (key: LeftPanelKey) => {
      const isSameKey = ws.layout.leftPanel === key;
      const isFocused = ws.layout.focusedRegion === 'left';

      // Same key + focused → close. Same key + unfocused → just focus.
      // Different key → switch. Closed → open on that key.
      if (isSameKey && isFocused) {
        ws.setLeftPanel(null);
        focus.focusRegion('editor');
        return;
      }
      if (!isSameKey) {
        ws.setLeftPanel(key);
      }
      focus.focusRegion('left');
    },
    [ws, focus],
  );

  const cycleRightPanel = useCallback(
    (key: RightPanelKey) => {
      const isSameKey = ws.layout.rightPanel === key;
      const isFocused = ws.layout.focusedRegion === 'right';

      if (isSameKey && isFocused) {
        ws.setRightPanel(null);
        focus.focusRegion('editor');
        return;
      }
      if (!isSameKey) {
        ws.setRightPanel(key);
      }
      focus.focusRegion('right');
    },
    [ws, focus],
  );

  const cycleBottomLauncher = useCallback(
    (key: LeftPanelKey) => {
      // Read the launcher's target tab from the shared map so adding a
      // new left-bottom key only requires touching LEFT_BOTTOM_LAUNCHERS.
      const target = LEFT_BOTTOM_LAUNCHERS[key];
      if (!target) return;
      const isSameKey = ws.layout.bottomOpen && ws.bottomTab === target;
      const isFocused = ws.layout.focusedRegion === 'bottom';

      if (isSameKey && isFocused) {
        ws.setBottomOpen(false);
        focus.focusRegion('editor');
        return;
      }
      if (!isSameKey) {
        ws.openBottomTab(target);
      }
      focus.focusRegion('bottom');
    },
    [ws, focus],
  );

  // Legacy togglePanel adapter — maps old string keys to state-machine
  // calls. New code should call ws.* directly.
  const togglePanel = useCallback(
    (panel: 'sidebar' | 'bottomPanel' | 'inspector') => {
      if (panel === 'sidebar') {
        if (ws.layout.leftPanel !== null) {
          ws.setLeftPanel(null);
          requestAnimationFrame(() => leftActivityBarRef.current?.focus());
        } else {
          ws.setLeftPanel(lastLeftTopRef.current);
        }
      } else if (panel === 'bottomPanel') {
        ws.setBottomOpen(!ws.layout.bottomOpen);
      } else {
        if (ws.layout.rightPanel !== null) {
          ws.setRightPanel(null);
          setInspectorWide(false);
        } else {
          ws.setRightPanel(lastRightRef.current);
        }
      }
    },
    [ws],
  );

  // Inspector "docs-focused" mode: when opened via #/docs/ hash, use wider size.
  // Initialized synchronously from hash so preferredSize is correct on first render —
  // allotment only reads preferredSize on initial pane mount (no cached size on fresh page load).
  const [inspectorWide, setInspectorWide] = useState(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    return hash.startsWith('docs/');
  });

  // Register right-pane-open callback for useInspectorNav. The hook's
  // openDocs() fires this when any deep-linked component (RuleEditor
  // condition help, shortcuts modal, etc.) wants to surface the docs.
  const { onOpenInspector, openDocs } = useInspectorNav();
  onOpenInspector.current = useCallback(() => {
    ws.setRightPanel('docs');
  }, [ws.setRightPanel]);

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
      // #/docs/{sectionId} — open right pane in wide mode for focused reading.
      // setRightPanel('docs') runs via useInspectorNav → onOpenInspector.
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

  // Keyboard shortcuts help — toggle the right pane pointing at the docs
  // "Keyboard shortcuts" section. If the right pane is already showing
  // docs, close it; otherwise open it to that section.
  const handleShowShortcuts = useCallback(() => {
    if (ws.layout.rightPanel === 'docs') {
      ws.setRightPanel(null);
    } else {
      openDocs('keyboard-shortcuts');
    }
  }, [ws, openDocs]);

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
    // Alt/Option + 1..4 delegates straight to the shared cycleRegion
    // helper. Same semantics as clicking the corresponding activity-bar
    // icon, so muscle memory stays consistent between keyboard and mouse.
    onFocusRegion: (region) => cycleRegion(region),
    hasActiveTab: () => activeTabId != null,
  });

  // Compute coordinated sidebar size when the right pane opens
  const coordinatedSidebarPreferred =
    ws.layout.rightPanel !== null
      ? (layout.getCoordinatedSidebarSize(true) ?? layout.sizes.sidebar.preferred)
      : layout.sizes.sidebar.preferred;

  // Sync state machine with Allotment resizes.
  //
  // IMPORTANT: Allotment's onChange fires for BOTH user drags and
  // programmatic visibility toggles. We cannot distinguish them by
  // comparing `nowOpen` vs `wasOpen` — the comparison is inherently
  // racy against React commits, because Allotment's onChange can fire
  // before the new ws closure has been captured by this callback.
  //
  // We previously had an auto-reopen branch here ("pane grew from 0 to
  // N? must be a user drag, restore last panel key") which collided
  // with programmatic opens: after setRightPanel('docs'), Allotment
  // would fire onChange with size > 0 against a stale closure seeing
  // wasOpen=false, and restore lastRightRef — which might be 'variables'
  // — silently clobbering 'docs'.
  //
  // Policy: only sync state on drag-CLOSE (size === 0). Opening a pane
  // is the exclusive job of the activity-bar click handlers and
  // cycleRegion — no other codepath is allowed to set panel keys. This
  // breaks the race completely because the drag-close path is always
  // user-initiated and never a consequence of a previous state change.
  //
  // The Allotment panes are indexed by DOM order: [0] left,
  // [1] center+bottom, [2] right. Vertical allotment: [0] editor,
  // [1] bottom.
  const handleHorizontalResize = useCallback(
    (panelSizes: number[]) => {
      layout.onPanelResize(panelSizes);
      const leftSize = panelSizes[0];
      const rightSize = panelSizes[2];
      if (leftSize === 0 && ws.layout.leftPanel !== null) {
        ws.setLeftPanel(null);
      }
      if (rightSize === 0 && ws.layout.rightPanel !== null) {
        ws.setRightPanel(null);
        setInspectorWide(false);
      }
    },
    [layout, ws],
  );

  const handleVerticalResize = useCallback(
    (panelSizes: number[]) => {
      layout.onVerticalResize(panelSizes);
      const bottomSize = panelSizes[1];
      if (bottomSize === 0 && ws.layout.bottomOpen) {
        ws.setBottomOpen(false);
      }
    },
    [layout, ws],
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
    ws.openBottomTab('test-runs');
  }, [ws.openBottomTab]);

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

  // ── Activity bar item arrays ─────────────────────────────────
  // Focus is computed per item — left-top icons get the blue accent
  // only when the LEFT region has focus, left-bottom icons only when
  // the BOTTOM region has focus, right icons only when the RIGHT
  // region has focus. This matches the IDE behaviour where the
  // bar shows which tool window actually owns the keyboard.

  const focusedLeft = ws.layout.focusedRegion === 'left';
  const focusedBottom = ws.layout.focusedRegion === 'bottom';
  const focusedRight = ws.layout.focusedRegion === 'right';

  const leftTopItems: ActivityBarItem[] = [
    {
      key: 'items',
      icon: <AppstoreOutlined />,
      label: 'Items',
      enabled: true,
      tooltip: `Items (${shortcutLabel('toggle-sidebar')})`,
      active: ws.isIconActive('items'),
      focused: focusedLeft,
      onActivate: () => cycleLeftTop('items'),
    },
    {
      key: 'recordings',
      icon: <VideoCameraOutlined />,
      label: 'Recordings',
      enabled: false,
      tooltip: 'Available in desktop app',
      active: false,
      focused: false,
    },
    {
      key: 'history',
      icon: <ClockCircleOutlined />,
      label: 'History',
      enabled: false,
      tooltip: 'Available in desktop app',
      active: false,
      focused: false,
    },
    {
      key: 'files',
      icon: <FolderOutlined />,
      label: 'Local Files',
      enabled: false,
      tooltip: 'Available in desktop app',
      active: false,
      focused: false,
    },
  ];

  const leftBottomItems: ActivityBarItem[] = [
    {
      key: 'page-traffic',
      icon: <FundViewOutlined />,
      label: 'Page Traffic',
      enabled: true,
      tooltip: 'Page Traffic',
      active: ws.isIconActive('page-traffic'),
      focused: focusedBottom,
      onActivate: () => cycleBottomLauncher('page-traffic'),
    },
    {
      key: 'test-runs',
      icon: <ExperimentOutlined />,
      label: 'Test Runs',
      enabled: true,
      tooltip: `Test Runs (${shortcutLabel('toggle-bottom')})`,
      active: ws.isIconActive('test-runs'),
      focused: focusedBottom,
      onActivate: () => cycleBottomLauncher('test-runs'),
    },
  ];

  const rightTopItems: ActivityBarItem[] = [
    {
      key: 'docs',
      icon: <BookOutlined />,
      label: 'Docs',
      enabled: true,
      tooltip: `Docs (${shortcutLabel('toggle-inspector')})`,
      active: ws.isIconActive('docs'),
      focused: focusedRight,
      onActivate: () => cycleRightPanel('docs'),
    },
    {
      key: 'variables',
      icon: <CodeOutlined />,
      label: 'Variables',
      enabled: true,
      tooltip: 'Variables',
      active: ws.isIconActive('variables'),
      focused: focusedRight,
      onActivate: () => cycleRightPanel('variables'),
    },
  ];

  return (
    <div
      ref={shellRef}
      className="rules-shell"
      data-theme={isDarkMode ? 'dark' : 'light'}
      style={{ background: token.colorBgLayout }}
    >
      <TopBar onCommandPalette={() => setCommandPaletteOpen(true)} />

      <div className="rules-main">
        <ActivityBar
          ref={leftActivityBarRef}
          side="left"
          topItems={leftTopItems}
          bottomItems={leftBottomItems}
          labelsVisible={ws.layout.activityBarLabels}
          onToggleLabels={ws.toggleActivityBarLabels}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Allotment proportionalLayout={false} onChange={handleHorizontalResize}>
            <Allotment.Pane
              preferredSize={coordinatedSidebarPreferred}
              minSize={layout.sizes.sidebar.min}
              maxSize={layout.sizes.sidebar.max}
              visible={ws.layout.leftPanel !== null}
              priority={LayoutPriority.Low}
              snap
            >
              {/* Left pane content router. Items is the only top-group key
                  today; additional keys render here as we add panels. */}
              {ws.layout.leftPanel === 'items' && (
                <div
                  className="rules-region rules-region-left"
                  data-region="left"
                  tabIndex={-1}
                  style={{ height: '100%' }}
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
                </div>
              )}
            </Allotment.Pane>

            <Allotment.Pane priority={LayoutPriority.High} minSize={layout.sizes.editorMin}>
              <Allotment vertical proportionalLayout={false} onChange={handleVerticalResize}>
                <Allotment.Pane>
                  <div
                    className="rules-region rules-region-editor"
                    data-region="editor"
                    tabIndex={-1}
                    style={{ height: '100%' }}
                  >
                    {editorArea}
                  </div>
                </Allotment.Pane>

                <Allotment.Pane
                  preferredSize={layout.sizes.bottom.preferred}
                  minSize={layout.sizes.bottom.min}
                  maxSize={layout.sizes.bottom.max}
                  visible={ws.layout.bottomOpen}
                  snap
                >
                  <div
                    className="rules-region rules-region-bottom"
                    data-region="bottom"
                    tabIndex={-1}
                    style={{ height: '100%' }}
                  >
                    <BottomPanel
                      activeTab={ws.bottomTab}
                      onTabChange={ws.setBottomTab}
                      contextOwner={contextOwner}
                      onOpenTestRun={openRunReport}
                      activeRunId={activeTab?.mode === 'run-report' ? (activeTab.testRunId ?? null) : null}
                    />
                  </div>
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
              visible={ws.layout.rightPanel !== null}
              snap
            >
              {/* Right pane router — one panel at a time. */}
              <div
                className="rules-region rules-region-right"
                data-region="right"
                tabIndex={-1}
                style={{ height: '100%' }}
              >
                {ws.layout.rightPanel === 'docs' && <DocsPanel onClose={() => ws.setRightPanel(null)} />}
                {ws.layout.rightPanel === 'variables' && (
                  <VariablesPanel onClose={() => ws.setRightPanel(null)} />
                )}
              </div>
            </Allotment.Pane>
          </Allotment>
        </div>

        <ActivityBar
          side="right"
          topItems={rightTopItems}
          labelsVisible={ws.layout.activityBarLabels}
          onToggleLabels={ws.toggleActivityBarLabels}
        />
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
