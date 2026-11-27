/**
 * WorkflowStepsCard — every step of a workflow in run order (the
 * workflows redesign, Workflow panel): its tags, and its last result or,
 * while no run has reached any step, what it does. A row opens its step;
 * the arrows at a row's end set the step's place among the steps, and the
 * card's head opens the step picker to add one more.
 */

import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button } from 'antd';
import type React from 'react';
import { useState } from 'react';
import StepOverviewRow, { type OverviewStepFacts } from './StepOverviewRow';
import { StepPickerPopover } from './StepPicker';
import type { StepPick, StepPickerChoices } from './step-picker';
import WorkflowCard from './WorkflowCard';

interface Props {
  steps: readonly OverviewStepFacts[];
  /** The workflow is read-only here: a row still opens its step, and nothing moves or is added. */
  readOnly: boolean;
  onOpen: (stepUid: string) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  /** What the step picker lists. */
  stepChoices: StepPickerChoices;
  /** A row of the step picker was taken. */
  onAdd: (pick: StepPick) => void;
}

const WorkflowStepsCard: React.FC<Props> = ({ steps, readOnly, onOpen, onMove, stepChoices, onAdd }) => {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  // One column says how the last run left each step once a run has reached any of them.
  const showResult = steps.some((step) => step.mark.kind !== 'idle');

  return (
    <WorkflowCard
      testId="wf-steps"
      title={t('workbench.editors.live.overview.stepsTitle')}
      description={t('workbench.editors.live.overview.stepsDescription')}
      extra={
        !readOnly && (
          <StepPickerPopover
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            placement="bottomRight"
            choices={stepChoices}
            onPick={(pick) => {
              setPickerOpen(false);
              onAdd(pick);
            }}
          >
            <Button data-testid="wf-steps-add">{t('workbench.editors.live.graph.menuAddStep')}</Button>
          </StepPickerPopover>
        )
      }
    >
      <div className="oh-wf-card-columns oh-wf-steps-grid oh-wf-steps-head">
        <span>{t('workbench.editors.live.overview.colStep')}</span>
        <span>{t('workbench.editors.live.overview.colType')}</span>
        <span>
          {showResult ? t('workbench.editors.live.panel.lastRun') : t('workbench.editors.live.overview.colDoes')}
        </span>
      </div>
      {steps.map((step, index) => (
        <StepOverviewRow
          key={step.uid}
          step={step}
          showResult={showResult}
          idleWord={t('workbench.editors.live.lastRun.stateIdle')}
          onOpen={onOpen}
          testId={`wf-run-row-${step.id}`}
          lineTestId={`wf-run-facts-${step.id}`}
          extra={
            <>
              <Button
                type="text"
                icon={<UpOutlined />}
                data-testid={`wf-step-up-${step.id}`}
                aria-label={t('workbench.editors.live.panel.moveUp')}
                disabled={readOnly || index === 0}
                onClick={() => onMove(index, -1)}
              />
              <Button
                type="text"
                icon={<DownOutlined />}
                data-testid={`wf-step-down-${step.id}`}
                aria-label={t('workbench.editors.live.panel.moveDown')}
                disabled={readOnly || index === steps.length - 1}
                onClick={() => onMove(index, 1)}
              />
            </>
          }
        />
      ))}
    </WorkflowCard>
  );
};

export default WorkflowStepsCard;
