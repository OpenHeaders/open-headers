/**
 * WorkflowStepPanel — the workflow view's docked panel while a step is
 * selected (the workflows redesign, Step panel): the step's head, and
 * under it one scrolling page of cards — what the last run made of the
 * step, the step's own fields, and what it produced in the run this page
 * last saw. Closing it deselects the step, and the panel shows the
 * workflow.
 *
 * The panel is drawn one size under the design's, as the whole workflow
 * view is: its controls are the small ones and its text a size down,
 * both on the app's UI scale.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import { type DraftWorkflow, isExpectStep, isKnownStep } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useTheme } from '@openheaders/ui/context/ThemeContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { ConfigProvider } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { readKeptRunProduct } from '../../data/workflow-run-store';
import { clauseTruthOf, reachOfCacheRow, reachOfRunRow } from './graph-lines';
import StepLastRunCard from './StepLastRunCard';
import type { StepMiniFacts } from './StepMiniRow';
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
import UnknownStepCard from './UnknownStepCard';
import { useStepRequests } from './use-step-requests';
import { useWaitClock } from './use-wait-clock';
import type { WorkflowFormModel } from './use-workflow-form-model';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowCard from './WorkflowCard';
import WorkflowRunProductPane from './WorkflowRunProductPane';
import WorkflowStepEditor, { type StepDependencies } from './WorkflowStepEditor';
import WorkflowStepHeader from './WorkflowStepHeader';

/** The panel's text, a size under the app's own. */
const PANEL_FONT_SIZE = 12;

interface Props {
  draft: DraftWorkflow;
  model: WorkflowFormModel;
  /** The selected step's place among the draft's steps. */
  stepIndex: number;
  /** The workflow is read-only here: every control of the panel is off but its close. */
  readOnly: boolean;
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
  onClose,
  onSelectStep,
  run,
  cacheRun,
  requestOpeners,
}) => {
  const t = useT();
  const { uiScale } = useTheme();
  const stepRequests = useStepRequests();
  const now = useWaitClock(run?.record ?? null);
  const step = draft.steps[stepIndex];
  const row = run?.record.steps.find((each) => each.uid === step.uid);
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
  const reach = run == null ? reachOfCacheRow(cacheRun, step.id) : reachOfRunRow(row);
  const lastRun = describeStepLastRun(
    { step, mark, row, now, runButton: t('workbench.editors.live.workflow.refresh') },
    t,
  );
  // The stylesheet sizes the panel's own text from this one number.
  const fontSize = Math.round(PANEL_FONT_SIZE * uiScale);
  const sizes = useMemo(() => ({ token: { fontSize } }), [fontSize]);
  const action = actionOfStep(step);

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
          onChange={(next) => model.updateStep(stepIndex, next)}
          onActionChange={(action) => model.changeStepAction(stepIndex, action)}
          onMoveUp={() => model.moveStep(stepIndex, -1)}
          onMoveDown={() => model.moveStep(stepIndex, 1)}
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
        <div className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
          <div className="oh-wf-panel-body" data-field-path={LIVE_WORKFLOW_FIELD.steps}>
            <StepLastRunCard lastRun={lastRun} />
            <ConfigProvider componentDisabled={readOnly}>
              {/* Keyed by the step: a card's own state — a field mid-edit — is never another step's. */}
              {isKnownStep(step) ? (
                <WorkflowStepEditor
                  key={step.uid}
                  step={step}
                  index={stepIndex}
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
                  onOpenRequest={
                    requestOpeners !== undefined ? requestOpenOf(step, stepRequests, requestOpeners) : undefined
                  }
                />
              ) : (
                <UnknownStepCard />
              )}
            </ConfigProvider>
            {run != null && row !== undefined && (
              <WorkflowCard
                title={t(
                  action === 'call' ? 'workbench.editors.live.panel.response' : 'workbench.editors.live.panel.message',
                )}
              >
                <div className="oh-wf-card-product">
                  <WorkflowRunProductPane
                    stepId={row.id}
                    state={run.products[row.id]}
                    product={run.refused ? null : readKeptRunProduct(run.record.runId, row.id)}
                    trigger={isKnownStep(step) && isExpectStep(step) ? step.after : undefined}
                  />
                </div>
              </WorkflowCard>
            )}
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default WorkflowStepPanel;
