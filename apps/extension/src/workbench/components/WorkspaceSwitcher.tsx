/**
 * WorkspaceSwitcher — TopBar dropdown for switching the active workspace.
 *
 * Single responsibility: render the current workspace pill + a dropdown
 * menu listing every workspace. Business logic lives in `useWorkspaces`
 * (data) and the parent (dirty-draft confirmation); this component
 * delegates switch to the parent via `onSwitch` so the parent can gate
 * it on unsaved work.
 */

import { CheckOutlined, DownOutlined, ExportOutlined, ImportOutlined, SettingOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { renderWorkspacePrefix } from './workspace-prefix';

const { Text } = Typography;

interface WorkspaceSwitcherProps {
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  onSwitch: (id: string) => void;
  onOpenManager: () => void;
  /**
   * Open the workspace-export modal scoped to the active workspace.
   * Wired to the "Export…" item below the workspace list.
   */
  onExport: () => void;
  /**
   * Open the file picker for importing a workspace export. Wired to
   * the "Import from file…" item below the workspace list.
   */
  onImport: () => void;
  /**
   * Read the clipboard and open the import preview against the
   * pasted content. Wired to the "Paste import…" item below.
   */
  onPasteImport: () => void;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onOpenManager,
  onExport,
  onImport,
  onPasteImport,
}) => {
  const { token } = theme.useToken();
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const items: MenuProps['items'] = useMemo(() => {
    const workspaceItems: MenuProps['items'] = workspaces.map((w) => ({
      key: w.id,
      label: (
        <Space size={8} style={{ minWidth: 200, width: '100%' }}>
          {renderWorkspacePrefix({ icon: w.icon, color: w.color }, token, { size: 18 })}
          <Text style={{ flex: 1 }}>{w.name}</Text>
          {w.id === activeWorkspaceId ? (
            <CheckOutlined style={{ color: token.colorPrimary, fontSize: 12 }} />
          ) : (
            <span style={{ width: 12, display: 'inline-block' }} />
          )}
        </Space>
      ),
      onClick: () => {
        if (w.id !== activeWorkspaceId) onSwitch(w.id);
      },
    }));
    return [
      ...workspaceItems,
      { type: 'divider' as const, key: 'div-manage' },
      {
        key: 'export',
        icon: <ExportOutlined />,
        label: 'Export…',
        onClick: onExport,
      },
      {
        key: 'import',
        icon: <ImportOutlined />,
        label: 'Import from file…',
        onClick: onImport,
      },
      {
        key: 'import-paste',
        icon: <ImportOutlined />,
        label: 'Paste import…',
        onClick: onPasteImport,
      },
      {
        key: 'manage',
        icon: <SettingOutlined />,
        label: 'Manage workspaces…',
        onClick: onOpenManager,
      },
    ];
  }, [workspaces, activeWorkspaceId, onSwitch, onOpenManager, onExport, onImport, onPasteImport, token]);

  if (!active) return null;

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomLeft">
      <Button
        type="text"
        size="small"
        aria-label={`Active workspace: ${active.name}. Click to switch.`}
        style={{
          padding: '0 8px',
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          color: token.colorText,
        }}
      >
        <Space size={6}>
          {renderWorkspacePrefix({ icon: active.icon, color: active.color }, token, { size: 18 })}
          <Text style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active.name}
          </Text>
          <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default WorkspaceSwitcher;
