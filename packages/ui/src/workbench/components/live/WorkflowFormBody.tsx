/**
 * WorkflowFormBody — the shared form body for `LiveWorkflowEditor`:
 * Description + Steps + Refresh policy + Enabled footer. Used by both
 * Edit and Create modes. Validation + dependency-row computation live
 * here so neither mode duplicates them.
 */

import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { hasCapability } from '@openheaders/core/capabilities';
import {
  callStepsOf,
  type DraftKnownStep,
  type DraftWorkflow,
  isKnownStep,
  isSessionStep,
  validateSessionRequests,
  validateSessionSteps,
  validateStepRequestsExist,
  validateWorkflowShape,
} from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Alert, Button, ConfigProvider, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { computeRequestTrail } from '../../breadcrumbs';
import { buildDependencyRows } from './dependencies-view';
import { appendDraftStep } from './graph-edit';
import { InlineDescription, LIVE_FORM_PAD_X, Section } from './layout';
import { rebindCaptureReferences } from './rebind-capture-references';
import { rebindStepReferences } from './rebind-step-references';
import RefreshPolicyEditor from './RefreshPolicyEditor';
import { type StepAction, withStepAction } from './step-action';
import UnknownStepCard from './UnknownStepCard';
import type { StepRequestChoice } from './workflow-step-request-options';
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
  /**
   * The workflow holds a step of an action the model does not know and
   * is read-only here (the workflow runs plan, Laws): every control is
   * off but the Enabled switch — it can still be switched off.
   */
  readOnly?: boolean;
}

const WorkflowFormBody: React.FC<WorkflowFormBodyProps> = ({
  draft,
  setDraft,
  selectedStepId,
  scrollToStepId,
  onScrollToStepDone,
  readOnly = false,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const {
    requests,
    graphqlRequests,
    mqttRequests,
    collectionTrees: requestCollectionTrees,
    isReady: requestsReady,
  } = useRequests();
  // A workflow that holds a session step gives a verdict (the workflow
  // runs plan, Decisions log, S16): it is refreshed by hand and its
  // captures are not exposed as live variables.
  const holdsSession = useMemo(() => draft.steps.some(isSessionStep), [draft.steps]);
  const sessionAuthoring = hasCapability('workflowSessionAuthoring');

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
  // A step names a request of either kind — a GraphQL request runs
  // through the compile as one POST.
  const knownRequestUids = useMemo(
    () => new Set([...requests.map((r) => r.uid), ...graphqlRequests.map((r) => r.uid)]),
    [requests, graphqlRequests],
  );
  // What a session step asks of its request is a cross-request check
  // too, and waits on the same hydration.
  const validationErrors = useMemo(() => {
    const shape = [...validateWorkflowShape(draftWorkflow), ...validateSessionSteps(draftWorkflow)];
    if (!requestsReady) return shape;
    return [
      ...shape,
      ...validateStepRequestsExist(draftWorkflow, knownRequestUids),
      ...validateSessionRequests(draftWorkflow, (uid) => mqttRequests.find((request) => request.uid === uid) ?? null),
    ];
  }, [draftWorkflow, requestsReady, knownRequestUids, mqttRequests]);

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
      if (!isKnownStep(step)) continue;
      map.set(
        step.id,
        step.captures.map((c) => c.name),
      );
    }
    return map;
  }, [draft.steps]);

  const availableCaptures = useMemo(
    () =>
      callStepsOf(draft).flatMap((s) =>
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
  const availableRequests = useMemo<StepRequestChoice[]>(
    () => [
      ...requests.map((r): StepRequestChoice => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: r.method,
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
      ...graphqlRequests.map((r): StepRequestChoice => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: 'GQL',
          kind: 'graphql',
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
    ],
    [requests, graphqlRequests, requestCollectionTrees],
  );

  // The session requests a listen step can open — MQTT, the one kind a
  // run's session speaks today.
  const sessionRequests = useMemo<StepRequestChoice[]>(
    () =>
      mqttRequests.map((r): StepRequestChoice => {
        const trail = computeRequestTrail(r.uid, requestCollectionTrees);
        return {
          uid: r.uid,
          name: r.name,
          method: 'MQTT',
          kind: 'mqtt',
          collectionName: trail?.collectionName ?? null,
          folderTrail: trail?.folderTrail ?? [],
        };
      }),
    [mqttRequests, requestCollectionTrees],
  );

  const updateStep = (idx: number, next: DraftKnownStep) => {
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
    if (prev && isKnownStep(prev)) {
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

  const changeStepAction = (idx: number, action: StepAction) => {
    setDraft(withStepAction(draft, idx, action));
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
    <ConfigProvider componentDisabled={readOnly}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {workflowLevelErrors.length > 0 && (
        <Alert
          type="error"
          showIcon
          title={t('workbench.editors.live.form.structuralIssues')}
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
      {/* Sticky header: the count, the inline description (the workflow
          name is owned by the tab strip / sidebar rename), and "+ Step"
          stay reachable while scrolling a long step list. */}
      <Section
        sticky
        title={
          <>
            <span style={{ flexShrink: 0 }}>
              {t('workbench.editors.live.form.stepsTitle', { count: draft.steps.length })}
            </span>
            <span
              data-field-path={LIVE_WORKFLOW_FIELD.description}
              style={{ flex: 1, minWidth: 0, textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }}
            >
              <InlineDescription
                description={draft.description}
                onChangeDescription={(description) => setDraft({ ...draft, description })}
              />
            </span>
            <Button size="small" icon={<PlusOutlined />} onClick={addStep}>
              {t('workbench.editors.live.form.addStepButton')}
            </Button>
          </>
        }
      >
        {draft.steps.length === 0 && (
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
            {t('workbench.editors.live.form.noSteps')}
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
          if (!isKnownStep(step)) {
            return (
              <UnknownStepCard
                key={step.uid}
                step={step}
                index={idx}
                selected={selectedStepId === step.id}
                scrollRequested={scrollToStepId === step.id}
                onScrollDone={onScrollToStepDone}
              />
            );
          }
          const stepErrors = errorsByStepId.get(step.id) ?? [];
          return (
            <WorkflowStepEditor
              key={step.uid}
              step={step}
              index={idx}
              totalSteps={draft.steps.length}
              availableRequests={availableRequests}
              onChange={(next) => updateStep(idx, next)}
              onActionChange={(action) => changeStepAction(idx, action)}
              steps={draft.steps}
              mqttRequests={mqttRequests}
              sessionRequests={sessionRequests}
              sessionAuthoring={sessionAuthoring}
              exposable={!holdsSession}
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

      {/* Sticky floor: refresh policy + the enabled footer stay visible
          while scrolling the step list, mirroring the sticky steps
          header above. One block — sticky content below a bottom-stuck
          element would be unreachable while it's pinned. */}
      <div
        data-testid="wf-form-floor"
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginInline: -LIVE_FORM_PAD_X,
          paddingInline: LIVE_FORM_PAD_X,
        }}
      >
      <div data-field-path={LIVE_WORKFLOW_FIELD.refresh}>
      <Section
        title={
          <>
            {t('workbench.editors.live.form.refreshPolicySection')}
            {holdsSession && (
              <InfoTrigger
                content={{
                  title: t('workbench.editors.live.form.refreshPolicySection'),
                  summary: t('workbench.editors.live.form.sessionPolicyInfo'),
                }}
              />
            )}
          </>
        }
      >
        {/* Fixed at Manual while the workflow holds a session step; a
            policy that is not Manual yet stays open so it can be set. */}
        <RefreshPolicyEditor
          value={draft.refresh}
          onChange={(refresh) => setDraft({ ...draft, refresh })}
          availableCaptures={availableCaptures}
          disabled={holdsSession && draft.refresh.kind === 'manual'}
        />
        {holdsSession && (
          <Text type="secondary" style={{ fontSize: 11 }} data-testid="wf-form-session-verdict">
            {t('workbench.editors.live.form.sessionNoLiveVariables')}
          </Text>
        )}
      </Section>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
          paddingTop: 8,
          paddingBottom: 12,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div data-field-path={LIVE_WORKFLOW_FIELD.enabled} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* A read-only workflow can still be switched off. */}
          <ConfigProvider componentDisabled={false}>
            <Switch
              size="small"
              aria-label={t('workbench.editors.live.form.enabledAria')}
              checked={draft.enabled}
              onChange={(enabled) => setDraft({ ...draft, enabled })}
            />
          </ConfigProvider>
          <Text style={{ fontSize: 12 }}>
            {draft.enabled ? t('workbench.editors.live.form.enabled') : t('workbench.editors.live.form.disabled')}
          </Text>
        </div>
        <Tooltip title={t('workbench.editors.live.form.parallelTooltip')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Switch aria-label={t('workbench.editors.live.form.parallelLabel')} size="small" checked={false} disabled />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.editors.live.form.parallelLabel')}
            </Text>
            <InfoCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
          </div>
        </Tooltip>
      </div>
      </div>
    </div>
    </ConfigProvider>
  );
};

export default WorkflowFormBody;
