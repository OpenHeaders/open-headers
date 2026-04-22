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

/**
 * User-facing refresh-policy kinds. `expires-in` and `expires-at` look
 * similar but drive different math — one reads a RELATIVE duration
 * (seconds until expiry, like OAuth's `expires_in`), the other reads
 * an ABSOLUTE timestamp (epoch milliseconds, like a JWT `exp` claim).
 * Labels make the distinction explicit so users pick correctly; the
 * trailing helper text under the row reiterates with an example.
 */
const KIND_OPTIONS: { value: V5.RefreshPolicy['kind']; label: string }[] = [
  { value: 'manual', label: 'Manual only' },
  { value: 'interval', label: 'Fixed interval' },
  { value: 'expires-in', label: 'Expires in N seconds (relative)' },
  { value: 'expires-at', label: 'Expires at epoch ms (absolute)' },
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
          size="small"
          disabled={disabled}
          style={{ width: 220 }}
          value={value.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => onChange(defaultPolicyFor(kind as V5.RefreshPolicy['kind'], availableCaptures))}
        />
        {value.kind === 'interval' && (
          <InputNumber
            size="small"
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
              size="small"
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
              size="small"
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
      {value.kind === 'expires-in' && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          Capture value = seconds until expiry (e.g. OAuth{' '}
          <code style={{ fontSize: 10 }}>{'{"expires_in": 3600}'}</code>). Refresh fires `lead` seconds before{' '}
          <code style={{ fontSize: 10 }}>run_time + captured_seconds</code>.
        </Text>
      )}
      {value.kind === 'expires-at' && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          Capture value = absolute unix epoch in <strong>milliseconds</strong> (e.g.{' '}
          <code style={{ fontSize: 10 }}>1745312000000</code>). Refresh fires `lead` seconds before that moment.
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
