/**
 * Phase I Collapse sections for {@link WorkflowStepEditor} — Depends on,
 * Run condition, Priority, plus the show-but-disable Retry / Timeout
 * catalog rows. Pure factory rebuilt every render (as the inline array
 * was) so state and handlers stay current — no memoization is required
 * because no renderer closes over a value that must be referentially
 * stable.
 */

import { BranchesOutlined, ClockCircleOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import type { PriorityRef, StepGate } from '@openheaders/core/types';
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
  handleDependsOnChange: (next: string[]) => void;
  clearExplicitDependsOn: () => void;
  handleRunIfChange: (next: StepGate | undefined) => void;
  setPriority: (next: PriorityRef | undefined) => void;
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
  handleDependsOnChange,
  clearExplicitDependsOn,
  handleRunIfChange,
  setPriority,
}: WorkflowStepSectionsOptions): CollapseProps['items'] {
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
    // ── Show-but-disable: retry policy ─────────────────────
    {
      key: 'retry',
      label: (
        <Tooltip title="Per-step retry coming in a future release. Whole-workflow retry policy is configured in the workflow's refresh policy.">
          <span style={{ fontSize: 11, color: token.colorTextDisabled }}>
            <ReloadOutlined style={{ marginRight: 4 }} />
            <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Retry policy</span>
            <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(coming soon)</span>
          </span>
        </Tooltip>
      ),
      collapsible: 'disabled',
      children: null,
    },
    // ── Show-but-disable: timeout ──────────────────────────
    {
      key: 'timeout',
      label: (
        <Tooltip title="Per-step timeout coming in a future release. The request executor's global timeout applies today.">
          <span style={{ fontSize: 11, color: token.colorTextDisabled }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            <span style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Timeout (ms)</span>
            <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(coming soon)</span>
          </span>
        </Tooltip>
      ),
      collapsible: 'disabled',
      extra: <InputNumber size="small" disabled placeholder="—" style={{ width: 120, pointerEvents: 'none' }} />,
      children: null,
    },
  ];
}
