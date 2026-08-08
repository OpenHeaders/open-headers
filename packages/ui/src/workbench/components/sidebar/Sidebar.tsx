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

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/readers/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useGrpcResponseExamplesByRequest } from '@openheaders/ui/shared/hooks/readers/useGrpcResponseExamples';
import { useResponseExamplesByRequest } from '@openheaders/ui/shared/hooks/readers/useResponseExamples';
import { useWsResponseExamplesByRequest } from '@openheaders/ui/shared/hooks/readers/useWsResponseExamples';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useDriftedSpecUids } from '../specs/use-spec-drift';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import {
  applyGrpcResponseExampleDelete,
  applyGrpcResponseExampleDuplicate,
  applyGrpcResponseExampleRename,
} from '@openheaders/ui/shared/sync/grpc-response-example-write-client';
import {
  applyResponseExampleDelete,
  applyResponseExampleDuplicate,
  applyResponseExampleRename,
} from '@openheaders/ui/shared/sync/response-example-write-client';
import {
  applyWsResponseExampleDelete,
  applyWsResponseExampleDuplicate,
  applyWsResponseExampleRename,
} from '@openheaders/ui/shared/sync/ws-response-example-write-client';
import { applySpecCreate, applySpecDelete, applySpecUpdate } from '@openheaders/ui/shared/sync/spec-write-client';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { isRuleResolvable } from '@openheaders/core/utils';
import { App, Modal } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvSwitcher } from '../../services/env-switcher';
import { useSettingValue } from '../../settings/hooks';
import type { WorkbenchTab, WorkflowSeedStep } from '../../types';
import CreateWorkflowFromRequestsModal, {
  type WorkflowFromRequestsTarget,
} from '../live/CreateWorkflowFromRequestsModal';
import { buildCreateMenuItems, buildRequestImportMenuItems } from './build-sidebar-menus';
import EnvironmentsSection from './EnvironmentsSection';
import { SectionOpenerRow } from './SectionHeader';
import RequestsSection from './RequestsSection';
import RulesSection from './RulesSection';
import SpecsSection from './SpecsSection';
import { createBlankSpecSeed, type SpecCreateFormat } from '../specs/spec-scaffold';
import SidebarHeaderActions from './SidebarHeaderActions';
import { TreeSearchBar } from './TreeSearchBar';
import type { SidebarView, TreeNode } from './types';
import { type SidebarSearchHandle, useTreeSearch, useTreeSearchMatches } from './useTreeSearch';
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
import { useSpecNodes } from './useSpecNodes';
import { useTemplateTreeNodes } from './useTemplateTreeNodes';
import { useVariableSingletonNodes } from './useVariableSingletonNodes';
import { useWorkflowNodes } from './useWorkflowNodes';

export type { SidebarView };
export type { SidebarSearchHandle };

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
  /** Open a spec's editor tab (Specs section row / create reveal). */
  onSelectSpec?: (uid: string, name: string, autoRename?: boolean) => void;
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
  /** Open a new unsaved Live Workflow draft — drives the Workflows
   *  sidebar's `+` buttons (no context) and the request tree's
   *  "Create Workflow…" picker (seed steps + container name). */
  onCreateWorkflow?: (context?: { seedSteps?: WorkflowSeedStep[]; name?: string }) => void;
  onSelectRequest?: (uid: string, name: string, method?: string, autoRename?: boolean) => void;
  onCreateRequest?: (context?: { collectionId?: string; folderPath?: string }) => void;
  /** Open a gRPC request's edit tab (sibling entity in the request tree). */
  onSelectGrpcRequest?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Context-create a gRPC request from a container's "+" menu. */
  onCreateGrpcRequest?: (context: { collectionId?: string; folderPath?: string }) => void;
  /** Open a WebSocket request's edit tab (session-shaped sibling entity). */
  onSelectWebSocketRequest?: (uid: string, name: string, flavor?: 'raw' | 'socketio', autoRename?: boolean) => void;
  /** Context-create a WebSocket request — the "+" menu's two entries
   *  (WebSocket / Socket.IO) pre-set the flavor. */
  onCreateWebSocketRequest?: (context: {
    collectionId?: string;
    folderPath?: string;
    flavor: 'raw' | 'socketio';
  }) => void;
  /** Open a saved response example in its read-only viewer tab. */
  onSelectResponseExample?: (uid: string, name: string, requestUid: string) => void;
  /** Open a saved gRPC response example in its viewer tab. */
  onSelectGrpcResponseExample?: (uid: string, name: string, grpcRequestUid: string) => void;
  /** Open a saved WebSocket response example in its viewer tab. */
  onSelectWsResponseExample?: (uid: string, name: string, websocketRequestUid: string) => void;
  /** Opens the import hub (single "Import…" entry; formats auto-detected). */
  onImport?: (context?: { collectionId?: string }) => void;
  /** Imperative speed-search handle — the host's focus-sidebar-filter
   *  shortcut calls `focus()`, which opens the on-demand bar (or
   *  re-focuses its input when already open). */
  searchRef?: React.Ref<SidebarSearchHandle>;
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
  onSelectSpec,
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
  onSelectGrpcRequest,
  onCreateGrpcRequest,
  onSelectWebSocketRequest,
  onCreateWebSocketRequest,
  onSelectResponseExample,
  onSelectGrpcResponseExample,
  onSelectWsResponseExample,
  onImport,
  searchRef,
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
  const t = useT();
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
    grpcRequests: allGrpcRequests,
    websocketRequests: allWebSocketRequests,
    collections: requestCollections,
    collectionTrees: requestCollectionTrees,
    updateRequest: updateRequestData,
    deleteRequest,
    updateGrpcRequest: updateGrpcRequestData,
    deleteGrpcRequest,
    updateWebSocketRequest: updateWebSocketRequestData,
    deleteWebSocketRequest,
    createCollection: createRequestCollectionRpc,
    renameCollection: renameRequestCollectionRpc,
    deleteCollection: deleteRequestCollectionRpc,
    createFolder: createRequestFolderRpc,
    renameFolder: renameRequestFolderRpc,
    deleteFolder: deleteRequestFolderRpc,
  } = useRequests();
  const { message } = App.useApp();

  // On-demand speed-search state machine (dual filter/search mode).
  // Runs BEFORE the node hooks: they consume `filterText` (filter mode
  // hides) and the reveal-aware `isExpandedKey` predicate below.
  const search = useTreeSearch();
  const filterText = search.filterText;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // "Create Workflow…" on a request collection / folder row — non-null
  // opens the request picker modal over that container's subtree.
  const [workflowFromTarget, setWorkflowFromTarget] = useState<WorkflowFromRequestsTarget | null>(null);

  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(true);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    toggleSection,
    toggleExpand: toggleExpandPersistent,
    expandAll,
    collapseAll,
  } = useSidebarExpansion({
    view,
    sectionsExpanded,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    setSectionsExpanded,
    setExpandedKeys,
  });

  // ── Reveal-aware expansion ──────────────────────────────────────
  // A live query force-expands every branch as a DEFAULT the user can
  // override: collapsing while the query is live toggles this
  // transient set instead of `expandedKeys`, so the caret AND the
  // children agree, the persistent expansion state is never polluted,
  // and clearing/retyping the query re-reveals everything.
  const [revealCollapsedKeys, setRevealCollapsedKeys] = useState<Set<string>>(() => new Set());
  const revealActive = filterText !== '' || search.revealAll;

  useEffect(() => {
    setRevealCollapsedKeys((prev) => (prev.size > 0 ? new Set() : prev));
  }, [search.query]);

  const isExpandedKey = useCallback(
    (id: string) => (revealActive ? !revealCollapsedKeys.has(id) : expandedKeys.has(id)),
    [revealActive, revealCollapsedKeys, expandedKeys],
  );

  const toggleExpand = useCallback(
    (key: string) => {
      if (revealActive) {
        setRevealCollapsedKeys((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        return;
      }
      toggleExpandPersistent(key);
    },
    [revealActive, toggleExpandPersistent],
  );

  const confirmOnDelete = useSettingValue('general.confirmOnDelete');
  const confirmDelete = useCallback(
    (name: string, onConfirm: () => void) => {
      if (!confirmOnDelete) {
        onConfirm();
        return;
      }
      Modal.confirm({
        title: <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.sidebar.confirmDelete.title')}</span>,
        width: 380,
        content: (
          <p style={{ fontSize: 12, margin: '4px 0 0' }}>
            {t('workbench.sidebar.confirmDelete.bodyPrefix')}
            <strong>{name}</strong>
            {t('workbench.sidebar.confirmDelete.bodySuffix')}
          </p>
        ),
        okText: t('workbench.sidebar.confirmDelete.ok'),
        okButtonProps: { danger: true, size: 'small' },
        cancelButtonProps: { size: 'small' },
        onOk: onConfirm,
      });
    },
    [confirmOnDelete, t],
  );

  const ruleMutator = useRuleMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const handleToggleRule = useCallback(
    (ruleUid: string, enabled: boolean) => {
      void ruleMutator.toggleRule(ruleUid, enabled).then((resp) => {
        if (!resp.ok) void message.error(t('workbench.sidebar.toast.toggleRuleFailed'));
      });
    },
    [message, ruleMutator, t],
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
      if (!result.ok) void message.error(t('workbench.sidebar.toast.renameExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const duplicateResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyResponseExampleDuplicate(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.duplicateExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const deleteResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyResponseExampleDelete(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.deleteExampleFailed'));
    },
    [activeWorkspaceId, message, t],
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

  // ── gRPC response examples (child nodes under gRPC request rows) ──
  const grpcResponseExamplesByRequest = useGrpcResponseExamplesByRequest(activeWorkspaceId);
  const renameGrpcResponseExample = useCallback(
    async (uid: string, name: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyGrpcResponseExampleRename(uid, name, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.renameExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const duplicateGrpcResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyGrpcResponseExampleDuplicate(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.duplicateExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const deleteGrpcResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyGrpcResponseExampleDelete(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.deleteExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const resolveGrpcResponseExampleParent = useCallback(
    (exampleUid: string): string | null => {
      for (const [grpcRequestUid, examples] of grpcResponseExamplesByRequest) {
        if (examples.some((e) => e.uid === exampleUid)) return grpcRequestUid;
      }
      return null;
    },
    [grpcResponseExamplesByRequest],
  );

  // ── WebSocket response examples (child nodes under WS request rows) ──
  const wsResponseExamplesByRequest = useWsResponseExamplesByRequest(activeWorkspaceId);
  const renameWsResponseExample = useCallback(
    async (uid: string, name: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyWsResponseExampleRename(uid, name, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.renameExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const duplicateWsResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyWsResponseExampleDuplicate(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.duplicateExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const deleteWsResponseExample = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applyWsResponseExampleDelete(uid, {
        workspaceId: activeWorkspaceId,
        surfaceId: 'workbench',
      });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.deleteExampleFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const resolveWsResponseExampleParent = useCallback(
    (exampleUid: string): string | null => {
      for (const [websocketRequestUid, examples] of wsResponseExamplesByRequest) {
        if (examples.some((e) => e.uid === exampleUid)) return websocketRequestUid;
      }
      return null;
    },
    [wsResponseExamplesByRequest],
  );

  // ── Specs (workspace-level API specification documents) ──────────
  const specs = useSpecs(activeWorkspaceId);
  const createSpecEntity = useCallback(
    async (name: string, format: SpecCreateFormat) => {
      if (!activeWorkspaceId) return null;
      const result = await applySpecCreate(
        { spec: createBlankSpecSeed(name, format) },
        { workspaceId: activeWorkspaceId, surfaceId: 'workbench' },
      );
      return result.ok ? result.spec : null;
    },
    [activeWorkspaceId],
  );
  const renameSpec = useCallback(
    async (uid: string, name: string) => {
      if (!activeWorkspaceId) return;
      const result = await applySpecUpdate(uid, { name }, { workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.renameSpecFailed'));
    },
    [activeWorkspaceId, message, t],
  );
  const deleteSpecEntity = useCallback(
    async (uid: string) => {
      if (!activeWorkspaceId) return;
      const result = await applySpecDelete(uid, { workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
      if (!result.ok) void message.error(t('workbench.sidebar.toast.deleteSpecFailed'));
    },
    [activeWorkspaceId, message, t],
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
    isExpandedKey,
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
    isExpandedKey,
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
    allGrpcRequests,
    allWebSocketRequests,
    resolver,
    dirtyRequestUids,
    scriptsReviewPendingUids,
    responseExamplesByRequest,
    renameResponseExample,
    duplicateResponseExample,
    deleteResponseExample,
    grpcResponseExamplesByRequest,
    renameGrpcResponseExample,
    duplicateGrpcResponseExample,
    deleteGrpcResponseExample,
    wsResponseExamplesByRequest,
    renameWsResponseExample,
    duplicateWsResponseExample,
    deleteWsResponseExample,
    draftsByLocationRequest: draftsByLocation.request,
    buildRequestDraftNode,
    isExpandedKey,
    setExpandedKeys,
    toggleExpand,
    setRenamingId,
    filterText,
    confirmDelete,
    updateRequestData,
    deleteRequest,
    updateGrpcRequestData,
    deleteGrpcRequest,
    updateWebSocketRequestData,
    deleteWebSocketRequest,
    createRequestFolderRpc,
    renameRequestFolderRpc,
    deleteRequestFolderRpc,
    renameRequestCollectionRpc,
    deleteRequestCollectionRpc,
    onSelectRequest,
    onCreateRequest,
    onSelectGrpcRequest,
    onCreateGrpcRequest,
    onSelectWebSocketRequest,
    onCreateWebSocketRequest,
    onSelectResponseExample,
    onSelectGrpcResponseExample,
    onSelectWsResponseExample,
    onExportEntity,
    onOpenCollectionVariables: onOpenRequestCollectionVariables,
    onOpenRequestCollectionOverview,
    onOpenRequestFolderOverview,
    ...(onCreateWorkflow ? { onCreateWorkflowFromContainer: setWorkflowFromTarget } : {}),
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

  const driftedSpecUids = useDriftedSpecUids(specs, requestCollections);
  const specNodes = useSpecNodes({
    specs,
    driftedSpecUids,
    filterText,
    setRenamingId,
    confirmDelete,
    renameSpec,
    deleteSpec: deleteSpecEntity,
    onSelectSpec,
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

  const {
    createNewCollection,
    createNewRequestCollection,
    createNewTemplateCollection,
    createNewEnvironment,
    createNewSpec,
  } = useSidebarCreateActions({
    localCollections,
    requestCollections,
    templateCollections,
    environments,
    specs,
    createLocalCollection,
    createRequestCollectionRpc,
    createTemplateCollection,
    createEnvironment,
    createSpec: createSpecEntity,
    setSectionsExpanded,
    setExpandedKeys,
    onOpenCollectionOverview,
    onOpenTemplateCollectionOverview,
    onSelectEnvironment,
    onSelectSpec,
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
      if (sectionsExpanded.specs) items.push(...specNodes);
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
    specNodes,
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
    isExpandedKey,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    resolveResponseExampleParent,
    resolveGrpcResponseExampleParent,
    resolveWsResponseExampleParent,
    containerRef,
    toggleExpand,
    setRenamingId,
    setExpandedKeys,
    setSectionsExpanded,
    onExportSelection,
  });

  // ── Speed-search derivation + host handle ─────────────────────
  // Match derivation runs after `allFlatItems` (search lands on the
  // revealed rows); the state machine ran before the node hooks.

  const searchMatches = useTreeSearchMatches({ search, allFlatItems, containerRef, setFocusedId });

  useImperativeHandle(searchRef, () => ({ focus: search.openBar }), [search.openBar]);

  // Filter-mode ArrowDown/Enter — the old filter row's hand-off into
  // the tree: cursor on the first visible row, DOM focus on the
  // container so arrows keep working.
  const jumpToTree = useCallback(() => {
    const first = allFlatItems[0];
    if (!first) return;
    setFocusedId(first.id);
    containerRef.current?.focus();
    setTimeout(() => {
      containerRef.current?.querySelector(`[data-item-id="${first.id}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }, [allFlatItems, setFocusedId]);

  const closeSearch = useCallback(() => {
    search.closeBar();
    containerRef.current?.focus();
  }, [search.closeBar]);

  // Cmd/Ctrl+F opens the bar — bound on the panel root so it fires
  // only while DOM focus is inside THIS panel (keydown bubbles up from
  // the focused descendant). The editor's find is Monaco-scoped and
  // the window shortcut bus carries no mod+f, so nothing global is
  // intercepted.
  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        search.openBar();
        return;
      }
      // Esc anywhere in the tree closes an open bar. Inputs are exempt:
      // the search input and the inline-rename input own their Esc
      // (cancel/close) and events bubble here without stopPropagation.
      if (e.key === 'Escape' && search.open) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        closeSearch();
      }
    },
    [search.openBar, search.open, closeSearch],
  );

  const createMenuItems = buildCreateMenuItems({ onCreateRule, createNewCollection }, t);

  const requestImportMenuItems = buildRequestImportMenuItems(
    {
      createNewRequestCollection,
      onCreateRequest,
      onImport,
    },
    t,
  );

  const { renderTreeNodeRow, renderEmptyState, renderNodes, renderFolderDndNodes } = useSidebarNodeRenderers({
    isSelected,
    isFocused,
    isExportSelected,
    handleItemClick,
    handleItemDoubleClick,
    renamingId,
    setRenamingId,
    isExpandedKey,
    searchHighlightQuery: search.highlightQuery,
    activeSearchMatchId: searchMatches.activeMatchId,
    filterActive: filterText !== '',
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: panel-scoped Cmd/Ctrl+F opens the speed-search bar
    <div className="rules-sidebar" onKeyDown={handleRootKeyDown}>
      <SidebarHeaderActions
        view={view}
        info={info}
        onHide={onHide}
        onOpenSearch={search.openBar}
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
      {search.open && (
        <TreeSearchBar
          search={search}
          matches={searchMatches}
          filterNoMatch={filterText !== '' && allFlatItems.length === 0}
          onJumpToTree={jumpToTree}
          onClose={closeSearch}
        />
      )}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard navigation container */}
      <div
        ref={containerRef}
        className="rules-sidebar-content oh-scroll-topline"
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
            <SpecsSection
              sectionsExpanded={sectionsExpanded}
              toggleSection={toggleSection}
              createNewSpec={createNewSpec}
              specNodes={specNodes}
              renderNodes={renderNodes}
            />
            {(!filterText ||
              t('workbench.sidebar.section.packageLibrary').toLowerCase().includes(filterText.toLowerCase())) && (
              <SectionOpenerRow
                title={t('workbench.sidebar.section.packageLibrary')}
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
      <CreateWorkflowFromRequestsModal
        target={workflowFromTarget}
        onCancel={() => setWorkflowFromTarget(null)}
        onCreate={(name, seedSteps) => {
          setWorkflowFromTarget(null);
          onCreateWorkflow?.({ seedSteps, name });
        }}
      />
    </div>
  );
};

export default Sidebar;
