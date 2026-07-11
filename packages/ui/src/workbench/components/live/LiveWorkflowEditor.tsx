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
 *   can replace the draft tab with a fresh edit tab. Optional `seedSteps`
 *   preseeds the draft's steps in declared order (one from the Request
 *   editor's "Use response in workflow" action, many from the request
 *   tree's "Create Workflow…" picker). No status bar, no Refresh-now
 *   button (nothing to refresh before first save).
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
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useLiveWorkflowCache } from '@openheaders/ui/shared/hooks/readers/useLiveCache';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
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
import type { WorkflowSeedStep } from '../../types';
import type { LiveWorkflow } from '@openheaders/core/types';
import { App, Button, Segmented, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import EditorHeader from '../shell/EditorHeader';
import { readFieldPath } from '@openheaders/ui/shared/awareness/field-path';
import { LIVE_WORKFLOW_FIELD, liveWorkflowStepIndexFromPath } from '@openheaders/ui/shared/awareness/live-paths';
import { appendDraftStep } from './graph-edit';
import { classifyRun, pickActiveRun, statusColor } from './live-display';
import WorkflowFormBody from './WorkflowFormBody';
import WorkflowGraphBody from './WorkflowGraphBody';
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

function emptyDraft(seedSteps?: readonly WorkflowSeedStep[]): Draft {
  // One step per seed (tree order), each with the same whole-body
  // default capture step 1 always started with; no seeds = one blank step.
  const seeds = seedSteps && seedSteps.length > 0 ? seedSteps : [undefined];
  const steps: DraftStep[] = seeds.map((seed, i) => ({
    uid: generateUid(),
    id: `step${i + 1}`,
    requestUid: seed?.requestUid ?? '',
    captures: [newDraftCapture('capture1', { kind: 'whole-body' })],
  }));
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
   * Optional pending seed steps — applied once to the initial draft
   * (after the workflow loads) so the editor opens with the requests
   * staged as new steps, in declared order. The persisted fingerprint
   * is computed from the unmodified workflow so `isDirty` flips true
   * immediately and the user can review + Save. Consumed exactly once
   * per tab mount.
   */
  seedSteps?: WorkflowSeedStep[];
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

interface CreateProps {
  mode: 'create';
  /** Draft label shown in the header when the name is still blank. */
  draftName?: string;
  /** Optional preseeded steps — the Request editor's Extract flow
   *  (one) or the request tree's "Create Workflow…" picker (many). */
  seedSteps?: WorkflowSeedStep[];
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
  /** Called when the draft persists. Host replaces the tab with an edit tab. */
  onCreated: (wf: LiveWorkflow) => void;
}

type Props = EditProps | CreateProps;

/**
 * Editor↔graph view toggle (WORKFLOW_GRAPH_PLAN.md §4). Component-local
 * UI state — never persisted, never on the tab or entity. Both panes
 * render from the same draft, so switching is loss-free by construction.
 */
type WorkflowView = 'form' | 'graph';

const viewToggle = (view: WorkflowView, setView: (v: WorkflowView) => void): React.ReactNode => (
  <Segmented
    size="small"
    value={view}
    onChange={(v) => setView(v as WorkflowView)}
    options={[
      { label: 'Form', value: 'form' },
      { label: 'Graph', value: 'graph' },
    ]}
  />
);

// ── Unified dispatcher ─────────────────────────────────────────────

const LiveWorkflowEditor: React.FC<Props> = (props) => {
  if (props.mode === 'edit') return <EditMode {...props} />;
  return <CreateMode {...props} />;
};

export default LiveWorkflowEditor;

// ── Edit mode ──────────────────────────────────────────────────────

const EditMode: React.FC<EditProps> = ({ workflowUid, seedSteps, onDirtyChange, registerSaveRef }) => {
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
  const [view, setView] = useState<WorkflowView>('form');
  // Graph↔form selection sync (WORKFLOW_GRAPH_PLAN.md §6.2). Ephemeral
  // UI state like `view` — never persisted, never on the draft, so it
  // can't move `isDirty` by construction. `scrollToStepId` is a
  // consume-once request set only by an explicit graph-side "Edit
  // step" jump; mere selection following form focus never scrolls.
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [scrollToStepId, setScrollToStepId] = useState<string | null>(null);
  const handleScrollToStepDone = useCallback(() => setScrollToStepId(null), []);

  const formFingerprint = useMemo(() => (draft ? fingerprint(draft) : ''), [draft]);

  // One-shot gate for the optional seedSteps — applied after first
  // populate so the appended steps flip `isDirty` immediately.
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
      if (!seedSteps || seedSteps.length === 0 || seedAppliedRef.current) return;
      seedAppliedRef.current = true;
      setDraft((d) => {
        if (!d) return d;
        let next = d;
        for (const seed of seedSteps) next = appendDraftStep(next, seed.requestUid).draft;
        return next;
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
      // Form-side focus drives the graph selection: a step-scoped path
      // maps back to its step id so returning to Graph highlights the
      // node the user was just editing.
      const stepIndex = liveWorkflowStepIndexFromPath(path);
      if (stepIndex !== null) {
        const stepId = draft?.steps[stepIndex]?.id;
        if (stepId) setSelectedStepId(stepId);
      }
      setActiveFieldFocus({ entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: workflow.uid, path });
    },
    [workflow, draft, setActiveFieldFocus],
  );
  const handleBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (next && e.currentTarget.contains(next)) return;
      setActiveFieldFocus(null);
    },
    [setActiveFieldFocus],
  );

  // Graph node click: select + publish the whole-step path through the
  // same awareness context form focus uses (PLAN §6.2) — no leaf is
  // focused, so the step-root path is the honest granularity.
  const handleGraphSelect = useCallback(
    (stepId: string, declaredIndex: number) => {
      setSelectedStepId(stepId);
      if (!workflow) return;
      setActiveFieldFocus({
        entityType: LIVE_WORKFLOW_ENTITY_TYPE,
        entityId: workflow.uid,
        path: LIVE_WORKFLOW_FIELD.stepRoot(declaredIndex),
      });
    },
    [workflow, setActiveFieldFocus],
  );

  // Graph "Edit step" affordance / double-click: jump to the form
  // scrolled to that step's card.
  const handleGraphOpen = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    setView('form');
    setScrollToStepId(stepId);
  }, []);

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
    <>
      {viewToggle(view, setView)}
      <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={() => void handleRefreshNow()}>
        Refresh
      </Button>
    </>
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
      {view === 'form' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <WorkflowRunStatusStrip runs={runs} refresh={draft.refresh} boundCount={boundVars.length} />
            <WorkflowFormBody
              draft={draft}
              setDraft={setDraft}
              selectedStepId={selectedStepId}
              scrollToStepId={scrollToStepId}
              onScrollToStepDone={handleScrollToStepDone}
            />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <WorkflowGraphBody
            draft={draft}
            setDraft={setDraft}
            selectedStepId={selectedStepId}
            onSelectStep={handleGraphSelect}
            onOpenStep={handleGraphOpen}
            run={run}
            boundVars={boundVars}
          />
        </div>
      )}
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

const CreateMode: React.FC<CreateProps> = ({ draftName, seedSteps, onDirtyChange, registerSaveRef, onCreated }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { createWorkflow } = useLiveWorkflows();
  const { createVariable } = useLiveVariables();
  const editingWorkspaceId = useWorkbenchEditingScopeWorkspaceId();

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(seedSteps));
  const [view, setView] = useState<WorkflowView>('form');
  // Graph↔form selection sync — same ephemeral state as EditMode, but
  // with no awareness publishing: a draft has no entity id until save.
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [scrollToStepId, setScrollToStepId] = useState<string | null>(null);
  const handleScrollToStepDone = useCallback(() => setScrollToStepId(null), []);

  const handleFocusCapture = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const path = readFieldPath(e.target);
      if (!path) return;
      const stepIndex = liveWorkflowStepIndexFromPath(path);
      if (stepIndex === null) return;
      const stepId = draft.steps[stepIndex]?.id;
      if (stepId) setSelectedStepId(stepId);
    },
    [draft],
  );

  const handleGraphSelect = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
  }, []);

  const handleGraphOpen = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
    setView('form');
    setScrollToStepId(stepId);
  }, []);

  // Dirty the moment the user touches anything. Comparing against the
  // initial seed-derived fingerprint keeps empty drafts from being
  // dirty unless the user actually edits.
  const seedFp = useMemo(() => fingerprint(emptyDraft(seedSteps)), [seedSteps]);
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
    <div
      style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}
      onFocusCapture={handleFocusCapture}
    >
      <EditorHeader title={createHeaderTitle} actions={viewToggle(view, setView)} shell={shell.headerProps} />
      {view === 'form' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <WorkflowFormBody
              draft={draft}
              setDraft={setDraft}
              selectedStepId={selectedStepId}
              scrollToStepId={scrollToStepId}
              onScrollToStepDone={handleScrollToStepDone}
            />
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <WorkflowGraphBody
            draft={draft}
            setDraft={setDraft}
            selectedStepId={selectedStepId}
            onSelectStep={handleGraphSelect}
            onOpenStep={handleGraphOpen}
          />
        </div>
      )}
    </div>
    </EntityScopeProvider>
  );
};

