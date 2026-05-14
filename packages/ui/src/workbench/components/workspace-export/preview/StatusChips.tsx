/**
 * Compact status chips for the import-preview header — replace the
 * full-width Alert banners that used to push the diff workspace below
 * the fold. Each chip is a 24px pill with an icon + short label;
 * clicking opens a Popover with the full message and any actions.
 *
 * Apple-style posture: minimal chrome, one tone per chip (info / warn
 * / error → blue / amber / red), tabular layout.
 */

import { CloseOutlined, ExclamationCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Popover, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';

export type ChipTone = 'info' | 'warn' | 'error';

export interface StatusChip {
  key: string;
  tone: ChipTone;
  label: string;
  details: React.ReactNode;
  onDismiss?: () => void;
}

interface StatusChipsProps {
  chips: StatusChip[];
}

const StatusChips: React.FC<StatusChipsProps> = ({ chips }) => {
  if (chips.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {chips.map((c) => (
        <Chip key={c.key} chip={c} />
      ))}
    </div>
  );
};

export default StatusChips;

const Chip: React.FC<{ chip: StatusChip }> = ({ chip }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const palette = palettes(chip.tone, token);
  const Icon =
    chip.tone === 'info' ? InfoCircleOutlined : chip.tone === 'warn' ? WarningOutlined : ExclamationCircleOutlined;
  return (
    <Popover
      content={
        <div style={{ maxWidth: 360, fontSize: 12, lineHeight: 1.5 }}>
          {chip.details}
          {chip.onDismiss && (
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => {
                  chip.onDismiss?.();
                  setOpen(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: token.colorTextSecondary,
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      }
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
    >
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          height: 24,
          fontSize: 11,
          fontWeight: 500,
          color: palette.fg,
          background: palette.bg,
          border: `1px solid ${palette.border}`,
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'inherit',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        <Icon style={{ fontSize: 12 }} />
        {chip.label}
        {chip.onDismiss && <CloseOutlined style={{ fontSize: 9, opacity: 0.6, marginLeft: 2 }} />}
      </button>
    </Popover>
  );
};

function palettes(
  tone: ChipTone,
  token: ReturnType<typeof theme.useToken>['token'],
): { fg: string; bg: string; border: string } {
  if (tone === 'warn') return { fg: token.colorWarning, bg: token.colorWarningBg, border: token.colorWarningBorder };
  if (tone === 'error') return { fg: token.colorError, bg: token.colorErrorBg, border: token.colorErrorBorder };
  return { fg: token.colorInfo, bg: token.colorInfoBg, border: token.colorInfoBorder };
}
