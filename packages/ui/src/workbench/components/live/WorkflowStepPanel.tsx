/**
 * WorkflowStepPanel — the workflow view's docked panel while a step is
 * selected (the workflows redesign, Step panel): the step's head, and
 * under it one scrolling page of cards. The cards are on four tabs of
 * the head (the workflow runs plan, Decisions log, S35) — Setup, Flow
 * and Data hold the step's own fields, Last run what the last run made
 * of the step and what it produced in the run this page last saw. Only
 * the open tab's cards are in the page, and the view holds which tab
 * that is from step to step. A step of an action the model does not know
 * has no tabs: its one page says so under its last run. Closing the
 * panel deselects the step, and the panel shows the workflow.
 *
 * The panel is drawn one size under the design's, as the whole workflow
 * view is: its controls are the small ones and its text a size down,
 * both on the app's UI scale.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { type DraftWorkflow, isExpectStep, isKnownStep } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { ConfigProvider } from 'antd';
import type React from 'react';
import { readKeptRunProduct } from '../../data/workflow-run-store';
import { captureUsesOf } from './capture-uses';
import { clauseTruthOf, reachOfCacheRow, reachOfRunRow } from './graph-lines';
import StepLastRunCard from './StepLastRunCard';
import type { StepMiniFacts } from './StepMiniRow';
import StepProductCard from './StepProductCard';
import {
  actionOfStep,
  doesOfStep,
  markOfStep,
  protocolOfStep,
  requestOpenOf,
  type StepRequestOpeners,
} from './step-facts';
import { describeStepLastRun } from './step-last-run';
import { idleMark } from './step-mark';
import type { StepTab } from './step-tabs';
import UnknownStepCard from './UnknownStepCard';
import { usePanelSizes } from './use-panel-sizes';
import { useStepRequests } from './use-step-requests';
import { useWaitClock } from './use-wait-clock';
import type { WorkflowFormModel } from './use-workflow-form-model';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowStepEditor, { type StepCaptureFacts, type StepDependencies } from './WorkflowStepEditor';
import WorkflowStepHeader from './WorkflowStepHeader';

interface Props {
  draft: DraftWorkflow;
  model: WorkflowFormModel;
  /** The selected step's place among the draft's steps. */
  stepIndex: number;
  /** The workflow is read-only here: every control of the panel is off but its close. */
  readOnly: boolean;
  /** The open tab — the view's, so the next step opens on it too. */
  tab: StepTab;
  onTabChange: (tab: StepTab) => void;
  /** The step's rename was asked for: its name takes focus, and the head says once it has. */
  focusName?: boolean;
  onNameFocused?: () => void;
  onClose: () => void;
  /** Another step takes the panel — a copy just made. */
  onSelectStep: (stepUid: string) => void;
  /** The run the view shows — absent where the workflow has none to show. */
  run?: ShownWorkflowRun | null;
  /** The active environment's cache row: what the last run made of the step while no run is kept. */
  cacheRun?: LiveWorkflowRunSnapshot | null;
  /** What opens a request's own tab — absent on a surface that opens none. */
  requestOpeners?: StepRequestOpeners;
}

const WorkflowStepPanel: React.FC<Props> = ({
  draft,
  model,
  stepIndex,
  readOnly,
  tab,
  onTabChange,
  focusName,
  onNameFocused,
  onClose,
  onSelectStep,
  run,
  cacheRun,
  requestOpeners,
}) => {
  const t = useT();
  const { fontSize, theme: sizes } = usePanelSizes();
  const stepRequests = useStepRequests();
  const now = useWaitClock(run?.record ?? null);
  const step = draft.steps[stepIndex];
  const row = run?.record.steps.find((each) => each.uid === step.uid);
  const productState = row !== undefined ? run?.products[row.id] : undefined;
  const dependencyRow = model.dependencyRows[stepIndex];
  const errors = model.errorsByStepId.get(step.id) ?? [];

  const markSources = { run, cacheRun, now };
  const mark = markOfStep(step, markSources, t);

  /** A step as a row of this one's panel; a name that is no step is a row that opens nothing. */
  const miniOf = (id: string): StepMiniFacts => {
    const other = draft.steps.find((each) => each.id === id);
    if (other === undefined) return { id, mark: idleMark(t), protocol: null };
    return {
      id,
      uid: other.uid,
      mark: markOfStep(other, markSources, t),
      protocol: protocolOfStep(other, draft.steps, stepRequests),
    };
  };
  const parentIds = dependencyRow?.parents ?? [];
  const dependencies: StepDependencies = {
    parents: parentIds.map(miniOf),
    dependents: model.dependencyRows
      .filter((each) => each.parents.includes(step.id))
      .map((each) => miniOf(each.step.id)),
    addable: draft.steps
      .filter((each) => each.id !== step.id && each.id.length > 0 && !parentIds.includes(each.id))
      .map((each) => each.id),
    onAdd: (parentId) => model.addDependency(stepIndex, parentId),
    onRemove: (parentId) => model.removeDependency(stepIndex, parentId),
    onGoToStep: onSelectStep,
  };
  // Who reads what: every step's uses of the others' captures, read once for the panel.
  const usesByStep = draft.steps.map((each) => captureUsesOf(each, stepRequests));
  const captureFacts: StepCaptureFacts = {
    readersOf: (captureName) =>
      draft.steps
        .filter(
          (_, at) =>
            at !== stepIndex &&
            usesByStep[at].some((use) => use.stepId === step.id && use.captureName === captureName),
        )
        .map((each) => each.id),
    // A captured value is kept by the cache row alone: a run's own events carry names, never values.
    lastValues: cacheRun?.stepCaptures[step.id] ?? {},
    uses: usesByStep[stepIndex].filter((use) => use.stepId !== step.id),
    goToStep: (stepId) => {
      const target = draft.steps.find((each) => each.id === stepId);
      return target !== undefined ? () => onSelectStep(target.uid) : undefined;
    },
  };
  const reach = run == null ? reachOfCacheRow(cacheRun, step.id) : reachOfRunRow(row);
  const lastRun = describeStepLastRun(
    { step, mark, row, now, runButton: t('workbench.editors.live.workflow.run') },
    t,
  );
  const action = actionOfStep(step);
  // The open page — `null` for a step with no tabs, whose one page holds everything.
  const page = isKnownStep(step) ? tab : null;
  const showsRun = page === null || page === 'last-run';

  return (
    <ConfigProvider componentSize="small" theme={sizes}>
      <div
        className="oh-wf-step-panel"
        data-step-card={step.id}
        data-step-action={action}
        data-step-needs-update={isKnownStep(step) ? undefined : 'true'}
        style={{ fontSize }}
      >
        <WorkflowStepHeader
          // Keyed by the step: a field mid-edit is never another step's.
          key={step.uid}
          step={step}
          index={stepIndex}
          totalSteps={draft.steps.length}
          mark={mark}
          protocol={protocolOfStep(step, draft.steps, stepRequests)}
          // A step of an action the model does not know says its one sentence in its card.
          does={isKnownStep(step) ? doesOfStep(step, draft.steps, stepRequests, t) : { text: '' }}
          readOnly={readOnly}
          sessionAuthoring={model.sessionAuthoring}
          errors={errors}
          tab={page ?? undefined}
          onTabChange={onTabChange}
          focusName={focusName}
          onNameFocused={onNameFocused}
          onChange={(next) => model.updateStep(stepIndex, next)}
          onActionChange={(action) => model.changeStepAction(stepIndex, action)}
          onDuplicate={() => {
            const copyUid = model.duplicateStep(stepIndex);
            if (copyUid !== null) onSelectStep(copyUid);
          }}
          onRemove={() => {
            model.removeStep(stepIndex);
            onClose();
          }}
          onClose={onClose}
        />
        {/* Keyed by the page: a tab opens at its top. */}
        <div key={page ?? 'whole'} className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
          <div className="oh-wf-panel-body" data-field-path={LIVE_WORKFLOW_FIELD.steps}>
            {showsRun && <StepLastRunCard lastRun={lastRun} />}
            <ConfigProvider componentDisabled={readOnly}>
              {/* Keyed by the step: a card's own state — a field mid-edit — is never another step's. */}
              {!isKnownStep(step) ? (
                <UnknownStepCard />
              ) : page !== null && page !== 'last-run' ? (
                <WorkflowStepEditor
                  key={step.uid}
                  step={step}
                  index={stepIndex}
                  tab={page}
                  availableRequests={model.availableRequests}
                  onChange={(next) => model.updateStep(stepIndex, next)}
                  steps={draft.steps}
                  mqttRequests={model.mqttRequests}
                  sessionRequests={model.sessionRequests}
                  exposable={!model.holdsSession}
                  dependencies={dependencies}
                  // Only a transitive ancestor can be named by a run condition or a priority.
                  reachableSteps={Array.from(dependencyRow?.reachable ?? []).map((id) => ({ id, label: id }))}
                  capturesByStepId={model.capturesByStepId}
                  errors={errors}
                  clauseTruth={(clauseUid) => clauseTruthOf(reach, clauseUid)}
                  runState={mark.kind}
                  captureFacts={captureFacts}
                  onOpenRequest={
                    requestOpeners !== undefined ? requestOpenOf(step, stepRequests, requestOpeners) : undefined
                  }
                />
              ) : null}
            </ConfigProvider>
            {/* A run that was refused, a step with nothing to show: neither names a product. */}
            {showsRun && run != null && row !== undefined && productState !== undefined && (
              <StepProductCard
                stepId={row.id}
                action={action}
                state={productState}
                product={readKeptRunProduct(run.record.runId, row.id)}
                trigger={isKnownStep(step) && isExpectStep(step) ? step.after : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default WorkflowStepPanel;
