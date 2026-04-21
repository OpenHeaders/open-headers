/**
 * RefreshPolicyEditor — inline picker for a workflow's refresh cadence.
 *
 * Supports all four RefreshPolicy kinds. `expires-in` / `expires-at`
 * dropdowns resolve against the workflow's steps + captures so the user
 * picks a real source rather than typing stepId/captureName strings.
 */

import type { V5 } from '@openheaders/core/types';
import { InputNumber, Select, Space, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

const KIND_OPTIONS: { value: V5.RefreshPolicy['kind']; label: string }[] = [
  { value: 'manual', label: 'Manual only' },
  { value: 'interval', label: 'Fixed interval' },
  { value: 'expires-in', label: 'Expires in (from capture)' },
  { value: 'expires-at', label: 'Expires at (from capture)' },
];

interface CaptureTarget {
  stepId: string;
  captureName: string;
  label: string;
}

interface Props {
  value: V5.RefreshPolicy;
  onChange: (next: V5.RefreshPolicy) => void;
  availableCaptures: CaptureTarget[];
  disabled?: boolean;
}

export function defaultPolicyFor(kind: V5.RefreshPolicy['kind'], captures: CaptureTarget[]): V5.RefreshPolicy {
  switch (kind) {
    case 'interval':
      return { kind: 'interval', seconds: 300 };
    case 'expires-in':
      return {
        kind: 'expires-in',
        stepId: captures[0]?.stepId ?? '',
        captureName: captures[0]?.captureName ?? '',
        leadSeconds: 30,
      };
    case 'expires-at':
      return {
        kind: 'expires-at',
        stepId: captures[0]?.stepId ?? '',
        captureName: captures[0]?.captureName ?? '',
        leadSeconds: 30,
      };
    case 'manual':
      return { kind: 'manual' };
  }
}

const RefreshPolicyEditor: React.FC<Props> = ({ value, onChange, availableCaptures, disabled }) => {
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space wrap size={6}>
        <Select
          disabled={disabled}
          style={{ width: 220 }}
          value={value.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => onChange(defaultPolicyFor(kind as V5.RefreshPolicy['kind'], availableCaptures))}
        />
        {value.kind === 'interval' && (
          <InputNumber
            disabled={disabled}
            min={30}
            max={86400}
            step={30}
            addonAfter="seconds"
            value={value.seconds}
            onChange={(seconds) =>
              onChange({
                kind: 'interval',
                seconds: typeof seconds === 'number' ? Math.max(30, seconds) : 30,
              })
            }
            style={{ width: 180 }}
          />
        )}
        {(value.kind === 'expires-in' || value.kind === 'expires-at') && (
          <>
            <Select
              disabled={disabled}
              placeholder="Select capture"
              style={{ width: 260 }}
              value={value.stepId && value.captureName ? `${value.stepId}::${value.captureName}` : undefined}
              options={availableCaptures.map((c) => ({
                value: `${c.stepId}::${c.captureName}`,
                label: c.label,
              }))}
              onChange={(key) => {
                const [stepId, captureName] = (key as string).split('::');
                if (value.kind === 'expires-in') {
                  onChange({ kind: 'expires-in', stepId, captureName, leadSeconds: value.leadSeconds });
                } else {
                  onChange({ kind: 'expires-at', stepId, captureName, leadSeconds: value.leadSeconds });
                }
              }}
              notFoundContent={<Text type="secondary">No captures defined yet.</Text>}
            />
            <InputNumber
              disabled={disabled}
              min={0}
              addonAfter="lead s"
              value={value.leadSeconds}
              onChange={(lead) => {
                const leadSeconds = typeof lead === 'number' ? Math.max(0, lead) : 0;
                if (value.kind === 'expires-in') {
                  onChange({ kind: 'expires-in', stepId: value.stepId, captureName: value.captureName, leadSeconds });
                } else {
                  onChange({ kind: 'expires-at', stepId: value.stepId, captureName: value.captureName, leadSeconds });
                }
              }}
              style={{ width: 140 }}
            />
          </>
        )}
      </Space>
      {value.kind === 'interval' && value.seconds < 60 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          Sub-minute intervals hit the MV3 alarm floor and burn quota fast. Use only when necessary.
        </Text>
      )}
      {(value.kind === 'expires-in' || value.kind === 'expires-at') && availableCaptures.length === 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          Add a capture to the workflow first so expiry math has a source.
        </Text>
      )}
    </Space>
  );
};

export default RefreshPolicyEditor;
