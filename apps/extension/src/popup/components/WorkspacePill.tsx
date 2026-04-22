/**
 * WorkspacePill — compact popup/sidepanel workspace indicator.
 *
 * Read-only switcher: lists all workspaces with active-state marker
 * and a "Manage workspaces…" link that opens workbench.html to the
 * manager tab. CRUD is intentionally absent from the popup — the
 * popup is too narrow (800px) to host management UI cleanly.
 */

import { CheckOutlined, DownOutlined, SettingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useSurface } from '@/shared/surface';
import { openWorkspace } from '@/shared/workspace-intent';
import { renderWorkspacePrefix } from '@/workbench/components/workspace-prefix';

const { Text } = Typography;

const WorkspacePill: React.FC = () => {
  const { token } = theme.useToken();
  const surface = useSurface();
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspace } = useWorkspaces();

  const items: MenuProps['items'] = useMemo(() => {
    const rows: MenuProps['items'] = workspaces.map((w) => ({
      key: w.id,
      label: (
        <Space size={8} style={{ minWidth: 180 }}>
          {renderWorkspacePrefix({ icon: w.icon, color: w.color }, token, { size: 16 })}
          <Text style={{ flex: 1 }}>{w.name}</Text>
          {w.id === activeWorkspaceId ? (
            <CheckOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />
          ) : (
            <span style={{ width: 12, display: 'inline-block' }} />
          )}
        </Space>
      ),
      onClick: () => {
        if (w.id !== activeWorkspaceId) void setActiveWorkspace(w.id);
      },
    }));
    return [
      ...rows,
      { type: 'divider' as const, key: 'div-manage' },
      {
        key: 'manage',
        icon: <SettingOutlined />,
        label: 'Manage workspaces…',
        onClick: () => {
          void openWorkspace({ kind: 'open-workspace-manager' }, surface.mode);
        },
      },
    ];
  }, [workspaces, activeWorkspaceId, setActiveWorkspace, token, surface.mode]);

  if (!activeWorkspace) return null;

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomLeft">
      <button
        type="button"
        aria-label={`Active workspace: ${activeWorkspace.name}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          height: 22,
          borderRadius: 4,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          cursor: 'pointer',
          fontSize: 12,
          color: token.colorText,
        }}
      >
        {renderWorkspacePrefix({ icon: activeWorkspace.icon, color: activeWorkspace.color }, token, { size: 14 })}
        <span
          style={{
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeWorkspace.name}
        </span>
        <DownOutlined style={{ fontSize: 8, color: token.colorTextTertiary }} />
      </button>
    </Dropdown>
  );
};

export default WorkspacePill;
