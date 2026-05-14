/**
 * Advanced overrides — third column inside the diff workspace.
 * Replaces the old slide-over drawer + the inline collapse. Shown
 * alongside the diff pane so toggles can be flipped while watching the
 * sidebar's `+a / -r` chips and the right pane update in real time.
 *
 * Header carries a close glyph; bottom of the panel scrolls when the
 * toggle list runs long.
 *
 * On low-trust sources (URL-fetch / deep-link / playground) the panel
 * shows an explainer instead of toggles — design §5.5 (the override
 * surface stays out of foot-gun reach for non-local sources).
 */

import { CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Checkbox, Space, Typography, theme } from 'antd';
import type React from 'react';
import type { ImportTargetSelection } from './TargetControl';
import type { ImportPreviewSource } from './types';

const { Text } = Typography;

export interface AdvancedTogglesListProps {
  lowTrustSource: boolean;
  source: ImportPreviewSource;
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
  lowTrustSource,
  source,
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
  const sourceLabel = source === 'link' ? 'deep-link' : 'URL-fetch';
  if (lowTrustSource) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="Hidden for low-trust sources"
        description={`Save the file locally and use "Import from file…" if you need to override the protective defaults for this ${sourceLabel} import.`}
      />
    );
  }
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Toggle
        checked={backupRestore}
        onChange={onBackupRestoreChange}
        label="This is mine — prefer update by uid"
        help="Switches uid-matched collisions from “add as new” to “replace existing”. Skipped for entities edited locally since the export was made."
      />
      <Toggle
        checked={trustExport}
        onChange={onTrustExportChange}
        label="Trust this export — keep enabled flags"
        help="Imported rules / live workflows / live variables land disabled by default. Enable this only when you trust the sender."
      />
      <Toggle
        checked={stripScripts}
        onChange={onStripScriptsChange}
        label="Strip request scripts on import"
        help="Removes pre-request and post-response scripts from every imported request. Recommended when the sender is unfamiliar."
      />
      <Toggle
        checked={omitOAuthConfigs}
        onChange={onOmitOAuthConfigsChange}
        label="Omit OAuth configs"
        help="By default, OAuth2 configs ride with the request (token endpoint, client id, scopes — never client secret or tokens). With this on, every OAuth2 request lands with auth set to none."
      />
      <Toggle
        checked={keepTargetCollectionOrder}
        onChange={onKeepTargetCollectionOrderChange}
        label="Keep target collection order on update"
        help="By default, an updated collection takes the export's child order. With this on, your existing target ordering is preserved."
      />
      <Toggle
        checked={includeWorkspaceSettings}
        onChange={onIncludeWorkspaceSettingsChange}
        disabled
        label="Include workspace-level settings"
        help="Reserved for a future allowlist of workspace-semantic settings. The current allowlist is empty — nothing ships through this toggle in v1."
      />
      {targetMode === 'new' && (
        <Toggle
          checked={refuseUidCollision}
          onChange={onRefuseUidCollisionChange}
          label="Refuse on workspace.uid collision"
          help="By default, importing into a new workspace silently regenerates the workspace uid on collision. With this on, an existing workspace with the same uid blocks the import."
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
  lowTrustSource,
  source,
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
          Advanced
        </Text>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close advanced panel"
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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
        <AdvancedTogglesList
          lowTrustSource={lowTrustSource}
          source={source}
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
