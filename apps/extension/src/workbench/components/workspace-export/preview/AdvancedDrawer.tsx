/**
 * Advanced overrides — slide-in right drawer.
 *
 * Replaces the old inline `<Collapse>` accordion that pushed the diff
 * workspace below the fold. Toggles flip live: every state change
 * propagates straight back into the parent which already re-runs the
 * preview RPC + diff pass, so the user sees the consequence in the
 * left/right pane in real time.
 *
 * On low-trust sources (URL-fetch / deep-link / playground) the drawer
 * shows an explainer instead of toggles — design §5.5 (the override
 * surface stays out of foot-gun reach for non-local sources).
 */

import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Drawer, Space, Typography } from 'antd';
import type React from 'react';
import type { ImportTargetSelection } from './TargetControl';
import type { ImportPreviewSource } from './types';

const { Text } = Typography;

export interface AdvancedDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Caller's container — drawer mounts inside the modal instead of
   *  the document body so it visually slides in from the modal's right
   *  edge, not the viewport's. */
  getContainer?: HTMLElement | (() => HTMLElement) | false;
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

const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  open,
  onClose,
  getContainer,
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
  return (
    <Drawer
      title="Advanced"
      placement="right"
      open={open}
      onClose={onClose}
      width={380}
      getContainer={getContainer}
      mask={false}
      styles={{ body: { padding: 16 } }}
    >
      {lowTrustSource ? (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          title="Hidden for low-trust sources"
          description={`Save the file locally and use "Import from file…" if you need to override the protective defaults for this ${sourceLabel} import.`}
        />
      ) : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Toggle
            checked={backupRestore}
            onChange={onBackupRestoreChange}
            label="This is mine — prefer update by uid"
            help="Switches the default for uid-matched entities from “create new copy” to “update existing”. Skipped for entities edited locally since the export was made."
          />
          <Toggle
            checked={trustExport}
            onChange={onTrustExportChange}
            label="Trust this export — import enabled flags as-is"
            help="Imported rules / live workflows / live variables land disabled by default. Enable this only when you trust the sender — it lets the export turn things on the moment it lands."
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
            help="By default, an updated collection takes the export's child order. With this on, your existing target ordering is preserved when collisions update by uid."
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
      )}
    </Drawer>
  );
};

export default AdvancedDrawer;

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  help: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, help, disabled }) => (
  <div
    style={{
      padding: 10,
      borderRadius: 6,
      background: 'rgba(0,0,0,0.02)',
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

/** Trigger button — placed in the diff-workspace header. */
export const AdvancedTrigger: React.FC<{ onClick: () => void; activeCount: number }> = ({ onClick, activeCount }) => (
  <Button
    size="small"
    icon={<SettingOutlined />}
    onClick={onClick}
    type={activeCount > 0 ? 'primary' : 'default'}
    ghost={activeCount > 0}
  >
    Advanced{activeCount > 0 ? ` · ${activeCount}` : ''}
  </Button>
);
