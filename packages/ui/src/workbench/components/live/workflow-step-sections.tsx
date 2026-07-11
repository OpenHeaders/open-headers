/**
 * Collapse sections for {@link WorkflowStepEditor} — Depends on,
 * Run condition, Priority, Retry policy, and Timeout.
 * Pure factory rebuilt every render (as the inline array
 * was) so state and handlers stay current — no memoization is required
 * because no renderer closes over a value that must be referentially
 * stable.
 */

import { BranchesOutlined, ClockCircleOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
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
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Button, type CollapseProps, InputNumber, Select, Space, Tooltip, Typography } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';
import StepGateEditor from './StepGateEditor';

const { Text } = Typography;

export interface WorkflowStepSectionsOptions {
  token: GlobalToken;
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
  handleDependsOnChange: (next: string[]) => void;
  clearExplicitDependsOn: () => void;
  handleRunIfChange: (next: StepGate | undefined) => void;
  setPriority: (next: PriorityRef | undefined) => void;
  setRetry: (next: StepRetryPolicy | undefined) => void;
  setTimeoutMs: (next: number | undefined) => void;
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
  handleDependsOnChange,
  clearExplicitDependsOn,
  handleRunIfChange,
  setPriority,
  setRetry,
  setTimeoutMs,
}: WorkflowStepSectionsOptions): CollapseProps['items'] {
  const retryOnChoice = encodeRetryOn(retry?.retryOn);
  return [
    {
      key: 'deps',
      label: (
        <span style={{ fontSize: 11 }}>
          <BranchesOutlined style={{ marginRight: 4 }} />
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            Depends on
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {dependsOnValue === undefined
              ? '(implicit — prior step)'
              : dependsOnValue.length === 0
                ? '(root)'
                : `(${dependsOnValue.join(', ')})`}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }}>
          <Tooltip open={dependsOnError ? undefined : false} title={dependsOnError?.message}>
            <Select
              size="small"
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Select ancestor step(s) — empty = root step"
              status={dependsOnError ? 'error' : undefined}
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
                No explicit dependsOn — implicitly depends on the previous step in declared order.
              </Text>
            ) : dependsOnValue.length === 0 ? (
              <>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Explicit root — runs as soon as the workflow starts.
                </Text>
                <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }} onClick={clearExplicitDependsOn}>
                  Use implicit
                </Button>
              </>
            ) : (
              <>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Step waits for {dependsOnValue.length} ancestor{dependsOnValue.length === 1 ? '' : 's'} to complete
                  or skip.
                </Text>
                <Button size="small" type="link" style={{ fontSize: 11, padding: 0 }} onClick={clearExplicitDependsOn}>
                  Reset
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
            Run condition
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {runIfCount === 0 ? '(none)' : `(${runIfCount})`}
          </span>
        </span>
      ),
      children: (
        <div data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'gate')}>
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
            Priority
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {priority ? `(${priority.stepId}.${priority.captureName})` : '(none)'}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <Tooltip
              open={priorityError && priorityError.issue !== 'priority-unknown-capture' ? undefined : false}
              title={priorityError?.message}
            >
              <Select
                size="small"
                placeholder="Ancestor step"
                style={{ width: 160 }}
                status={priorityError && priorityError.issue !== 'priority-unknown-capture' ? 'error' : undefined}
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
                placeholder="Capture name"
                style={{ width: 160 }}
                disabled={!priority?.stepId}
                status={priorityError?.issue === 'priority-unknown-capture' ? 'error' : undefined}
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
              value={priority?.sort ?? 'numeric'}
              options={[
                { value: 'numeric', label: 'Numeric' },
                { value: 'lexicographic', label: 'Lexicographic' },
              ]}
              onChange={(sort) => {
                if (!priority) return;
                setPriority({ ...priority, sort });
              }}
            />
            <Tooltip title="When multiple steps can run next, the one with the lowest priority value runs first. Missing values sort last.">
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {priority && (
              <Button size="small" type="text" onClick={() => setPriority(undefined)}>
                Clear
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
            Retry policy
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {retry
              ? `(${retry.maxAttempts} attempts${retry.backoff === 'exponential' ? ', exponential' : ''})`
              : '(none)'}
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
              placeholder="Attempts"
              prefix={<Text type="secondary" style={{ fontSize: 11 }}>attempts</Text>}
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
              prefix={<Text type="secondary" style={{ fontSize: 11 }}>delay ms</Text>}
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
                { value: 'fixed', label: 'Fixed' },
                { value: 'exponential', label: 'Exponential' },
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
                { value: 'network', label: 'Network errors only' },
                { value: '5xx', label: 'Network + 5xx' },
                { value: '429', label: 'Network + 429' },
                { value: '4xx', label: 'Network + 4xx' },
                ...(retryOnChoice === 'custom' ? [{ value: 'custom', label: 'Custom (edited as data)' }] : []),
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
            <Tooltip title="Network failures (DNS, connection, timeout) always retry while attempts remain. Adding a status match also retries matching responses; extraction errors never retry. Clear the attempts field to disable retries.">
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {retry && (
              <Button size="small" type="text" onClick={() => setRetry(undefined)}>
                Clear
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
            Timeout
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {timeoutMs === undefined ? '(none)' : `(${timeoutMs} ms)`}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <InputNumber
              size="small"
              style={{ width: 170 }}
              min={MIN_STEP_TIMEOUT_MS}
              max={MAX_STEP_TIMEOUT_MS}
              step={500}
              placeholder="No timeout"
              suffix={<Text type="secondary" style={{ fontSize: 11 }}>ms</Text>}
              data-testid={`wf-step-${index}-timeout`}
              value={timeoutMs ?? null}
              onChange={(v) => setTimeoutMs(v ?? undefined)}
            />
            <Tooltip title="Per attempt — the request (including the body read) aborts past this ceiling. A retrying step gets the full timeout on every attempt. Clear the field for no ceiling.">
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {timeoutMs !== undefined && (
              <Button size="small" type="text" onClick={() => setTimeoutMs(undefined)}>
                Clear
              </Button>
            )}
          </Space>
        </div>
      ),
    },
  ];
}
