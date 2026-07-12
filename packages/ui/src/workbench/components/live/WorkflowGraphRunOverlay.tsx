/**
 * Run-status overlay for the workflow graph view (WORKFLOW_GRAPH_PLAN.md
 * §6.3) — `StepRunDot`, the per-node state dot (`classifyStepRun`
 * vocabulary) `WorkflowGraphBody` composes when the editor hands it the
 * active environment's run row. When the step has captured values,
 * clicking opens a masked-by-default value popover (capture sets can
 * hold tokens; reveal is an explicit eye toggle, matching the LV editor
 * idiom). The whole-run summary lives on the editor's bottom
 * `WorkflowRunStatusStrip` — one surface for both views.
 *
 * Everything here derives at render time from the cache row — the
 * overlay holds no state beyond the popover's reveal toggle, and it
 * never touches the draft.
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Popover, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { describeStepRun, maskValue, statusColor, type StepRunState, stepRunLevel } from './live-display';

const { Text } = Typography;

// ── Per-node state dot + captured-values popover ───────────────────

interface StepRunDotProps {
  stepId: string;
  state: StepRunState;
  /** Failure message when this node is the run's failure point. */
  errorMessage?: string;
  /** Captured values for this step from the run row (may be a prior run's, when skipped). */
  captures?: Record<string, string>;
  /** Response body byte count for this step — observability garnish. */
  responseBytes?: number;
}

export const StepRunDot: React.FC<StepRunDotProps> = ({ stepId, state, errorMessage, captures, responseBytes }) => {
  const { token } = theme.useToken();
  const level = stepRunLevel(state);
  const hollow = state === 'skipped' || state === 'not-run';
  const hollowBorder = state === 'skipped' ? token.colorWarning : token.colorTextQuaternary;
  const captureEntries = captures ? Object.entries(captures) : [];
  const hasValues = captureEntries.length > 0;

  const dot = (
    <span
      data-testid={`wf-graph-run-${stepId}`}
      data-run-state={state}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        boxSizing: 'border-box',
        background: hollow ? 'transparent' : statusColor(level),
        border: hollow ? `1.5px solid ${hollowBorder}` : undefined,
        cursor: hasValues ? 'pointer' : 'default',
      }}
    />
  );

  if (!hasValues) {
    const hint = errorMessage ? `${describeStepRun(state)}: ${errorMessage}` : describeStepRun(state);
    return <Tooltip title={hint}>{dot}</Tooltip>;
  }
  return (
    <Popover
      trigger="click"
      content={
        <StepCapturePopover
          stepId={stepId}
          state={state}
          errorMessage={errorMessage}
          captureEntries={captureEntries}
          responseBytes={responseBytes}
        />
      }
    >
      <Tooltip title={describeStepRun(state)}>{dot}</Tooltip>
    </Popover>
  );
};

interface StepCapturePopoverProps {
  stepId: string;
  state: StepRunState;
  errorMessage?: string;
  captureEntries: [string, string][];
  responseBytes?: number;
}

const StepCapturePopover: React.FC<StepCapturePopoverProps> = ({
  stepId,
  state,
  errorMessage,
  captureEntries,
  responseBytes,
}) => {
  const { token } = theme.useToken();
  // Masked by default — capture sets can hold access tokens. One
  // explicit toggle per popover, matching the LV editor's reveal idiom.
  const [reveal, setReveal] = useState(false);
  return (
    <div data-testid={`wf-graph-run-pop-${stepId}`} style={{ maxWidth: 360, fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
          {describeStepRun(state)}
        </Text>
        <Button
          size="small"
          type="text"
          data-testid={`wf-graph-reveal-${stepId}`}
          icon={reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => setReveal((r) => !r)}
        />
      </div>
      {state === 'skipped' && (
        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic', display: 'block', marginBottom: 4 }}>
          values preserved from an earlier run
        </Text>
      )}
      {errorMessage && (
        <Text type="danger" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
          {errorMessage}
        </Text>
      )}
      {captureEntries.map(([name, value]) => (
        <div key={name} style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
          <Text style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{name}</Text>
          <Text
            style={{
              fontFamily: "'SF Mono', monospace",
              fontSize: 11,
              wordBreak: 'break-all',
              color: token.colorTextSecondary,
            }}
          >
            {reveal ? value : maskValue(value)}
          </Text>
        </div>
      ))}
      {responseBytes !== undefined && (
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
          {`response ${responseBytes} bytes`}
        </Text>
      )}
    </div>
  );
};
