/**
 * Collapse sections for {@link WorkflowStepEditor} — Depends on,
 * Run condition, Priority, Retry policy, Timeout, and Scripts.
 * Pure factory rebuilt every render (as the inline array
 * was) so state and handlers stay current — no memoization is required
 * because no renderer closes over a value that must be referentially
 * stable.
 */

import {
  BranchesOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import {
  DEFAULT_RETRY_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
  MAX_RETRY_DELAY_MS,
  MAX_STEP_TIMEOUT_MS,
  MIN_RETRY_ATTEMPTS,
  MIN_STEP_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import type { PriorityRef, StatusMatch, StepGate, StepRetryPolicy } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Button, type CollapseProps, InputNumber, Select, Space, Switch, Tooltip, Typography } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import StepGateEditor from './StepGateEditor';

const { Text } = Typography;

export interface WorkflowStepSectionsOptions {
  token: GlobalToken;
  t: Translate;
  index: number;
  runIf: StepGate | undefined;
  dependsOnValue: string[] | undefined;
  allStepIds: { id: string; label: string }[];
  reachableSteps: { id: string; label: string }[];
  capturesByStepId: Map<string, string[]>;
  dependsOnError: StructuralError | undefined;
  gateErrors: StructuralError[];
  priorityError: StructuralError | undefined;
  runIfCount: number;
  priority: PriorityRef | undefined;
  priorityStepOptions: { value: string; label: string }[];
  priorityCaptureOptions: { value: string; label: string }[];
  retry: StepRetryPolicy | undefined;
  timeoutMs: number | undefined;
  runScripts: boolean | undefined;
  handleDependsOnChange: (next: string[]) => void;
  clearExplicitDependsOn: () => void;
  handleRunIfChange: (next: StepGate | undefined) => void;
  setPriority: (next: PriorityRef | undefined) => void;
  setRetry: (next: StepRetryPolicy | undefined) => void;
  setTimeoutMs: (next: number | undefined) => void;
  setRunScripts: (next: boolean | undefined) => void;
}

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

export function buildWorkflowStepSections({
  token,
  t,
  index,
  runIf,
  dependsOnValue,
  allStepIds,
  reachableSteps,
  capturesByStepId,
  dependsOnError,
  gateErrors,
  priorityError,
  runIfCount,
  priority,
  priorityStepOptions,
  priorityCaptureOptions,
  retry,
  timeoutMs,
  runScripts,
  handleDependsOnChange,
  clearExplicitDependsOn,
  handleRunIfChange,
  setPriority,
  setRetry,
  setTimeoutMs,
  setRunScripts,
}: WorkflowStepSectionsOptions): CollapseProps['items'] {
  const retryOnChoice = encodeRetryOn(retry?.retryOn);
  return [
    {
      key: 'deps',
      label: (
        <span style={{ fontSize: 11 }}>
          <BranchesOutlined style={{ marginRight: 4 }} />
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.dependsOn')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {dependsOnValue === undefined
              ? t('workbench.editors.live.sections.dependsOnImplicit')
              : dependsOnValue.length === 0
                ? t('workbench.editors.live.sections.dependsOnRoot')
                : `(${dependsOnValue.join(', ')})`}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }} data-testid={`wf-step-${index}-deps`}>
          <Tooltip open={dependsOnError ? undefined : false} title={dependsOnError?.message}>
            <Select
              size="small"
              mode="multiple"
              style={{ width: '100%' }}
              placeholder={t('workbench.editors.live.sections.dependsOnPlaceholder')}
              status={dependsOnError ? 'error' : undefined}
              data-testid={`wf-step-${index}-deps-select`}
              value={dependsOnValue ?? []}
              options={allStepIds.map((s) => ({ value: s.id, label: s.label }))}
              onChange={handleDependsOnChange}
            />
          </Tooltip>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
              fontSize: 11,
              color: token.colorTextTertiary,
            }}
          >
            {dependsOnValue === undefined ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('workbench.editors.live.sections.dependsOnImplicitHint')}
              </Text>
            ) : dependsOnValue.length === 0 ? (
              <>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workbench.editors.live.sections.dependsOnRootHint')}
                </Text>
                <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }} onClick={clearExplicitDependsOn}>
                  {t('workbench.editors.live.sections.useImplicit')}
                </Button>
              </>
            ) : (
              <>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workbench.editors.live.sections.waitsFor', { count: dependsOnValue.length })}
                </Text>
                <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }} onClick={clearExplicitDependsOn}>
                  {t('workbench.editors.live.sections.reset')}
                </Button>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'runIf',
      label: (
        <span style={{ fontSize: 11 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.runCondition')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {runIfCount === 0 ? t('workbench.editors.live.sections.none') : `(${runIfCount})`}
          </span>
        </span>
      ),
      children: (
        <div data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'gate')} data-testid={`wf-step-${index}-runif`}>
          <StepGateEditor
            value={runIf}
            onChange={handleRunIfChange}
            reachableSteps={reachableSteps}
            capturesByStepId={capturesByStepId}
            errors={gateErrors}
          />
        </div>
      ),
    },
    {
      key: 'priority',
      label: (
        <span style={{ fontSize: 11 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.priority')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {priority
              ? `(${priority.stepId}.${priority.captureName})`
              : t('workbench.editors.live.sections.none')}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }} data-testid={`wf-step-${index}-priority`}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <Tooltip
              open={priorityError && priorityError.issue !== 'priority-unknown-capture' ? undefined : false}
              title={priorityError?.message}
            >
              <Select
                size="small"
                placeholder={t('workbench.editors.live.sections.priorityStepPlaceholder')}
                style={{ width: 160 }}
                status={priorityError && priorityError.issue !== 'priority-unknown-capture' ? 'error' : undefined}
                data-testid={`wf-step-${index}-priority-step`}
                value={priority?.stepId}
                options={priorityStepOptions}
                onChange={(stepId) => {
                  setPriority({
                    stepId,
                    captureName: priority?.captureName ?? '',
                    sort: priority?.sort,
                  });
                }}
              />
            </Tooltip>
            <Tooltip
              open={priorityError?.issue === 'priority-unknown-capture' ? undefined : false}
              title={priorityError?.message}
            >
              <Select
                size="small"
                placeholder={t('workbench.editors.live.sections.priorityCapturePlaceholder')}
                style={{ width: 160 }}
                disabled={!priority?.stepId}
                status={priorityError?.issue === 'priority-unknown-capture' ? 'error' : undefined}
                data-testid={`wf-step-${index}-priority-capture`}
                value={priority?.captureName}
                options={priorityCaptureOptions}
                onChange={(captureName) => {
                  if (!priority) return;
                  setPriority({ ...priority, captureName });
                }}
              />
            </Tooltip>
            <Select
              size="small"
              style={{ width: 140 }}
              disabled={!priority?.stepId}
              data-testid={`wf-step-${index}-priority-sort`}
              value={priority?.sort ?? 'numeric'}
              options={[
                { value: 'numeric', label: t('workbench.editors.live.sections.sortNumeric') },
                { value: 'lexicographic', label: t('workbench.editors.live.sections.sortLexicographic') },
              ]}
              onChange={(sort) => {
                if (!priority) return;
                setPriority({ ...priority, sort });
              }}
            />
            <Tooltip title={t('workbench.editors.live.sections.priorityTooltip')}>
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {priority && (
              <Button size="small" type="text" onClick={() => setPriority(undefined)}>
                {t('workbench.editors.live.sections.clear')}
              </Button>
            )}
          </Space>
        </div>
      ),
    },
    {
      key: 'retry',
      label: (
        <span style={{ fontSize: 11 }}>
          <ReloadOutlined style={{ marginRight: 4 }} />
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.retryPolicy')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {retry
              ? retry.backoff === 'exponential'
                ? t('workbench.editors.live.sections.retrySummaryExponential', { count: retry.maxAttempts })
                : t('workbench.editors.live.sections.retrySummary', { count: retry.maxAttempts })
              : t('workbench.editors.live.sections.none')}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }} data-testid={`wf-step-${index}-retry`}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <InputNumber
              size="small"
              style={{ width: 130 }}
              min={MIN_RETRY_ATTEMPTS}
              max={MAX_RETRY_ATTEMPTS}
              placeholder={t('workbench.editors.live.sections.attemptsPlaceholder')}
              prefix={
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workbench.editors.live.sections.attemptsPrefix')}
                </Text>
              }
              data-testid={`wf-step-${index}-retry-attempts`}
              value={retry?.maxAttempts ?? null}
              onChange={(v) => {
                if (v == null) {
                  setRetry(undefined);
                  return;
                }
                setRetry({ ...(retry ?? {}), maxAttempts: v });
              }}
            />
            <InputNumber
              size="small"
              style={{ width: 140 }}
              min={0}
              max={MAX_RETRY_DELAY_MS}
              step={100}
              disabled={!retry}
              placeholder={String(DEFAULT_RETRY_DELAY_MS)}
              prefix={
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('workbench.editors.live.sections.delayPrefix')}
                </Text>
              }
              data-testid={`wf-step-${index}-retry-delay`}
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
            <Select
              size="small"
              style={{ width: 120 }}
              disabled={!retry}
              data-testid={`wf-step-${index}-retry-backoff`}
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
            <Select
              size="small"
              style={{ width: 190 }}
              disabled={!retry}
              data-testid={`wf-step-${index}-retry-on`}
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
            <Tooltip title={t('workbench.editors.live.sections.retryTooltip')}>
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {retry && (
              <Button size="small" type="text" onClick={() => setRetry(undefined)}>
                {t('workbench.editors.live.sections.clear')}
              </Button>
            )}
          </Space>
        </div>
      ),
    },
    {
      key: 'timeout',
      label: (
        <span style={{ fontSize: 11 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.timeout')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {timeoutMs === undefined ? t('workbench.editors.live.sections.none') : `(${timeoutMs} ms)`}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }} data-testid={`wf-step-${index}-timeout-section`}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <InputNumber
              size="small"
              style={{ width: 170 }}
              min={MIN_STEP_TIMEOUT_MS}
              max={MAX_STEP_TIMEOUT_MS}
              step={500}
              placeholder={t('workbench.editors.live.sections.noTimeoutPlaceholder')}
              suffix={<Text type="secondary" style={{ fontSize: 11 }}>ms</Text>}
              data-testid={`wf-step-${index}-timeout`}
              value={timeoutMs ?? null}
              onChange={(v) => setTimeoutMs(v ?? undefined)}
            />
            <Tooltip title={t('workbench.editors.live.sections.timeoutTooltip')}>
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {timeoutMs !== undefined && (
              <Button size="small" type="text" onClick={() => setTimeoutMs(undefined)}>
                {t('workbench.editors.live.sections.clear')}
              </Button>
            )}
          </Space>
        </div>
      ),
    },
    {
      key: 'scripts',
      label: (
        <span style={{ fontSize: 11 }}>
          <CodeOutlined style={{ marginRight: 4 }} />
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.scripts')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {runScripts === true
              ? t('workbench.editors.live.sections.scriptsOn')
              : t('workbench.editors.live.sections.scriptsOff')}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }} data-testid={`wf-step-${index}-scripts`}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <Switch
              size="small"
              checked={runScripts === true}
              data-testid={`wf-step-${index}-run-scripts`}
              aria-label={t('workbench.editors.live.sections.runScriptsAria')}
              onChange={(on) => setRunScripts(on ? true : undefined)}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.live.sections.runScriptsLabel')}
            </Text>
            <Tooltip title={t('workbench.editors.live.sections.scriptsTooltip')}>
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
          </Space>
        </div>
      ),
    },
  ];
}
