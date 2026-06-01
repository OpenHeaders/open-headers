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
  /**
   * Override the store-derived "modified from default" signal. Staged
   * fields (the connection-draft editors) pass their own draft-vs-persisted
   * dirty flag so the dot means "edited, not yet applied" instead.
   */
  modified?: boolean;
  /** Override the reset handler. Pairs with `modified` for staged fields,
   *  where reset discards the pending edit rather than resetting to default. */
  onReset?: () => void;
  /** Reset-button tooltip. Defaults to the reset-to-default meaning. */
  resetTooltip?: string;
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
  modified: modifiedOverride,
  onReset,
  resetTooltip = 'Reset to default',
}) => {
  const { token } = theme.useToken();
  const storeModified = useIsModified(settingKey);
  const storeReset = useResetSetting(settingKey);
  const modified = modifiedOverride ?? storeModified;
  const reset = onReset ?? storeReset;
  const { isConnected } = useSettingsConnection();
  const gated = requiresConnection === true && !isConnected;

  return (
    <div
      className="settings-field-row"
      data-setting-key={settingKey}
      style={{
        // Flex-wrap rather than a fixed two-column grid so narrow
        // viewports (split-screen windows, the popup-inside-popup case)
        // collapse to a stacked label-above-control layout instead of
        // forcing the label column to break individual words across lines.
        // Once both children have room for their `flex-basis`, they sit
        // side-by-side; below that threshold they wrap.
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: block ? 'column' : 'row',
        alignItems: 'flex-start',
        columnGap: 16,
        rowGap: 12,
        padding: '14px 0',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ flex: block ? '1 1 100%' : '1 1 280px', minWidth: 0 }}>
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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          minWidth: 0,
          // Stacked layout (block prop) and the narrow-wrap fallback
          // both want the control to span the full row; in the
          // side-by-side case it stays bounded by its flex-basis.
          flex: block ? '1 1 100%' : '1 1 260px',
        }}
      >
        {/* `isolation: isolate` makes this control its own stacking
            context so antd's focus/hover input z-index (Space.Compact
            bumps the active segment to z-index 2) can't escape the row
            and paint over the sticky ApplyBar below. */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', isolation: 'isolate' }}>
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
          <Tooltip title={resetTooltip}>
            <Button size="small" type="text" icon={<UndoOutlined />} onClick={reset} />
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default FieldRow;
