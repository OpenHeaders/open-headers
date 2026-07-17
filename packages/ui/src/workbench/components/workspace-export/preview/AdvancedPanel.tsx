/**
 * Advanced overrides — third column inside the diff workspace.
 * Replaces the old slide-over drawer + the inline collapse. Shown
 * alongside the diff pane so toggles can be flipped while watching the
 * sidebar's `+a / -r` chips and the right pane update in real time.
 *
 * Header carries a close glyph; bottom of the panel scrolls when the
 * toggle list runs long.
 */

import { CloseOutlined } from '@ant-design/icons';
import { Checkbox, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ImportTargetSelection } from './TargetControl';

const { Text } = Typography;

export interface AdvancedTogglesListProps {
  backupRestore: boolean;
  onBackupRestoreChange: (next: boolean) => void;
  trustExport: boolean;
  onTrustExportChange: (next: boolean) => void;
  stripScripts: boolean;
  onStripScriptsChange: (next: boolean) => void;
  omitOAuthConfigs: boolean;
  onOmitOAuthConfigsChange: (next: boolean) => void;
  keepTargetCollectionOrder: boolean;
  onKeepTargetCollectionOrderChange: (next: boolean) => void;
  includeWorkspaceSettings: boolean;
  onIncludeWorkspaceSettingsChange: (next: boolean) => void;
  refuseUidCollision: boolean;
  onRefuseUidCollisionChange: (next: boolean) => void;
  targetMode: ImportTargetSelection['mode'];
}

/** Bare toggle list — same content as AdvancedPanel's body, no chrome.
 *  Hosts that already provide their own header / surface (drawers,
 *  popovers) embed this directly. */
export const AdvancedTogglesList: React.FC<AdvancedTogglesListProps> = ({
  backupRestore,
  onBackupRestoreChange,
  trustExport,
  onTrustExportChange,
  stripScripts,
  onStripScriptsChange,
  omitOAuthConfigs,
  onOmitOAuthConfigsChange,
  keepTargetCollectionOrder,
  onKeepTargetCollectionOrderChange,
  includeWorkspaceSettings,
  onIncludeWorkspaceSettingsChange,
  refuseUidCollision,
  onRefuseUidCollisionChange,
  targetMode,
}) => {
  const t = useT();
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Toggle
        checked={backupRestore}
        onChange={onBackupRestoreChange}
        label={t('workbench.importExport.advanced.backupRestoreLabel')}
        help={t('workbench.importExport.advanced.backupRestoreHelp')}
      />
      <Toggle
        checked={trustExport}
        onChange={onTrustExportChange}
        label={t('workbench.importExport.advanced.trustExportLabel')}
        help={t('workbench.importExport.advanced.trustExportHelp')}
      />
      <Toggle
        checked={stripScripts}
        onChange={onStripScriptsChange}
        label={t('workbench.importExport.advanced.stripScriptsLabel')}
        help={t('workbench.importExport.advanced.stripScriptsHelp')}
      />
      <Toggle
        checked={omitOAuthConfigs}
        onChange={onOmitOAuthConfigsChange}
        label={t('workbench.importExport.advanced.omitOAuthLabel')}
        help={t('workbench.importExport.advanced.omitOAuthHelp')}
      />
      <Toggle
        checked={keepTargetCollectionOrder}
        onChange={onKeepTargetCollectionOrderChange}
        label={t('workbench.importExport.advanced.keepOrderLabel')}
        help={t('workbench.importExport.advanced.keepOrderHelp')}
      />
      <Toggle
        checked={includeWorkspaceSettings}
        onChange={onIncludeWorkspaceSettingsChange}
        disabled
        label={t('workbench.importExport.advanced.workspaceSettingsLabel')}
        help={t('workbench.importExport.advanced.workspaceSettingsHelp')}
      />
      {targetMode === 'new' && (
        <Toggle
          checked={refuseUidCollision}
          onChange={onRefuseUidCollisionChange}
          label={t('workbench.importExport.advanced.refuseUidCollisionLabel')}
          help={t('workbench.importExport.advanced.refuseUidCollisionHelp')}
        />
      )}
    </Space>
  );
};

export interface AdvancedPanelProps extends AdvancedTogglesListProps {
  open: boolean;
  onToggle: () => void;
  /** Active-toggle count surfaced on the trigger button — informational. */
  activeCount: number;
}

const AdvancedPanel: React.FC<AdvancedPanelProps> = ({
  onToggle,
  backupRestore,
  onBackupRestoreChange,
  trustExport,
  onTrustExportChange,
  stripScripts,
  onStripScriptsChange,
  omitOAuthConfigs,
  onOmitOAuthConfigsChange,
  keepTargetCollectionOrder,
  onKeepTargetCollectionOrderChange,
  includeWorkspaceSettings,
  onIncludeWorkspaceSettingsChange,
  refuseUidCollision,
  onRefuseUidCollisionChange,
  targetMode,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          {t('workbench.importExport.advanced.title')}
        </Text>
        <button
          type="button"
          onClick={onToggle}
          aria-label={t('workbench.importExport.advanced.closeAria')}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: token.colorTextSecondary,
            padding: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CloseOutlined style={{ fontSize: 12 }} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'none', padding: 12 }}>
        <AdvancedTogglesList
          backupRestore={backupRestore}
          onBackupRestoreChange={onBackupRestoreChange}
          trustExport={trustExport}
          onTrustExportChange={onTrustExportChange}
          stripScripts={stripScripts}
          onStripScriptsChange={onStripScriptsChange}
          omitOAuthConfigs={omitOAuthConfigs}
          onOmitOAuthConfigsChange={onOmitOAuthConfigsChange}
          keepTargetCollectionOrder={keepTargetCollectionOrder}
          onKeepTargetCollectionOrderChange={onKeepTargetCollectionOrderChange}
          includeWorkspaceSettings={includeWorkspaceSettings}
          onIncludeWorkspaceSettingsChange={onIncludeWorkspaceSettingsChange}
          refuseUidCollision={refuseUidCollision}
          onRefuseUidCollisionChange={onRefuseUidCollisionChange}
          targetMode={targetMode}
        />
      </div>
    </div>
  );
};

export default AdvancedPanel;

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, help, disabled }) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 6,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled}>
        <Text strong style={{ fontSize: 12 }}>
          {label}
        </Text>
      </Checkbox>
      <div style={{ marginTop: 4, marginLeft: 24, fontSize: 11 }}>
        <Text type="secondary">{help}</Text>
      </div>
    </div>
  );
};
