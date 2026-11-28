/**
 * WorkflowStepHeader — the head of a step's panel (the workflows
 * redesign, Step panel): the step's state glyph, its name, the protocol
 * it speaks and its kind; then what is done to the step as a whole —
 * a copy of it, its removal — and the close that hands the panel back to
 * the workflow, where its place among the steps is set. Under them: where the step
 * stands and what it does, a line for its description, the issues no
 * field of the panel owns, and last the tabs of the panel's pages — a
 * tab whose card holds an error wears a dot.
 *
 * The name is the step's id: `{{step.<id>.<capture>}}` references name a
 * step by it. The kind tag is the picker of the step's action (the
 * workflow runs plan, Decisions log, S16 and S20); Foreach and Composite
 * stay the show-but-disable catalog entries. A step of an action the
 * model does not know shows its name and its raw action, takes no edit
 * and has no tabs.
 */

import { CloseOutlined } from '@ant-design/icons';
import { type DraftKnownStep, type DraftStep, isKnownStep, type StructuralError } from '@openheaders/core/live';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Button, Input, Select, Tooltip } from 'antd';
import type React from 'react';
import type { RequestKind } from '../../request-kind-menu';
import StepGlyph from './StepGlyph';
import { KindTag, ProtocolTag } from './StepTags';
import { STEP_ACTIONS, type StepAction, stepActionOf } from './step-action';
import { STEP_KIND_WORD, type StepDoes } from './step-facts';
import type { StepMark } from './step-mark';
import { isListedUnderHead, STEP_TAB_WORD, STEP_TABS, type StepTab, tabsWithErrors } from './step-tabs';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

interface Props {
  step: DraftStep;
  index: number;
  totalSteps: number;
  mark: StepMark;
  /** The kind of request the step speaks — `null` where it names none the workspace holds. */
  protocol: RequestKind | null;
  does: StepDoes;
  /** The workflow is read-only here: the head offers the close and nothing else. */
  readOnly?: boolean;
  /** The picker offers Listen, Send and Wait. A step that already is one keeps its own. */
  sessionAuthoring?: boolean;
  /** The step's errors, from the validators. */
  errors?: readonly StructuralError[];
  /** The open page of the panel — absent, the head has no tabs. */
  tab?: StepTab;
  onTabChange?: (tab: StepTab) => void;
  onChange?: (next: DraftKnownStep) => void;
  /** The picker took another action — the owner rebuilds the step under it. */
  onActionChange?: (action: StepAction) => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onClose?: () => void;
}

const WorkflowStepHeader: React.FC<Props> = ({
  step,
  index,
  totalSteps,
  mark,
  protocol,
  does,
  readOnly = false,
  sessionAuthoring = false,
  errors = [],
  tab,
  onTabChange,
  onChange,
  onActionChange,
  onDuplicate,
  onRemove,
  onClose,
}) => {
  const t = useT();
  const known = isKnownStep(step) ? step : undefined;
  const action = known !== undefined ? stepActionOf(known) : undefined;
  const rawAction = isKnownStep(step) ? '' : step.action;
  const offeredActions = STEP_ACTIONS.filter((each) => each === 'call' || each === action || sessionAuthoring);

  const nameError = errors.find(
    (e) => e.issue === 'duplicate-step-id' || e.issue === 'step-unknown-dep' || e.issue === 'depends-on-cycle',
  );
  const issues = errors.filter(isListedUnderHead);
  const shownTab = known !== undefined ? tab : undefined;
  const errorTabs = tabsWithErrors(errors, step);

  return (
    <div className={shownTab !== undefined ? 'oh-wf-step-head oh-wf-step-head--tabs' : 'oh-wf-step-head'}>
      <div className="oh-wf-step-head-row">
        <StepGlyph kind={mark.kind} label={mark.label} size={16} />
        {known !== undefined ? (
          <span data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'id')} style={{ display: 'contents' }}>
            <Tooltip open={nameError ? undefined : false} title={nameError?.message}>
              <Input
                className="oh-wf-step-name"
                variant="borderless"
                aria-label={t('workbench.editors.live.panel.stepName')}
                // As wide as the name: the size stands in where a browser does not size a field by its content.
                htmlSize={Math.max(4, known.id.length)}
                value={known.id}
                disabled={readOnly}
                status={nameError?.issue === 'duplicate-step-id' ? 'error' : undefined}
                onChange={(e) => onChange?.({ ...known, id: e.target.value })}
              />
            </Tooltip>
          </span>
        ) : (
          <b className="oh-wf-step-name oh-wf-quiet">{step.id}</b>
        )}
        {protocol !== null && <ProtocolTag kind={protocol} size="panel" />}
        {known !== undefined && action !== undefined ? (
          <Tooltip title={t('workbench.editors.live.step.typeTooltip')}>
            <Select<StepAction | 'foreach' | 'composite'>
              className="oh-wf-step-kind"
              variant="filled"
              popupMatchSelectWidth={false}
              aria-label={t('workbench.editors.live.panel.stepKind')}
              data-testid={`wf-step-${index}-action`}
              value={action}
              disabled={readOnly}
              options={[
                ...offeredActions.map((each) => ({ value: each, label: t(STEP_KIND_WORD[each]) })),
                { value: 'foreach', label: t('workbench.editors.live.step.typeForeach'), disabled: true },
                { value: 'composite', label: t('workbench.editors.live.step.typeComposite'), disabled: true },
              ]}
              onChange={(next) => {
                if (next !== 'foreach' && next !== 'composite') onActionChange?.(next);
              }}
            />
          </Tooltip>
        ) : (
          <KindTag size="panel">
            <span style={{ fontFamily: MONO }}>{rawAction}</span>
          </KindTag>
        )}
        <span style={{ flex: 1 }} />
        {known !== undefined && (
          <>
            <Button data-testid="wf-step-duplicate" disabled={readOnly} onClick={onDuplicate}>
              {t('workbench.editors.live.panel.duplicate')}
            </Button>
            <Button data-testid="wf-step-delete" danger disabled={readOnly || totalSteps <= 1} onClick={onRemove}>
              {t('workbench.editors.live.panel.delete')}
            </Button>
          </>
        )}
        <Button
          type="text"
          data-testid="wf-panel-close"
          aria-label={t('workbench.editors.live.panel.closeStep')}
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      </div>
      <div className="oh-wf-step-subline">
        <span>{t('workbench.editors.live.panel.stepOf', { number: index + 1, total: totalSteps })}</span>
        {does.text !== '' && (
          <>
            {' · '}
            {does.lead !== undefined && does.lead !== '' && <b className="oh-wf-label">{does.lead} </b>}
            <span style={does.mono ? { fontFamily: MONO } : undefined}>{does.text}</span>
          </>
        )}
      </div>
      {known !== undefined && (
        <Input
          className="oh-wf-step-description"
          variant="borderless"
          placeholder={t('workbench.editors.live.step.descriptionPlaceholder')}
          value={known.description ?? ''}
          disabled={readOnly}
          onChange={(e) => onChange?.({ ...known, description: e.target.value || undefined })}
        />
      )}
      {issues.length > 0 && (
        <div className="oh-wf-step-issues" data-testid={`wf-step-${index}-issues`}>
          {issues.map((error) => (
            <div key={`${error.issue}:${error.message}`}>{error.message}</div>
          ))}
        </div>
      )}
      {shownTab !== undefined && (
        <div className="oh-wf-tabs" role="tablist" data-testid="wf-step-tabs">
          {STEP_TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="oh-wf-tab"
              aria-selected={shownTab === id}
              data-testid={`wf-step-tab-${id}`}
              data-error={errorTabs.has(id) ? 'true' : undefined}
              onClick={() => onTabChange?.(id)}
            >
              {t(STEP_TAB_WORD[id])}
              {errorTabs.has(id) && <span className="oh-wf-tab-dot" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowStepHeader;
