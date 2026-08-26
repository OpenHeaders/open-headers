/**
 * Compact list-knob row: same `label · (i) · control` geometry as the
 * text row, with a free-entry tag field (Enter, comma or space commits
 * a token; no dropdown — there is no option list to pick from). An
 * empty list means "no explicit value" — the placeholder states the
 * effective default. `example` renders under the row as a muted
 * format sample aligned under the control column.
 */

import { Select, Typography } from 'antd';
import type React from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CONTROL_RIGHT_INSET, CONTROL_WIDTH } from './constants';
import ModifiedDot from './ModifiedDot';
import { ResetSlot, RowReset } from './RowReset';

const { Text } = Typography;

const TagsKnobRow: React.FC<{
  label: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
  info: InfoPopoverContent;
  placeholder: string;
  example?: string;
  testId?: string;
  unsaved?: boolean;
  /** Row undo; defaults to clearing the list. */
  onReset?: () => void;
}> = ({ label, value, onChange, info, placeholder, example, testId, unsaved, onReset }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
      <InfoTrigger content={info} />
      {(unsaved === true || value.length > 0) && <ModifiedDot unsaved={unsaved} />}
      <span style={{ flex: 1 }} />
      <Select
        mode="tags"
        size="small"
        aria-label={label}
        data-testid={testId}
        value={[...value]}
        onChange={(next: string[]) => onChange(next)}
        placeholder={placeholder}
        open={false}
        suffixIcon={null}
        tokenSeparators={[',', ' ']}
        style={{ width: CONTROL_WIDTH }}
      />
      <ResetSlot>{value.length > 0 && <RowReset label={label} onReset={onReset ?? (() => onChange([]))} />}</ResetSlot>
    </div>
    {example !== undefined && (
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

export default TagsKnobRow;
