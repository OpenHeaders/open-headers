/**
 * PanelWorkspaceSelector — slim workspace switcher for the DevTools
 * panel. System surface (always reflects ACTIVE), so row click promotes
 * the workspace to ACTIVE — same semantics as the popup pill.
 *
 * Trigger styling matches `PanelEnvironmentSelector` (24px height,
 * subtle border) so the toolbar reads as a paired control: workspace
 * on the left, environment on the right.
 */

import { DownOutlined } from '@ant-design/icons';
import { orgCatalogue } from '@openheaders/core/identity';
import { useActiveOrg } from '@openheaders/ui/shared/hooks/useActiveOrg';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/useWorkspaces';
import { useSurface } from '@openheaders/ui/shared/surface';
import { WorkspaceDropdownBody } from '@openheaders/ui/shared/workspace-dropdown/WorkspaceDropdownBody';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { renderWorkspacePrefix } from '@openheaders/ui/workbench/components/workspace-prefix';
import { Button, Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';

const { Text } = Typography;

export const PanelWorkspaceSelector: React.FC = () => {
  const { token } = theme.useToken();
  const surface = useSurface();
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspace } = useWorkspaces();
  const snapshot = useIdentitySnapshot();
  const catalogue = useMemo(() => orgCatalogue(snapshot), [snapshot]);
  const { activeOrgId, setActiveOrg } = useActiveOrg(snapshot);
  const [open, setOpen] = useState(false);

  if (!activeWorkspace) return null;

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => (
        <WorkspaceDropdownBody
          workspaces={workspaces}
          selectedId={activeWorkspaceId}
          activeId={activeWorkspaceId}
          mode="system"
          onPromoteActive={(id) => {
            void setActiveWorkspace(id);
          }}
          onExport={() => {
            void openWorkspace({ kind: 'open-export-modal' }, surface.mode);
          }}
          onImport={() => {
            void openWorkspace({ kind: 'open-import-modal' }, surface.mode);
          }}
          onOpenManager={() => {
            void openWorkspace({ kind: 'open-workspace-manager' }, surface.mode);
          }}
          onClose={() => setOpen(false)}
          orgScope={{
            catalogue,
            activeOrgId,
            onSwitchOrg: (orgId) => {
              void setActiveOrg(orgId);
            },
          }}
        />
      )}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button
        type="text"
        size="small"
        aria-label={`Active workspace: ${activeWorkspace.name}`}
        style={{
          padding: '0 8px',
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <Space size={4}>
          {renderWorkspacePrefix({ icon: activeWorkspace.icon, color: activeWorkspace.color }, token, { size: 12 })}
          <Text
            style={{
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: token.colorText,
              fontSize: 12,
            }}
          >
            {activeWorkspace.name}
          </Text>
          <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};
