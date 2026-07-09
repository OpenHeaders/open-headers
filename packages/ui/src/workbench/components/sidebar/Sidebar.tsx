/**
 * Sidebar — IDE-style tree panel, rendered as one of four view modes:
 *
 *   - `http-rules`   — RULES, TEMPLATES, ENVIRONMENTS
 *   - `api-requests` — API REQUESTS, PACKAGE LIBRARY, ENVIRONMENTS
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

import { SearchOutlined } from '@ant-design/icons';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/readers/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useResponseExamplesByRequest } from '@openheaders/ui/shared/hooks/readers/useResponseExamples';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import {
  applyResponseExampleDelete,
  applyResponseExampleDuplicate,
  applyResponseExampleRename,
} from '@openheaders/ui/shared/sync/response-example-write-client';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { isRuleResolvable } from '@openheaders/core/utils';
import type { InputRef } from 'antd';
import { App, Input, Modal, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useEnvSwitcher } from '../../services/env-switcher';
import { useSettingValue } from '../../settings/hooks';
import type { WorkbenchTab } from '../../types';
import { buildCreateMenuItems, buildRequestImportMenuItems } from './build-sidebar-menus';
import EnvironmentsSection from './EnvironmentsSection';
import { SectionOpenerRow } from './SectionHeader';
import RequestsSection from './RequestsSection';
import RulesSection from './RulesSection';
import SidebarHeaderActions from './SidebarHeaderActions';
import type { SidebarView, TreeNode } from './types';
import VariablesSection from './VariablesSection';
import WorkflowsSection from './WorkflowsSection';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';
import { useDraftOverlay } from './useDraftOverlay';
import { useFolderDndConfigs } from './useFolderDndConfigs';
import { useEnvironmentNodes } from './useEnvironmentNodes';
import { useRequestTreeNodes } from './useRequestTreeNodes';
import { useRulesTreeNodes } from './useRulesTreeNodes';
import { useSidebarCreateActions } from './useSidebarCreateActions';
import { useSidebarExpansion } from './useSidebarExpansion';
import { useSidebarInteraction } from './useSidebarInteraction';
import { useSidebarNodeRenderers } from './useSidebarNodeRenderers';
import { useTemplateTreeNodes } from './useTemplateTreeNodes';
import { useVariableSingletonNodes } from './useVariableSingletonNodes';
import { useWorkflowNodes } from './useWorkflowNodes';

export type { SidebarView };

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
  onOpenScriptPackages?: () => void;
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
  /** Open a saved response example in its read-only viewer tab. */
  onSelectResponseExample?: (uid: string, name: string, requestUid: string) => void;
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
  onOpenScriptPackages,
  onOpenCollectionVariables,
  onOpenRequestCollectionVariables,
  onOpenTemplateCollectionVariables,
  onSelectLiveWorkflow,
  onCreateWorkflow,
  onSelectRequest,
  onCreateRequest,
  onSelectResponseExample,
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

  // ── Response examples (child nodes under request rows) ───────────
  const responseExamplesByRequest = useResponseExamplesByRequest(activeWorkspaceId);
  const renameResponseExample = useCallback(
    async (uid: string, name: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyResponseExampleRename(uid, name, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error('Failed to rename example');
    },
    [activeWorkspaceId, message],
  );
  const duplicateResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyResponseExampleDuplicate(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error('Failed to duplicate example');
    },
    [activeWorkspaceId, message],
  );
  const deleteResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyResponseExampleDelete(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error('Failed to delete example');
    },
    [activeWorkspaceId, message],
  );
  // Parent lookup for the reveal-on-focus path (an example tab going
  // active expands its request row so the child node is visible).
  const resolveResponseExampleParent = useCallback(
    (exampleUid: string): string | null => {
      for (const [requestUid, examples] of responseExamplesByRequest) {
        if (examples.some((e) => e.uid === exampleUid)) return requestUid;
      }
      return null;
    },
    [responseExamplesByRequest],
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
    responseExamplesByRequest,
    renameResponseExample,
    duplicateResponseExample,
    deleteResponseExample,
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
    onSelectResponseExample,
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

  const { vaultNode, workspaceVarsNode, liveVarsNode, scriptPackagesNode } = useVariableSingletonNodes({
    onOpenVault,
    onOpenWorkspaceVariables,
    onOpenLiveVariables,
    onOpenScriptPackages,
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
    workflowNodes,
    requestNodes,
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
    resolveResponseExampleParent,
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

  const { renderTreeNodeRow, renderEmptyState, renderNodes, renderFolderDndNodes } = useSidebarNodeRenderers({
    isSelected,
    isFocused,
    isExportSelected,
    handleItemClick,
    handleItemDoubleClick,
    renamingId,
    setRenamingId,
    expandedKeys,
  });

  return (
    <div className="rules-sidebar">
      <SidebarHeaderActions
        view={view}
        info={info}
        onHide={onHide}
        createMenuItems={createMenuItems}
        requestImportMenuItems={requestImportMenuItems}
        createNewEnvironment={createNewEnvironment}
        onCreateWorkflow={onCreateWorkflow}
        exportSelectedIds={exportSelectedIds}
        onExportSelection={onExportSelection}
        handleExportSelectedClick={handleExportSelectedClick}
        clearExportSelection={clearExportSelection}
        selectOpenedFile={selectOpenedFile}
        expandAll={expandAll}
        collapseAll={collapseAll}
        openWithSingleClick={openWithSingleClick}
        setOpenWithSingleClick={setOpenWithSingleClick}
        openCollectionsWithSingleClick={openCollectionsWithSingleClick}
        setOpenCollectionsWithSingleClick={setOpenCollectionsWithSingleClick}
        openFoldersWithSingleClick={openFoldersWithSingleClick}
        setOpenFoldersWithSingleClick={setOpenFoldersWithSingleClick}
        alwaysSelectOpened={alwaysSelectOpened}
        setAlwaysSelectOpened={setAlwaysSelectOpened}
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
            <RequestsSection
              sectionsExpanded={sectionsExpanded}
              toggleSection={toggleSection}
              requestImportMenuItems={requestImportMenuItems}
              requestNodes={requestNodes}
              requestFolderDndConfig={requestFolderDndConfig}
              createNewRequestCollection={createNewRequestCollection}
              renderFolderDndNodes={renderFolderDndNodes}
            />
            {(!filterText || 'package library'.includes(filterText.toLowerCase())) && (
              <SectionOpenerRow
                title="PACKAGE LIBRARY"
                node={scriptPackagesNode}
                selected={isSelected(scriptPackagesNode.id)}
              />
            )}
          </>
        )}

        {view === 'http-rules' && (
          <RulesSection
            sectionsExpanded={sectionsExpanded}
            toggleSection={toggleSection}
            createMenuItems={createMenuItems}
            rulesNodes={rulesNodes}
            rulesFolderDndConfig={rulesFolderDndConfig}
            createNewCollection={createNewCollection}
            systemTemplateNodes={systemTemplateNodes}
            templateNodes={templateNodes}
            templateFolderDndConfig={templateFolderDndConfig}
            createNewTemplateCollection={createNewTemplateCollection}
            renderTreeNodeRow={renderTreeNodeRow}
            renderEmptyState={renderEmptyState}
            renderFolderDndNodes={renderFolderDndNodes}
          />
        )}

        {view === 'variables' && (
          <VariablesSection
            filterText={filterText}
            vaultNode={vaultNode}
            workspaceVarsNode={workspaceVarsNode}
            liveVarsNode={liveVarsNode}
            isSelected={isSelected}
          />
        )}

        {view === 'workflows' && (
          <WorkflowsSection
            sectionsExpanded={sectionsExpanded}
            toggleSection={toggleSection}
            setSectionsExpanded={setSectionsExpanded}
            onCreateWorkflow={onCreateWorkflow}
            workflowNodes={workflowNodes}
            renderNodes={renderNodes}
          />
        )}

        <EnvironmentsSection
          sectionsExpanded={sectionsExpanded}
          toggleSection={toggleSection}
          createNewEnvironment={createNewEnvironment}
          environmentNodes={environmentNodes}
          renderNodes={renderNodes}
        />
      </div>
    </div>
  );
};

export default Sidebar;
