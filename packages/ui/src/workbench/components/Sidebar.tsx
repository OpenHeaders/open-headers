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
  DownloadOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import { useEnvironments } from '@openheaders/ui/shared/hooks/useEnvironments';
import { useFolderMutator } from '@openheaders/ui/shared/hooks/useFolderMutator';
import { useAllLiveCaches } from '@openheaders/ui/shared/hooks/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/useLiveWorkflows';
import { useRequestFolderMutator } from '@openheaders/ui/shared/hooks/useRequestFolderMutator';
import { useRequests } from '@openheaders/ui/shared/hooks/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useTemplateFolderMutator } from '@openheaders/ui/shared/hooks/useTemplateFolderMutator';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  type FolderParentRef,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import type { TreeNode as CoreTreeNode } from '@openheaders/core/types';
import { isRuleResolvable } from '@openheaders/core/utils';
import type { InputRef } from 'antd';
import { App, Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TEMPLATES_BY_TYPE } from '../rule-templates';
import { buildRuleTypeMenuItems } from '../rule-type-menu';
import { useEnvSwitcher } from '../services/env-switcher';
import { useSettingValue } from '../settings/hooks';
import type { WorkbenchTab } from '../types';
import { getCollectionSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getFolderSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getRequestCollectionSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getRequestFolderSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getTemplateCollectionSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getTemplateFolderSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { replaceOwnedKeys } from './sidebar/expanded-key-ownership';
import { FolderDndTree, type FolderDndConfig } from './sidebar/FolderDndTree';
import { SectionHeader } from './sidebar/SectionHeader';
import { TreeNodeRow } from './sidebar/TreeNodeRow';
import type { SidebarView, TreeNode } from './sidebar/types';
import { useDraftOverlay } from './sidebar/useDraftOverlay';
import { useEnvironmentNodes } from './sidebar/useEnvironmentNodes';
import { useRequestTreeNodes } from './sidebar/useRequestTreeNodes';
import { useRulesTreeNodes } from './sidebar/useRulesTreeNodes';
import { useSelectOpenedTab } from './sidebar/useSelectOpenedTab';
import { useTemplateTreeNodes } from './sidebar/useTemplateTreeNodes';
import { useVariableSingletonNodes } from './sidebar/useVariableSingletonNodes';
import { useWorkflowNodes } from './sidebar/useWorkflowNodes';

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
  activeTabId?: string | null;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  onDeleteRule?: (uid: string) => void;
  /**
   * Open the workspace-export modal scoped to a single sidebar entity.
   * Single callback for every entity kind — keeps the consumer (App.tsx)
   * authoritative on how an entity-ref maps to an `ExportModalScope`.
   */
  onExportEntity?: (entity: import('../App').SidebarExportEntity) => void;
  /**
   * Open the workspace-export modal scoped to a multi-select set of
   * sidebar entities. Aggregation into a single `ExportSelection`
   * (per-type uid lists) lives in App.tsx so the sidebar stays
   * responsibility-pure: it tracks selection, owns the keyboard/mouse
   * gestures, and hands the consumer the resolved entity list.
   */
  onExportSelection?: (entities: import('../App').SidebarExportEntity[]) => void;
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
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Multi-select export selection state. Distinct from `focusedId` /
  // `isSelected` (which track active-tab navigation) — these track which
  // sidebar entities are queued for a combined "Export selected…" call.
  // Cmd/Ctrl+click toggles a single entry; Shift+click extends a range
  // anchored at the last toggled exportable id. Plain click clears.
  // Cleared on view change, filter change, and explicit Esc.
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(() => new Set());
  const lastExportSelectAnchorRef = useRef<string | null>(null);

  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(true);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback(
    (key: string) => {
      setSectionsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [setSectionsExpanded],
  );

  const toggleExpand = useCallback(
    (key: string) => {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [setExpandedKeys],
  );

  // Expand/Collapse All operate on the visible tree only — sections
  // are a layout choice owned by the user, not a deeper level of the
  // tree, so a click here never opens or closes a section. The one
  // exception: if every section in the view is collapsed, Expand All
  // would be a visible no-op, so we fall back to opening sections too
  // and let the user climb out of an all-closed state in one click.
  //
  // `replaceOwnedKeys()` swaps in this view's `nextOwned` tree-key
  // set while preserving every other panel's expansions (keys owned
  // by other views or with no recognized prefix).
  const expandAll = useCallback(() => {
    const collectFolderKeys = (nodes: CoreTreeNode[], prefix: string, into: Set<string>) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          into.add(`${prefix}${n.uid}`);
          collectFolderKeys(n.children, prefix, into);
        }
      }
    };

    if (view === 'http-rules') {
      const rulesOpen = sectionsExpanded.rules === true;
      const templatesOpen = sectionsExpanded.templates === true;
      const allClosed = !rulesOpen && !templatesOpen && sectionsExpanded.environments !== true;
      if (allClosed) {
        setSectionsExpanded({ rules: true, templates: true, environments: true });
      }
      const ownedKeys = new Set<string>();
      if (rulesOpen || allClosed) {
        for (const col of localCollectionTrees) {
          ownedKeys.add(`col-${col.uid}`);
          collectFolderKeys(col.tree, 'folder-', ownedKeys);
        }
      }
      if (templatesOpen || allClosed) {
        for (const col of templateCollectionTrees) {
          ownedKeys.add(`tpl-col-${col.uid}`);
          collectFolderKeys(col.tree, 'tpl-folder-', ownedKeys);
        }
        ownedKeys.add('sys-tpl-col');
        for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
          if (tpls.length === 0) continue;
          ownedKeys.add(`sys-tpl-${ruleType}`);
        }
      }
      setExpandedKeys((prev) => replaceOwnedKeys(prev, ownedKeys, view));
      return;
    }

    if (view === 'api-requests') {
      const reqOpen = sectionsExpanded['api-requests'] === true;
      const allClosed = !reqOpen && sectionsExpanded.environments !== true;
      if (allClosed) {
        setSectionsExpanded({ 'api-requests': true, environments: true });
      }
      const ownedKeys = new Set<string>();
      if (reqOpen || allClosed) {
        for (const col of requestCollectionTrees) {
          ownedKeys.add(`req-col-${col.uid}`);
          collectFolderKeys(col.tree, 'req-folder-', ownedKeys);
        }
      }
      setExpandedKeys((prev) => replaceOwnedKeys(prev, ownedKeys, view));
      return;
    }

    // Views without expandable trees: fall back to opening sections
    // so the button isn't a no-op when sections are collapsed.
    if (view === 'variables') {
      const anyOpen =
        sectionsExpanded.vault === true ||
        sectionsExpanded['workspace-vars'] === true ||
        sectionsExpanded['live-variables'] === true ||
        sectionsExpanded.environments === true;
      if (!anyOpen) {
        setSectionsExpanded({
          vault: true,
          'workspace-vars': true,
          environments: true,
          'live-variables': true,
        });
      }
    } else if (view === 'workflows') {
      if (sectionsExpanded.workflows !== true) {
        setSectionsExpanded({ workflows: true });
      }
    }
  }, [
    view,
    sectionsExpanded,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    setSectionsExpanded,
    setExpandedKeys,
  ]);

  // Collapse All only clears tree keys; sections stay as the user
  // left them. Symmetric with Expand All — a click never closes a
  // section the user explicitly opened.
  const collapseAll = useCallback(() => {
    setExpandedKeys((prev) => replaceOwnedKeys(prev, new Set<string>(), view));
  }, [view, setExpandedKeys]);

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
  const { moveFolder: moveRulesFolder } = useFolderMutator({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
  });
  const { moveRequestFolder } = useRequestFolderMutator({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
  });
  const { moveTemplateFolder } = useTemplateFolderMutator({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
  });

  const rulesFolderDndConfig = useMemo<FolderDndConfig>(() => {
    const toRef = (p: { kind: 'collection' | 'folder'; uid: string }): FolderParentRef => ({
      type: p.kind === 'collection' ? COLLECTION_ENTITY_TYPE : FOLDER_ENTITY_TYPE,
      uid: p.uid,
    });
    return {
      collectionIdPrefix: 'col-',
      folderIdPrefix: 'folder-',
      lookupSiblings: (parent) => {
        if (!activeWorkspaceId) return [];
        return parent.kind === 'collection'
          ? getCollectionSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(
              parent.uid,
              'folders',
            )
          : getFolderSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(
              parent.uid,
              'folders',
            );
      },
      moveFolder: ({ folderUid, parent, orderKey, oldParent }) => {
        void moveRulesFolder({
          folderUid,
          newParent: toRef(parent),
          orderKey,
          ...(oldParent ? { oldParent: toRef(oldParent) } : {}),
        });
      },
    };
  }, [moveRulesFolder, activeWorkspaceId]);

  const requestFolderDndConfig = useMemo<FolderDndConfig>(() => {
    const toRef = (p: { kind: 'collection' | 'folder'; uid: string }): RequestFolderParentRef => ({
      type:
        p.kind === 'collection' ? REQUEST_COLLECTION_ENTITY_TYPE : REQUEST_FOLDER_ENTITY_TYPE,
      uid: p.uid,
    });
    return {
      collectionIdPrefix: 'req-col-',
      folderIdPrefix: 'req-folder-',
      lookupSiblings: (parent) => {
        if (!activeWorkspaceId) return [];
        return parent.kind === 'collection'
          ? getRequestCollectionSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(
              parent.uid,
              'folders',
            )
          : getRequestFolderSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(
              parent.uid,
              'folders',
            );
      },
      moveFolder: ({ folderUid, parent, orderKey, oldParent }) => {
        void moveRequestFolder({
          folderUid,
          newParent: toRef(parent),
          orderKey,
          ...(oldParent ? { oldParent: toRef(oldParent) } : {}),
        });
      },
    };
  }, [moveRequestFolder, activeWorkspaceId]);

  const templateFolderDndConfig = useMemo<FolderDndConfig>(() => {
    const toRef = (p: { kind: 'collection' | 'folder'; uid: string }): TemplateFolderParentRef => ({
      type:
        p.kind === 'collection' ? TEMPLATE_COLLECTION_ENTITY_TYPE : TEMPLATE_FOLDER_ENTITY_TYPE,
      uid: p.uid,
    });
    return {
      collectionIdPrefix: 'tpl-col-',
      folderIdPrefix: 'tpl-folder-',
      lookupSiblings: (parent) => {
        if (!activeWorkspaceId) return [];
        return parent.kind === 'collection'
          ? getTemplateCollectionSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(
              parent.uid,
              'folders',
            )
          : getTemplateFolderSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(
              parent.uid,
              'folders',
            );
      },
      moveFolder: ({ folderUid, parent, orderKey, oldParent }) => {
        void moveTemplateFolder({
          folderUid,
          newParent: toRef(parent),
          orderKey,
          ...(oldParent ? { oldParent: toRef(oldParent) } : {}),
        });
      },
    };
  }, [moveTemplateFolder, activeWorkspaceId]);

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

  const createNewRequestCollection = useCallback(async () => {
    const baseName = 'New Requests Collection';
    const existingNames = new Set(requestCollections.map((c) => c.name));
    let name = baseName;
    let counter = 2;
    while (existingNames.has(name)) name = `${baseName} (${counter++})`;
    const col = await createRequestCollectionRpc(name);
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, 'api-requests': true }));
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.add(`req-col-${col.uid}`);
        return next;
      });
    } else {
      message.error('Failed to create request collection');
    }
  }, [createRequestCollectionRpc, requestCollections, message]);

  const createNewEnvironment = useCallback(async () => {
    const baseName = 'New Environment';
    const existingNames = new Set(environments.map((e) => e.name));
    let name = baseName;
    let counter = 2;
    while (existingNames.has(name)) name = `${baseName} (${counter++})`;
    const env = await createEnvironment(name);
    if (env) {
      setSectionsExpanded((prev) => ({ ...prev, environments: true }));
      onSelectEnvironment?.(env.uid, env.name, true);
    } else {
      message.error('Failed to create environment');
    }
  }, [createEnvironment, environments, onSelectEnvironment, message]);

  const createNewCollection = useCallback(async () => {
    const baseName = 'New Rules Collection';
    const existingNames = new Set(localCollections.map((c) => c.name));
    let name = baseName;
    let counter = 2;
    while (existingNames.has(name)) name = `${baseName} (${counter++})`;
    const col = await createLocalCollection(name);
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, rules: true }));
      onOpenCollectionOverview?.(col.uid, col.name, true);
    }
  }, [createLocalCollection, localCollections, onOpenCollectionOverview]);

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

  // ── Selection / interaction ──────────────────────────────────

  const isSelected = useCallback(
    (id: string) => {
      if (!alwaysSelectOpened || !activeTabId) return false;
      if (activeTabId === id) return true;
      if (id.startsWith('rule-') && activeTabId === `edit-${id.replace('rule-', '')}`) return true;
      if (id.startsWith('tpl-') && activeTabId === `tpl-edit-${id.replace('tpl-', '')}`) return true;
      if (id.startsWith('workflow-') && activeTabId === `live-wf-${id.replace('workflow-', '')}`) return true;
      return (
        (id === 'vault-row' && activeTabId === 'vault') ||
        (id === 'workspace-vars-row' && activeTabId === 'workspace-vars')
      );
    },
    [activeTabId, alwaysSelectOpened],
  );

  const isFocused = useCallback((id: string) => focusedId === id, [focusedId]);

  const shouldOpenOnSingleClick = useCallback(
    (node: TreeNode) => {
      if (node.kind === 'group') return openCollectionsWithSingleClick;
      if (node.kind === 'folder') return openFoldersWithSingleClick;
      return openWithSingleClick;
    },
    [openWithSingleClick, openCollectionsWithSingleClick, openFoldersWithSingleClick],
  );

  const handleItemClick = useCallback(
    (node: TreeNode, e: React.MouseEvent) => {
      const modifierToggle = (e.metaKey || e.ctrlKey) && !e.shiftKey;
      const modifierRange = e.shiftKey;

      if ((modifierToggle || modifierRange) && node.exportEntity) {
        // Multi-select gesture — suppress nav. Cmd/Ctrl toggles, Shift
        // extends a contiguous range over exportable nodes anchored at
        // the last toggled id (or this node if no anchor yet).
        e.preventDefault();
        if (modifierRange) {
          const exportableIds = allFlatItems.filter((n) => n.exportEntity).map((n) => n.id);
          const anchor = lastExportSelectAnchorRef.current ?? node.id;
          const a = exportableIds.indexOf(anchor);
          const b = exportableIds.indexOf(node.id);
          if (a >= 0 && b >= 0) {
            const [from, to] = a <= b ? [a, b] : [b, a];
            setExportSelectedIds((prev) => {
              const next = new Set(prev);
              for (let i = from; i <= to; i++) next.add(exportableIds[i]!);
              return next;
            });
            lastExportSelectAnchorRef.current = node.id;
          }
        } else {
          setExportSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          });
          lastExportSelectAnchorRef.current = node.id;
        }
        setFocusedId(node.id);
        return;
      }

      // Plain click — clear any multi-select set, then normal nav.
      if (exportSelectedIds.size > 0) setExportSelectedIds(new Set());
      lastExportSelectAnchorRef.current = null;
      setFocusedId(node.id);
      // Pull keyboard focus onto the tree container so subsequent
      // ArrowUp/Down/Left/Right reach the React onKeyDown handler.
      // The container carries tabIndex={-1} so this is a real focus()
      // (a plain <div> is not focusable, and rows themselves are not
      // focusable either — focus would otherwise stay on document.body
      // and arrow keys would never reach handleKeyDown).
      containerRef.current?.focus({ preventScroll: true });
      if (shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick, allFlatItems, exportSelectedIds.size],
  );

  const handleItemDoubleClick = useCallback(
    (node: TreeNode) => {
      if (!shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
  );

  const selectOpenedFile = useSelectOpenedTab({
    activeTabId,
    view,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    containerRef,
    setExpandedKeys,
    setSectionsExpanded,
    setFocusedId,
  });

  // Auto-select on active-tab change, with retry when tree data arrives async
  const prevActiveTabRef = useRef(activeTabId);
  const pendingSelectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!alwaysSelectOpened || !activeTabId) return;

    const tabChanged = prevActiveTabRef.current !== activeTabId;
    prevActiveTabRef.current = activeTabId;

    if (tabChanged) {
      const found = selectOpenedFile();
      pendingSelectRef.current = found ? null : activeTabId;
    } else if (pendingSelectRef.current === activeTabId) {
      const found = selectOpenedFile();
      if (found) pendingSelectRef.current = null;
    }
  }, [alwaysSelectOpened, activeTabId, selectOpenedFile]);

  // Multi-select set is bound to the current view + filter context — a
  // pick made under "http-rules" with no filter would silently include
  // hidden nodes if the user switched view or typed a query, so clear it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on view/filter change
  useEffect(() => {
    if (exportSelectedIds.size === 0) return;
    setExportSelectedIds(new Set());
    lastExportSelectAnchorRef.current = null;
  }, [view, filterText]);

  const resolveExportSelectionEntities = useCallback((): import('../App').SidebarExportEntity[] => {
    const byId = new Map<string, import('../App').SidebarExportEntity>();
    for (const n of allFlatItems) {
      if (exportSelectedIds.has(n.id) && n.exportEntity) byId.set(n.id, n.exportEntity);
    }
    return Array.from(byId.values());
  }, [allFlatItems, exportSelectedIds]);

  const handleExportSelectedClick = useCallback(() => {
    const entities = resolveExportSelectionEntities();
    if (entities.length === 0) return;
    onExportSelection?.(entities);
  }, [resolveExportSelectionEntities, onExportSelection]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // When the keystroke is being typed into a child input/textarea/
      // contenteditable (most commonly the inline rename input on a
      // tree row), the tree's nav handler must NOT fire — Arrow keys
      // belong to the input's caret, Backspace/Delete to text edit,
      // F2 to nothing here, etc. We mirror the workspace-shortcut
      // gating (`isInputFocused`) at the container level so the
      // window-level shortcut bus stays untouched (no React-side
      // `stopPropagation` to interfere with Cmd+K, Cmd+S, …).
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = allFlatItems.findIndex((n) => n.id === focusedId);
        const nextIdx =
          e.key === 'ArrowDown' ? Math.min(currentIdx + 1, allFlatItems.length - 1) : Math.max(currentIdx - 1, 0);
        const next = allFlatItems[nextIdx];
        if (next) {
          setFocusedId(next.id);
          setTimeout(
            () =>
              containerRef.current?.querySelector(`[data-item-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }),
            0,
          );
        }
      } else if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onOpen?.();
      } else if (e.key === 'ArrowRight' && focusedId) {
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && !expandedKeys.has(node.id)) {
          e.preventDefault();
          toggleExpand(node.id);
        }
      } else if (e.key === 'ArrowLeft' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && expandedKeys.has(node.id)) toggleExpand(node.id);
        else if (node?.parentId) setFocusedId(node.parentId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onDelete?.();
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.canRename) setRenamingId(focusedId);
      } else if (e.key === 'Escape' && exportSelectedIds.size > 0) {
        e.preventDefault();
        setExportSelectedIds(new Set());
        lastExportSelectAnchorRef.current = null;
      }
    },
    [allFlatItems, focusedId, expandedKeys, toggleExpand, exportSelectedIds.size],
  );

  const createMenuItems = [
    {
      key: 'collection',
      icon: <FolderOpenOutlined />,
      label: 'New Collection',
      onClick: () => void createNewCollection(),
    },
    { type: 'divider' as const, key: 'div-collection' },
    ...buildRuleTypeMenuItems(onCreateRule),
  ];

  const requestImportMenuItems = [
    {
      key: 'collection',
      icon: <FolderOpenOutlined />,
      label: 'New Collection',
      onClick: () => void createNewRequestCollection(),
    },
    ...(onCreateRequest
      ? [
          { type: 'divider' as const, key: 'div-request' },
          {
            key: 'new-request',
            icon: <PlusOutlined />,
            label: 'New Request',
            onClick: () => onCreateRequest(),
          },
        ]
      : []),
    ...(onImportCurl || onImportHar || onImportPostman
      ? ([{ type: 'divider' as const, key: 'div-import' }] as const)
      : []),
    ...(onImportCurl
      ? [
          {
            key: 'import-curl',
            icon: <DownloadOutlined />,
            label: 'Import from cURL',
            onClick: () => onImportCurl(),
          },
        ]
      : []),
    ...(onImportHar
      ? [
          {
            key: 'import-har',
            icon: <DownloadOutlined />,
            label: 'Import from HAR',
            onClick: () => onImportHar(),
          },
        ]
      : []),
    ...(onImportPostman
      ? [
          {
            key: 'import-postman',
            icon: <DownloadOutlined />,
            label: 'Import from Postman',
            onClick: () => onImportPostman(),
          },
        ]
      : []),
  ];

  const renderTreeNodeRow = (node: TreeNode) => (
    <TreeNodeRow
      key={node.id}
      node={node}
      isSelected={isSelected(node.id)}
      isFocused={isFocused(node.id)}
      isRenaming={renamingId === node.id}
      isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
      isExportSelected={exportSelectedIds.has(node.id)}
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
              onClick={() => {
                setExportSelectedIds(new Set());
                lastExportSelectAnchorRef.current = null;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setExportSelectedIds(new Set());
                  lastExportSelectAnchorRef.current = null;
                }
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
                      const baseName = 'User Templates';
                      const existingNames = new Set(templateCollections.map((c) => c.name));
                      let name = baseName;
                      let counter = 2;
                      while (existingNames.has(name)) name = `${baseName} (${counter++})`;
                      void createTemplateCollection(name).then((col) => {
                        if (col) {
                          setSectionsExpanded((prev) => ({ ...prev, templates: true }));
                          onOpenTemplateCollectionOverview?.(col.uid, col.name, true);
                        }
                      });
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
                  const createUserCollection = (): void => {
                    const baseName = 'User Templates';
                    const existingNames = new Set(templateCollections.map((c) => c.name));
                    let name = baseName;
                    let counter = 2;
                    while (existingNames.has(name)) name = `${baseName} (${counter++})`;
                    void createTemplateCollection(name).then((col) => {
                      if (col) {
                        setSectionsExpanded((prev) => ({ ...prev, templates: true }));
                        onOpenTemplateCollectionOverview?.(col.uid, col.name, true);
                      }
                    });
                  };
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
