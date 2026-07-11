/**
 * Run-status overlay for the workflow graph view (WORKFLOW_GRAPH_PLAN.md
 * §6.3) — the pieces `WorkflowGraphBody` composes when the editor hands
 * it the active environment's run row:
 *
 *   - `GraphRunSummary` — one non-scrolling row above the canvas with
 *     the whole-run state: status dot (`classifyRun`), last/expiry
 *     schedule, circuit pill (shared with the form strip), last error,
 *     definitional-staleness badge. Same helpers as the form strip so
 *     both surfaces speak one vocabulary.
 *   - `StepRunDot` — the per-node state dot (`classifyStepRun`
 *     vocabulary). When the step has captured values, clicking opens a
 *     masked-by-default value popover (capture sets can hold tokens;
 *     reveal is an explicit eye toggle, matching the LV editor idiom).
 *
 * Everything here derives at render time from the cache row — the
 * overlay holds no state beyond the popover's reveal toggle, and it
 * never touches the draft.
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { RefreshPolicy } from '@openheaders/core/types';
import { Button, Popover, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import {
  classifyRun,
  describeRunSchedule,
  describeStepRun,
  maskValue,
  statusColor,
  type StepRunState,
  stepRunLevel,
} from './live-display';
import { CircuitInlineStatus } from './WorkflowRunStatusStrip';

const { Text } = Typography;

// ── Whole-run summary row ──────────────────────────────────────────

interface GraphRunSummaryProps {
  /** Active env's run row — `null` when the env has never run. */
  run: LiveWorkflowRunSnapshot | null;
  refresh: RefreshPolicy;
}

export const GraphRunSummary: React.FC<GraphRunSummaryProps> = ({ run, refresh }) => {
  const { token } = theme.useToken();
  const level = classifyRun(run);
  return (
    <div
      data-testid="wf-graph-run-summary"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '5px 12px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillAlter,
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: statusColor(level),
          flexShrink: 0,
        }}
      />
      {run ? (
        <>
          {describeRunSchedule(run, refresh).map((chunk) => (
            <Text key={chunk.text} type={chunk.tone} style={{ fontSize: 11 }}>
              {chunk.text}
            </Text>
          ))}
          <CircuitInlineStatus run={run} />
          {run.lastErrorMessage && (
            <Text type="danger" style={{ fontSize: 11 }}>
              {`· ${run.lastErrorMessage}${run.lastErrorStepId ? ` (${run.lastErrorStepId})` : ''}`}
            </Text>
          )}
          {run.definitionallyStale === true && (
            <Tooltip title="The workflow or an input it resolves changed since this value was extracted — run Refresh to re-extract.">
              <Text type="warning" style={{ fontSize: 11 }}>
                · needs re-run
              </Text>
            </Tooltip>
          )}
        </>
      ) : (
        <Text type="warning" style={{ fontSize: 11 }}>
          never run for this env — click Refresh to populate
        </Text>
      )}
    </div>
  );
};

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
