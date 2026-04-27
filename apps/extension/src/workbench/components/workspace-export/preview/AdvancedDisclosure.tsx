/**
 * Advanced disclosure — the §5.5 override toggle ribbon. Hidden
 * entirely on URL-fetch / deep-link / playground sources (collapse
 * stays visible but expands to an explainer pointing the user at the
 * "save the file locally first" path).
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Checkbox, Collapse, Space, Typography } from 'antd';
import type React from 'react';
import type { ImportTargetSelection } from './TargetControl';
import type { ImportPreviewSource } from './types';

const { Text } = Typography;

const AdvancedDisclosure: React.FC<{
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
}> = ({
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
      <Collapse
        size="small"
        items={[
          {
            key: 'advanced',
            label: 'Advanced',
            children: (
              <Alert
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                message="Advanced overrides are hidden for low-trust sources"
                description={`Save the file locally and use "Import from file…" if you need to override the protective defaults for this ${sourceLabel} import.`}
              />
            ),
          },
        ]}
      />
    );
  }
  return (
    <Collapse
      size="small"
      items={[
        {
          key: 'advanced',
          label: 'Advanced',
          children: (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Checkbox checked={backupRestore} onChange={(e) => onBackupRestoreChange(e.target.checked)}>
                <Text strong>This is mine — prefer update by uid</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Switches the default for uid-matched entities from "create new copy" to "update existing". Skipped
                    for entities edited locally since the export was made.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox checked={trustExport} onChange={(e) => onTrustExportChange(e.target.checked)}>
                <Text strong>Trust this export — import enabled flags as-is</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Imported rules / live workflows / live variables land disabled by default. Enable this only when you
                    trust the sender — it lets the export turn things on the moment it lands.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox checked={stripScripts} onChange={(e) => onStripScriptsChange(e.target.checked)}>
                <Text strong>Strip request scripts on import</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Removes pre-request and post-response scripts from every imported request. Recommended when the
                    sender is unfamiliar.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox checked={omitOAuthConfigs} onChange={(e) => onOmitOAuthConfigsChange(e.target.checked)}>
                <Text strong>Omit OAuth configs</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    By default, OAuth2 configs ride with the request (token endpoint, client id, scopes — never client
                    secret or tokens). With this on, every OAuth2 request lands with auth set to none — you wire it up
                    from scratch.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox
                checked={keepTargetCollectionOrder}
                onChange={(e) => onKeepTargetCollectionOrderChange(e.target.checked)}
              >
                <Text strong>Keep target collection order on update</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    By default, an updated collection takes the export's child order. With this on, your existing target
                    ordering is preserved when collisions update by uid.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox
                checked={includeWorkspaceSettings}
                onChange={(e) => onIncludeWorkspaceSettingsChange(e.target.checked)}
                disabled
              >
                <Text strong>Include workspace-level settings</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Reserved for a future allowlist of workspace-semantic settings. The current allowlist is empty —
                    nothing ships through this toggle in v1.
                  </Text>
                </div>
              </Checkbox>
              {targetMode === 'new' && (
                <Checkbox checked={refuseUidCollision} onChange={(e) => onRefuseUidCollisionChange(e.target.checked)}>
                  <Text strong>Refuse on workspace.uid collision</Text>
                  <div style={{ fontSize: 11 }}>
                    <Text type="secondary">
                      By default, importing into a new workspace silently regenerates the workspace uid on collision.
                      With this on, an existing workspace with the same uid blocks the import — switch to "Pick
                      existing" to merge into it instead.
                    </Text>
                  </div>
                </Checkbox>
              )}
            </Space>
          ),
        },
      ]}
    />
  );
};

export default AdvancedDisclosure;
