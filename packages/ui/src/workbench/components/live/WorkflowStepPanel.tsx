/**
 * WorkflowStepPanel — the workflow view's docked panel while a step is
 * selected (the workflows redesign, Step panel): the step's own card,
 * and under it what the step produced in the run this page last saw.
 * Closing it deselects the step, and the panel shows the workflow.
 */

import { CloseOutlined } from '@ant-design/icons';
import { type DraftWorkflow, isExpectStep, isKnownStep } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Button, ConfigProvider, Typography, theme } from 'antd';
import type React from 'react';
import { readKeptRunProduct } from '../../data/workflow-run-store';
import { LIVE_FORM_PAD_X, Section } from './layout';
import UnknownStepCard from './UnknownStepCard';
import type { WorkflowFormModel } from './use-workflow-form-model';
import type { ShownWorkflowRun } from './use-workflow-run';
import WorkflowRunProductPane from './WorkflowRunProductPane';
import WorkflowStepEditor from './WorkflowStepEditor';

const { Text } = Typography;

/** The height a step's product is given inside the scrolling panel. */
const PRODUCT_HEIGHT = 420;

interface Props {
  draft: DraftWorkflow;
  model: WorkflowFormModel;
  /** The selected step's place among the draft's steps. */
  stepIndex: number;
  /** The workflow is read-only here: every control of the card is off. */
  readOnly: boolean;
  onClose: () => void;
  /** The run the view shows — absent where the workflow has none to show. */
  run?: ShownWorkflowRun | null;
}

const WorkflowStepPanel: React.FC<Props> = ({ draft, model, stepIndex, readOnly, onClose, run }) => {
  const { token } = theme.useToken();
  const t = useT();
  const step = draft.steps[stepIndex];
  const row = run?.record.steps.find((each) => each.uid === step.uid);
  const dependencyRow = model.dependencyRows[stepIndex];

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: `8px ${LIVE_FORM_PAD_X}px`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
        }}
      >
        <Text type="secondary" style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
          {t('workbench.editors.live.panel.stepOf', { number: stepIndex + 1, total: draft.steps.length })}
        </Text>
        <Button
          size="small"
          type="text"
          data-testid="wf-panel-close"
          aria-label={t('workbench.editors.live.panel.closeStep')}
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>
      <div className="oh-persistent-scroll" style={{ flex: 1, minHeight: 0 }}>
        <div
          style={{ padding: `16px ${LIVE_FORM_PAD_X}px`, display: 'flex', flexDirection: 'column', gap: 12 }}
          data-field-path={LIVE_WORKFLOW_FIELD.steps}
        >
          <ConfigProvider componentDisabled={readOnly}>
            {/* Keyed by the step: a card's own state — an open section, a field mid-edit — is never another step's. */}
            {isKnownStep(step) ? (
              <WorkflowStepEditor
                key={step.uid}
                step={step}
                index={stepIndex}
                totalSteps={draft.steps.length}
                availableRequests={model.availableRequests}
                onChange={(next) => model.updateStep(stepIndex, next)}
                onActionChange={(action) => model.changeStepAction(stepIndex, action)}
                steps={draft.steps}
                mqttRequests={model.mqttRequests}
                sessionRequests={model.sessionRequests}
                sessionAuthoring={model.sessionAuthoring}
                exposable={!model.holdsSession}
                onRemove={() => {
                  model.removeStep(stepIndex);
                  onClose();
                }}
                onMoveUp={() => model.moveStep(stepIndex, -1)}
                onMoveDown={() => model.moveStep(stepIndex, 1)}
                // Every other step by id — a step cannot depend on itself.
                allStepIds={draft.steps
                  .filter((each) => each.id !== step.id && each.id.length > 0)
                  .map((each) => ({ id: each.id, label: each.id }))}
                // Only a transitive ancestor can be named by a run condition or a priority.
                reachableSteps={Array.from(dependencyRow?.reachable ?? []).map((id) => ({ id, label: id }))}
                capturesByStepId={model.capturesByStepId}
                errors={model.errorsByStepId.get(step.id) ?? []}
                dependencyRow={dependencyRow}
              />
            ) : (
              <UnknownStepCard key={step.uid} step={step} index={stepIndex} />
            )}
          </ConfigProvider>
          {run != null && row !== undefined && (
            <Section title={t('workbench.editors.live.panel.lastRun')}>
              <div
                style={{
                  height: PRODUCT_HEIGHT,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                  overflow: 'hidden',
                }}
              >
                <WorkflowRunProductPane
                  stepId={row.id}
                  state={run.products[row.id]}
                  product={run.refused ? null : readKeptRunProduct(run.record.runId, row.id)}
                  trigger={isKnownStep(step) && isExpectStep(step) ? step.after : undefined}
                />
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
};

export default WorkflowStepPanel;
