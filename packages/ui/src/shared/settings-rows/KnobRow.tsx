/**
 * Compact wired-knob row: label + (i) left-aligned, the switch
 * right-aligned with Enabled/Disabled state text inside the track.
 * `warning` renders under the row while the knob sits in its risky
 * position — off by default (verification-style knobs), the checked
 * state when `warningWhenChecked` (opt-in trust-relaxing knobs) — so
 * the risk is stated in place, not only behind the popover.
 */

import { Switch, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import ModifiedDot from './ModifiedDot';
import { ResetSlot, RowReset } from './RowReset';

const { Text } = Typography;

const KnobRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  info: InfoPopoverContent;
  warning?: string;
  warningWhenChecked?: boolean;
  modified?: boolean;
  unsaved?: boolean;
  onReset?: () => void;
  testId?: string;
}> = ({ label, checked, onChange, info, warning, warningWhenChecked, modified, unsaved, onReset, testId }) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="rules-settings-row" style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        <InfoTrigger content={info} />
        {(unsaved === true || modified === true) && <ModifiedDot unsaved={unsaved} />}
        <span style={{ flex: 1 }} />
        <Switch
          size="small"
          aria-label={label}
          data-testid={testId}
          checked={checked}
          onChange={onChange}
          checkedChildren={t('shared.settingsRows.enabled')}
          unCheckedChildren={t('shared.settingsRows.disabled')}
        />
        <ResetSlot>
          {modified === true && onReset !== undefined && <RowReset label={label} onReset={onReset} />}
        </ResetSlot>
      </div>
      {checked === (warningWhenChecked ?? false) && warning !== undefined && (
        <Text type="warning" style={{ fontSize: 11, marginBottom: 4 }}>
          {warning}
        </Text>
      )}
    </div>
  );
};

export default KnobRow;
