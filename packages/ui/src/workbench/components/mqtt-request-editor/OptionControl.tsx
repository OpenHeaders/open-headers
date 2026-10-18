/**
 * OptionControl — control cell of an options-popover grid: the knob's
 * control followed by the Settings rows' reset slot (`ResetSlot`,
 * always laid out so the column's edge never shifts), the per-row undo
 * (`RowReset`) inside it while the knob is off its default and
 * editable — the fixed knobs only; a user-property row is its own
 * remove button. Shared by the topic-options and message-properties
 * popovers, `OptionLabel`'s twin.
 */

import { ResetSlot, RowReset } from '@openheaders/ui/shared/settings-rows';
import type React from 'react';

const OptionControl: React.FC<{
  /** The row's label — the reset's tooltip names it. */
  label: string;
  modified: boolean;
  disabled?: boolean;
  onReset: () => void;
  children: React.ReactNode;
}> = ({ label, modified, disabled, onReset, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {children}
    <ResetSlot>{modified && disabled !== true && <RowReset label={label} onReset={onReset} />}</ResetSlot>
  </span>
);

export default OptionControl;
