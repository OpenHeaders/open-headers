/**
 * WorkflowStepEditor — draft-level editor for a single `V5.WorkflowStep`.
 *
 * Used inside `LiveWorkflowEditor` (once per step) and inline in the
 * single-request path of `LiveVariableEditor`. The step-id chip is
 * editable because `{{step.<id>.<capture>}}` references are stable
 * identifiers users might reference from later steps.
 */

import { DeleteOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Input, Select, Space, Typography, theme } from 'antd';
import type React from 'react';
import ExtractorEditor, { defaultExtractorFor } from './ExtractorEditor';

const { Text } = Typography;

interface Props {
  step: V5.WorkflowStep;
  index: number;
  totalSteps: number;
  availableRequests: { uid: string; name: string; method: string }[];
  onChange: (next: V5.WorkflowStep) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** Disable the step id input if it would break existing step references. */
  lockStepId?: boolean;
}

const WorkflowStepEditor: React.FC<Props> = ({
  step,
  index,
  totalSteps,
  availableRequests,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  lockStepId,
}) => {
  const { token } = theme.useToken();

  const addCapture = () => {
    const nextCaptures: V5.Capture[] = [
      ...step.captures,
      {
        name: `capture${step.captures.length + 1}`,
        extractor: defaultExtractorFor('json-path'),
      },
    ];
    onChange({ ...step, captures: nextCaptures });
  };

  const updateCapture = (idx: number, next: V5.Capture) => {
    const nextCaptures = step.captures.slice();
    nextCaptures[idx] = next;
    onChange({ ...step, captures: nextCaptures });
  };

  const removeCapture = (idx: number) => {
    onChange({ ...step, captures: step.captures.filter((_, i) => i !== idx) });
  };

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 12 }}>
          Step {index + 1}
        </Text>
        <Input
          size="small"
          style={{ width: 160 }}
          prefix={<Text type="secondary">id</Text>}
          value={step.id}
          disabled={lockStepId}
          onChange={(e) => onChange({ ...step, id: e.target.value })}
        />
        <div style={{ flex: 1 }} />
        {onMoveUp && (
          <Button size="small" type="text" icon={<UpOutlined />} disabled={index === 0} onClick={onMoveUp} />
        )}
        {onMoveDown && (
          <Button
            size="small"
            type="text"
            icon={<DownOutlined />}
            disabled={index === totalSteps - 1}
            onClick={onMoveDown}
          />
        )}
        {onRemove && (
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={totalSteps <= 1}
            onClick={onRemove}
          />
        )}
      </div>

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            REQUEST
          </Text>
          <Select
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
            placeholder="Select a request"
            value={step.requestUid || undefined}
            onChange={(uid) => onChange({ ...step, requestUid: uid })}
            options={availableRequests.map((r) => ({
              value: r.uid,
              label: `${r.method} ${r.name}`,
            }))}
          />
        </div>

        <div>
          <Input.TextArea
            placeholder="Optional step description"
            autoSize={{ minRows: 1, maxRows: 3 }}
            value={step.description ?? ''}
            onChange={(e) => onChange({ ...step, description: e.target.value || undefined })}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              CAPTURES ({step.captures.length})
            </Text>
            <Button size="small" onClick={addCapture}>
              + Capture
            </Button>
          </div>
          {step.captures.length === 0 && (
            <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
              At least one capture is required before an LV can bind to this step.
            </Text>
          )}
          {step.captures.map((c, idx) => (
            <div
              // Key on capture name + idx — capture names are local to
              // the step and the combination is stable enough for this
              // short-lived list.
              key={`${c.name}-${idx}`}
              style={{
                border: `1px dashed ${token.colorBorderSecondary}`,
                borderRadius: 4,
                padding: 8,
                marginBottom: 6,
              }}
            >
              <Space wrap size={6} style={{ width: '100%', marginBottom: 6 }}>
                <Input
                  size="small"
                  style={{ width: 200 }}
                  prefix={<Text type="secondary">name</Text>}
                  value={c.name}
                  onChange={(e) => updateCapture(idx, { ...c, name: e.target.value })}
                />
                <div style={{ flex: 1 }} />
                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeCapture(idx)} />
              </Space>
              <ExtractorEditor
                compact
                value={c.extractor}
                onChange={(extractor) => updateCapture(idx, { ...c, extractor })}
              />
            </div>
          ))}
        </div>
      </Space>
    </div>
  );
};

export default WorkflowStepEditor;
