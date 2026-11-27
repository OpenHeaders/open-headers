/**
 * WorkflowStepHeader — the head of a step's panel (the workflows
 * redesign, Step panel): the step's state glyph, its name, the protocol
 * it speaks and its kind; then what is done to the step as a whole —
 * its place among the steps, a copy of it, its removal — and the close
 * that hands the panel back to the workflow. Under them: where the step
 * stands and what it does, a line for its description, and the issues no
 * field of the panel owns.
 *
 * The name is the step's id: `{{step.<id>.<capture>}}` references name a
 * step by it. The kind tag is the picker of the step's action (the
 * workflow runs plan, Decisions log, S16 and S20); Foreach and Composite
 * stay the show-but-disable catalog entries. A step of an action the
 * model does not know shows its name and its raw action, and takes no
 * edit.
 */

import { CloseOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import {
  type DraftKnownStep,
  type DraftStep,
  isKnownStep,
  type StructuralError,
  type StructuralIssue,
} from '@openheaders/core/live';
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

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** The issues a field of the panel shows where it sits — every other one is listed under the head. */
const FIELD_OWNED_ISSUES: ReadonlySet<StructuralIssue> = new Set([
  'duplicate-step-id',
  'step-unknown-dep',
  'depends-on-cycle',
  'step-request-missing',
  'gate-unknown-stepid',
  'gate-unreachable-stepid',
  'gate-unknown-capture',
  'gate-invalid-regex',
  'priority-unknown-stepid',
  'priority-unreachable-stepid',
  'priority-unknown-capture',
  'criterion-invalid-regex',
  'poll-without-criteria',
  'poll-exceeds-limit',
  'listen-request-missing',
  'session-step-unknown-listen',
  'session-step-unreachable-listen',
  'send-without-message',
  'expect-unknown-trigger',
  'expect-unreachable-trigger',
  'expect-unarmed-trigger',
  'expect-address-reads-trigger',
  'step-needs-update',
]);

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
  onChange?: (next: DraftKnownStep) => void;
  /** The picker took another action — the owner rebuilds the step under it. */
  onActionChange?: (action: StepAction) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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
  onChange,
  onActionChange,
  onMoveUp,
  onMoveDown,
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
  const issues = errors.filter((e) => !FIELD_OWNED_ISSUES.has(e.issue) && e.referencedCriterionUid === undefined);

  return (
    <div className="oh-wf-step-head">
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
            <Button
              type="text"
              icon={<UpOutlined />}
              aria-label={t('workbench.editors.live.panel.moveUp')}
              disabled={readOnly || index === 0}
              onClick={onMoveUp}
            />
            <Button
              type="text"
              icon={<DownOutlined />}
              aria-label={t('workbench.editors.live.panel.moveDown')}
              disabled={readOnly || index === totalSteps - 1}
              onClick={onMoveDown}
            />
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
    </div>
  );
};

export default WorkflowStepHeader;
