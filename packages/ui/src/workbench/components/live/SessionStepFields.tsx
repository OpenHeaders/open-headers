/**
 * The fields of a session step's card (the workflow runs plan, Decisions
 * log, S16), under the card's shared head and above its shared sections:
 *
 *   - Listen — the session request it opens, how long it may take to be
 *     ready, whether the request's scripts run, and one read-only line of
 *     the identity the session connects under. It has nothing to capture.
 *   - Send — the listen it is on, the saved message of that listen's
 *     request, and captures of the message as sent.
 *   - Expect — the listen it is on, the step it waits after, where the
 *     message lands, the rows that pick it, how long it waits, whether a
 *     stored message counts, and captures of the matched message.
 *
 * An issue is shown on the field that owns it, in the validator's
 * sentence. The labels are an MQTT session's: a topic filter, a saved
 * message, a client id.
 */

import { isListenStep, type DraftStep, type StructuralError, type StructuralIssue } from '@openheaders/core/live';
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
import { Input, InputNumber, Select, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import CriteriaEditor from './CriteriaEditor';
import StepCapturesEditor from './StepCapturesEditor';
import { sessionRequestOf } from './step-action';
import { buildRequestPickerOptions, type StepRequestChoice } from './workflow-step-request-options';

const { Text } = Typography;

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

const StepDescription: React.FC<{ value: string | undefined; onChange: (next: string | undefined) => void }> = ({
  value,
  onChange,
}) => {
  const t = useT();
  return (
    <Input
      size="small"
      style={{ flex: '1 1 40%' }}
      placeholder={t('workbench.editors.live.step.descriptionPlaceholder')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
};

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
        size="small"
        style={{ flex: '1 1 30%', minWidth: 0 }}
        prefix={<Text type="secondary">{t('workbench.editors.live.step.onPrefix')}</Text>}
        status={error ? 'error' : undefined}
        data-testid={`wf-step-${index}-on`}
        value={value || undefined}
        options={steps.filter(isListenStep).map((listen) => ({ value: listen.id, label: listen.id }))}
        onChange={onChange}
      />
    </Tooltip>
  );
};

/** Who the session connects as, in the Run view's own words. */
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
  }
> = ({ step, index, onChange, mqttRequests, sessionRequests, errors }) => {
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
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'requestUid')} style={{ display: 'contents' }}>
          <Tooltip open={requestError ? undefined : false} title={requestError?.message}>
            <Select
              size="small"
              style={{ flex: '1 1 60%', minWidth: 0 }}
              showSearch
              status={requestError ? 'error' : undefined}
              filterOption={(input, option) =>
                String(option?.title ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              placeholder={t('workbench.editors.live.step.selectSessionRequest')}
              data-testid={`wf-step-${index}-session-request`}
              value={step.sessionRequestUid || undefined}
              onChange={(sessionRequestUid) => onChange({ ...step, sessionRequestUid })}
              options={buildRequestPickerOptions(sessionRequests, token)}
            />
          </Tooltip>
        </span>
        <StepDescription value={step.description} onChange={(description) => onChange({ ...step, description })} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <InputNumber
          size="small"
          style={{ width: 200 }}
          min={MIN_STEP_TIMEOUT_MS}
          max={MAX_STEP_TIMEOUT_MS}
          step={500}
          prefix={
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.live.step.readyWithin')}
            </Text>
          }
          suffix={
            <Text type="secondary" style={{ fontSize: 11 }}>
              ms
            </Text>
          }
          data-testid={`wf-step-${index}-ready-within`}
          value={step.timeoutMs}
          onChange={(timeoutMs) => {
            if (timeoutMs !== null) onChange({ ...step, timeoutMs });
          }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Switch
            size="small"
            checked={step.runScripts === true}
            data-testid={`wf-step-${index}-run-scripts`}
            aria-label={t('workbench.editors.live.sections.runScriptsAria')}
            onChange={setRunScripts}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.editors.live.step.sessionScriptsLabel')}
          </Text>
        </span>
      </div>
      {request !== undefined && (
        <div
          data-testid={`wf-step-${index}-identity`}
          style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
        >
          <Text type="secondary" style={{ fontSize: 11 }}>
            {identityFacts(request, t).join(' · ')}
          </Text>
          <InfoTrigger
            content={{
              title: t('workbench.editors.live.step.identityTitle'),
              summary: t('workbench.editors.live.step.identityInfo'),
            }}
          />
        </div>
      )}
    </>
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
  const messageError = errorOf(errors, 'send-without-message');

  // Another listen is another request: the message picked on the first is not one of its messages.
  const setSession = (on: string) => {
    const next = { ...step, on };
    delete next.messageUid;
    onChange(next);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <SessionPicker
          index={index}
          value={step.on}
          steps={steps}
          error={errorOf(errors, 'session-step-unknown-listen', 'session-step-unreachable-listen')}
          onChange={setSession}
        />
        <Tooltip open={messageError ? undefined : false} title={messageError?.message}>
          <Select
            size="small"
            style={{ flex: '2 1 40%', minWidth: 0 }}
            popupMatchSelectWidth={false}
            status={messageError ? 'error' : undefined}
            placeholder={t('workbench.editors.live.step.selectMessage')}
            data-testid={`wf-step-${index}-message`}
            value={step.messageUid}
            options={(session?.savedMessages ?? []).map((message) => ({
              value: message.uid,
              label: (
                <span>
                  {message.name}
                  <span style={{ marginLeft: 6, color: token.colorTextTertiary, fontFamily: "'SF Mono', monospace" }}>
                    {message.topic}
                  </span>
                </span>
              ),
            }))}
            onChange={(messageUid) => onChange({ ...step, messageUid })}
          />
        </Tooltip>
        <StepDescription value={step.description} onChange={(description) => onChange({ ...step, description })} />
      </div>
      <StepCapturesEditor
        index={index}
        subject="message"
        captures={step.captures}
        onChange={(captures) => onChange({ ...step, captures })}
        newCapture={newMessageCapture}
      />
    </>
  );
};

export const ExpectStepFields: React.FC<SessionFieldsProps<ExpectWorkflowStep>> = ({
  step,
  index,
  onChange,
  steps,
  errors,
}) => {
  const t = useT();
  const triggerError = errorOf(
    errors,
    'expect-unknown-trigger',
    'expect-unreachable-trigger',
    'expect-unarmed-trigger',
  );
  const addressError = errorOf(errors, 'expect-address-reads-trigger');

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
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <SessionPicker
          index={index}
          value={step.on}
          steps={steps}
          error={errorOf(errors, 'session-step-unknown-listen', 'session-step-unreachable-listen')}
          onChange={(on) => onChange({ ...step, on })}
        />
        <Tooltip open={triggerError ? undefined : false} title={triggerError?.message}>
          <Select
            size="small"
            style={{ flex: '1 1 30%', minWidth: 0 }}
            prefix={<Text type="secondary">{t('workbench.editors.live.step.afterPrefix')}</Text>}
            status={triggerError ? 'error' : undefined}
            data-testid={`wf-step-${index}-after`}
            value={step.after || undefined}
            options={steps
              .filter((each) => each.id !== step.id && each.id.length > 0)
              .map((each) => ({ value: each.id, label: each.id }))}
            onChange={(after) => onChange({ ...step, after })}
          />
        </Tooltip>
        <StepDescription value={step.description} onChange={(description) => onChange({ ...step, description })} />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Tooltip open={addressError ? undefined : false} title={addressError?.message}>
          <Input
            size="small"
            style={{ flex: '1 1 240px', minWidth: 0, fontFamily: "'SF Mono', monospace" }}
            prefix={<Text type="secondary">{t('workbench.editors.mqtt.saved.topicTagPlaceholder')}</Text>}
            placeholder={TOPIC_FILTER_EXAMPLE}
            status={addressError ? 'error' : undefined}
            data-testid={`wf-step-${index}-address`}
            value={step.address ?? ''}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Tooltip>
        <InputNumber
          size="small"
          style={{ width: 170 }}
          min={MIN_STEP_TIMEOUT_MS}
          max={MAX_STEP_TIMEOUT_MS}
          step={500}
          prefix={
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.live.step.within')}
            </Text>
          }
          suffix={
            <Text type="secondary" style={{ fontSize: 11 }}>
              ms
            </Text>
          }
          data-testid={`wf-step-${index}-within`}
          value={step.timeoutMs}
          onChange={(timeoutMs) => {
            if (timeoutMs !== null) onChange({ ...step, timeoutMs });
          }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Switch
            size="small"
            checked={step.includeStored === true}
            data-testid={`wf-step-${index}-include-stored`}
            aria-label={t('workbench.editors.live.step.includeStored')}
            onChange={setIncludeStored}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.editors.live.step.includeStored')}
          </Text>
        </span>
      </div>
      <div data-testid={`wf-step-${index}-match`}>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
          {t('workbench.editors.live.step.matchHeader', { count: step.match.length })}
        </Text>
        <CriteriaEditor
          subject="message"
          value={step.match}
          onChange={(match) => onChange({ ...step, match })}
          emptyText={t('workbench.editors.live.criteria.noneForExpect')}
          errors={errors.filter((error) => error.issue === 'criterion-invalid-regex')}
          testId={`wf-step-${index}-match`}
        />
      </div>
      <StepCapturesEditor
        index={index}
        subject="message"
        captures={step.captures}
        onChange={(captures) => onChange({ ...step, captures })}
        newCapture={newMessageCapture}
      />
    </>
  );
};
