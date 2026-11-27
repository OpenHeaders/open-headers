/**
 * A session step's own cards (the workflow runs plan, Decisions log,
 * S16; the workflows redesign, Step panel):
 *
 *   - Listen — Connection: the session request it opens, how long it may
 *     take to be ready, whether the request's scripts run, and at the
 *     card's foot the identity the session connects under. It has nothing
 *     to capture.
 *   - Send — Send message: the listen it is on and the saved message of
 *     that listen's request.
 *   - Expect — Expect message: where the message lands, the listen it is
 *     on, the step it waits after, how long it waits and whether a stored
 *     message counts; then Match criteria, the rows that pick the message.
 *
 * A send's and an expect's captures read the message, in a Captures
 * card of their own.
 *
 * An issue is shown on the field that owns it, in the validator's
 * sentence. The labels are an MQTT session's: a topic filter, a saved
 * message, a client id.
 */

import { type DraftStep, isListenStep, type StructuralError, type StructuralIssue } from '@openheaders/core/live';
import { MAX_STEP_TIMEOUT_MS, MIN_STEP_TIMEOUT_MS } from '@openheaders/core/schemas';
import type {
  Capture,
  ExpectWorkflowStep,
  ListenWorkflowStep,
  MqttRequest,
  SendWorkflowStep,
} from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import { Button, Checkbox, Input, InputNumber, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import CriteriaEditor from './CriteriaEditor';
import StepCapturesEditor from './StepCapturesEditor';
import { sessionRequestOf } from './step-action';
import type { StepMarkKind } from './step-mark';
import WorkflowCard, { CardField } from './WorkflowCard';
import { buildRequestPickerOptions, type StepRequestChoice } from './workflow-step-request-options';

// Topic-filter format example shown in the address placeholder — raw by design.
const TOPIC_FILTER_EXAMPLE = 'devices/+/status';

interface SessionFieldsProps<S> {
  step: S;
  index: number;
  onChange: (next: S) => void;
  /** The draft's steps in order — the listens a step can be on, the steps an expect can wait after. */
  steps: readonly DraftStep[];
  mqttRequests: readonly MqttRequest[];
  /** The step's errors, from the validators. */
  errors: readonly StructuralError[];
}

function errorOf(errors: readonly StructuralError[], ...issues: StructuralIssue[]): StructuralError | undefined {
  return errors.find((error) => issues.includes(error.issue));
}

function newMessageCapture(name: string): Capture {
  return { uid: generateUid(), name, extractor: { kind: 'whole-body' } };
}

/** The listen a send or an expect is on. */
const SessionPicker: React.FC<{
  index: number;
  value: string;
  steps: readonly DraftStep[];
  error: StructuralError | undefined;
  onChange: (listenId: string) => void;
}> = ({ index, value, steps, error, onChange }) => {
  const t = useT();
  return (
    <Tooltip open={error ? undefined : false} title={error?.message}>
      <Select
        status={error ? 'error' : undefined}
        data-testid={`wf-step-${index}-on`}
        aria-label={t('workbench.editors.live.step.onConnection')}
        value={value || undefined}
        options={steps.filter(isListenStep).map((listen) => ({ value: listen.id, label: listen.id }))}
        onChange={onChange}
      />
    </Tooltip>
  );
};

/** Who the session connects as, in the run rows' own words. */
function identityFacts(request: MqttRequest, t: Translate): string[] {
  const generated = request.clientId === undefined || request.clientId.trim() === '';
  return [
    t(generated ? 'workbench.editors.live.run.row.identityGenerated' : 'workbench.editors.live.run.row.identityOwn'),
    ...(request.cleanStart !== false ? [t('workbench.editors.live.run.row.cleanStart')] : []),
    // The protocol's own name for the knob and its wire unit — stays raw.
    ...(request.sessionExpiryInterval !== undefined
      ? [`${t('workbench.editors.mqtt.settings.sessionExpiryLabel')} ${request.sessionExpiryInterval} s`]
      : []),
  ];
}

export const ListenStepFields: React.FC<
  SessionFieldsProps<ListenWorkflowStep> & {
    /** The MQTT requests a listen can open, as the request picker shows them. */
    sessionRequests: StepRequestChoice[];
    /** Opens the session request's own tab — absent where the step names no request the workspace holds. */
    onOpenRequest?: () => void;
  }
> = ({ step, index, onChange, mqttRequests, sessionRequests, errors, onOpenRequest }) => {
  const { token } = theme.useToken();
  const t = useT();
  const request = mqttRequests.find((each) => each.uid === step.sessionRequestUid);
  // A request not picked yet names nothing that could be missing.
  const requestError = step.sessionRequestUid === '' ? undefined : errorOf(errors, 'listen-request-missing');

  const setRunScripts = (on: boolean) => {
    if (on) noteFeatureUsed('workflow-scripts');
    const next = { ...step };
    if (on) {
      next.runScripts = true;
    } else {
      delete next.runScripts;
    }
    onChange(next);
  };

  return (
    <WorkflowCard
      testId={`wf-step-${index}-connection`}
      title={t('workbench.editors.live.connection.title')}
      description={t('workbench.editors.live.connection.description')}
      extra={
        // It edits nothing, so it is told by its own `disabled`, never a read-only form's.
        <Button
          data-testid={`wf-step-${index}-open-request`}
          disabled={onOpenRequest === undefined}
          onClick={onOpenRequest}
        >
          {t('workbench.editors.live.request.open')}
        </Button>
      }
      footer={
        request !== undefined ? (
          <span className="oh-wf-foot-row" data-testid={`wf-step-${index}-identity`}>
            <span>{identityFacts(request, t).join(' · ')}</span>
            <InfoTrigger
              content={{
                title: t('workbench.editors.live.step.identityTitle'),
                summary: t('workbench.editors.live.step.identityInfo'),
              }}
            />
          </span>
        ) : undefined
      }
    >
      <div className="oh-wf-card-body oh-wf-fields">
        <div className="oh-wf-field-grid oh-wf-field-grid--lead">
          <CardField label={t('workbench.editors.live.request.saved')}>
            <span data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'requestUid')} style={{ display: 'contents' }}>
              <Tooltip open={requestError ? undefined : false} title={requestError?.message}>
                <Select
                  showSearch
                  status={requestError ? 'error' : undefined}
                  filterOption={(input, option) =>
                    String(option?.title ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  placeholder={t('workbench.editors.live.step.selectSessionRequest')}
                  data-testid={`wf-step-${index}-session-request`}
                  aria-label={t('workbench.editors.live.request.saved')}
                  value={step.sessionRequestUid || undefined}
                  onChange={(sessionRequestUid) => onChange({ ...step, sessionRequestUid })}
                  options={buildRequestPickerOptions(sessionRequests, token)}
                />
              </Tooltip>
            </span>
          </CardField>
          <CardField label={t('workbench.editors.live.connection.readyWithin')}>
            <InputNumber
              min={MIN_STEP_TIMEOUT_MS}
              max={MAX_STEP_TIMEOUT_MS}
              step={500}
              data-testid={`wf-step-${index}-ready-within`}
              aria-label={t('workbench.editors.live.connection.readyWithin')}
              value={step.timeoutMs}
              onChange={(timeoutMs) => {
                if (timeoutMs !== null) onChange({ ...step, timeoutMs });
              }}
            />
          </CardField>
        </div>
        <Checkbox
          data-testid={`wf-step-${index}-run-scripts`}
          checked={step.runScripts === true}
          onChange={(e) => setRunScripts(e.target.checked)}
        >
          {t('workbench.editors.live.step.sessionScriptsLabel')}
        </Checkbox>
      </div>
    </WorkflowCard>
  );
};

export const SendStepFields: React.FC<SessionFieldsProps<SendWorkflowStep>> = ({
  step,
  index,
  onChange,
  steps,
  mqttRequests,
  errors,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const session = sessionRequestOf(steps, step.on, mqttRequests);

  // Another listen is another request: the message picked on the first is not one of its messages.
  const setSession = (on: string) => {
    const next = { ...step, on };
    delete next.messageUid;
    onChange(next);
  };

  return (
    <WorkflowCard
      testId={`wf-step-${index}-send`}
      title={t('workbench.editors.live.send.title')}
      description={t('workbench.editors.live.send.description')}
    >
      <div className="oh-wf-card-body oh-wf-field-grid">
        <CardField label={t('workbench.editors.live.step.onConnection')}>
          <SessionPicker
            index={index}
            value={step.on}
            steps={steps}
            error={errorOf(errors, 'session-step-unknown-listen', 'session-step-unreachable-listen')}
            onChange={setSession}
          />
        </CardField>
        <CardField label={t('workbench.editors.live.send.savedMessage')}>
          {/* A message not picked yet is no error on its picker — as a call's or a listen's request. */}
          <Select
            popupMatchSelectWidth={false}
            placeholder={t('workbench.editors.live.step.selectMessage')}
            data-testid={`wf-step-${index}-message`}
            aria-label={t('workbench.editors.live.send.savedMessage')}
            value={step.messageUid}
            options={(session?.savedMessages ?? []).map((message) => ({
              value: message.uid,
              label: (
                <span>
                  {message.name}
                  <span className="oh-wf-code" style={{ marginLeft: 6, color: token.colorTextTertiary }}>
                    {message.topic}
                  </span>
                </span>
              ),
            }))}
            onChange={(messageUid) => onChange({ ...step, messageUid })}
          />
        </CardField>
      </div>
    </WorkflowCard>
  );
};

/** How the last run left an expect, as its Match criteria card says it — nothing where no run judged the rows. */
function matchOutcomeOf(runState: StepMarkKind | undefined): 'matched' | 'never' | undefined {
  if (runState === 'passed') return 'matched';
  return runState === 'timed-out' ? 'never' : undefined;
}

export const ExpectStepFields: React.FC<
  SessionFieldsProps<ExpectWorkflowStep> & {
    /** How the last run left the step — absent where the step is not shown beside a run. */
    runState?: StepMarkKind;
  }
> = ({ step, index, onChange, steps, errors, runState }) => {
  const t = useT();
  const triggerError = errorOf(
    errors,
    'expect-unknown-trigger',
    'expect-unreachable-trigger',
    'expect-unarmed-trigger',
  );
  const addressError = errorOf(errors, 'expect-address-reads-trigger');
  // The run knows the step matched, not which row held: one line for the rows together.
  const matchOutcome = step.match.length > 0 ? matchOutcomeOf(runState) : undefined;

  // An emptied address deletes the field: absent is "wherever a message lands".
  const setAddress = (address: string) => {
    const next = { ...step };
    if (address === '') {
      delete next.address;
    } else {
      next.address = address;
    }
    onChange(next);
  };

  const setIncludeStored = (on: boolean) => {
    const next = { ...step };
    if (on) {
      next.includeStored = true;
    } else {
      delete next.includeStored;
    }
    onChange(next);
  };

  return (
    <>
      <WorkflowCard
        testId={`wf-step-${index}-expect`}
        title={t('workbench.editors.live.expect.title')}
        description={t('workbench.editors.live.expect.description')}
      >
        <div className="oh-wf-card-body oh-wf-field-grid">
          <CardField wide label={t('workbench.editors.live.expect.topic')}>
            <Tooltip open={addressError ? undefined : false} title={addressError?.message}>
              <Input
                className="oh-wf-code"
                placeholder={TOPIC_FILTER_EXAMPLE}
                status={addressError ? 'error' : undefined}
                data-testid={`wf-step-${index}-address`}
                aria-label={t('workbench.editors.live.expect.topic')}
                value={step.address ?? ''}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Tooltip>
          </CardField>
          <CardField label={t('workbench.editors.live.step.onConnection')}>
            <SessionPicker
              index={index}
              value={step.on}
              steps={steps}
              error={errorOf(errors, 'session-step-unknown-listen', 'session-step-unreachable-listen')}
              onChange={(on) => onChange({ ...step, on })}
            />
          </CardField>
          <CardField label={t('workbench.editors.live.expect.onlyAfter')}>
            <Tooltip open={triggerError ? undefined : false} title={triggerError?.message}>
              <Select
                status={triggerError ? 'error' : undefined}
                data-testid={`wf-step-${index}-after`}
                aria-label={t('workbench.editors.live.expect.onlyAfter')}
                value={step.after || undefined}
                options={steps
                  .filter((each) => each.id !== step.id && each.id.length > 0)
                  .map((each) => ({ value: each.id, label: each.id }))}
                onChange={(after) => onChange({ ...step, after })}
              />
            </Tooltip>
          </CardField>
          <CardField label={t('workbench.editors.live.expect.within')}>
            <InputNumber
              min={MIN_STEP_TIMEOUT_MS}
              max={MAX_STEP_TIMEOUT_MS}
              step={500}
              data-testid={`wf-step-${index}-within`}
              aria-label={t('workbench.editors.live.expect.within')}
              value={step.timeoutMs}
              onChange={(timeoutMs) => {
                if (timeoutMs !== null) onChange({ ...step, timeoutMs });
              }}
            />
          </CardField>
          <Checkbox
            className="oh-wf-field-check"
            data-testid={`wf-step-${index}-include-stored`}
            checked={step.includeStored === true}
            onChange={(e) => setIncludeStored(e.target.checked)}
          >
            {t('workbench.editors.live.step.includeStored')}
          </Checkbox>
        </div>
      </WorkflowCard>
      <CriteriaEditor
        cardTestId={`wf-step-${index}-match`}
        title={t('workbench.editors.live.criteria.matchTitle')}
        description={t('workbench.editors.live.criteria.matchDescription')}
        subject="message"
        value={step.match}
        onChange={(match) => onChange({ ...step, match })}
        emptyText={t('workbench.editors.live.criteria.noneForExpect')}
        errors={errors.filter((error) => error.referencedCriterionUid !== undefined)}
        testId={`wf-step-${index}-match`}
        footer={
          matchOutcome !== undefined ? (
            <span
              className="oh-wf-match-run"
              data-testid={`wf-step-${index}-match-last-run`}
              data-outcome={matchOutcome}
            >
              {t('workbench.editors.live.criteria.lastRun', {
                outcome: t(
                  matchOutcome === 'matched'
                    ? 'workbench.editors.live.run.pane.note.matched'
                    : 'workbench.editors.live.criteria.neverMatched',
                ),
              })}
            </span>
          ) : undefined
        }
      />
    </>
  );
};

/** The Captures card of a send's or an expect's message. */
export function SessionStepCaptures<S extends SendWorkflowStep | ExpectWorkflowStep>({
  step,
  index,
  onChange,
  readersOf,
  lastValues,
}: {
  step: S;
  index: number;
  onChange: (next: S) => void;
  /** The steps that read a capture, by its name. */
  readersOf: (captureName: string) => readonly string[];
  /** The values the captures last held, by name. */
  lastValues: Readonly<Record<string, string>>;
}) {
  return (
    <StepCapturesEditor
      index={index}
      subject="message"
      captures={step.captures}
      onChange={(captures) => onChange({ ...step, captures })}
      newCapture={newMessageCapture}
      readersOf={readersOf}
      lastValues={lastValues}
    />
  );
}
