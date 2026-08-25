/**
 * Compact text-knob row: same `label · (i) · control` geometry as the
 * switch row, with a wider free-text input. Empty means "no explicit
 * value" — the placeholder states the effective default. One line
 * renders under the row at a time, by priority: `error` (also tints
 * the field) while the current text is malformed; `warning` while the
 * value is well-formed but conflicts with another setting; otherwise
 * `example`, a muted format sample ("e.g. …") aligned under the
 * control column.
 */

import { Input, Typography } from 'antd';
import type React from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CONTROL_RIGHT_INSET, CONTROL_WIDTH } from './constants';
import ModifiedDot from './ModifiedDot';
import { ResetSlot, RowReset } from './RowReset';

const { Text } = Typography;

const TextKnobRow: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  info: InfoPopoverContent;
  placeholder: string;
  maxLength: number;
  error?: string;
  warning?: string;
  example?: string;
  testId?: string;
  unsaved?: boolean;
  /** Row undo; defaults to clearing the value back to undefined. */
  onReset?: () => void;
}> = ({ label, value, onChange, info, placeholder, maxLength, error, warning, example, testId, unsaved, onReset }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <InfoTrigger content={info} />
      {(unsaved === true || value !== undefined) && <ModifiedDot unsaved={unsaved} />}
      <span style={{ flex: 1 }} />
      <Input
        size="small"
        aria-label={label}
        data-testid={testId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        status={error !== undefined ? 'error' : undefined}
        style={{ width: CONTROL_WIDTH }}
      />
      <ResetSlot>
        {value !== undefined && <RowReset label={label} onReset={onReset ?? (() => onChange(undefined))} />}
      </ResetSlot>
    </div>
    {error !== undefined && (
      <Text type="danger" style={{ fontSize: 11, marginBottom: 4 }}>
        {error}
      </Text>
    )}
    {error === undefined && warning !== undefined && (
      <Text type="warning" style={{ fontSize: 11, marginBottom: 4 }}>
        {warning}
      </Text>
    )}
    {error === undefined && warning === undefined && example !== undefined && (
      <Text
        type="secondary"
        style={{
          fontSize: 11,
          marginBottom: 4,
          alignSelf: 'flex-end',
          width: CONTROL_WIDTH,
          marginRight: CONTROL_RIGHT_INSET,
          overflowWrap: 'anywhere',
        }}
      >
        {example}
      </Text>
    )}
  </div>
);

export default TextKnobRow;
