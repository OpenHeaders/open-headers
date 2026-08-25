/**
 * Per-row undo shown while a row's knob is off its default — the app
 * Settings page's FieldRow reset idiom, so one experiment can be
 * undone in place. `ResetSlot` is the fixed-width slot to the right of
 * every field control that holds it: always rendered, so the control
 * column's edges stay straight whether or not a row is modified.
 */

import { UndoOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export const RowReset: React.FC<{ label: string; onReset: () => void }> = ({ label, onReset }) => {
  const t = useT();
  const title = t('shared.settingsRows.reset', { label });
  return (
    <Tooltip title={title}>
      <Button
        size="small"
        type="text"
        aria-label={title}
        icon={<UndoOutlined style={{ fontSize: 11 }} />}
        onClick={onReset}
        style={{ width: 20, height: 20, minWidth: 20 }}
      />
    </Tooltip>
  );
};

export const ResetSlot: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <span
    style={{ width: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
  >
    {children}
  </span>
);
