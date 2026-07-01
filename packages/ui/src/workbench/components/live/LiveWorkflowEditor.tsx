/**
 * LiveWorkflowEditor — tab body for editing one LiveWorkflow OR drafting
 * a new one.
 *
 * Edit mode (`mode: 'edit'`):
 *   Controlled by a local draft; commits via `updateLiveWorkflow`,
 *   which routes through the sync engine's per-(field) LWW oracle
 *   (sync engine §6.3). On external commit while the editor is clean,
 *   the draft re-primes from the new persisted state; while dirty the
 *   user's typing is preserved and LWW resolves at save time. Shows a
 *   status bar with the last refresh / expiry / policy summary + a
 *   Refresh-now button.
 *
 * Create mode (`mode: 'create'`):
 *   No `workflowUid` until save. Local-only draft; Save creates the
 *   workflow via `createLiveWorkflow` and calls `onCreated` so the host
 *   can replace the draft tab with a fresh edit tab. Optional `seedStep`
 *   preseeds step 1 with a request (used by the Request editor's
 *   "Use response in workflow" action). No status bar, no
 *   Refresh-now button (nothing to refresh before first save).
 *
 * Phase I responsibilities (both modes):
 *   - Runs `validateWorkflowShape` against the draft on every change
 *     so per-step inline errors (cycle, unknown dep, unreachable
 *     gate/priority ref, unknown capture) render without a save attempt.
 *   - Threads dependency-layout metadata (`buildDependencyRows`) into
 *     each step editor for indented-tree visualization.
 *   - Surfaces workflow-level structural errors (no-root-step,
 *     depends-on-cycle) as a dedicated alert near the step list.
 *   - Renders the disabled "Run independent steps in parallel" toggle
 *     per the show-but-disable catalog.
 */

import { ReloadOutlined } from '@ant-design/icons';
import { useEnvironments } from '@openheaders/ui/shared/hooks/useEnvironments';
import { useLiveWorkflowCache } from '@openheaders/ui/shared/hooks/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/useLiveWorkflows';
import {
  type DraftStep,
  type DraftWorkflow,
  draftFromWorkflow as draftFromWorkflowCore,
  isWorkflowComplete,
  newDraftCapture,
  planLiveVariableReconcile,
  stripDraftSteps,
} from '@openheaders/core/live';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import { EntityScopeProvider, useSetActiveFieldFocus } from '@openheaders/ui/shared/awareness';
import { EntityConflictBanner, EntityConflictDialog, hasDialogOnlyConflict } from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useLiveWorkflowConflictResolution } from './use-live-workflow-conflict-resolution';
import { applyLiveWorkflowPublish } from '@openheaders/ui/shared/sync/live-workflow-write-client';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import type { LiveWorkflow } from '@openheaders/core/types';
import { App, Button, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import EditorHeader from '../shell/EditorHeader';
import { readFieldPath } from '@openheaders/ui/shared/awareness/field-path';
import { classifyRun, pickActiveRun, statusColor } from './live-display';
import WorkflowFormBody from './WorkflowFormBody';
import WorkflowRunStatusStrip from './WorkflowRunStatusStrip';

const { Text, Title } = Typography;

// ── Draft shape + helpers ──────────────────────────────────────────
//
// Draft types + reconcile planner live in `@openheaders/core/live/
// editor-draft.ts` (platform-agnostic, unit-tested). Here we just
// alias the core `DraftWorkflow` → `Draft` to match the existing
// component-local variable names, and keep local `fingerprint` /
// `emptyDraft` thin wrappers.

type Draft = DraftWorkflow;

function fingerprint(d: Draft): string {
  // Include exposure fields so editing the switch or the live-name
  // flips isDirty correctly. Everything in the draft is user-editable
  // state, so a full JSON dump is the simplest correct fingerprint.
  return JSON.stringify(d);
}

function emptyDraft(seedStep?: { requestUid: string; requestName: string; method: string } | undefined): Draft {
  const defaultCapture = newDraftCapture('capture1', { kind: 'whole-body' });
  const steps: DraftStep[] = seedStep
    ? [{ uid: generateUid(), id: 'step1', requestUid: seedStep.requestUid, captures: [defaultCapture] }]
    : [{ uid: generateUid(), id: 'step1', requestUid: '', captures: [defaultCapture] }];
  return {
    name: '',
    description: '',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
  };
}

// Re-aliased to match existing component call sites.
const draftFromWorkflow = draftFromWorkflowCore;

// ── Props (discriminated union) ────────────────────────────────────

interface EditProps {
  mode: 'edit';
  workflowUid: string;
  /**
   * Optional pending seed step — applied once to the initial draft
   * (after the workflow loads) so the editor opens with the request
   * staged as a new step. The persisted fingerprint is computed from
   * the unmodified workflow so `isDirty` flips true immediately and
   * the user can review + Save. Consumed exactly once per tab mount.
   */
  seedStep?: { requestUid: string; requestName: string; method: string };
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

interface CreateProps {
  mode: 'create';
  /** Draft label shown in the header when the name is still blank. */
  draftName?: string;
  /** Optional preseeded step 1 from the Request editor's Extract flow. */
  seedStep?: { requestUid: string; requestName: string; method: string };
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Called when the draft persists. Host replaces the tab with an edit tab. */
  onCreated: (wf: LiveWorkflow) => void;
}

type Props = EditProps | CreateProps;

// ── Unified dispatcher ─────────────────────────────────────────────

const LiveWorkflowEditor: React.FC<Props> = (props) => {
  if (props.mode === 'edit') return <EditMode {...props} />;
  return <CreateMode {...props} />;
};

export default LiveWorkflowEditor;

// ── Edit mode ──────────────────────────────────────────────────────

const EditMode: React.FC<EditProps> = ({ workflowUid, seedStep, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workflows, updateWorkflow, refreshNow } = useLiveWorkflows();
  const editingWorkspaceId = useWorkbenchEditingScopeWorkspaceId();
  const { variables, createVariable, updateVariable, deleteVariable } = useLiveVariables();
  const { activeEnvironmentId } = useEnvironments();
  const { runs } = useLiveWorkflowCache(workflowUid);

  const workflow = useMemo(() => workflows.find((w) => w.uid === workflowUid) ?? null, [workflows, workflowUid]);
  const boundVars = useMemo(() => variables.filter((v) => v.workflowUid === workflowUid), [variables, workflowUid]);

  const [draft, setDraft] = useState<Draft | null>(() => (workflow ? draftFromWorkflow(workflow, variables) : null));

  const [refreshing, setRefreshing] = useState(false);

  const formFingerprint = useMemo(() => (draft ? fingerprint(draft) : ''), [draft]);

  // One-shot gate for the optional seedStep — applied after first
  // populate so the appended step flips `isDirty` immediately.
  // `seedAppliedRef` survives auto-rebase + clean-state reseeds.
  const seedAppliedRef = useRef(false);

  // Conflict baseline advances synchronously inside populate via a ref
  // (tracker is declared after reprime since its `isDirty` flows in
  // from reprime).
  const setBaselineRef = useRef<(e: LiveWorkflow) => void>(() => undefined);
  // Snapshot of the canonical entity at the most recent re-prime — feeds
  // the merge-editor preview's Show Base layouts via `baseText`.
  const baselineLiveWorkflowRef = useRef<LiveWorkflow | null>(null);

  const reprime = useReprime<LiveWorkflow>({
    liveEntity: workflow,
    scope: { entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: workflow?.uid ?? null },
    enabled: workflow != null,
    formFingerprint,
    signature: (e) => fingerprint(draftFromWorkflow(e, variables)),
    populate: (e) => setDraft(draftFromWorkflow(e, variables)),
    onPrimed: (e) => {
      setBaselineRef.current(e);
      baselineLiveWorkflowRef.current = e;
      if (!seedStep || seedAppliedRef.current) return;
      seedAppliedRef.current = true;
      setDraft((d) => {
        if (!d) return d;
        const existingIds = new Set(d.steps.map((s) => s.id));
        let candidate = `step${d.steps.length + 1}`;
        let n = d.steps.length + 1;
        while (existingIds.has(candidate)) {
          n += 1;
          candidate = `step${n}`;
        }
        return {
          ...d,
          steps: [...d.steps, { uid: generateUid(), id: candidate, requestUid: seedStep.requestUid, captures: [] }],
        };
      });
    },
  });
  const isDirty = reprime.isDirty;

  const {
    allConflicts,
    clearDismissed,
    isConflictDialogOpen,
    setConflictDialogOpen,
    handleKeepAllMine,
    handleUseAllSaved,
    handleResolveText,
    savedText,
    baseText,
    mineText,
  } = useLiveWorkflowConflictResolution({
    workflow,
    draft,
    setDraft,
    isDirty,
    boundVars,
    setBaselineRef,
    baselineLiveWorkflowRef,
  });

  // Per-field focus path. Live editors don't use antd Form, so focus
  // mapping rides `data-field-path` attributes on field-section
  // wrappers (within `WorkflowFormBody`); a focus-capture ancestor
  // walk reads the path off the focused element and routes it through
  // `useSetActiveFieldFocus` — the same central context the
  // workspace-level publisher reads.
  const setActiveFieldFocus = useSetActiveFieldFocus();
  const handleFocusCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!workflow) return;
      const path = readFieldPath(e.target);
      if (!path) return;
      setActiveFieldFocus({ entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: workflow.uid, path });
    },
    [workflow, setActiveFieldFocus],
  );
  const handleBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next && e.currentTarget.contains(next)) return;
      setActiveFieldFocus(null);
    },
    [setActiveFieldFocus],
  );

  const handleSave = useCallback(async () => {
    if (!workflow || !draft) return;
    // 1. Persist the workflow itself. Captures are stripped of their
    //    draft-only exposure overlay — the workflow schema doesn't
    //    include `exposed` / `liveName` / `liveUid`.
    const result = await updateWorkflow(workflow.uid, {
      name: draft.name,
      description: draft.description.trim() ? draft.description : undefined,
      steps: stripDraftSteps(draft.steps),
      refresh: draft.refresh,
      enabled: draft.enabled,
    });
    if (result.success) {
      // 2. Apply the LV reconcile plan the pure core helper computed
      //    from the draft's exposure state. Aliases (LVs pointing at
      //    this workflow's captures but NOT tracked by the draft's
      //    liveUid set) are intentionally left alone — the LV list
      //    page is the surface that owns those.
      // Reconciled LVs are created/updated as drafts here; the workflow's
      // refresh (manual or auto) is what publishes a binding once it has
      // actually produced a value — see `commitSuccess` in the live chain
      // adapter. Save only activates the workflow (below).
      const plan = planLiveVariableReconcile(workflow.uid, draft, variables);
      for (const op of plan.creates) {
        await createVariable({
          name: op.liveName,
          workflowUid: workflow.uid,
          stepId: op.stepId,
          captureName: op.captureName,
          enabled: true,
        });
      }
      for (const op of plan.updates) {
        await updateVariable(op.liveUid, {
          name: op.liveName,
          stepId: op.stepId,
          captureName: op.captureName,
        });
      }
      for (const uid of plan.deletes) {
        await deleteVariable(uid);
      }
      // Save = publish: flip the publication gate so the SW scheduler
      // activates the workflow. Mirrors RuleEditor's Save = update +
      // publish flow. Without this, `workflow.published` stays false
      // forever and the chip / sidebar permanently report `Draft`.
      if (editingWorkspaceId) {
        await applyLiveWorkflowPublish(workflow.uid, {
          workspaceId: editingWorkspaceId,
          surfaceId: 'workbench',
        });
      }
      // Dirty derives from form-vs-canonical equality; broadcast echo
      // brings live in line with form, useReprime auto-rebase clears.
      clearDismissed();
      return;
    }
    if (result.reason === 'not-found') {
      message.error('Workflow was deleted from another tab');
      return;
    }
    message.error('Failed to save workflow');
  }, [
    workflow,
    draft,
    updateWorkflow,
    editingWorkspaceId,
    message,
    variables,
    createVariable,
    updateVariable,
    deleteVariable,
    clearDismissed,
  ]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);

  const shell = useEditorShell({
    entityType: LIVE_WORKFLOW_ENTITY_TYPE,
    entityId: workflow?.uid ?? null,
    isDirty,
    isPublished: workflow?.published === true,
    isComplete: workflow ? isWorkflowComplete(workflow) : undefined,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const handleRefreshNow = useCallback(async () => {
    if (!workflow) return;
    setRefreshing(true);
    const resp = await refreshNow(workflow.uid, activeEnvironmentId);
    setRefreshing(false);
    if (!resp.success) {
      message.error(`Refresh failed: ${resp.error ?? 'unknown error'}`);
    } else {
      message.success('Refreshed');
    }
  }, [workflow, refreshNow, activeEnvironmentId, message]);

  const run = useMemo(() => pickActiveRun(runs, activeEnvironmentId ?? null), [runs, activeEnvironmentId]);
  const level = classifyRun(run);

  if (!workflow) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Workflow not found.</Text>
      </div>
    );
  }

  if (!draft) return null;

  const editHeaderTitle = (
    <>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: statusColor(level),
          display: 'inline-block',
        }}
      />
      <Title level={5} style={{ margin: 0 }}>
        {workflow.name}
      </Title>
      <Tag color="blue" style={{ marginInlineEnd: 0 }}>
        Workflow
      </Tag>
      {!draft.enabled && <Tag style={{ marginInlineEnd: 0 }}>Disabled</Tag>}
    </>
  );

  const editHeaderActions = (
    <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={() => void handleRefreshNow()}>
      Refresh
    </Button>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
    <div
      style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <EditorHeader title={editHeaderTitle} actions={editHeaderActions} shell={shell.headerProps} />
      <EntityConflictBanner
        count={allConflicts.size}
        forceVisible={hasDialogOnlyConflict(allConflicts)}
        onReview={() => setConflictDialogOpen(true)}
        onKeepAllMine={handleKeepAllMine}
        onUseAllSaved={handleUseAllSaved}
      />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <WorkflowRunStatusStrip runs={runs} refresh={draft.refresh} boundCount={boundVars.length} />
          <WorkflowFormBody draft={draft} setDraft={setDraft} />
        </div>
      </div>
      <EntityConflictDialog
        open={isConflictDialogOpen}
        savedText={savedText}
        mineText={mineText}
        baseText={baseText}
        language="json"
        onResolveText={handleResolveText}
        onClose={() => setConflictDialogOpen(false)}
      />
    </div>
    </EntityScopeProvider>
  );
};

// ── Create mode ────────────────────────────────────────────────────

const CreateMode: React.FC<CreateProps> = ({ draftName, seedStep, onDirtyChange, registerSaveRef, onCreated }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { createWorkflow } = useLiveWorkflows();
  const { createVariable } = useLiveVariables();
  const editingWorkspaceId = useWorkbenchEditingScopeWorkspaceId();

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(seedStep));

  // Dirty the moment the user touches anything. Comparing against the
  // initial seed-derived fingerprint keeps empty drafts from being
  // dirty unless the user actually edits.
  const seedFp = useMemo(() => fingerprint(emptyDraft(seedStep)), [seedStep]);
  const isDirty = useMemo(() => fingerprint(draft) !== seedFp, [draft, seedFp]);

  const handleSave = useCallback(async () => {
    const name = draft.name.trim() || draftName?.trim() || 'Workflow';
    const wf = await createWorkflow({
      name,
      description: draft.description.trim() ? draft.description : undefined,
      steps: stripDraftSteps(draft.steps),
      refresh: draft.refresh,
      enabled: draft.enabled,
    });
    if (!wf) {
      message.error('Failed to create workflow');
      return;
    }
    // New workflow — no existing LVs. Every exposed capture becomes
    // a fresh LV. Reuse the core plan helper even though `deletes` +
    // `updates` are always empty for a brand-new workflow — keeps
    // the create + edit save paths aligned on the same contract.
    const plan = planLiveVariableReconcile(wf.uid, draft, []);
    for (const op of plan.creates) {
      await createVariable({
        name: op.liveName,
        workflowUid: wf.uid,
        stepId: op.stepId,
        captureName: op.captureName,
        enabled: true,
      });
    }
    // Save = publish (mirrors EditMode + RuleEditor): activate the
    // workflow so the SW scheduler will fire it. The first Save is the
    // only chance — the edit tab opens clean, where Save is disabled
    // (`!isDirty`), so a workflow left as a draft here can never be
    // published. Its exposed LVs go live on the first successful run.
    if (editingWorkspaceId) {
      await applyLiveWorkflowPublish(wf.uid, { workspaceId: editingWorkspaceId, surfaceId: 'workbench' });
    }
    onCreated(wf);
  }, [draft, draftName, createWorkflow, createVariable, editingWorkspaceId, message, onCreated]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);

  const shell = useEditorShell({
    entityType: LIVE_WORKFLOW_ENTITY_TYPE,
    entityId: null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const displayName = draft.name.trim() || draftName || 'New Workflow';

  const createHeaderTitle = (
    <>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: token.colorTextTertiary,
          display: 'inline-block',
        }}
      />
      <Title level={5} style={{ margin: 0 }}>
        {displayName}
      </Title>
      <Tag color="blue" style={{ marginInlineEnd: 0 }}>
        Workflow
      </Tag>
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={createHeaderTitle} shell={shell.headerProps} />
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <WorkflowFormBody draft={draft} setDraft={setDraft} />
        </div>
      </div>
    </div>
    </EntityScopeProvider>
  );
};

