/**
 * FieldRow — shared chrome for every setting row.
 *
 * Renders the label, description, modified dot, reset button and slots
 * the concrete control into the right column. Every field component
 * wraps itself in this so the layout stays consistent regardless of
 * which control (Switch, Select, Input, etc.) is inside.
 */

import { DisconnectOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { useSettingsConnection } from '../ConnectionContext';
import { useIsModified, useResetSetting } from '../hooks';
import type { SettingKey } from '../types';

interface FieldRowProps {
  settingKey: SettingKey;
  label: string;
  description: string;
  experimental?: boolean;
  requiresConnection?: boolean;
  children: React.ReactNode;
  /** Hide the reset button for fields that are purely informational. */
  resettable?: boolean;
  /** When true the control spans the full width below the label (good for code editors). */
  block?: boolean;
}

const FieldRow: React.FC<FieldRowProps> = ({
  settingKey,
  label,
  description,
  experimental,
  requiresConnection,
  children,
  resettable = true,
  block = false,
}) => {
  const { token } = theme.useToken();
  const modified = useIsModified(settingKey);
  const reset = useResetSetting(settingKey);
  const { isConnected } = useSettingsConnection();
  const gated = requiresConnection === true && !isConnected;

  return (
    <div
      className="settings-field-row"
      data-setting-key={settingKey}
      style={{
        display: 'grid',
        gridTemplateColumns: block ? '1fr' : 'minmax(0, 1fr) minmax(260px, 360px)',
        gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {modified && (
            <Tooltip title="Modified from default">
              <span
                role="img"
                aria-label="modified"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: token.colorPrimary,
                  flex: 'none',
                }}
              />
            </Tooltip>
          )}
          <span style={{ fontWeight: 500, color: token.colorText }}>{label}</span>
          {experimental && (
            <Tooltip title="Experimental">
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: token.colorWarningBg,
                  color: token.colorWarningText,
                  fontWeight: 500,
                }}
              >
                EXPERIMENTAL
              </span>
            </Tooltip>
          )}
          {requiresConnection && (
            <Tooltip title="Requires a live connection to the Open Headers desktop app. The desktop app stores the authoritative value.">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: gated ? token.colorErrorBg : token.colorInfoBg,
                  color: gated ? token.colorError : token.colorInfo,
                  fontWeight: 500,
                }}
              >
                <DisconnectOutlined style={{ fontSize: 9 }} />
                DESKTOP
              </span>
            </Tooltip>
          )}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: token.colorTextSecondary,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div
            style={{
              opacity: gated ? 0.5 : 1,
              pointerEvents: gated ? 'none' : 'auto',
              transition: 'opacity 120ms ease',
            }}
          >
            {children}
          </div>
          {gated && (
            <Tooltip title="Connect the desktop app to change this setting.">
              <div
                role="img"
                aria-label="Disabled — requires desktop connection"
                style={{
                  position: 'absolute',
                  inset: 0,
                  cursor: 'not-allowed',
                  background: 'transparent',
                }}
              />
            </Tooltip>
          )}
        </div>
        {resettable && modified && (
          <Tooltip title="Reset to default">
            <Button size="small" type="text" icon={<UndoOutlined />} onClick={reset} />
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default FieldRow;
