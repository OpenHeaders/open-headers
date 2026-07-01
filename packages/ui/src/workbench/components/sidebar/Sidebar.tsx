/**
 * Sidebar — IDE-style tree panel, rendered as one of four view modes:
 *
 *   - `http-rules`   — RULES, TEMPLATES, ENVIRONMENTS
 *   - `api-requests` — API REQUESTS, ENVIRONMENTS
 *   - `variables`    — VAULT, WORKSPACE VARIABLES, LIVE VARIABLES, ENVIRONMENTS
 *   - `workflows`    — WORKFLOWS (scheduled-refresh value producers)
 *
 * All views share one component so chrome (filter input, +add toolbar
 * action, expand/collapse all, keyboard navigation, options menu)
 * stays identical. Only the sections block varies by `view`.
 *
 * Tree-node construction for each section is delegated to a hook in
 * ./sidebar/ — this file owns state + chrome + JSX assembly only.
 */

import {
  AimOutlined,
  BorderLeftOutlined,
  CloseOutlined,
  ExportOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useEnvironments } from '@openheaders/ui/shared/hooks/useEnvironments';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { isRuleResolvable } from '@openheaders/core/utils';
import type { InputRef } from 'antd';
import { App, Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useEnvSwitcher } from '../../services/env-switcher';
import { useSettingValue } from '../../settings/hooks';
import type { WorkbenchTab } from '../../types';
import { buildCreateMenuItems, buildRequestImportMenuItems } from './build-sidebar-menus';
import { FolderDndTree, type FolderDndConfig } from './FolderDndTree';
import { SectionHeader } from './SectionHeader';
import { TreeNodeRow } from './TreeNodeRow';
import type { SidebarView, TreeNode } from './types';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
import { useDraftOverlay } from './useDraftOverlay';
import { useFolderDndConfigs } from './useFolderDndConfigs';
import { useEnvironmentNodes } from './useEnvironmentNodes';
import { useRequestTreeNodes } from './useRequestTreeNodes';
import { useRulesTreeNodes } from './useRulesTreeNodes';
import { useSidebarCreateActions } from './useSidebarCreateActions';
import { useSidebarExpansion } from './useSidebarExpansion';
import { useSidebarInteraction } from './useSidebarInteraction';
import { useTemplateTreeNodes } from './useTemplateTreeNodes';
import { useVariableSingletonNodes } from './useVariableSingletonNodes';
import { useWorkflowNodes } from './useWorkflowNodes';

export type { SidebarView };

// Per-view display label — mirrors the `tool-windows.tsx` registry
// entries so the sidebar's PanelHeader title matches the activity-bar
// chip identity. No icon: the activity bar already surfaces the icon
// and repeating it in the header is visual noise.
const SIDEBAR_VIEW_LABEL: Record<SidebarView, string> = {
  'http-rules': 'HTTP Rules',
  'api-requests': 'API Requests',
  workflows: 'Workflows',
  variables: 'Variables',
};

interface SidebarProps {
  view: SidebarView;
  /** Title-bar `(i)` popover copy for the active view. */
  info: InfoPopoverContent;
  activeTabId?: string | null;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  onDeleteRule?: (uid: string) => void;
  /**
   * Open the workspace-export modal scoped to a single sidebar entity.
   * Single callback for every entity kind — keeps the consumer
   * authoritative on how an entity-ref maps to an `ExportModalScope`.
   */
  onExportEntity?: (entity: SidebarExportEntity) => void;
  /**
   * Open the workspace-export modal scoped to a multi-select set of
   * sidebar entities. Aggregation into a single `ExportSelection`
   * (per-type uid lists) lives in the consumer so the sidebar stays
   * responsibility-pure: it tracks selection, owns the keyboard/mouse
   * gestures, and hands the consumer the resolved entity list.
   */
  onExportSelection?: (entities: SidebarExportEntity[]) => void;
  onOpenCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenRequestCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open the request-folder overview tab — companion to
   *  {@link onOpenFolderOverview} (rule family) and
   *  {@link onOpenTemplateFolderOverview}. */
  onOpenRequestFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onSelectTemplate?: (uid: string) => void;
  onOpenTemplateCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenTemplateFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onSelectEnvironment?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenVault?: () => void;
  onOpenLiveVariables?: () => void;
  /** Open the variables editor for a rule-collection (`⋯` action on a
   *  rule-collection sidebar row). */
  onOpenCollectionVariables?: (uid: string, name: string) => void;
  /** Open the variables editor for a request-collection. */
  onOpenRequestCollectionVariables?: (uid: string, name: string) => void;
  /** Open the variables editor for a template-collection. */
  onOpenTemplateCollectionVariables?: (uid: string, name: string) => void;
  onSelectLiveWorkflow?: (uid: string, name: string) => void;
  /** Open a new unsaved Live Workflow draft — drives the Workflows sidebar's `+` buttons. */
  onCreateWorkflow?: (seedStep?: { requestUid: string; requestName: string; method: string }) => void;
  onSelectRequest?: (uid: string, name: string, method?: string, autoRename?: boolean) => void;
  onCreateRequest?: (context?: { collectionId?: string; folderPath?: string }) => void;
  onImportCurl?: (context?: { collectionId?: string }) => void;
  onImportHar?: (context?: { collectionId?: string }) => void;
  onImportPostman?: () => void;
  filterRef?: React.Ref<InputRef>;
  dirtyRuleUids?: ReadonlySet<string>;
  dirtyRequestUids?: ReadonlySet<string>;
  /** Post-import "scripts" review reminder set — imported request uids
   *  whose scripts haven't been opened in the inspector yet. */
  scriptsReviewPendingUids?: ReadonlySet<string>;
  dirtyWorkflowUids?: ReadonlySet<string>;
  unresolvableWorkflowUids?: ReadonlySet<string>;
  allTabs?: WorkbenchTab[];
  onSwitchTab?: (tabId: string) => void;
  onCloseDraftTab?: (tabId: string) => void;
  /** Hide the sidebar dock — bound to the trailing − button in the
      toolbar. Calls `tl.closeDock(slot)` from the shell wrapper. */
  onHide: () => void;
  /** Lifted tree-expansion state — owned by the host's
   *  `useWorkbenchSidebarState` so values survive tab close/reopen via
   *  the per-tab snapshot's workspace slice (design § 2.2 / v3). */
  expandedKeys: Set<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  sectionsExpanded: Record<string, boolean>;
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const Sidebar: React.FC<SidebarProps> = ({
  view,
  info,
  activeTabId,
  onSelectRule,
  onCreateRule,
  onDeleteRule,
  onExportEntity,
  onExportSelection,
  onOpenCollectionOverview,
  onOpenFolderOverview,
  onOpenRequestCollectionOverview,
  onOpenRequestFolderOverview,
  onSelectTemplate,
  onOpenTemplateCollectionOverview,
  onOpenTemplateFolderOverview,
  onSelectEnvironment,
  onOpenWorkspaceVariables,
  onOpenVault,
  onOpenLiveVariables,
  onOpenCollectionVariables,
  onOpenRequestCollectionVariables,
  onOpenTemplateCollectionVariables,
  onSelectLiveWorkflow,
  onCreateWorkflow,
  onSelectRequest,
  onCreateRequest,
  onImportCurl,
  onImportHar,
  onImportPostman,
  filterRef,
  dirtyRuleUids,
  dirtyRequestUids,
  scriptsReviewPendingUids,
  dirtyWorkflowUids,
  unresolvableWorkflowUids,
  allTabs,
  onSwitchTab,
  onCloseDraftTab,
  onHide,
  expandedKeys,
  setExpandedKeys,
  sectionsExpanded,
  setSectionsExpanded,
}) => {
  const { token } = theme.useToken();
  const {
    rules,
    activeWorkspaceId,
    localCollections,
    localCollectionTrees,
    pauseMarkers,
    pausedUids,
    togglePause,
    clearPauseOverride,
    clearNestedPauseOverrides,
    updateLocalRule,
    deleteLocalCollection,
    createLocalFolder,
    renameLocalFolder,
    deleteLocalFolder,
    renameLocalCollection,
    createLocalCollection,
    templateCollections,
    templateCollectionTrees,
    deleteTemplate,
    updateTemplate,
    createTemplateCollection,
    renameTemplateCollection,
    deleteTemplateCollection,
    createTemplateFolder,
    renameTemplateFolder,
    deleteTemplateFolder,
  } = useRules();

  const resolver = useVariableResolver();
  const unresolvableRuleUids = useMemo(() => {
    const out = new Set<string>();
    for (const rule of rules) {
      const collectionId = localCollections.find((c) => rule.path.startsWith(`${c.path}/`))?.uid;
      const context = collectionId ? { collectionId } : undefined;
      const resolvable = isRuleResolvable(
        rule,
        (name) => resolver.resolve(name, context),
        (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
      );
      if (!resolvable) out.add(rule.uid);
    }
    return out;
  }, [rules, localCollections, resolver]);

  const {
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    createEnvironment,
    renameEnvironment,
    deleteEnvironment,
    setDefaultEnvironment,
  } = useEnvironments();
  const { pickActiveEnvironment } = useEnvSwitcher();

  const { variables: liveVariables } = useLiveVariables();
  const {
    workflows: liveWorkflows,
    refreshNow: refreshLiveWorkflow,
    updateWorkflow: updateLiveWorkflow,
    deleteWorkflow: deleteLiveWorkflow,
  } = useLiveWorkflows();
  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);

  const {
    requests: allRequests,
    collections: requestCollections,
    collectionTrees: requestCollectionTrees,
    updateRequest: updateRequestData,
    deleteRequest,
    createCollection: createRequestCollectionRpc,
    renameCollection: renameRequestCollectionRpc,
    deleteCollection: deleteRequestCollectionRpc,
    createFolder: createRequestFolderRpc,
    renameFolder: renameRequestFolderRpc,
    deleteFolder: deleteRequestFolderRpc,
  } = useRequests();
  const { message } = App.useApp();

  const [filterText, setFilterText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(true);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { toggleSection, toggleExpand, expandAll, collapseAll } = useSidebarExpansion({
    view,
    sectionsExpanded,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    setSectionsExpanded,
    setExpandedKeys,
  });

  const confirmOnDelete = useSettingValue('general.confirmOnDelete');
  const confirmDelete = useCallback(
    (name: string, onConfirm: () => void) => {
      if (!confirmOnDelete) {
        onConfirm();
        return;
      }
      Modal.confirm({
        title: <span style={{ fontSize: 13, fontWeight: 600 }}>Delete item?</span>,
        width: 380,
        content: (
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>
            Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
          </p>
        ),
        okText: 'Delete',
        okButtonProps: { danger: true, size: 'small' },
        cancelButtonProps: { size: 'small' },
        onOk: onConfirm,
      });
    },
    [confirmOnDelete],
  );

  const ruleMutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const handleToggleRule = useCallback(
    (ruleUid: string, enabled: boolean) => {
      void ruleMutator.toggleRule(ruleUid, enabled).then((resp) => {
        if (!resp.ok) void message.error('Failed to toggle rule');
      });
    },
    [message, ruleMutator],
  );

  // ── Folder reorder dnd configs (one per tree) ─────────────────────
  const { rulesFolderDndConfig, requestFolderDndConfig, templateFolderDndConfig } = useFolderDndConfigs({
    activeWorkspaceId,
  });

  // ── Section nodes via hooks ────────────────────────────────────

  const { draftsByLocation, workflowDrafts, buildRuleDraftNode, buildRequestDraftNode, buildWorkflowDraftNode } =
    useDraftOverlay({
      allTabs,
      onSwitchTab,
      onCloseDraftTab,
    });

  const rulesNodes = useRulesTreeNodes({
    rules,
    localCollections,
    localCollectionTrees,
    pauseMarkers,
    pausedUids,
    unresolvableRuleUids,
    dirtyRuleUids,
    draftsByLocationRule: draftsByLocation.rule,
    buildRuleDraftNode,
    expandedKeys,
    setExpandedKeys,
    toggleExpand,
    setRenamingId,
    filterText,
    confirmDelete,
    handleToggleRule,
    togglePause,
    clearPauseOverride,
    clearNestedPauseOverrides,
    updateLocalRule,
    createLocalFolder,
    renameLocalFolder,
    deleteLocalFolder,
    renameLocalCollection,
    deleteLocalCollection,
    onCreateRule,
    onSelectRule,
    onDeleteRule,
    onExportEntity,
    onOpenCollectionOverview,
    onOpenFolderOverview,
    onOpenCollectionVariables,
  });

  const { systemTemplateNodes, templateNodes } = useTemplateTreeNodes({
    templateCollectionTrees,
    expandedKeys,
    setExpandedKeys,
    toggleExpand,
    setRenamingId,
    filterText,
    confirmDelete,
    createTemplateFolder,
    renameTemplateFolder,
    deleteTemplateFolder,
    renameTemplateCollection,
    deleteTemplateCollection,
    updateTemplate,
    deleteTemplate,
    onCreateRule,
    onSelectTemplate,
    onOpenTemplateCollectionOverview,
    onOpenTemplateFolderOverview,
    onExportEntity,
    onOpenCollectionVariables: onOpenTemplateCollectionVariables,
  });

  const requestNodes = useRequestTreeNodes({
    requestCollectionTrees,
    requestCollections,
    allRequests,
    resolver,
    dirtyRequestUids,
    scriptsReviewPendingUids,
    draftsByLocationRequest: draftsByLocation.request,
    buildRequestDraftNode,
    expandedKeys,
    setExpandedKeys,
    toggleExpand,
    setRenamingId,
    filterText,
    confirmDelete,
    updateRequestData,
    deleteRequest,
    createRequestFolderRpc,
    renameRequestFolderRpc,
    deleteRequestFolderRpc,
    renameRequestCollectionRpc,
    deleteRequestCollectionRpc,
    onSelectRequest,
    onCreateRequest,
    onExportEntity,
    onOpenCollectionVariables: onOpenRequestCollectionVariables,
    onOpenRequestCollectionOverview,
    onOpenRequestFolderOverview,
  });

  const environmentNodes = useEnvironmentNodes({
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    filterText,
    setRenamingId,
    confirmDelete,
    renameEnvironment,
    deleteEnvironment,
    pickActiveEnvironment,
    setDefaultEnvironment,
    onSelectEnvironment,
    onExportEntity,
  });

  const workflowNodes = useWorkflowNodes({
    liveWorkflows,
    liveVariables,
    liveCaches,
    activeEnvironmentId,
    filterText,
    refreshLiveWorkflow,
    onSelectLiveWorkflow,
    renameWorkflow: (uid, name) => updateLiveWorkflow(uid, { name }),
    deleteWorkflow: deleteLiveWorkflow,
    confirmDelete,
    workflowDrafts,
    buildWorkflowDraftNode,
    dirtyWorkflowUids,
    unresolvableWorkflowUids,
    onExportEntity,
  });

  const { vaultNode, workspaceVarsNode, liveVarsNode } = useVariableSingletonNodes({
    onOpenVault,
    onOpenWorkspaceVariables,
    onOpenLiveVariables,
  });

  // ── Create-new entrypoints ─────────────────────────────────────

  const { createNewCollection, createNewRequestCollection, createNewTemplateCollection, createNewEnvironment } =
    useSidebarCreateActions({
      localCollections,
      requestCollections,
      templateCollections,
      environments,
      createLocalCollection,
      createRequestCollectionRpc,
      createTemplateCollection,
      createEnvironment,
      setSectionsExpanded,
      setExpandedKeys,
      onOpenCollectionOverview,
      onOpenTemplateCollectionOverview,
      onSelectEnvironment,
      message,
    });

  // ── Flat items for keyboard nav ──────────────────────────────
  // Only nodes from sections THIS view actually renders.

  const allFlatItems = useMemo(() => {
    const items: TreeNode[] = [];
    if (view === 'http-rules') {
      if (sectionsExpanded.rules) items.push(...rulesNodes);
      if (sectionsExpanded.templates) items.push(...systemTemplateNodes, ...templateNodes);
      if (sectionsExpanded.environments) items.push(...environmentNodes);
    } else if (view === 'api-requests') {
      if (sectionsExpanded['api-requests']) items.push(...requestNodes);
      if (sectionsExpanded.environments) items.push(...environmentNodes);
    } else if (view === 'workflows') {
      if (sectionsExpanded.workflows) items.push(...workflowNodes);
    } else {
      if (sectionsExpanded.vault) items.push(vaultNode);
      if (sectionsExpanded['workspace-vars']) items.push(workspaceVarsNode);
      if (sectionsExpanded['live-variables']) items.push(liveVarsNode);
      if (sectionsExpanded.environments) items.push(...environmentNodes);
    }
    return items;
  }, [
    view,
    sectionsExpanded,
    rulesNodes,
    systemTemplateNodes,
    templateNodes,
    environmentNodes,
    liveVarsNode,
    workflowNodes,
    requestNodes,
    vaultNode,
    workspaceVarsNode,
  ]);

  // ── Selection / interaction subsystem ─────────────────────────

  const {
    setFocusedId,
    exportSelectedIds,
    isExportSelected,
    clearExportSelection,
    isSelected,
    isFocused,
    handleItemClick,
    handleItemDoubleClick,
    handleKeyDown,
    handleExportSelectedClick,
    selectOpenedFile,
  } = useSidebarInteraction({
    allFlatItems,
    activeTabId,
    view,
    filterText,
    alwaysSelectOpened,
    openWithSingleClick,
    openCollectionsWithSingleClick,
    openFoldersWithSingleClick,
    expandedKeys,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    containerRef,
    toggleExpand,
    setRenamingId,
    setExpandedKeys,
    setSectionsExpanded,
    onExportSelection,
  });

  const createMenuItems = buildCreateMenuItems({ onCreateRule, createNewCollection });

  const requestImportMenuItems = buildRequestImportMenuItems({
    createNewRequestCollection,
    onCreateRequest,
    onImportCurl,
    onImportHar,
    onImportPostman,
  });

  const renderTreeNodeRow = (node: TreeNode) => (
    <TreeNodeRow
      key={node.id}
      node={node}
      isSelected={isSelected(node.id)}
      isFocused={isFocused(node.id)}
      isRenaming={renamingId === node.id}
      isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
      isExportSelected={isExportSelected(node.id)}
      onClick={(e) => handleItemClick(node, e)}
      onDoubleClick={() => handleItemDoubleClick(node)}
      onStartRename={() => {
        if (renamingId === node.id) setRenamingId(null);
        else setRenamingId(node.id);
      }}
    />
  );

  const renderEmptyState = (emptyCreate?: () => void) => (
    <div className="rules-sidebar-empty-state">
      <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>No items in this section</span>
      {emptyCreate && (
        <button
          type="button"
          className="rules-sidebar-create-btn"
          style={{ color: token.colorText }}
          onClick={emptyCreate}
        >
          <PlusOutlined style={{ fontSize: 10 }} /> Create
        </button>
      )}
    </div>
  );

  const renderNodes = (nodes: TreeNode[], emptyCreate?: () => void) => {
    if (nodes.length === 0) return renderEmptyState(emptyCreate);
    return nodes.map(renderTreeNodeRow);
  };

  /** Variant of `renderNodes` that wraps folder rows in dnd-kit so
   *  same-parent reorder gestures emit `moveFolder` mutations. The
   *  per-tree config supplies the id prefixes + mutator binding. */
  const renderFolderDndNodes = (
    nodes: TreeNode[],
    config: FolderDndConfig,
    emptyCreate?: () => void,
  ) => {
    if (nodes.length === 0) return renderEmptyState(emptyCreate);
    return <FolderDndTree nodes={nodes} renderNode={renderTreeNodeRow} config={config} />;
  };

  // ── Header chrome — PanelHeader (name + actions + options + hide) on
  // top, filter input row below. PanelHeader is mandatory per the dock-
  // layout convention; the filter row is panel-specific UX that doesn't
  // fit in the 32px header alongside the action cluster.
  const viewLabel = SIDEBAR_VIEW_LABEL[view];
  const headerWiring = createPanelHeaderWiring({ onHide });
  const behaviorMenuItems: MenuProps['items'] = [
    {
      key: 'behavior',
      label: 'Behavior',
      children: [
        {
          key: 'single-click',
          label: `${openWithSingleClick ? '✓ ' : ''}Open Entries with Single Click`,
          onClick: () => setOpenWithSingleClick((v) => !v),
        },
        {
          key: 'collections-single-click',
          label: `${openCollectionsWithSingleClick ? '✓ ' : ''}Open Collections with Single Click`,
          onClick: () => setOpenCollectionsWithSingleClick((v) => !v),
        },
        {
          key: 'folders-single-click',
          label: `${openFoldersWithSingleClick ? '✓ ' : ''}Open Folders with Single Click`,
          onClick: () => setOpenFoldersWithSingleClick((v) => !v),
        },
        {
          key: 'always-select',
          label: `${alwaysSelectOpened ? '✓ ' : ''}Always Select Opened Tab`,
          onClick: () => setAlwaysSelectOpened((v) => !v),
        },
      ],
    },
  ];
  const headerActions = (
    <>
      {view === 'http-rules' && (
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <Tooltip title="New rule" placement="bottom">
            <span role="button" tabIndex={0} className="rules-panel-header-action" aria-label="New rule">
              <PlusOutlined />
            </span>
          </Tooltip>
        </Dropdown>
      )}
      {view === 'api-requests' && (
        <Dropdown menu={{ items: requestImportMenuItems }} trigger={['click']} placement="bottomRight">
          <Tooltip title="Add request" placement="bottom">
            <span role="button" tabIndex={0} className="rules-panel-header-action" aria-label="Add request">
              <PlusOutlined />
            </span>
          </Tooltip>
        </Dropdown>
      )}
      {view === 'variables' && (
        <Tooltip title="New environment" placement="bottom">
          <span
            role="button"
            tabIndex={0}
            className="rules-panel-header-action"
            onClick={() => void createNewEnvironment()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') void createNewEnvironment();
            }}
            aria-label="New environment"
          >
            <PlusOutlined />
          </span>
        </Tooltip>
      )}
      {view === 'workflows' && (
        <Tooltip title="New workflow" placement="bottom">
          <span
            role="button"
            tabIndex={0}
            className="rules-panel-header-action"
            onClick={() => onCreateWorkflow?.()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCreateWorkflow?.();
            }}
            aria-label="New workflow"
          >
            <PlusOutlined />
          </span>
        </Tooltip>
      )}
      {exportSelectedIds.size > 0 && onExportSelection && (
        <>
          <Tooltip title={`Export ${exportSelectedIds.size} selected…`} placement="bottom">
            <span
              role="button"
              tabIndex={0}
              className="rules-panel-header-action"
              style={{ color: token.colorPrimary, width: 'auto', padding: '0 4px' }}
              onClick={handleExportSelectedClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleExportSelectedClick();
              }}
              aria-label={`Export ${exportSelectedIds.size} selected items`}
            >
              <ExportOutlined />
              <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600 }}>{exportSelectedIds.size}</span>
            </span>
          </Tooltip>
          <Tooltip title="Clear selection" placement="bottom">
            <span
              role="button"
              tabIndex={0}
              className="rules-panel-header-action"
              onClick={clearExportSelection}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') clearExportSelection();
              }}
              aria-label="Clear export selection"
            >
              <CloseOutlined />
            </span>
          </Tooltip>
        </>
      )}
      <Tooltip title="Select Opened Tab" placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={selectOpenedFile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') selectOpenedFile();
          }}
          aria-label="Select opened tab"
        >
          <AimOutlined />
        </span>
      </Tooltip>
      <Tooltip title="Expand All" placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={expandAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') expandAll();
          }}
          aria-label="Expand all"
        >
          <MenuUnfoldOutlined />
        </span>
      </Tooltip>
      <Tooltip title="Collapse All" placement="bottom">
        <span
          role="button"
          tabIndex={0}
          className="rules-panel-header-action"
          onClick={collapseAll}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') collapseAll();
          }}
          aria-label="Collapse all"
        >
          <BorderLeftOutlined />
        </span>
      </Tooltip>
    </>
  );

  return (
    <div className="rules-sidebar">
      <PanelHeader
        wiring={headerWiring}
        title={<strong>{viewLabel}</strong>}
        info={info}
        actions={headerActions}
        optionsMenuItems={behaviorMenuItems}
      />
      <div className="rules-sidebar-filter-row">
        <Input
          ref={filterRef}
          size="small"
          placeholder="Filter"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
              e.preventDefault();
              const first = allFlatItems[0];
              if (first) {
                setFocusedId(first.id);
                containerRef.current?.focus();
                setTimeout(() => {
                  containerRef.current
                    ?.querySelector(`[data-item-id="${first.id}"]`)
                    ?.scrollIntoView({ block: 'nearest' });
                }, 0);
              }
            } else if (e.key === 'Escape') {
              if (filterText) {
                setFilterText('');
              } else {
                containerRef.current?.focus();
              }
            }
          }}
          allowClear
          style={{ flex: 1, fontSize: 12, height: 28 }}
        />
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard navigation container */}
      <div
        ref={containerRef}
        className="rules-sidebar-content"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        {view === 'api-requests' && (
          <>
            <SectionHeader
              title="REQUESTS"
              expanded={sectionsExpanded['api-requests']}
              onToggle={() => toggleSection('api-requests')}
              actions={
                <Dropdown menu={{ items: requestImportMenuItems }} trigger={['click']} placement="bottomRight">
                  <PlusOutlined
                    style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              }
            />
            {sectionsExpanded['api-requests'] && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {renderFolderDndNodes(
                  requestNodes,
                  requestFolderDndConfig,
                  () => void createNewRequestCollection(),
                )}
              </div>
            )}
          </>
        )}

        {view === 'http-rules' && (
          <>
            <SectionHeader
              title="RULES"
              expanded={sectionsExpanded.rules}
              onToggle={() => toggleSection('rules')}
              actions={
                <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
                  <PlusOutlined
                    style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              }
            />
            {sectionsExpanded.rules && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {renderFolderDndNodes(rulesNodes, rulesFolderDndConfig, () => void createNewCollection())}
              </div>
            )}

            <SectionHeader
              title="TEMPLATES"
              expanded={sectionsExpanded.templates}
              onToggle={() => toggleSection('templates')}
              actions={
                <Tooltip title="New template collection" placement="bottom">
                  <PlusOutlined
                    style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void createNewTemplateCollection();
                    }}
                  />
                </Tooltip>
              }
            />
            {sectionsExpanded.templates && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {(() => {
                  // System and user templates render side-by-side under the
                  // single TEMPLATES section header. When both lists are
                  // empty (filter excludes everything, or fresh workspace
                  // before any user collection is created), render ONE
                  // section-level empty-state instead of one per list —
                  // otherwise the section flashes "No items in this section"
                  // twice in a row, which reads like a layout bug.
                  const createUserCollection = () => void createNewTemplateCollection();
                  if (systemTemplateNodes.length === 0 && templateNodes.length === 0) {
                    return renderEmptyState(createUserCollection);
                  }
                  return (
                    <>
                      {systemTemplateNodes.length > 0 && systemTemplateNodes.map(renderTreeNodeRow)}
                      {templateNodes.length > 0 &&
                        renderFolderDndNodes(templateNodes, templateFolderDndConfig, createUserCollection)}
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {view === 'variables' &&
          (() => {
            // Variables view sections each contain a single opener
            // row. With an active filter, hide a section when neither
            // its title nor its row label contains the query — and
            // force-expand when it does, so a filter never silently
            // hides matches behind a collapsed chevron.
            const lower = filterText.toLowerCase();
            const matches = (label: string) => !lower || label.toLowerCase().includes(lower);
            const showVault = matches('vault') || matches('Vault');
            const showWorkspace = matches('workspace variables');
            const showLive = matches('live variables');
            const vaultOpen = sectionsExpanded.vault || (lower !== '' && showVault);
            const wsOpen = sectionsExpanded['workspace-vars'] || (lower !== '' && showWorkspace);
            const liveOpen = sectionsExpanded['live-variables'] || (lower !== '' && showLive);
            return (
              <>
                {showVault && (
                  <>
                    <SectionHeader title="VAULT" expanded={vaultOpen} onToggle={() => toggleSection('vault')} />
                    {vaultOpen && <div style={{ overflowY: 'auto' }}>{renderNodes([vaultNode])}</div>}
                  </>
                )}

                {showWorkspace && (
                  <>
                    <SectionHeader
                      title="WORKSPACE VARIABLES"
                      expanded={wsOpen}
                      onToggle={() => toggleSection('workspace-vars')}
                    />
                    {wsOpen && <div style={{ overflowY: 'auto' }}>{renderNodes([workspaceVarsNode])}</div>}
                  </>
                )}

                {showLive && (
                  <>
                    <SectionHeader
                      title="LIVE VARIABLES"
                      expanded={liveOpen}
                      onToggle={() => toggleSection('live-variables')}
                    />
                    {liveOpen && <div style={{ overflowY: 'auto' }}>{renderNodes([liveVarsNode])}</div>}
                  </>
                )}
              </>
            );
          })()}

        {view === 'workflows' && (
          <>
            <SectionHeader
              title="WORKFLOWS"
              expanded={sectionsExpanded.workflows}
              onToggle={() => toggleSection('workflows')}
              actions={
                <Tooltip title="New workflow" placement="bottom">
                  <PlusOutlined
                    style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSectionsExpanded((prev) => ({ ...prev, workflows: true }));
                      onCreateWorkflow?.();
                    }}
                  />
                </Tooltip>
              }
            />
            {sectionsExpanded.workflows && (
              <div style={{ overflowY: 'auto' }}>{renderNodes(workflowNodes, () => onCreateWorkflow?.())}</div>
            )}
          </>
        )}

        <SectionHeader
          title="ENVIRONMENTS"
          expanded={sectionsExpanded.environments}
          onToggle={() => toggleSection('environments')}
          actions={
            <Tooltip title="New environment" placement="bottom">
              <PlusOutlined
                style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  void createNewEnvironment();
                }}
              />
            </Tooltip>
          }
        />
        {sectionsExpanded.environments && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {renderNodes(environmentNodes, () => void createNewEnvironment())}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
