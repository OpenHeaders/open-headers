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
  DownloadOutlined,
  EllipsisOutlined,
  FolderOpenOutlined,
  MenuUnfoldOutlined,
  MinusOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useAllLiveCaches } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import { useRules } from '@hooks/useRules';
import { useVariableResolver } from '@hooks/useVariableResolver';
import type { V5 } from '@openheaders/core/types';
import { isRuleResolvable } from '@openheaders/core/utils';
import { call } from '@utils/bridge';
import type { InputRef } from 'antd';
import { App, Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildRuleTypeMenuItems } from '../rule-type-menu';
import { useSettingValue } from '../settings/hooks';
import type { WorkbenchTab } from '../types';
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

interface SidebarProps {
  view: SidebarView;
  activeTabId?: string | null;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  onDeleteRule?: (uid: string) => void;
  onOpenCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onSelectTemplate?: (uid: string) => void;
  onOpenTemplateCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenTemplateFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onSelectEnvironment?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenVault?: () => void;
  onOpenLiveVariables?: () => void;
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
  dirtyWorkflowUids?: ReadonlySet<string>;
  unresolvableWorkflowUids?: ReadonlySet<string>;
  allTabs?: WorkbenchTab[];
  onSwitchTab?: (tabId: string) => void;
  onCloseDraftTab?: (tabId: string) => void;
  /** Hide the sidebar dock — bound to the trailing − button in the
      toolbar. Calls `tl.closeDock(slot)` from the shell wrapper. */
  onHide?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  view,
  activeTabId,
  onSelectRule,
  onCreateRule,
  onDeleteRule,
  onOpenCollectionOverview,
  onOpenFolderOverview,
  onSelectTemplate,
  onOpenTemplateCollectionOverview,
  onOpenTemplateFolderOverview,
  onSelectEnvironment,
  onOpenWorkspaceVariables,
  onOpenVault,
  onOpenLiveVariables,
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
  dirtyWorkflowUids,
  unresolvableWorkflowUids,
  allTabs,
  onSwitchTab,
  onCloseDraftTab,
  onHide,
}) => {
  const { token } = theme.useToken();
  const {
    rules,
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
    setActiveEnvironment,
    setDefaultEnvironment,
  } = useEnvironments();

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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() =>
    view === 'http-rules' ? new Set(['sys-tpl-col', 'sys-tpl-header']) : new Set(),
  );
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = { environments: false };
    if (view === 'api-requests') {
      base['api-requests'] = true;
    } else if (view === 'variables') {
      base.vault = true;
      base['workspace-vars'] = true;
      base.environments = true;
      base['live-variables'] = true;
    } else if (view === 'workflows') {
      base.workflows = true;
    } else {
      base.rules = true;
      base.templates = true;
    }
    return base;
  });

  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(true);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback((key: string) => {
    setSectionsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (view === 'api-requests') {
      setSectionsExpanded({ 'api-requests': true, environments: true });
    } else if (view === 'variables') {
      setSectionsExpanded({
        vault: true,
        'workspace-vars': true,
        environments: true,
        'live-variables': true,
      });
    } else if (view === 'workflows') {
      setSectionsExpanded({ workflows: true });
    } else {
      setSectionsExpanded({ rules: true, templates: true, environments: true });
    }
    const allKeys = new Set<string>();
    const collectKeys = (nodes: V5.TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          allKeys.add(`folder-${n.uid}`);
          collectKeys(n.children);
        }
      }
    };
    for (const col of localCollectionTrees) {
      allKeys.add(`col-${col.uid}`);
      collectKeys(col.tree);
    }
    for (const col of templateCollectionTrees) {
      allKeys.add(`tpl-col-${col.uid}`);
      collectKeys(col.tree);
    }
    setExpandedKeys(allKeys);
  }, [view, localCollectionTrees, templateCollectionTrees]);

  const collapseAll = useCallback(() => {
    if (view === 'api-requests') {
      setSectionsExpanded({ 'api-requests': false, environments: false });
    } else if (view === 'variables') {
      setSectionsExpanded({
        vault: false,
        'workspace-vars': false,
        environments: false,
        'live-variables': false,
      });
    } else if (view === 'workflows') {
      setSectionsExpanded({ workflows: false });
    } else {
      setSectionsExpanded({ rules: false, templates: false, environments: false });
    }
    setExpandedKeys(new Set());
  }, [view]);

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

  const handleToggleRule = useCallback(
    (ruleUid: string, enabled: boolean) => {
      call('toggleRule', { ruleId: ruleUid, enabled })
        .then((resp) => {
          if (!resp?.success) void message.error('Failed to toggle rule');
        })
        .catch(() => void message.error('Failed to toggle rule'));
    },
    [message],
  );

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
    onOpenCollectionOverview,
    onOpenFolderOverview,
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
  });

  const requestNodes = useRequestTreeNodes({
    requestCollectionTrees,
    requestCollections,
    allRequests,
    resolver,
    dirtyRequestUids,
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
    setActiveEnvironment,
    setDefaultEnvironment,
    onSelectEnvironment,
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
  });

  const { vaultNode, workspaceVarsNode, liveVarsNode } = useVariableSingletonNodes({
    onOpenVault,
    onOpenWorkspaceVariables,
    onOpenLiveVariables,
  });

  // ── Create-new entrypoints ─────────────────────────────────────

  const createNewRequestCollection = useCallback(async () => {
    const col = await createRequestCollectionRpc('New Collection');
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
  }, [createRequestCollectionRpc, message]);

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
    const col = await createLocalCollection('New Collection');
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, rules: true }));
      onOpenCollectionOverview?.(col.uid, col.name, true);
    }
  }, [createLocalCollection, onOpenCollectionOverview]);

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
    (node: TreeNode) => {
      setFocusedId(node.id);
      if (shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
      }
    },
    [allFlatItems, focusedId, expandedKeys, toggleExpand],
  );

  const createMenuItems = [
    ...buildRuleTypeMenuItems(onCreateRule),
    { type: 'divider' as const, key: 'div-collection' },
    { key: 'collection', icon: <FolderOpenOutlined />, label: 'Collection', onClick: () => void createNewCollection() },
  ];

  const requestImportMenuItems = [
    {
      key: 'collection',
      icon: <FolderOpenOutlined />,
      label: 'New Request Collection',
      onClick: () => void createNewRequestCollection(),
    },
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

  const renderNodes = (nodes: TreeNode[], emptyCreate?: () => void) => {
    if (nodes.length === 0) {
      return (
        <div className="rules-sidebar-empty-state">
          <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>No items in this panel</span>
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
    }
    return nodes.map((node) => (
      <TreeNodeRow
        key={node.id}
        node={node}
        isSelected={isSelected(node.id)}
        isFocused={isFocused(node.id)}
        isRenaming={renamingId === node.id}
        isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
        onClick={() => handleItemClick(node)}
        onDoubleClick={() => handleItemDoubleClick(node)}
        onStartRename={() => {
          if (renamingId === node.id) setRenamingId(null);
          else setRenamingId(node.id);
        }}
      />
    ));
  };

  return (
    <div className="rules-sidebar">
      <div className="rules-sidebar-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          ref={filterRef}
          size="small"
          placeholder="Filter"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />}
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
          style={{ flex: 1, fontSize: 11 }}
          variant="borderless"
        />
        <div className="rules-panel-header-actions" data-focus-skip>
        {view === 'http-rules' && (
          <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
            <Tooltip title="New rule" placement="bottom">
              <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
                <PlusOutlined />
              </div>
            </Tooltip>
          </Dropdown>
        )}
        {view === 'api-requests' && (
          <Dropdown menu={{ items: requestImportMenuItems }} trigger={['click']} placement="bottomRight">
            <Tooltip title="Add request" placement="bottom">
              <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
                <PlusOutlined />
              </div>
            </Tooltip>
          </Dropdown>
        )}
        {view === 'variables' && (
          <Tooltip title="New environment" placement="bottom">
            <button
              type="button"
              className="rules-sidebar-toolbar-icon"
              style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => void createNewEnvironment()}
            >
              <PlusOutlined />
            </button>
          </Tooltip>
        )}
        {view === 'workflows' && (
          <Tooltip title="New workflow" placement="bottom">
            <button
              type="button"
              className="rules-sidebar-toolbar-icon"
              style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => onCreateWorkflow?.()}
            >
              <PlusOutlined />
            </button>
          </Tooltip>
        )}
        <Tooltip title="Select Opened Tab" placement="bottom">
          <button
            type="button"
            className="rules-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={selectOpenedFile}
          >
            <AimOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Expand All" placement="bottom">
          <button
            type="button"
            className="rules-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={expandAll}
          >
            <MenuUnfoldOutlined />
          </button>
        </Tooltip>
        <Tooltip title="Collapse All" placement="bottom">
          <button
            type="button"
            className="rules-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={collapseAll}
          >
            <BorderLeftOutlined />
          </button>
        </Tooltip>
        <Dropdown
          menu={{
            items: [
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
            ],
          }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setOptionsMenuOpen}
        >
          <Tooltip title="Options" placement="bottom" open={optionsMenuOpen ? false : undefined}>
            <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
              <EllipsisOutlined />
            </div>
          </Tooltip>
        </Dropdown>
        {onHide && (
          <Tooltip title="Hide" placement="bottom">
            <button
              type="button"
              className="rules-sidebar-toolbar-icon"
              style={{ color: token.colorTextSecondary, background: 'none', border: 'none', cursor: 'pointer' }}
              // preventDefault on mousedown: don't steal DOM focus from
              // whatever the user currently has focused. The click still
              // fires onClick after.
              onMouseDown={(e) => e.preventDefault()}
              onClick={onHide}
              aria-label="Hide panel"
            >
              <MinusOutlined />
            </button>
          </Tooltip>
        )}
        </div>
      </div>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard navigation container */}
      <div ref={containerRef} className="rules-sidebar-content" onKeyDown={handleKeyDown} style={{ outline: 'none' }}>
        {view === 'api-requests' && (
          <>
            <SectionHeader
              title="API REQUESTS"
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
                {renderNodes(requestNodes, () => void createNewRequestCollection())}
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
                {renderNodes(rulesNodes, () => void createNewCollection())}
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
                      void createTemplateCollection('New Collection').then((col) => {
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
                {renderNodes(systemTemplateNodes)}
                {renderNodes(templateNodes, () => {
                  void createTemplateCollection('My Templates').then((col) => {
                    if (col) {
                      setSectionsExpanded((prev) => ({ ...prev, templates: true }));
                      onOpenTemplateCollectionOverview?.(col.uid, col.name, true);
                    }
                  });
                })}
              </div>
            )}
          </>
        )}

        {view === 'variables' && (
          <>
            <SectionHeader title="VAULT" expanded={sectionsExpanded.vault} onToggle={() => toggleSection('vault')} />
            {sectionsExpanded.vault && <div style={{ overflowY: 'auto' }}>{renderNodes([vaultNode])}</div>}

            <SectionHeader
              title="WORKSPACE VARIABLES"
              expanded={sectionsExpanded['workspace-vars']}
              onToggle={() => toggleSection('workspace-vars')}
            />
            {sectionsExpanded['workspace-vars'] && (
              <div style={{ overflowY: 'auto' }}>{renderNodes([workspaceVarsNode])}</div>
            )}

            <SectionHeader
              title="LIVE VARIABLES"
              expanded={sectionsExpanded['live-variables']}
              onToggle={() => toggleSection('live-variables')}
            />
            {sectionsExpanded['live-variables'] && (
              <div style={{ overflowY: 'auto' }}>{renderNodes([liveVarsNode])}</div>
            )}
          </>
        )}

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
              <div style={{ overflowY: 'auto' }}>
                {workflowNodes.length > 0 ? (
                  renderNodes(workflowNodes, () => onCreateWorkflow?.())
                ) : (
                  <div style={{ padding: '8px 16px', fontSize: 11, color: token.colorTextTertiary }}>
                    <ThunderboltOutlined style={{ marginRight: 4 }} />
                    No workflows yet — author one by clicking + to schedule a request chain.
                  </div>
                )}
              </div>
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
