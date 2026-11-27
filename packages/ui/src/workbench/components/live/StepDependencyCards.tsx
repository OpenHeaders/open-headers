/**
 * StepDependencyCards — the two cards of a step's panel that say where
 * it stands among the others (the workflows redesign, Step panel), side
 * by side: Depends on, the steps it waits for; Required by, the steps
 * that wait for it. A row opens its step.
 *
 * Depends on is edited here: Add names one more step, the × on a row
 * drops that one. A step that names none waits for the step before it;
 * the card shows that step and says so at its foot. The first edit
 * writes the list out — the same edit as drawing or removing a line on
 * the graph — and Reset goes back to naming none.
 */

import { CloseOutlined } from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, ConfigProvider, Select } from 'antd';
import type React from 'react';
import StepMiniRow, { type StepMiniFacts } from './StepMiniRow';
import WorkflowCard from './WorkflowCard';

interface Props {
  /** The step's place in the workflow — the cards' test ids. */
  index: number;
  /** The steps the step waits for, as resolved: the step before it where it names none. */
  parents: readonly StepMiniFacts[];
  /** The steps that wait for this one. */
  dependents: readonly StepMiniFacts[];
  /** The step names its dependencies itself — absent, it waits for the step before it. */
  explicit: boolean;
  /** The steps Add offers: every other step it does not wait for yet. */
  addable: readonly string[];
  /** A dependency that is no step, or one that closes a cycle. */
  error?: StructuralError;
  onAdd: (parentId: string) => void;
  onRemove: (parentId: string) => void;
  /** Back to naming none. */
  onReset: () => void;
  onGoToStep: (stepUid: string) => void;
}

const StepDependencyCards: React.FC<Props> = ({
  index,
  parents,
  dependents,
  explicit,
  addable,
  error,
  onAdd,
  onRemove,
  onReset,
  onGoToStep,
}) => {
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;

  return (
    <div className="oh-wf-card-pair">
      <WorkflowCard
        testId={`wf-step-${index}-deps`}
        title={t('workbench.editors.live.sections.dependsOn')}
        description={t('workbench.editors.live.deps.description')}
        extra={
          // A picker that keeps no value: a pick is one more dependency.
          <Select<string>
            className="oh-wf-add-select"
            popupMatchSelectWidth={false}
            placeholder={t('workbench.editors.live.deps.add')}
            aria-label={t('workbench.editors.live.deps.add')}
            data-testid={`wf-step-${index}-deps-select`}
            status={error ? 'error' : undefined}
            disabled={readOnly || addable.length === 0}
            value={null}
            options={addable.map((id) => ({ value: id, label: id }))}
            onChange={(id) => onAdd(id)}
          />
        }
        footer={
          explicit ? (
            <span className="oh-wf-foot-row">
              <span>{t('workbench.editors.live.deps.chosen')}</span>
              <Button type="link" onClick={onReset}>
                {t('workbench.editors.live.sections.reset')}
              </Button>
            </span>
          ) : parents.length > 0 ? (
            t('workbench.editors.live.deps.byDefault')
          ) : undefined
        }
      >
        {parents.length === 0 && <div className="oh-wf-card-note">{t('workbench.editors.live.deps.none')}</div>}
        {parents.map((parent) => (
          <StepMiniRow
            key={parent.id}
            step={parent}
            onGo={onGoToStep}
            testId={`wf-step-${index}-dep-${parent.id}`}
            extra={
              <Button
                type="text"
                icon={<CloseOutlined style={{ fontSize: 10 }} />}
                aria-label={`${t('workbench.editors.live.graph.removeDependency')} ${parent.id}`}
                onClick={() => onRemove(parent.id)}
              />
            }
          />
        ))}
        {error !== undefined && <div className="oh-wf-card-note oh-wf-card-note--error">{error.message}</div>}
      </WorkflowCard>
      <WorkflowCard
        testId={`wf-step-${index}-required-by`}
        title={t('workbench.editors.live.requiredBy.title')}
        description={t('workbench.editors.live.requiredBy.description')}
      >
        {dependents.length === 0 && (
          <div className="oh-wf-card-note">{t('workbench.editors.live.requiredBy.none')}</div>
        )}
        {dependents.map((dependent) => (
          <StepMiniRow
            key={dependent.id}
            step={dependent}
            onGo={onGoToStep}
            testId={`wf-step-${index}-dependent-${dependent.id}`}
          />
        ))}
      </WorkflowCard>
    </div>
  );
};

export default StepDependencyCards;
