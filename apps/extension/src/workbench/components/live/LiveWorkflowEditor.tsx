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

import { InfoCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useLiveWorkflowCache } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import {
  type DraftStep,
  type DraftWorkflow,
  draftFromWorkflow as draftFromWorkflowCore,
  newDraftCapture,
  planLiveVariableReconcile,
  stripDraftSteps,
  validateWorkflowShape,
} from '@openheaders/core/live';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import { EntityScopeProvider, useSetActiveFieldFocus } from '@/shared/awareness';
import { useEditorShell, useReprime } from '@/shared/editor-shell';
import type { V5 } from '@openheaders/core/types';
import { Alert, App, Button, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeRequestTrail } from '../../breadcrumbs';
import EditorHeader from '../EditorHeader';
import { buildDependencyRows } from './dependencies-view';
import { InlineNameDescription, Section } from './layout';
import { LIVE_WORKFLOW_FIELD } from '@/shared/awareness/live-paths';
import { readFieldPath } from '@/shared/awareness/field-path';
import {
  classifyRun,
  describeCircuit,
  describeRefreshPolicy,
  describeRunSchedule,
  formatCountdown,
  pickActiveRun,
  statusColor,
  summarizeRunsByEnv,
} from './live-display';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import WorkflowStepEditor from './WorkflowStepEditor';

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
    ? [{ id: 'step1', requestUid: seedStep.requestUid, captures: [defaultCapture] }]
    : [{ id: 'step1', requestUid: '', captures: [defaultCapture] }];
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
  onCreated: (wf: V5.LiveWorkflow) => void;
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
  const { variables, createVariable, updateVariable, deleteVariable } = useLiveVariables();
  const { environments, activeEnvironmentId } = useEnvironments();
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

  const reprime = useReprime<V5.LiveWorkflow>({
    liveEntity: workflow,
    scope: { entityType: LIVE_WORKFLOW_ENTITY_TYPE, entityId: workflow?.uid ?? null },
    enabled: workflow != null,
    formFingerprint,
    signature: (e) => fingerprint(draftFromWorkflow(e, variables)),
    populate: (e) => setDraft(draftFromWorkflow(e, variables)),
    onPrimed: () => {
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
          steps: [...d.steps, { id: candidate, requestUid: seedStep.requestUid, captures: [] }],
        };
      });
    },
  });
  const isDirty = reprime.isDirty;

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
      // Dirty derives from form-vs-canonical equality; broadcast echo
      // brings live in line with form, useReprime auto-rebase clears.
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
    message,
    variables,
    createVariable,
    updateVariable,
    deleteVariable,
  ]);

  const handleSaveSync = useCallback(() => void handleSave(), [handleSave]);

  const shell = useEditorShell({
    entityType: LIVE_WORKFLOW_ENTITY_TYPE,
    entityId: workflow?.uid ?? null,
    isDirty,
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
  const perEnvRuns = useMemo(() => summarizeRunsByEnv(runs, activeEnvironmentId ?? null), [runs, activeEnvironmentId]);
  const envName = useCallback(
    (environmentId: string | null) => {
      if (environmentId === null) return 'No environment';
      return environments.find((e) => e.uid === environmentId)?.name ?? 'Unknown env';
    },
    [environments],
  );

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
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '6px 10px',
              background: token.colorFillAlter,
              borderRadius: 4,
              marginBottom: 14,
              fontSize: 11,
            }}
          >
            {/* Top row: refresh policy + binding count — workflow-level facts that don't vary by env */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {describeRefreshPolicy(draft.refresh)}
              </Text>
              <div style={{ flex: 1 }} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                bound: {boundVars.length} variable{boundVars.length === 1 ? '' : 's'}
              </Text>
            </div>
            {/* Per-env table — one row per env that has a cache, plus the
              active env row even when no cache exists for it. The active
              env row is always first + visually highlighted so the user
              sees "what's resolved RIGHT NOW" at a glance. */}
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {perEnvRuns.map((entry) => {
                const entryLevel = classifyRun(entry.run);
                return (
                  <div
                    key={entry.environmentId ?? '__none__'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '3px 6px',
                      borderRadius: 3,
                      background: entry.isActive ? token.colorBgContainer : 'transparent',
                      border: entry.isActive ? `1px solid ${token.colorBorderSecondary}` : '1px solid transparent',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: statusColor(entryLevel),
                        flexShrink: 0,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: entry.isActive ? 600 : 400,
                        color: entry.isActive ? token.colorText : token.colorTextSecondary,
                      }}
                    >
                      {envName(entry.environmentId)}
                      {entry.isActive ? ' (active)' : ''}
                    </Text>
                    {entry.run ? (
                      <>
                        {describeRunSchedule(entry.run, draft.refresh).map((chunk) => (
                          <Text key={chunk.text} type={chunk.tone} style={{ fontSize: 11 }}>
                            · {chunk.text}
                          </Text>
                        ))}
                        <CircuitInlineStatus run={entry.run} />
                        {entry.run.lastErrorMessage && (
                          <Text type="danger" style={{ fontSize: 11 }}>
                            · {entry.run.lastErrorMessage}
                            {entry.run.lastErrorStepId ? ` (${entry.run.lastErrorStepId})` : ''}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text type="warning" style={{ fontSize: 11 }}>
                        · never run for this env — click Refresh to populate
                      </Text>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <WorkflowFormBody draft={draft} setDraft={setDraft} />
        </div>
      </div>
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
    onCreated(wf);
  }, [draft, draftName, createWorkflow, createVariable, message, onCreated]);

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
      <Tag style={{ marginInlineEnd: 0 }}>Draft</Tag>
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

// ── Shared form body ───────────────────────────────────────────────
//
// Name + Description + Steps + Refresh policy + Enabled footer. Used
// by both Edit and Create modes. Validation + dependency-row
// computation live here so neither mode duplicates them.

interface WorkflowFormBodyProps {
  draft: Draft;
  setDraft: (next: Draft) => void;
}

const WorkflowFormBody: React.FC<WorkflowFormBodyProps> = ({ draft, setDraft }) => {
  const { token } = theme.useToken();
  const { requests, collectionTrees: requestCollectionTrees } = useRequests();

  // Construct a full LiveWorkflow shape so the validator + layout
  // helper see a coherent object. Synthetic `uid` / `path` /
  // `schemaVersion` / `version` don't affect validation semantics —
  // they're only inspected for cross-reference shape.
  const draftWorkflow = useMemo<V5.LiveWorkflow>(
    () => ({
      schemaVersion: 5,
      version: 1,
      uid: '________',
      path: 'live-workflows/draft',
      name: draft.name,
      description: draft.description.trim() ? draft.description : undefined,
      enabled: draft.enabled,
      steps: draft.steps,
      refresh: draft.refresh,
    }),
    [draft],
  );

  const validationErrors = useMemo(() => validateWorkflowShape(draftWorkflow), [draftWorkflow]);

  const errorsByStepId = useMemo(() => {
    const map = new Map<string, typeof validationErrors>();
    for (const err of validationErrors) {
      if (err.stepId === null) continue;
      const bucket = map.get(err.stepId) ?? [];
      bucket.push(err);
      map.set(err.stepId, bucket);
    }
    return map;
  }, [validationErrors]);

  const workflowLevelErrors = useMemo(() => validationErrors.filter((e) => e.stepId === null), [validationErrors]);

  const dependencyRows = useMemo(() => buildDependencyRows(draftWorkflow), [draftWorkflow]);

  const capturesByStepId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const step of draft.steps) {
      map.set(
        step.id,
        step.captures.map((c) => c.name),
      );
    }
    return map;
  }, [draft.steps]);

  const availableCaptures = useMemo(
    () =>
      draft.steps.flatMap((s) =>
        s.captures.map((c) => ({ stepId: s.id, captureName: c.name, label: `${s.id}.${c.name}` })),
      ),
    [draft.steps],
  );

  // Decorate requests with their structured `Collection > Folder[...]`
  // trail so the step editor's Select can render a rich option label —
  // folder-icon + collection name, folder-icon + each folder, then a
  // colored method tag + request name. Structured (not pre-joined)
  // because the Select builds JSX: icons per segment, method colored
  // per METHOD_COLORS. `title` (string) stays on the option for
  // showSearch filtering.
  const availableRequests = useMemo(
    () =>
      requests.map((r) => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: r.method,
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
    [requests, requestCollectionTrees],
  );

  const updateStep = (idx: number, next: DraftStep) => {
    const nextSteps = draft.steps.slice();
    nextSteps[idx] = next;
    setDraft({ ...draft, steps: nextSteps });
  };

  const addStep = () => {
    const existingIds = new Set(draft.steps.map((s) => s.id));
    let candidate = `step${draft.steps.length + 1}`;
    let n = draft.steps.length + 1;
    while (existingIds.has(candidate)) {
      n += 1;
      candidate = `step${n}`;
    }
    const next: DraftStep = {
      id: candidate,
      requestUid: '',
      captures: [],
    };
    setDraft({ ...draft, steps: [...draft.steps, next] });
  };

  const removeStep = (idx: number) => {
    if (draft.steps.length <= 1) return;
    setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== idx) });
  };

  const moveStep = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= draft.steps.length) return;
    const next = draft.steps.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft({ ...draft, steps: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* InlineNameDescription holds two inputs (name + description) so
          we wrap with a coarse `name` path; sub-field discrimination
          would require splitting the component. The dominant collision
          target is the workflow name; description rarely conflicts. */}
      <div data-field-path={LIVE_WORKFLOW_FIELD.name}>
        <InlineNameDescription
          name={draft.name}
          description={draft.description}
          onChangeName={(name) => setDraft({ ...draft, name })}
          onChangeDescription={(description) => setDraft({ ...draft, description })}
          namePlaceholder="Workflow name"
        />
      </div>

      {workflowLevelErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="Workflow has structural issues"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {workflowLevelErrors.map((err) => (
                <li key={`${err.issue}:${err.stepId ?? ''}:${err.referencedStepId ?? ''}`} style={{ fontSize: 12 }}>
                  {err.message}
                </li>
              ))}
            </ul>
          }
        />
      )}

      <div data-field-path={LIVE_WORKFLOW_FIELD.steps}>
      <Section
        title={
          <>
            <span style={{ flex: 1 }}>Steps ({draft.steps.length})</span>
            <Button size="small" icon={<PlusOutlined />} onClick={addStep}>
              Step
            </Button>
          </>
        }
      >
        {draft.steps.length === 0 && (
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            No steps yet — add one to wire a request + extraction into this workflow.
          </Text>
        )}
        {draft.steps.map((step, idx) => {
          const row = dependencyRows[idx];
          // Other step ids for the dependsOn multi-select — excluding
          // self (a step can't depend on itself; validator would flag).
          const allStepIds = draft.steps
            .filter((s) => s.id !== step.id && s.id.length > 0)
            .map((s) => ({ id: s.id, label: s.id }));
          // Reachable ancestors — only these can be referenced from
          // runIf / priorityFrom. The transitive set is computed by
          // `buildDependencyRows` via the core validator's helper.
          const reachableSteps = Array.from(row?.reachable ?? []).map((id) => ({ id, label: id }));
          const stepErrors = errorsByStepId.get(step.id) ?? [];
          return (
            <WorkflowStepEditor
              key={step.id || `step-${idx}`}
              step={step}
              index={idx}
              totalSteps={draft.steps.length}
              availableRequests={availableRequests}
              onChange={(next) => updateStep(idx, next)}
              onRemove={() => removeStep(idx)}
              onMoveUp={() => moveStep(idx, -1)}
              onMoveDown={() => moveStep(idx, 1)}
              allStepIds={allStepIds}
              reachableSteps={reachableSteps}
              capturesByStepId={capturesByStepId}
              errors={stepErrors}
              dependencyRow={row}
            />
          );
        })}
      </Section>
      </div>

      <div data-field-path={LIVE_WORKFLOW_FIELD.refresh}>
      <Section title="Refresh policy">
        <RefreshPolicyEditor
          value={draft.refresh}
          onChange={(refresh) => setDraft({ ...draft, refresh })}
          availableCaptures={availableCaptures}
        />
      </Section>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: 4,
          paddingTop: 10,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div data-field-path={LIVE_WORKFLOW_FIELD.enabled} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Switch
            size="small"
            aria-label="Workflow enabled"
            checked={draft.enabled}
            onChange={(enabled) => setDraft({ ...draft, enabled })}
          />
          <Text style={{ fontSize: 12 }}>{draft.enabled ? 'Enabled' : 'Disabled'}</Text>
        </div>
        <Tooltip title="Sequential only in v1. Parallel execution coming in a future release.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Switch aria-label="Run independent steps in parallel" size="small" checked={false} disabled />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Run independent steps in parallel
            </Text>
            <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

// ── CircuitInlineStatus ───────────────────────────────────────────
//
// Per-env circuit pill rendered inline with the "last Xm ago · expires
// Ym" row. Folds four distinct UX states into one small surface:
//   - green healthy: hidden (no label — the green dot upstream
//     already says "fine"; we don't want to spam the row).
//   - yellow pre-breaker: "· retry 2 of 3" + tooltip describing the
//     two-tier retry.
//   - yellow probing: "· probing…" (probe in flight; no countdown —
//     the chain will resolve shortly).
//   - red paused: "· paused · next attempt in 12m" with a live
//     ticking countdown, tooltip explaining the backoff window.
//
// Ticking uses a 1-second interval only when the circuit is OPEN and
// `nextAttemptAt` is in the future — no-op for every other state
// (no React timer, no wasted re-renders on healthy rows).

const CircuitInlineStatus: React.FC<{ run: import('@utils/bridge').LiveWorkflowRunSnapshot }> = ({ run }) => {
  const [, setNow] = useState(Date.now());
  const descriptor = describeCircuit(run);
  const needsTick = descriptor.nextAttemptAt !== null && descriptor.nextAttemptAt > Date.now();

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // Healthy — no dedicated pill. The per-env dot already carries the
  // green signal; adding "· healthy" would just be noise.
  if (descriptor.level === 'green' || descriptor.level === 'idle') return null;

  const countdown = descriptor.nextAttemptAt !== null ? formatCountdown(descriptor.nextAttemptAt) : '';
  const labelColor = descriptor.level === 'red' ? 'danger' : descriptor.level === 'yellow' ? 'warning' : 'secondary';

  return (
    <Tooltip title={descriptor.hint}>
      <Text type={labelColor} style={{ fontSize: 11 }}>
        · {descriptor.label}
        {countdown ? ` · next attempt ${countdown}` : ''}
      </Text>
    </Tooltip>
  );
};
