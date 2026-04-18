/**
 * WorkspaceIdentityPicker — picks the workspace's single prefix
 * indicator: a tinted TwoTone icon OR a plain color square. Never
 * both.
 *
 * Popover layout:
 *   1. Color swatch row at top — always required; sets the color
 *      used for the square (icon-less) or the icon's two-tone
 *      primary (icon-set).
 *   2. Icon grid below with a leading "None" tile. Selecting None
 *      clears `icon`, collapsing the prefix to a color square.
 *      Selecting any icon sets it and the prefix becomes a tinted
 *      icon.
 *
 * Value shape (`icon?: string; color: string`) mirrors the workspace
 * entity exactly — `icon === undefined` is the color-only state.
 */

import { StopOutlined } from '@ant-design/icons';
import { Popover, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { renderTwoToneIcon, TWO_TONE_ICON_MAP } from './TwoToneIconPicker';
import { resolveWorkspaceColor, resolveWorkspaceIconColor, WORKSPACE_COLOR_KEYS } from './workspace-colors';
import { renderWorkspacePrefix } from './workspace-prefix';

export interface WorkspaceIdentity {
  /** Undefined → color-only; set → tinted icon. */
  icon?: string;
  color: string;
}

interface WorkspaceIdentityPickerProps {
  value?: WorkspaceIdentity;
  /** Ant Design Form injects `onChange` when the component is used as
   *  a `Form.Item` child. */
  onChange?: (next: WorkspaceIdentity) => void;
  /** Trigger size in pixels. Defaults to 32. */
  size?: number;
}

const ALL_ICON_KEYS = Object.keys(TWO_TONE_ICON_MAP);

const WorkspaceIdentityPicker: React.FC<WorkspaceIdentityPickerProps> = ({ value, onChange, size = 32 }) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const currentIcon = value?.icon;
  const currentColor = value?.color ?? 'neutral';
  const currentTwoToneColor = resolveWorkspaceIconColor(currentColor, token);

  const filteredIcons = useMemo(() => {
    if (!search) return ALL_ICON_KEYS;
    const q = search.toLowerCase();
    return ALL_ICON_KEYS.filter((k) => k.toLowerCase().includes(q));
  }, [search]);

  const handlePickColor = (nextColor: string): void => {
    onChange?.({ icon: currentIcon, color: nextColor });
  };

  const handlePickIcon = (nextIcon: string | undefined): void => {
    onChange?.({ icon: nextIcon, color: currentColor });
    setOpen(false);
    setSearch('');
  };

  const popoverContent = (
    <div style={{ width: 288 }}>
      {/* Color swatch row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {WORKSPACE_COLOR_KEYS.map((key) => {
          const selected = currentColor === key;
          return (
            <Tooltip key={key} title={key} placement="top">
              <button
                type="button"
                aria-label={`Color ${key}`}
                onClick={() => handlePickColor(key)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: resolveWorkspaceColor(key, token),
                  border: `1px solid ${selected ? token.colorPrimary : token.colorBorder}`,
                  outline: selected ? `1px solid ${token.colorPrimary}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            </Tooltip>
          );
        })}
      </div>

      {/* Icon search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search icons..."
        style={{
          width: '100%',
          padding: '4px 8px',
          fontSize: 12,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 4,
          marginBottom: 8,
          outline: 'none',
          background: token.colorBgContainer,
          color: token.colorText,
        }}
      />

      {/* Icon grid — every icon rendered in the currently-selected color.
          Leading "None" tile toggles the workspace back to color-only. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 2,
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        <Tooltip title="No icon — show color square only" placement="top">
          <button
            type="button"
            onClick={() => handlePickIcon(undefined)}
            aria-label="No icon"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 4,
              cursor: 'pointer',
              background: !currentIcon ? token.colorPrimaryBg : 'transparent',
              border: !currentIcon ? `1px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
              padding: 0,
            }}
          >
            <StopOutlined style={{ fontSize: 14, color: token.colorTextTertiary }} />
          </button>
        </Tooltip>

        {filteredIcons.map((key) => {
          const isSelected = currentIcon === key;
          return (
            <Tooltip key={key} title={key.replace('TwoTone', '')} placement="top">
              <button
                type="button"
                onClick={() => handlePickIcon(key)}
                aria-label={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isSelected ? token.colorPrimaryBg : 'transparent',
                  border: isSelected ? `1px solid ${token.colorPrimary}` : '1px solid transparent',
                  padding: 0,
                }}
              >
                {renderTwoToneIcon(key, { fontSize: 16 }, currentTwoToneColor)}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      destroyTooltipOnHide
    >
      <button
        type="button"
        aria-label="Choose workspace prefix (color or icon)"
        onClick={() => setOpen(true)}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: `1px solid ${token.colorBorder}`,
          cursor: 'pointer',
          background: token.colorBgContainer,
          padding: 0,
        }}
      >
        {renderWorkspacePrefix({ icon: currentIcon, color: currentColor }, token, { size })}
      </button>
    </Popover>
  );
};

export default WorkspaceIdentityPicker;
