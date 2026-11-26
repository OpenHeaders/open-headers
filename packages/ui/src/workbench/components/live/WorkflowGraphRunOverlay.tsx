/**
 * A graph node's run mark (the workflows redesign, Step states) —
 * `StepRunMark`, the state glyph `WorkflowGraphNode` wears. Hovered, it
 * says the state in words. Where the cache row holds values the step
 * captured, a click opens them masked by default (capture sets can hold
 * tokens; reveal is an explicit eye toggle, matching the LV editor
 * idiom).
 *
 * The mark is derived by the graph at render time; this holds no state
 * beyond the popover's reveal toggle, and it never touches the draft.
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Popover, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { maskValue } from './live-display';
import StepGlyph from './StepGlyph';
import type { StepMark } from './step-mark';

const { Text } = Typography;

const NODE_GLYPH_SIZE = 16;

interface StepRunMarkProps {
  stepId: string;
  mark: StepMark;
  /** Captured values for this step from the cache row (may be a prior run's, when skipped). */
  captures?: Record<string, string>;
  /** Response body byte count for this step — observability garnish. */
  responseBytes?: number;
}

export const StepRunMark: React.FC<StepRunMarkProps> = ({ stepId, mark, captures, responseBytes }) => {
  // Suppress the hover tooltip while the click-opened capture popover
  // shows — the pointer stays on the glyph after the click, so the
  // tooltip would otherwise linger over the popover.
  const [capturesOpen, setCapturesOpen] = useState(false);
  const captureEntries = captures ? Object.entries(captures) : [];
  const hasValues = captureEntries.length > 0;

  const glyph = (
    <span
      data-testid={`wf-graph-run-${stepId}`}
      data-run-state={mark.kind}
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', flex: 'none', cursor: hasValues ? 'pointer' : 'default' }}
    >
      <StepGlyph kind={mark.kind} label={mark.label} size={NODE_GLYPH_SIZE} />
    </span>
  );

  if (!hasValues) {
    const hint = mark.detail !== undefined ? `${mark.label}: ${mark.detail}` : mark.label;
    return <Tooltip title={hint}>{glyph}</Tooltip>;
  }
  return (
    <Popover
      trigger="click"
      onOpenChange={setCapturesOpen}
      content={
        <StepCapturePopover
          stepId={stepId}
          mark={mark}
          captureEntries={captureEntries}
          responseBytes={responseBytes}
        />
      }
    >
      <Tooltip title={mark.label} open={capturesOpen ? false : undefined}>
        {glyph}
      </Tooltip>
    </Popover>
  );
};

interface StepCapturePopoverProps {
  stepId: string;
  mark: StepMark;
  captureEntries: [string, string][];
  responseBytes?: number;
}

const StepCapturePopover: React.FC<StepCapturePopoverProps> = ({ stepId, mark, captureEntries, responseBytes }) => {
  const { token } = theme.useToken();
  const t = useT();
  // Masked by default — capture sets can hold access tokens. One
  // explicit toggle per popover, matching the LV editor's reveal idiom.
  const [reveal, setReveal] = useState(false);
  return (
    <div data-testid={`wf-graph-run-pop-${stepId}`} style={{ maxWidth: 360, fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
          {mark.label}
        </Text>
        <Button
          size="small"
          type="text"
          data-testid={`wf-graph-reveal-${stepId}`}
          icon={reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => setReveal((r) => !r)}
        />
      </div>
      {mark.kind === 'skipped' && (
        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic', display: 'block', marginBottom: 4 }}>
          {t('workbench.editors.live.runOverlay.valuesPreserved')}
        </Text>
      )}
      {mark.detail !== undefined && (
        <Text
          type={mark.kind === 'failed' || mark.kind === 'timed-out' ? 'danger' : 'secondary'}
          style={{ fontSize: 11, display: 'block', marginBottom: 4 }}
        >
          {mark.detail}
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
            {reveal ? value : maskValue(value, t)}
          </Text>
        </div>
      ))}
      {responseBytes !== undefined && (
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
          {t('workbench.editors.live.runOverlay.responseBytes', { bytes: responseBytes })}
        </Text>
      )}
    </div>
  );
};
