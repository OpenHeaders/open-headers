/**
 * WorkflowFormBody — the shared form body for `LiveWorkflowEditor`:
 * Description + Steps + Refresh policy + Enabled footer. Used by both
 * Edit and Create modes. Validation + dependency-row computation live
 * here so neither mode duplicates them.
 */

import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { type DraftStep, type DraftWorkflow, validateStepRequestsExist, validateWorkflowShape } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { Alert, Button, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { computeRequestTrail } from '../../breadcrumbs';
import { buildDependencyRows } from './dependencies-view';
import { appendDraftStep } from './graph-edit';
import { InlineDescription, Section } from './layout';
import { rebindCaptureReferences } from './rebind-capture-references';
import { rebindStepReferences } from './rebind-step-references';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import WorkflowStepEditor from './WorkflowStepEditor';

const { Text } = Typography;

interface WorkflowFormBodyProps {
  draft: DraftWorkflow;
  setDraft: (next: DraftWorkflow) => void;
  /** Selected step id for graph↔form selection sync (ephemeral). */
  selectedStepId?: string | null;
  /** Consume-once request: scroll this step's card into view, then report done. */
  scrollToStepId?: string | null;
  onScrollToStepDone?: () => void;
}

const WorkflowFormBody: React.FC<WorkflowFormBodyProps> = ({
  draft,
  setDraft,
  selectedStepId,
  scrollToStepId,
  onScrollToStepDone,
}) => {
  const { token } = theme.useToken();
  const { requests, collectionTrees: requestCollectionTrees, isReady: requestsReady } = useRequests();

  // Construct a full LiveWorkflow shape so the validator + layout
  // helper see a coherent object. Synthetic `uid` / `path` /
  // `schemaVersion` / `version` don't affect validation semantics —
  // they're only inspected for cross-reference shape.
  const draftWorkflow = useMemo<LiveWorkflow>(
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

  // `step-request-missing` is a cross-request check the local shape
  // validator can't make — it needs the request registry. Guarded by
  // `requestsReady` so a not-yet-hydrated request store never
  // false-flags every step as referencing a deleted request.
  const knownRequestUids = useMemo(() => new Set(requests.map((r) => r.uid)), [requests]);
  const validationErrors = useMemo(() => {
    const shape = validateWorkflowShape(draftWorkflow);
    if (!requestsReady) return shape;
    return [...shape, ...validateStepRequestsExist(draftWorkflow, knownRequestUids)];
  }, [draftWorkflow, requestsReady, knownRequestUids]);

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
    const prev = draft.steps[idx];
    const nextSteps = draft.steps.slice();
    nextSteps[idx] = next;
    let nextDraft: DraftWorkflow = { ...draft, steps: nextSteps };
    // Auto-rebind in-workflow references on a step.id rename so
    // dependsOn / runIf clauses / priorityFrom / refresh.stepId track
    // the new id without manual chase. Same step.uid + changed id is
    // the rename signature.
    if (prev && prev.uid === next.uid && prev.id !== next.id && prev.id.length > 0 && next.id.length > 0) {
      nextDraft = rebindStepReferences({
        draft: nextDraft,
        targetUid: next.uid,
        oldId: prev.id,
        newId: next.id,
      });
    }
    // Auto-rebind capture references on a capture.name rename. Match
    // captures by uid across prev / next and rewrite any
    // `(stepId, captureName)` reference where stepId === step.id
    // and captureName === old. Use the renamed step's CURRENT id
    // (next.id) since the step-id rebind above already shifted the
    // owner's identifier when both rename together.
    if (prev) {
      const prevCapByUid = new Map(prev.captures.map((c) => [c.uid, c]));
      for (const nextCap of next.captures) {
        const prevCap = prevCapByUid.get(nextCap.uid);
        if (!prevCap) continue;
        if (prevCap.name === nextCap.name) continue;
        if (prevCap.name.length === 0 || nextCap.name.length === 0) continue;
        nextDraft = rebindCaptureReferences({
          draft: nextDraft,
          ownerStepId: next.id,
          oldName: prevCap.name,
          newName: nextCap.name,
        });
      }
    }
    setDraft(nextDraft);
  };

  const addStep = () => {
    setDraft(appendDraftStep(draft).draft);
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
      {/* The workflow name is owned by the tab strip / sidebar rename, so
          the form body carries only the description (no redundant name
          input). */}
      <div data-field-path={LIVE_WORKFLOW_FIELD.description}>
        <InlineDescription
          description={draft.description}
          onChangeDescription={(description) => setDraft({ ...draft, description })}
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
              selected={selectedStepId === step.id}
              scrollRequested={scrollToStepId === step.id}
              onScrollDone={onScrollToStepDone}
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

export default WorkflowFormBody;
