/**
 * WorkbenchToolWindow — the per-slot tool-window body dispatcher. The
 * shell (`WorkbenchContent`) mounts one of these per dock slot via
 * `ShellLayout`'s `renderToolWindow` render prop; the `id` switch picks
 * the panel to mount and threads the openers, decoration sets, and
 * layout handlers down to it.
 *
 * The four sidebar-backed tool windows (`http-rules`, `api-requests`,
 * `variables`, `workflows`) share the same `Sidebar` component — a
 * `view` prop gates which sections render so keyboard nav, filter, and
 * toolbar stay shared behavior instead of four forks.
 *
 * Pure presentation glue: every input arrives as a prop so the shell
 * stays the single owner of the openers, the import/export ref, the
 * decoration sets, and the sidebar tree state. The `id` switch order
 * mirrors the dock's tool-window vocabulary — leave it alone.
 */

import type { LiveWorkflow } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import type React from 'react';
import { lazy, Suspense } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import WorkflowStatusPanel from '../live/WorkflowStatusPanel';
import ActivityFeedPanel from '../panels/ActivityFeedPanel';
import DocsPanel from '../panels/DocsPanel';
import { NotificationsPanel } from '@openheaders/ui/shared/notifications';
import VariablesPanel from '../panels/variables-panel';
import Sidebar from '../sidebar/Sidebar';

// Lazy: xterm only loads when a terminal actually renders — the window
// exists solely on hosts with the `terminal` capability (registry
// `requiresCapability` gate), so other hosts never fetch the chunk.
const TerminalPanel = lazy(() => import('../panels/terminal/TerminalPanel'));
// Pulls the panel-package network table (TrafficList + detail); lazy so
// browser workbenches that never register the observability capabilities
// don't bundle it.
const TrafficMonitorPanel = lazy(() => import('../panels/TrafficMonitorPanel'));
// The sessions archive window shares the capability gate above.
const TrafficSessionsPanel = lazy(() => import('../panels/TrafficSessionsPanel'));
// Lazy for the same reason: the window exists solely on hosts with the
// `workspaceGit` capability (registry `requiresCapability` gate).
const GitLogPanel = lazy(() => import('../panels/git/GitLogPanel'));
import { DesktopTeaser } from '@openheaders/ui/shared/desktop-teaser';
import type { SidebarView } from '../sidebar/types';
import { buildEntityExportScope, buildSelectionExportScope } from '../workspace-export/build-export-scope';
import type { ImportExportModalsHandle } from '../workspace-export/ImportExportModals';
import type { UseEditorGroupsApi } from '../../hooks/useEditorGroups';
import type { EntityStatusSets } from '../../hooks/useEntityStatusSets';
import type { UseTabOpenersApi } from '../../hooks/useTabOpeners';
import type { ToolLayoutApi } from '../../hooks/useToolLayout';
import type { UseWorkbenchSidebarStateApi } from '../../hooks/useWorkbenchSidebarState';
import { getToolWindowInfo } from '../../tool-window-info';
import { isToolWindowTeased, TOOL_WINDOW_MAP } from '../../tool-windows';
import type { DockSlot, ToolWindowId, WorkbenchTab } from '../../types';

interface WorkbenchToolWindowProps {
  id: ToolWindowId;
  slot: DockSlot;

  // Layout state machine.
  tl: ToolLayoutApi;

  // Editor-groups slice.
  activeTabId: UseEditorGroupsApi['activeTabId'];
  allTabs: UseEditorGroupsApi['allTabs'];
  switchTab: UseEditorGroupsApi['switchTab'];

  // Tab openers (useTabOpeners).
  openEditTab: UseTabOpenersApi['openEditTab'];
  openCreateTab: UseTabOpenersApi['openCreateTab'];
  openCollectionOverview: UseTabOpenersApi['openCollectionOverview'];
  openFolderOverview: UseTabOpenersApi['openFolderOverview'];
  openRequestCollectionOverview: UseTabOpenersApi['openRequestCollectionOverview'];
  openRequestFolderOverview: UseTabOpenersApi['openRequestFolderOverview'];
  openTemplateEditTab: UseTabOpenersApi['openTemplateEditTab'];
  openTemplateCollectionOverview: UseTabOpenersApi['openTemplateCollectionOverview'];
  openTemplateFolderOverview: UseTabOpenersApi['openTemplateFolderOverview'];
  openEnvironmentEdit: UseTabOpenersApi['openEnvironmentEdit'];
  openSpecEdit: UseTabOpenersApi['openSpecEdit'];
  openCreateEnvironment: () => void;
  openWorkspaceVariables: UseTabOpenersApi['openWorkspaceVariables'];
  openVault: UseTabOpenersApi['openVault'];
  openScriptPackages: UseTabOpenersApi['openScriptPackages'];
  openLiveVariables: UseTabOpenersApi['openLiveVariables'];
  openCollectionVariables: UseTabOpenersApi['openCollectionVariables'];
  openRequestCollectionVariables: UseTabOpenersApi['openRequestCollectionVariables'];
  openTemplateCollectionVariables: UseTabOpenersApi['openTemplateCollectionVariables'];
  openLiveWorkflowEdit: UseTabOpenersApi['openLiveWorkflowEdit'];
  openCreateLiveWorkflow: UseTabOpenersApi['openCreateLiveWorkflow'];
  openRequestEditTab: UseTabOpenersApi['openRequestEditTab'];
  openCreateRequestTab: UseTabOpenersApi['openCreateRequestTab'];
  openGrpcRequestEditTab: UseTabOpenersApi['openGrpcRequestEditTab'];
  openCreateGrpcRequestTab: UseTabOpenersApi['openCreateGrpcRequestTab'];
  openWebSocketRequestEditTab: UseTabOpenersApi['openWebSocketRequestEditTab'];
  openCreateWebSocketRequestTab: UseTabOpenersApi['openCreateWebSocketRequestTab'];
  openResponseExampleTab: UseTabOpenersApi['openResponseExampleTab'];
  openGrpcResponseExampleTab: UseTabOpenersApi['openGrpcResponseExampleTab'];
  openWsResponseExampleTab: UseTabOpenersApi['openWsResponseExampleTab'];
  openLiveVariableEdit: UseTabOpenersApi['openLiveVariableEdit'];
  openProxyRequestInspect: UseTabOpenersApi['openProxyRequestInspect'];
  openLiveNetworkRequestInspect: UseTabOpenersApi['openLiveNetworkRequestInspect'];
  openLiveStorageDocInspect: UseTabOpenersApi['openLiveStorageDocInspect'];
  openSettingsTab: UseTabOpenersApi['openSettingsTab'];

  // Shell-local handlers.
  handleDeleteRule: (uid: string) => void;
  handleCloseTab: (tabId: string) => Promise<void>;
  handleViewActivityEntity: (entityType: string, entityId: string) => void;

  // Imperative refs.
  importExportRef: RefObject<ImportExportModalsHandle | null>;
  sidebarFilterRefs: MutableRefObject<Map<SidebarView, InputRef | null>>;

  // Decoration sets (useEntityStatusSets).
  dirtyRuleUids: EntityStatusSets['dirtyRuleUids'];
  dirtyRequestUids: EntityStatusSets['dirtyRequestUids'];
  scriptsReviewPendingUids: EntityStatusSets['scriptsReviewPendingUids'];
  dirtyWorkflowUids: EntityStatusSets['dirtyWorkflowUids'];
  unresolvableWorkflowUids: EntityStatusSets['unresolvableWorkflowUids'];

  // Sidebar tree-expansion state (useWorkbenchSidebarState).
  sidebarState: UseWorkbenchSidebarStateApi;

  // Panel context.
  activeTab: WorkbenchTab | undefined;
  liveWorkflows: LiveWorkflow[];
}

const WorkbenchToolWindow: React.FC<WorkbenchToolWindowProps> = ({
  id,
  slot,
  tl,
  activeTabId,
  allTabs,
  switchTab,
  openEditTab,
  openCreateTab,
  openCollectionOverview,
  openFolderOverview,
  openRequestCollectionOverview,
  openRequestFolderOverview,
  openTemplateEditTab,
  openTemplateCollectionOverview,
  openTemplateFolderOverview,
  openEnvironmentEdit,
  openSpecEdit,
  openCreateEnvironment,
  openWorkspaceVariables,
  openVault,
  openScriptPackages,
  openLiveVariables,
  openCollectionVariables,
  openRequestCollectionVariables,
  openTemplateCollectionVariables,
  openLiveWorkflowEdit,
  openCreateLiveWorkflow,
  openRequestEditTab,
  openCreateRequestTab,
  openGrpcRequestEditTab,
  openCreateGrpcRequestTab,
  openWebSocketRequestEditTab,
  openCreateWebSocketRequestTab,
  openResponseExampleTab,
  openGrpcResponseExampleTab,
  openWsResponseExampleTab,
  openLiveVariableEdit,
  openProxyRequestInspect,
  openLiveNetworkRequestInspect,
  openLiveStorageDocInspect,
  openSettingsTab,
  handleDeleteRule,
  handleCloseTab,
  handleViewActivityEntity,
  importExportRef,
  sidebarFilterRefs,
  dirtyRuleUids,
  dirtyRequestUids,
  scriptsReviewPendingUids,
  dirtyWorkflowUids,
  unresolvableWorkflowUids,
  sidebarState,
  activeTab,
  liveWorkflows,
}) => {
  const t = useT();
  // Capability-gated window on a host without the capability: render
  // the desktop teaser instead of the real panel. Checked BEFORE the
  // switch so the lazy chunks below (xterm, git, proxy table) are
  // never fetched on hosts that can't run them.
  const def = TOOL_WINDOW_MAP[id];
  if (isToolWindowTeased(def)) {
    return <DesktopTeaser feature={def.teaserWhenUnavailable} icon={def.icon} />;
  }
  switch (id) {
    case 'http-rules':
    case 'api-requests':
    case 'variables':
    case 'workflows':
      return (
        <Sidebar
          view={id}
          info={getToolWindowInfo(id, t)}
          activeTabId={activeTabId}
          onSelectRule={openEditTab}
          onCreateRule={openCreateTab}
          onDeleteRule={handleDeleteRule}
          onExportEntity={(args) => importExportRef.current?.openExportModal(buildEntityExportScope(args))}
          onExportSelection={(entities) =>
            importExportRef.current?.openExportModal(buildSelectionExportScope(entities))
          }
          onOpenCollectionOverview={openCollectionOverview}
          onOpenFolderOverview={openFolderOverview}
          onOpenRequestCollectionOverview={openRequestCollectionOverview}
          onOpenRequestFolderOverview={openRequestFolderOverview}
          onSelectTemplate={openTemplateEditTab}
          onOpenTemplateCollectionOverview={openTemplateCollectionOverview}
          onOpenTemplateFolderOverview={openTemplateFolderOverview}
          onSelectEnvironment={openEnvironmentEdit}
          onSelectSpec={openSpecEdit}
          onOpenWorkspaceVariables={openWorkspaceVariables}
          onOpenVault={openVault}
          onOpenLiveVariables={openLiveVariables}
          onOpenScriptPackages={openScriptPackages}
          onOpenCollectionVariables={openCollectionVariables}
          onOpenRequestCollectionVariables={openRequestCollectionVariables}
          onOpenTemplateCollectionVariables={openTemplateCollectionVariables}
          onSelectLiveWorkflow={openLiveWorkflowEdit}
          onCreateWorkflow={(context) => openCreateLiveWorkflow(context)}
          onSelectRequest={openRequestEditTab}
          onCreateRequest={openCreateRequestTab}
          onSelectGrpcRequest={openGrpcRequestEditTab}
          onCreateGrpcRequest={openCreateGrpcRequestTab}
          onSelectWebSocketRequest={openWebSocketRequestEditTab}
          onCreateWebSocketRequest={openCreateWebSocketRequestTab}
          onSelectResponseExample={openResponseExampleTab}
          onSelectGrpcResponseExample={openGrpcResponseExampleTab}
          onSelectWsResponseExample={openWsResponseExampleTab}
          onImport={(ctx) => importExportRef.current?.openImportSource(ctx)}
          filterRef={(node: InputRef | null) => {
            if (node) sidebarFilterRefs.current.set(id as SidebarView, node);
            else sidebarFilterRefs.current.delete(id as SidebarView);
          }}
          dirtyRuleUids={dirtyRuleUids}
          dirtyRequestUids={dirtyRequestUids}
          scriptsReviewPendingUids={scriptsReviewPendingUids}
          dirtyWorkflowUids={dirtyWorkflowUids}
          unresolvableWorkflowUids={unresolvableWorkflowUids}
          allTabs={allTabs}
          onSwitchTab={switchTab}
          onCloseDraftTab={handleCloseTab}
          onHide={() => tl.closeDock(slot)}
          expandedKeys={sidebarState.expandedKeys}
          setExpandedKeys={sidebarState.setExpandedKeys}
          sectionsExpanded={sidebarState.getSectionsForView(id)}
          setSectionsExpanded={(updater) => sidebarState.setSectionsForView(id, updater)}
        />
      );
    case 'workflow-status':
      return (
        <WorkflowStatusPanel
          info={getToolWindowInfo('workflow-status', t)}
          onClose={() => tl.toggleWindow('workflow-status')}
          // `openLiveWorkflowEdit` expects `(uid, name, seedSteps?)`.
          // The sidebar only knows the uid; look up the name from
          // the workflow list so the tab title renders correctly.
          onOpenWorkflow={(uid) => {
            const wf = liveWorkflows.find((w) => w.uid === uid);
            openLiveWorkflowEdit(uid, wf?.name ?? t('workbench.shell.fallback.workflow'));
          }}
          // Empty-state CTA — same action as the Workflows navigator's
          // Create button, revealing that navigator so the draft has a
          // visible home.
          onCreateWorkflow={() => {
            tl.activateWindow('workflows');
            openCreateLiveWorkflow();
          }}
        />
      );
    case 'activity':
      return (
        <ActivityFeedPanel
          info={getToolWindowInfo('activity', t)}
          onClose={() => tl.toggleWindow('activity')}
          onViewEntity={handleViewActivityEntity}
        />
      );
    case 'notifications':
      return (
        <NotificationsPanel
          info={getToolWindowInfo('notifications', t)}
          onClose={() => tl.toggleWindow('notifications')}
        />
      );
    case 'docs':
      return <DocsPanel info={getToolWindowInfo('docs', t)} onClose={() => tl.toggleWindow('docs')} />;
    case 'var-scope':
      return (
        <VariablesPanel
          info={getToolWindowInfo('var-scope', t)}
          onClose={() => tl.toggleWindow('var-scope')}
          activeTab={activeTab ?? null}
          onOpenVault={openVault}
          onOpenWorkspaceVariables={openWorkspaceVariables}
          onOpenLiveVariables={openLiveVariables}
          onOpenLiveVariableEdit={openLiveVariableEdit}
          onOpenEnvironmentEdit={openEnvironmentEdit}
          onCreateEnvironment={openCreateEnvironment}
          onOpenRuleCollectionVariables={openCollectionVariables}
          onOpenRequestCollectionVariables={openRequestCollectionVariables}
          onOpenTemplateCollectionVariables={openTemplateCollectionVariables}
        />
      );
    case 'traffic-monitor':
      return (
        <Suspense fallback={null}>
          <TrafficMonitorPanel
            info={getToolWindowInfo(id, t)}
            onHide={() => tl.closeDock(slot)}
            onOpenProxyRequest={openProxyRequestInspect}
            onOpenLiveRequest={openLiveNetworkRequestInspect}
            onOpenStorageDoc={openLiveStorageDocInspect}
            onOpenProxySettings={() => openSettingsTab({ categoryId: 'proxyTrust' })}
            onOpenSessionsWindow={() => {
              if (tl.state.hidden.includes('traffic-sessions')) tl.restoreWindow('traffic-sessions');
              tl.activateWindow('traffic-sessions');
            }}
            activeTab={activeTab ?? null}
          />
        </Suspense>
      );
    case 'traffic-sessions':
      return (
        <Suspense fallback={null}>
          <TrafficSessionsPanel info={getToolWindowInfo(id, t)} onHide={() => tl.closeDock(slot)} />
        </Suspense>
      );
    case 'terminal':
      return (
        <Suspense fallback={null}>
          <TerminalPanel info={getToolWindowInfo('terminal', t)} dockSlot={slot} onHide={() => tl.closeDock(slot)} />
        </Suspense>
      );
    case 'git':
      return (
        <Suspense fallback={null}>
          <GitLogPanel
            info={getToolWindowInfo('git', t)}
            onHide={() => tl.closeDock(slot)}
            onOpenGitSettings={() => openSettingsTab({ categoryId: 'git' })}
          />
        </Suspense>
      );
    default:
      return null;
  }
};

export default WorkbenchToolWindow;
