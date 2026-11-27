/**
 * A call's four cards after its Request (the workflows redesign, Step
 * panel; the workflow runs plan, Decisions log, S20): what its response
 * is held to — Success criteria, and the Poll that sends it again until
 * they hold — then how one attempt is sent — Retry policy and Timeout.
 *
 * Each of the last three is unset until its first field holds a number:
 * the field's placeholder says so, the card's other fields are off, and
 * Clear at the card's head removes it whole.
 */

import type { DraftCallStep, StructuralError } from '@openheaders/core/live';
import {
  DEFAULT_RETRY_DELAY_MS,
  MAX_POLL_ATTEMPTS,
  MAX_POLL_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
  MAX_RETRY_DELAY_MS,
  MAX_STEP_TIMEOUT_MS,
  MIN_POLL_ATTEMPTS,
  MIN_POLL_DELAY_MS,
  MIN_RETRY_ATTEMPTS,
  MIN_STEP_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import type { Criterion, StatusMatch, StepPoll, StepRetryPolicy } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, ConfigProvider, InputNumber, Select } from 'antd';
import type React from 'react';
import CriteriaEditor from './CriteriaEditor';
import WorkflowCard, { CardField } from './WorkflowCard';

/** The wait a poll starts with when its attempts are first set — the editor's seed; the step stores its own. */
const SEED_POLL_DELAY_MS = 1_000;

// ── Retry-on encoding — the UI's picklist over the StatusMatch union ──

type RetryOnChoice = 'network' | '5xx' | '4xx' | '429' | 'custom';

/** Map a persisted `retryOn` to the UI picklist. YAML-authored shapes the
 *  picker doesn't produce (`ne` / `in` / other `eq` codes) render as a
 *  read-only "Custom" entry so the picker never destroys them silently. */
function encodeRetryOn(retryOn: StatusMatch | undefined): RetryOnChoice {
  if (retryOn === undefined) return 'network';
  if (retryOn === '5xx' || retryOn === '4xx') return retryOn;
  if (Array.isArray(retryOn) && retryOn[0] === 'eq' && retryOn[1] === 429) return '429';
  return 'custom';
}

function decodeRetryOn(choice: RetryOnChoice): StatusMatch | undefined {
  switch (choice) {
    case '5xx':
    case '4xx':
      return choice;
    case '429':
      return ['eq', 429];
    default:
      return undefined;
  }
}

interface Props {
  step: DraftCallStep;
  index: number;
  onChange: (next: DraftCallStep) => void;
  /** The step's errors, from the validators. */
  errors: readonly StructuralError[];
}

const CallPolicyCards: React.FC<Props> = ({ step, index, onChange, errors }) => {
  const t = useT();
  // A read-only form switches every control off through the provider;
  // the controls below that set their own `disabled` must agree with it.
  const readOnly = ConfigProvider.useConfig().componentDisabled === true;
  const { retry, poll, timeoutMs } = step;
  const retryOnChoice = encodeRetryOn(retry?.retryOn);
  const pollError = errors.find((e) => e.issue === 'poll-without-criteria' || e.issue === 'poll-exceeds-limit');

  // An emptied list deletes the field: absent is "any response that
  // arrived passes", and an empty array would say the same twice.
  const setSuccessCriteria = (next: Criterion[]) => {
    const nextStep = { ...step };
    if (next.length === 0) {
      delete nextStep.successCriteria;
    } else {
      nextStep.successCriteria = next;
    }
    onChange(nextStep);
  };

  const setPoll = (next: StepPoll | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.poll;
    } else {
      nextStep.poll = next;
    }
    onChange(nextStep);
  };

  const setRetry = (next: StepRetryPolicy | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.retry;
    } else {
      nextStep.retry = next;
    }
    onChange(nextStep);
  };

  const setTimeoutMs = (next: number | undefined) => {
    const nextStep = { ...step };
    if (next === undefined) {
      delete nextStep.timeoutMs;
    } else {
      nextStep.timeoutMs = next;
    }
    onChange(nextStep);
  };

  const clearButton = (onClear: () => void) => (
    <Button type="text" onClick={onClear}>
      {t('workbench.editors.live.sections.clear')}
    </Button>
  );

  const attemptsLabel = t('workbench.editors.live.sections.attempts');
  const pollWaitLabel = t('workbench.editors.live.sections.pollWait');
  const retryDelayLabel = t('workbench.editors.live.sections.retryDelay');
  const backoffLabel = t('workbench.editors.live.sections.backoff');
  const retryOnLabel = t('workbench.editors.live.sections.retryOn');
  const perAttemptLabel = t('workbench.editors.live.sections.timeoutPerAttempt');

  return (
    <>
      <CriteriaEditor
        cardTestId={`wf-step-${index}-criteria`}
        title={t('workbench.editors.live.sections.successCriteria')}
        description={t('workbench.editors.live.criteria.successDescription')}
        value={step.successCriteria ?? []}
        onChange={setSuccessCriteria}
        emptyText={t('workbench.editors.live.criteria.noneForCall')}
        errors={errors.filter((e) => e.issue === 'criterion-invalid-regex')}
        testId={`wf-step-${index}-criterion`}
      />

      <WorkflowCard
        testId={`wf-step-${index}-poll`}
        title={t('workbench.editors.live.sections.poll')}
        description={t('workbench.editors.live.sections.pollInfo')}
        extra={poll !== undefined ? clearButton(() => setPoll(undefined)) : undefined}
      >
        <div className="oh-wf-card-body oh-wf-field-grid">
          <CardField label={attemptsLabel}>
            <InputNumber
              min={MIN_POLL_ATTEMPTS}
              max={MAX_POLL_ATTEMPTS}
              status={pollError ? 'error' : undefined}
              placeholder={t('workbench.editors.live.sections.noPollPlaceholder')}
              data-testid={`wf-step-${index}-poll-attempts`}
              aria-label={attemptsLabel}
              value={poll?.maxAttempts ?? null}
              onChange={(v) => {
                if (v == null) {
                  setPoll(undefined);
                  return;
                }
                setPoll({ maxAttempts: v, delayMs: poll?.delayMs ?? SEED_POLL_DELAY_MS });
              }}
            />
          </CardField>
          <CardField label={pollWaitLabel}>
            <InputNumber
              min={MIN_POLL_DELAY_MS}
              max={MAX_POLL_DELAY_MS}
              step={100}
              disabled={readOnly || !poll}
              status={pollError ? 'error' : undefined}
              data-testid={`wf-step-${index}-poll-delay`}
              aria-label={pollWaitLabel}
              value={poll?.delayMs ?? null}
              onChange={(v) => {
                if (!poll || v == null) return;
                setPoll({ ...poll, delayMs: v });
              }}
            />
          </CardField>
        </div>
        {pollError && <div className="oh-wf-card-note oh-wf-card-note--error">{pollError.message}</div>}
      </WorkflowCard>

      <WorkflowCard
        testId={`wf-step-${index}-retry`}
        title={t('workbench.editors.live.sections.retryPolicy')}
        description={t('workbench.editors.live.sections.retryDescription')}
        extra={
          <>
            <InfoTrigger
              content={{
                title: t('workbench.editors.live.sections.retryPolicy'),
                summary: t('workbench.editors.live.sections.retryInfo'),
              }}
            />
            {retry !== undefined && clearButton(() => setRetry(undefined))}
          </>
        }
      >
        <div className="oh-wf-card-body oh-wf-field-grid">
          <CardField label={attemptsLabel}>
            <InputNumber
              min={MIN_RETRY_ATTEMPTS}
              max={MAX_RETRY_ATTEMPTS}
              placeholder={t('workbench.editors.live.sections.noRetryPlaceholder')}
              data-testid={`wf-step-${index}-retry-attempts`}
              aria-label={attemptsLabel}
              value={retry?.maxAttempts ?? null}
              onChange={(v) => {
                if (v == null) {
                  setRetry(undefined);
                  return;
                }
                setRetry({ ...(retry ?? {}), maxAttempts: v });
              }}
            />
          </CardField>
          <CardField label={retryDelayLabel}>
            <InputNumber
              min={0}
              max={MAX_RETRY_DELAY_MS}
              step={100}
              disabled={readOnly || !retry}
              placeholder={String(DEFAULT_RETRY_DELAY_MS)}
              data-testid={`wf-step-${index}-retry-delay`}
              aria-label={retryDelayLabel}
              value={retry?.delayMs ?? null}
              onChange={(v) => {
                if (!retry) return;
                const next = { ...retry };
                if (v == null) {
                  delete next.delayMs;
                } else {
                  next.delayMs = v;
                }
                setRetry(next);
              }}
            />
          </CardField>
          <CardField label={backoffLabel}>
            <Select
              disabled={readOnly || !retry}
              data-testid={`wf-step-${index}-retry-backoff`}
              aria-label={backoffLabel}
              value={retry?.backoff ?? 'fixed'}
              options={[
                { value: 'fixed', label: t('workbench.editors.live.sections.backoffFixed') },
                { value: 'exponential', label: t('workbench.editors.live.sections.backoffExponential') },
              ]}
              onChange={(backoff) => {
                if (!retry) return;
                const next = { ...retry };
                if (backoff === 'fixed') {
                  delete next.backoff;
                } else {
                  next.backoff = backoff;
                }
                setRetry(next);
              }}
            />
          </CardField>
          <CardField label={retryOnLabel}>
            <Select
              disabled={readOnly || !retry}
              data-testid={`wf-step-${index}-retry-on`}
              aria-label={retryOnLabel}
              value={retryOnChoice}
              options={[
                { value: 'network', label: t('workbench.editors.live.sections.retryOnNetwork') },
                { value: '5xx', label: t('workbench.editors.live.sections.retryOn5xx') },
                { value: '429', label: t('workbench.editors.live.sections.retryOn429') },
                { value: '4xx', label: t('workbench.editors.live.sections.retryOn4xx') },
                ...(retryOnChoice === 'custom'
                  ? [{ value: 'custom', label: t('workbench.editors.live.sections.retryOnCustom') }]
                  : []),
              ]}
              onChange={(choice: RetryOnChoice) => {
                if (!retry) return;
                const next = { ...retry };
                const decoded = decodeRetryOn(choice);
                if (decoded === undefined) {
                  delete next.retryOn;
                } else {
                  next.retryOn = decoded;
                }
                setRetry(next);
              }}
            />
          </CardField>
        </div>
      </WorkflowCard>

      <WorkflowCard
        testId={`wf-step-${index}-timeout-section`}
        title={t('workbench.editors.live.sections.timeout')}
        description={t('workbench.editors.live.sections.timeoutDescription')}
        extra={timeoutMs !== undefined ? clearButton(() => setTimeoutMs(undefined)) : undefined}
      >
        <div className="oh-wf-card-body oh-wf-field-grid">
          <CardField label={perAttemptLabel}>
            <InputNumber
              min={MIN_STEP_TIMEOUT_MS}
              max={MAX_STEP_TIMEOUT_MS}
              step={500}
              placeholder={t('workbench.editors.live.sections.noTimeoutPlaceholder')}
              data-testid={`wf-step-${index}-timeout`}
              aria-label={perAttemptLabel}
              value={timeoutMs ?? null}
              onChange={(v) => setTimeoutMs(v ?? undefined)}
            />
          </CardField>
        </div>
      </WorkflowCard>
    </>
  );
};

export default CallPolicyCards;
