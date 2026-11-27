/**
 * The Priority card of a step's panel (the workflows redesign, Step
 * panel): the capture of an earlier step that orders this one among the
 * steps ready at once, and how its values compare. Unset until a step is
 * picked; Clear at the card's head removes it whole.
 */

import type { StructuralError } from '@openheaders/core/live';
import type { PriorityRef } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, ConfigProvider, Select, Tooltip } from 'antd';
import type React from 'react';
import WorkflowCard, { CardField } from './WorkflowCard';

interface Props {
  index: number;
  value: PriorityRef | undefined;
  onChange: (next: PriorityRef | undefined) => void;
  /** The steps a priority can read: this one's transitive ancestors. */
  reachableSteps: readonly { id: string; label: string }[];
  /** Map of stepId → declared capture names. */
  capturesByStepId: ReadonlyMap<string, string[]>;
  /** The step's error about its priority, from the validator. */
  error: StructuralError | undefined;
}

const StepPriorityCard: React.FC<Props> = ({ index, value, onChange, reachableSteps, capturesByStepId, error }) => {
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;
  const captureError = error?.issue === 'priority-unknown-capture' ? error : undefined;
  const stepError = captureError === undefined ? error : undefined;
  const captureNames = value?.stepId ? (capturesByStepId.get(value.stepId) ?? []) : [];
  const stepLabel = t('workbench.editors.live.priority.fromStep');
  const captureLabel = t('workbench.editors.live.priority.capture');
  const compareLabel = t('workbench.editors.live.priority.compareAs');
  const none = t('workbench.editors.live.priority.none');

  return (
    <WorkflowCard
      testId={`wf-step-${index}-priority`}
      title={t('workbench.editors.live.sections.priority')}
      description={t('workbench.editors.live.priority.description')}
      extra={
        value !== undefined ? (
          <Button type="text" onClick={() => onChange(undefined)}>
            {t('workbench.editors.live.sections.clear')}
          </Button>
        ) : undefined
      }
      footer={t('workbench.editors.live.priority.rule')}
    >
      <div className="oh-wf-card-body oh-wf-field-grid oh-wf-field-grid--three">
        <CardField label={stepLabel}>
          <Tooltip open={stepError ? undefined : false} title={stepError?.message}>
            <Select
              placeholder={none}
              status={stepError ? 'error' : undefined}
              data-testid={`wf-step-${index}-priority-step`}
              aria-label={stepLabel}
              value={value?.stepId}
              options={reachableSteps.map((step) => ({ value: step.id, label: step.label }))}
              onChange={(stepId) => onChange({ stepId, captureName: value?.captureName ?? '', sort: value?.sort })}
            />
          </Tooltip>
        </CardField>
        <CardField label={captureLabel}>
          <Tooltip open={captureError ? undefined : false} title={captureError?.message}>
            <Select
              placeholder={none}
              disabled={readOnly || !value?.stepId}
              status={captureError ? 'error' : undefined}
              data-testid={`wf-step-${index}-priority-capture`}
              aria-label={captureLabel}
              value={value?.captureName || undefined}
              options={captureNames.map((name) => ({ value: name, label: name }))}
              onChange={(captureName) => {
                if (value !== undefined) onChange({ ...value, captureName });
              }}
            />
          </Tooltip>
        </CardField>
        <CardField label={compareLabel}>
          <Select
            disabled={readOnly || !value?.stepId}
            data-testid={`wf-step-${index}-priority-sort`}
            aria-label={compareLabel}
            value={value?.sort ?? 'numeric'}
            options={[
              { value: 'numeric', label: t('workbench.editors.live.sections.sortNumeric') },
              { value: 'lexicographic', label: t('workbench.editors.live.sections.sortLexicographic') },
            ]}
            onChange={(sort) => {
              if (value !== undefined) onChange({ ...value, sort });
            }}
          />
        </CardField>
      </div>
    </WorkflowCard>
  );
};

export default StepPriorityCard;
