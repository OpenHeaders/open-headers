/**
 * FieldRow — shared chrome for every setting row.
 *
 * Compact single-line form layout: `Label: control` for value fields,
 * control-first for checkbox fields (`labelInControl`), and a stacked
 * label-above-control layout for `block` fields (code editors, tables).
 * The setting description lives behind an `(i)` InfoTrigger popover
 * instead of a paragraph under the label, so a category page reads as
 * a dense scannable form rather than a stack of cards.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import type { Capabilities } from '@openheaders/core/capabilities';
import { DisconnectOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useSettingsConnection } from '../ConnectionContext';
import { useIsModified, useResetSetting } from '../hooks';
import type { SettingKey } from '../types';

interface FieldRowProps {
  /**
   * Registered `SettingKey`, or a registry-backed field id (the
   * connection fields retired from the settings schema by the
   * multi-backend epic). Unregistered ids read as never-modified and
   * their reset is a no-op, so such fields pass their own `modified` /
   * `onReset` overrides.
   */
  settingKey: SettingKey | (string & {});
  label: string;
  description: string;
  experimental?: boolean;
  requiresConnection?: boolean;
  /**
   * Host-capability gate (see `SettingDef.requiresCapability`). On hosts
   * that didn't register the named capability the control is disabled with
   * an explanation, so the row reads as deliberately-unavailable rather
   * than silently inert.
   */
  requiresCapability?: keyof Capabilities;
  /** Explanation shown on the disabled control when the host lacks `requiresCapability`. */
  capabilityUnavailableHint?: string;
  children: React.ReactNode;
  /** Hide the reset button for fields that are purely informational. */
  resettable?: boolean;
  /** When true the control spans the full width below the label (good for code editors). */
  block?: boolean;
  /**
   * The control renders its own label (checkbox fields). FieldRow skips
   * the leading `Label:` and puts the control first.
   */
  labelInControl?: boolean;
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
  requiresCapability,
  capabilityUnavailableHint,
  children,
  resettable = true,
  block = false,
  labelInControl = false,
  modified: modifiedOverride,
  onReset,
  resetTooltip = 'Reset to default',
}) => {
  const { token } = theme.useToken();
  // Unregistered ids are tolerated by the store hooks (never modified,
  // no-op reset) — the same key-narrowing cast `useUntypedSetting` makes.
  const storeModified = useIsModified(settingKey as SettingKey);
  const storeReset = useResetSetting(settingKey as SettingKey);
  const modified = modifiedOverride ?? storeModified;
  const reset = onReset ?? storeReset;
  const { isConnected } = useSettingsConnection();
  const connectionGated = requiresConnection === true && !isConnected;
  const capabilityGated = requiresCapability !== undefined && !hasCapability(requiresCapability);
  const gated = connectionGated || capabilityGated;
  const disabledHint = capabilityGated
    ? (capabilityUnavailableHint ?? 'This browser doesn’t support this setting.')
    : 'Connect the desktop app to change this setting.';

  const modifiedDot = modified && (
    <Tooltip title="Modified from default">
      <span
        role="img"
        aria-label="modified"
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: token.colorPrimary,
          flex: 'none',
        }}
      />
    </Tooltip>
  );

  const info = description ? <InfoTrigger content={{ title: label, summary: description }} ariaLabel={`About ${label}`} /> : null;

  const badges = (
    <>
      {experimental && (
        <Tooltip title="Experimental">
          <span
            style={{
              fontSize: 9,
              padding: '0 5px',
              borderRadius: 8,
              background: token.colorWarningBg,
              color: token.colorWarningText,
              fontWeight: 500,
              flex: 'none',
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
              fontSize: 9,
              padding: '0 5px',
              borderRadius: 8,
              background: gated ? token.colorErrorBg : token.colorInfoBg,
              color: gated ? token.colorError : token.colorInfo,
              fontWeight: 500,
              flex: 'none',
            }}
          >
            <DisconnectOutlined style={{ fontSize: 9 }} />
            DESKTOP
          </span>
        </Tooltip>
      )}
    </>
  );

  const resetButton = resettable && modified && (
    <Tooltip title={resetTooltip}>
      <Button
        size="small"
        type="text"
        icon={<UndoOutlined style={{ fontSize: 11 }} />}
        onClick={reset}
        style={{ width: 20, height: 20, minWidth: 20 }}
      />
    </Tooltip>
  );

  // `isolation: isolate` makes the control its own stacking context so
  // antd's focus/hover input z-index (Space.Compact bumps the active
  // segment to z-index 2) can't escape the row and paint over the
  // sticky ApplyBar below.
  const gatedControl = (
    <div
      style={{
        position: 'relative',
        isolation: 'isolate',
        flex: block ? '1 1 100%' : '0 1 auto',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
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
        <Tooltip title={disabledHint}>
          <div
            role="img"
            aria-label={capabilityGated ? 'Disabled — unavailable on this browser' : 'Disabled — requires desktop connection'}
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
  );

  if (block) {
    return (
      <div className="settings-field-row" data-setting-key={settingKey} style={{ padding: '5px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          {modifiedDot}
          <span style={{ fontSize: 13, color: token.colorText }}>{label}</span>
          {info}
          {badges}
          {resetButton}
        </div>
        {gatedControl}
      </div>
    );
  }

  return (
    <div
      className="settings-field-row"
      data-setting-key={settingKey}
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 6,
        rowGap: 4,
        padding: '3px 0',
        minHeight: 27,
      }}
    >
      {modifiedDot}
      {!labelInControl && (
        <span style={{ fontSize: 13, color: token.colorText, flex: 'none' }}>{label}:</span>
      )}
      {gatedControl}
      {info}
      {badges}
      {resetButton}
    </div>
  );
};

export default FieldRow;
