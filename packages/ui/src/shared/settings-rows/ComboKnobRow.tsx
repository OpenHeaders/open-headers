/**
 * Compact numeric-knob row: same `label · (i) · control` geometry as
 * the switch row, with a ComboKnob (curated presets + interpreted
 * free entry) instead of a switch. An empty field means "no explicit
 * value" — the placeholder states the effective behavior ("No limit",
 * the default cap) so the empty state is never ambiguous.
 */

import { Typography } from 'antd';
import type React from 'react';
import { ComboKnob, type ComboKnobOption } from '@openheaders/ui/shared/combo-knob';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CONTROL_WIDTH } from './constants';
import ModifiedDot from './ModifiedDot';
import { ResetSlot, RowReset } from './RowReset';

const { Text } = Typography;

const ComboKnobRow: React.FC<{
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  info: InfoPopoverContent;
  presets: ReadonlyArray<ComboKnobOption<number>>;
  interpret: (input: string) => ComboKnobOption<number>[];
  format: (value: number) => string;
  placeholder: string;
  disabled?: boolean;
  unsaved?: boolean;
  /** A line under the row naming where the effective value comes from
   *  (an inherited setting's source). */
  note?: React.ReactNode;
  testId?: string;
}> = ({ label, value, onChange, info, presets, interpret, format, placeholder, disabled, unsaved, note, testId }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <InfoTrigger content={info} />
      {(unsaved === true || value !== undefined) && <ModifiedDot unsaved={unsaved} />}
      <span style={{ flex: 1 }} />
      <ComboKnob
        value={value}
        onChange={onChange}
        presets={presets}
        interpret={interpret}
        format={format}
        placeholder={placeholder}
        disabled={disabled}
        ariaLabel={label}
        testId={testId}
        style={{ width: CONTROL_WIDTH }}
      />
      <ResetSlot>
        {value !== undefined && disabled !== true && <RowReset label={label} onReset={() => onChange(undefined)} />}
      </ResetSlot>
    </div>
    {note}
  </div>
);

export default ComboKnobRow;
