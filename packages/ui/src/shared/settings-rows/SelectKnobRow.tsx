/**
 * Compact picklist-knob row: same `label · (i) · control` geometry as
 * the switch row, with a clearable Select. An empty select means "no
 * explicit value" — the placeholder states the runtime default so the
 * empty state is never ambiguous. `warning` renders under the row
 * while the selected value is a risky one (the caller decides).
 */

import { ConfigProvider, Select, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CONTROL_WIDTH } from './constants';
import ModifiedDot from './ModifiedDot';
import { ResetSlot, RowReset } from './RowReset';

const { Text } = Typography;

const SelectKnobRow: React.FC<{
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  info: InfoPopoverContent;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  warning?: string;
  /** Off for always-set knobs (a cleared field would be meaningless). */
  allowClear?: boolean;
  /** Type-to-filter by option label — for open-ended lists (vault
   *  entries), not fixed mode picklists. */
  searchable?: boolean;
  /** Custom empty state, e.g. naming where the options come from. */
  notFoundContent?: React.ReactNode;
  /** Sticky row under the option list, e.g. a manage-source action.
   *  Receives a closer — a footer click is not a selection, so the
   *  popup must be dismissed explicitly before navigating away. */
  popupFooter?: (close: () => void) => React.ReactNode;
  testId?: string;
  modified?: boolean;
  unsaved?: boolean;
  /** Row undo; defaults to clearing the value back to undefined. */
  onReset?: () => void;
}> = ({
  label,
  value,
  onChange,
  info,
  options,
  placeholder,
  warning,
  allowClear = true,
  searchable = false,
  notFoundContent,
  popupFooter,
  testId,
  modified,
  unsaved,
  onReset,
}) => {
  // Controlled only when a footer needs to dismiss the popup itself;
  // motion off so the navigate-away dismissal is instant, no leave
  // transition lingering over the surface it navigated to.
  const [open, setOpen] = useState(false);
  const select = (
    <Select
      size="small"
      aria-label={label}
      data-testid={testId}
      value={value}
      onChange={(v) => onChange(v)}
      options={options}
      allowClear={allowClear}
      showSearch={searchable}
      optionFilterProp="label"
      placeholder={placeholder}
      popupMatchSelectWidth={false}
      notFoundContent={notFoundContent}
      open={popupFooter !== undefined ? open : undefined}
      onOpenChange={popupFooter !== undefined ? setOpen : undefined}
      popupRender={
        popupFooter !== undefined
          ? (menu) => (
              <>
                {menu}
                {popupFooter(() => setOpen(false))}
              </>
            )
          : undefined
      }
      style={{ width: CONTROL_WIDTH }}
    />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        <InfoTrigger content={info} />
        {(unsaved === true || (modified ?? value !== undefined)) && <ModifiedDot unsaved={unsaved} />}
        <span style={{ flex: 1 }} />
        {popupFooter !== undefined ? (
          <ConfigProvider theme={{ token: { motion: false } }}>{select}</ConfigProvider>
        ) : (
          select
        )}
        <ResetSlot>
          {(modified ?? value !== undefined) && (
            <RowReset label={label} onReset={onReset ?? (() => onChange(undefined))} />
          )}
        </ResetSlot>
      </div>
      {warning !== undefined && (
        <Text type="warning" style={{ fontSize: 11, marginBottom: 4 }}>
          {warning}
        </Text>
      )}
    </div>
  );
};

export default SelectKnobRow;
