/**
 * WorkbenchTabBody — the per-tab body dispatcher. Each editor group
 * leaf mounts one of these per tab (via `EditorGroupRenderer`'s
 * `renderTabBody` render prop); the `tab.mode` switch picks the editor
 * or overview to mount and threads the openers, editor-registration
 * callbacks, and save-draft flows down to it.
 *
 * Pure presentation glue: every input arrives as a prop so the shell
 * (`WorkbenchContent`) stays the single owner of the openers, the
 * registration refs, and the workspace/data slices. The branch order
 * mirrors the `tab.mode` union — leave it alone; the first matching
 * guard wins.
 */

import type { Collection, CollectionTree, ExtensionRuleType, LiveWorkflow } from '@openheaders/core/types';
import type React from 'react';
import { findFolderByUid } from '@openheaders/ui/shared/variables';
import type { UseWorkspacesApi } from '@openheaders/ui/shared/hooks/useWorkspaces';
import CollectionOverview from '../overviews/CollectionOverview';
import CollectionVariablesEditor from '../variables/CollectionVariablesEditor';
import EnvironmentEditor from '../variables/EnvironmentEditor';
import FolderOverview from '../overviews/FolderOverview';
import LiveVariablesEditor from '../variables/LiveVariablesEditor';
import LiveVariableEditor from '../live/LiveVariableEditor';
import LiveWorkflowEditor from '../live/LiveWorkflowEditor';
import RequestCollectionOverview from '../overviews/RequestCollectionOverview';
import RequestEditor from '../request-editor/RequestEditor';
import RequestFolderOverview from '../overviews/RequestFolderOverview';
import RuleEditor from '../rule/RuleEditor';
import RuleFlow from '../rule-flow/RuleFlow';
import RunReportView from '../runs/RunReportView';
import TemplateCollectionOverview from '../overviews/TemplateCollectionOverview';
import TemplateEditor from '../template/TemplateEditor';
import TemplateFolderOverview from '../overviews/TemplateFolderOverview';
import VaultEditor from '../variables/VaultEditor';
import WorkspaceManager from '../workspace/WorkspaceManager';
import WorkspaceVariablesEditor from '../variables/WorkspaceVariablesEditor';
import type { EditorRegistrations } from '../../hooks/useEditorRegistrations';
import type { UseEditorGroupsApi } from '../../hooks/useEditorGroups';
import type { SaveRequestFlowApi } from '../../hooks/useSaveRequestFlow';
import type { SaveRuleFlowApi } from '../../hooks/useSaveRuleFlow';
import type { UseTabOpenersApi } from '../../hooks/useTabOpeners';
import { SettingsTab } from '../../settings/ui';
import type { WorkbenchTab } from '../../types';

interface WorkbenchTabBodyProps {
  tab: WorkbenchTab;

  // Editor mounting glue (useEditorRegistrations).
  handleSaved: EditorRegistrations['handleSaved'];
  handleDirtyChange: EditorRegistrations['handleDirtyChange'];
  registerSaveRef: EditorRegistrations['registerSaveRef'];
  registerSaveAsTemplateRef: EditorRegistrations['registerSaveAsTemplateRef'];
  registerRuleDuplicateRef: EditorRegistrations['registerRuleDuplicateRef'];
  registerRequestDuplicateRef: EditorRegistrations['registerRequestDuplicateRef'];

  // Tab openers (useTabOpeners).
  openEditTab: UseTabOpenersApi['openEditTab'];
  openCreateTab: UseTabOpenersApi['openCreateTab'];
  openFolderOverview: UseTabOpenersApi['openFolderOverview'];
  openRequestFolderOverview: UseTabOpenersApi['openRequestFolderOverview'];
  openTemplateFolderOverview: UseTabOpenersApi['openTemplateFolderOverview'];
  openRuleFlow: UseTabOpenersApi['openRuleFlow'];
  openCollectionVariables: UseTabOpenersApi['openCollectionVariables'];
  openCreateRequestTab: UseTabOpenersApi['openCreateRequestTab'];
  openRequestCollectionVariables: UseTabOpenersApi['openRequestCollectionVariables'];
  openRequestEditTab: UseTabOpenersApi['openRequestEditTab'];
  openTemplateEditTab: UseTabOpenersApi['openTemplateEditTab'];
  openTemplateCollectionVariables: UseTabOpenersApi['openTemplateCollectionVariables'];
  openLiveWorkflowEdit: UseTabOpenersApi['openLiveWorkflowEdit'];
  openLiveVariableEdit: UseTabOpenersApi['openLiveVariableEdit'];
  openCreateLiveVariable: UseTabOpenersApi['openCreateLiveVariable'];
  openCreateLiveWorkflow: UseTabOpenersApi['openCreateLiveWorkflow'];

  // Shell-local handlers and slices.
  openTestRunsPanel: () => void;
  handleRunReportDeleted: (tabId: string) => void;
  handleSwitchWorkspace: (targetId: string, opts?: { makeActive?: boolean }) => void;
  onRuleSaveDraft: SaveRuleFlowApi['handleSaveDraft'];
  onRequestSaveDraft: SaveRequestFlowApi['handleSaveDraft'];
  replaceTab: UseEditorGroupsApi['replaceTab'];
  workspacesApi: UseWorkspacesApi;
  editingScopeWorkspaceId: string | null;

  // Family-dispatch data.
  requestCollections: Collection[];
  templateCollections: Collection[];
  localCollectionTrees: CollectionTree[];
  requestCollectionTrees: CollectionTree[];
  templateCollectionTrees: CollectionTree[];
  liveWorkflows: LiveWorkflow[];
}

const WorkbenchTabBody: React.FC<WorkbenchTabBodyProps> = ({
  tab,
  handleSaved,
  handleDirtyChange,
  registerSaveRef,
  registerSaveAsTemplateRef,
  registerRuleDuplicateRef,
  registerRequestDuplicateRef,
  openEditTab,
  openCreateTab,
  openFolderOverview,
  openRequestFolderOverview,
  openTemplateFolderOverview,
  openRuleFlow,
  openCollectionVariables,
  openCreateRequestTab,
  openRequestCollectionVariables,
  openRequestEditTab,
  openTemplateEditTab,
  openTemplateCollectionVariables,
  openLiveWorkflowEdit,
  openLiveVariableEdit,
  openCreateLiveVariable,
  openCreateLiveWorkflow,
  openTestRunsPanel,
  handleRunReportDeleted,
  handleSwitchWorkspace,
  onRuleSaveDraft,
  onRequestSaveDraft,
  replaceTab,
  workspacesApi,
  editingScopeWorkspaceId,
  requestCollections,
  templateCollections,
  localCollectionTrees,
  requestCollectionTrees,
  templateCollectionTrees,
  liveWorkflows,
}) => {
  if (tab.mode === 'edit' && tab.ruleUid) {
    return (
      <RuleEditor
        ruleUid={tab.ruleUid}
        tabId={tab.id}
        initialTemplateKey={tab.templateKey}
        initialDraft={tab.initialDraft}
        onSaved={(uid) => handleSaved(tab.id, uid)}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        registerSaveAsTemplateRef={(fn) => registerSaveAsTemplateRef(tab.id, fn)}
        registerDuplicateRef={(fn) => registerRuleDuplicateRef(tab.id, fn)}
      />
    );
  }
  if (tab.mode === 'collection-overview' && tab.entityId) {
    // Dispatch by family — uids never collide, so a single uid
    // disambiguates which overview component to mount. Falls
    // through to the rule-collection overview (matches pre-
    // session-50 behavior + handles the still-loading case).
    if (requestCollections.some((c) => c.uid === tab.entityId)) {
      return (
        <RequestCollectionOverview
          collectionUid={tab.entityId}
          onSelectRequest={openRequestEditTab}
          onCreateRequest={openCreateRequestTab}
          onOpenFolderOverview={openRequestFolderOverview}
          onOpenCollectionVariables={openRequestCollectionVariables}
        />
      );
    }
    if (templateCollections.some((c) => c.uid === tab.entityId)) {
      return (
        <TemplateCollectionOverview
          collectionUid={tab.entityId}
          onSelectTemplate={openTemplateEditTab}
          onOpenFolderOverview={openTemplateFolderOverview}
          onOpenCollectionVariables={openTemplateCollectionVariables}
        />
      );
    }
    return (
      <CollectionOverview
        collectionUid={tab.entityId}
        onSelectRule={openEditTab}
        onCreateRule={openCreateTab}
        onOpenFolderOverview={openFolderOverview}
        onOpenRuleFlow={openRuleFlow}
        onOpenTestRuns={openTestRunsPanel}
        onOpenCollectionVariables={openCollectionVariables}
      />
    );
  }
  if (tab.mode === 'folder-overview' && tab.entityId) {
    // Family-dispatch by folder uid lookup. Folder uids — like
    // collection uids — are globally unique, so a single uid picks
    // the right component. Falls through to the rule-family
    // FolderOverview for the still-loading case (no match in any
    // family yet) so the user sees a brief "Folder not found" empty
    // state instead of nothing.
    const owner = findFolderByUid(tab.entityId, {
      ruleTrees: localCollectionTrees,
      requestTrees: requestCollectionTrees,
      templateTrees: templateCollectionTrees,
    });
    if (owner?.family === 'request') {
      return (
        <RequestFolderOverview
          folderUid={tab.entityId}
          onSelectRequest={openRequestEditTab}
          onCreateRequest={openCreateRequestTab}
          onOpenFolderOverview={openRequestFolderOverview}
        />
      );
    }
    if (owner?.family === 'template') {
      return (
        <TemplateFolderOverview
          folderUid={tab.entityId}
          onSelectTemplate={openTemplateEditTab}
          onOpenFolderOverview={openTemplateFolderOverview}
        />
      );
    }
    return (
      <FolderOverview
        folderUid={tab.entityId}
        onSelectRule={openEditTab}
        onCreateRule={openCreateTab}
        onOpenFolderOverview={openFolderOverview}
        onOpenRuleFlow={openRuleFlow}
        onOpenTestRuns={openTestRunsPanel}
      />
    );
  }
  if (tab.mode === 'template-edit' && tab.templateUid) {
    return (
      <TemplateEditor
        templateUid={tab.templateUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'rule-flow') {
    return (
      <RuleFlow
        scope={tab.flowScope ?? 'all-active'}
        entityId={tab.entityId}
        initialTabUrl={tab.flowTabUrl}
        onSelectRule={openEditTab}
        onCreateRule={openCreateTab}
      />
    );
  }
  if (tab.mode === 'run-report' && tab.testRunId) {
    return (
      <RunReportView
        runId={tab.testRunId}
        onSelectRule={openEditTab}
        onAfterDelete={() => handleRunReportDeleted(tab.id)}
      />
    );
  }
  if (tab.mode === 'settings') {
    return <SettingsTab initialSettingKey={tab.settingsInitialKey} initialCategoryId={tab.settingsInitialCategory} />;
  }
  if (tab.mode === 'workspace-manager') {
    return (
      <WorkspaceManager api={workspacesApi} activeWorkspaceId={editingScopeWorkspaceId} onSwitch={handleSwitchWorkspace} />
    );
  }
  if (tab.mode === 'env-edit' && tab.environmentUid) {
    return (
      <EnvironmentEditor
        environmentUid={tab.environmentUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'workspace-vars') {
    return (
      <WorkspaceVariablesEditor
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'vault') {
    return (
      <VaultEditor
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'live-vars') {
    return (
      <LiveVariablesEditor
        onOpenWorkflow={openLiveWorkflowEdit}
        onEditBinding={openLiveVariableEdit}
        onCreateLiveVariable={openCreateLiveVariable}
      />
    );
  }
  if (tab.mode === 'collection-vars' && tab.collectionUid) {
    return (
      <CollectionVariablesEditor
        kind="rule"
        collectionUid={tab.collectionUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'request-collection-vars' && tab.collectionUid) {
    return (
      <CollectionVariablesEditor
        kind="request"
        collectionUid={tab.collectionUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'template-collection-vars' && tab.collectionUid) {
    return (
      <CollectionVariablesEditor
        kind="template"
        collectionUid={tab.collectionUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'request-edit' && tab.requestUid) {
    return (
      <RequestEditor
        mode="request-edit"
        requestUid={tab.requestUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        registerDuplicateRef={(fn) => registerRequestDuplicateRef(tab.id, fn)}
        onExtractToWorkflow={(target, seedStep) => {
          if (target === 'new') {
            openCreateLiveWorkflow({ seedStep });
            return;
          }
          const wf = liveWorkflows.find((w) => w.uid === target.workflowUid);
          openLiveWorkflowEdit(target.workflowUid, wf?.name ?? 'Workflow', seedStep);
        }}
      />
    );
  }
  if (tab.mode === 'rule-create') {
    return (
      <RuleEditor
        mode="rule-create"
        tabId={tab.id}
        seedRuleType={tab.ruleType as ExtensionRuleType}
        seedDraftName={tab.draftName ?? tab.label}
        initialTemplateKey={tab.templateKey}
        initialDraft={tab.initialDraft}
        seedRuleContent={tab.seedRuleContent}
        preferredCollectionId={tab.preferredCollectionId}
        preferredFolderPath={tab.preferredFolderPath}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        registerSaveAsTemplateRef={(fn) => registerSaveAsTemplateRef(tab.id, fn)}
        registerDuplicateRef={(fn) => registerRuleDuplicateRef(tab.id, fn)}
        onSaveDraft={(d) => onRuleSaveDraft(tab.id, d)}
      />
    );
  }
  if (tab.mode === 'request-create') {
    return (
      <RequestEditor
        mode="request-create"
        draftName={tab.draftName ?? tab.label}
        seedRequestContent={tab.seedRequestContent}
        preferredCollectionId={tab.preferredCollectionId}
        preferredFolderPath={tab.preferredFolderPath}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        registerDuplicateRef={(fn) => registerRequestDuplicateRef(tab.id, fn)}
        onSaveDraft={(draftData) => onRequestSaveDraft(tab.id, draftData)}
      />
    );
  }
  if (tab.mode === 'live-variable-edit' && tab.liveVariableUid) {
    return (
      <LiveVariableEditor
        mode="edit"
        variableUid={tab.liveVariableUid}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        openWorkflowTab={openLiveWorkflowEdit}
      />
    );
  }
  if (tab.mode === 'live-variable-create') {
    return (
      <LiveVariableEditor
        mode="create"
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        onCreateWorkflow={() => openCreateLiveWorkflow()}
        onCreated={(lv) =>
          replaceTab(tab.id, {
            id: `live-var-${lv.uid}`,
            label: lv.name,
            ruleType: '',
            dirty: false,
            mode: 'live-variable-edit',
            liveVariableUid: lv.uid,
          })
        }
      />
    );
  }
  if (tab.mode === 'live-workflow-edit' && tab.liveWorkflowUid) {
    return (
      <LiveWorkflowEditor
        mode="edit"
        workflowUid={tab.liveWorkflowUid}
        seedStep={tab.liveWorkflowSeedStep}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
      />
    );
  }
  if (tab.mode === 'live-workflow-create') {
    return (
      <LiveWorkflowEditor
        mode="create"
        draftName={tab.draftName ?? tab.label}
        seedStep={tab.liveWorkflowSeedStep}
        onDirtyChange={(dirty) => handleDirtyChange(tab.id, dirty)}
        registerSaveRef={(saveFn) => registerSaveRef(tab.id, saveFn)}
        onCreated={(wf) =>
          replaceTab(tab.id, {
            id: `live-workflow-${wf.uid}`,
            label: wf.name,
            ruleType: '',
            dirty: false,
            mode: 'live-workflow-edit',
            liveWorkflowUid: wf.uid,
          })
        }
      />
    );
  }
  return null;
};

export default WorkbenchTabBody;
