/**
 * TopBar — mirrors the desktop V5Shell TopBar.
 *
 * Layout: [Logo] [Workspace Switcher] | [⌘K Search...] | [Settings]
 */

import { SearchOutlined, SettingOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { Button, Space, Tooltip, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { getBrowserAPI } from '@/types/browser';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import EnvironmentSelector from './EnvironmentSelector';
import WorkspaceSwitcher from './WorkspaceSwitcher';

interface TopBarProps {
  onCommandPalette?: () => void;
  onOpenSettings?: () => void;
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  onSwitchWorkspace: (id: string) => void;
  onOpenWorkspaceManager: () => void;
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  onSwitchEnvironment: (uid: string | null) => void;
  onCreateEnvironment: () => void;
  onOpenEnvironment: (uid: string) => void;
  onOpenWorkspaceVariables: () => void;
  onOpenVault: () => void;
  activeCollectionId: string | null;
  allCollections: V5.Collection[];
  onSetCollectionPinnedEnvs: (collectionUid: string, pinnedIds: string[], defaultId: string | null) => Promise<boolean>;
}

const TopBar: React.FC<TopBarProps> = ({
  onCommandPalette,
  onOpenSettings,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onOpenWorkspaceManager,
  environments,
  activeEnvironmentId,
  onSwitchEnvironment,
  onCreateEnvironment,
  onOpenEnvironment,
  onOpenWorkspaceVariables,
  onOpenVault,
  activeCollectionId,
  allCollections,
  onSetCollectionPinnedEnvs,
}) => {
  const { token } = theme.useToken();
  const commandPaletteLabel = useShortcutLabel('command-palette');
  const openSettingsLabel = useShortcutLabel('open-settings');

  return (
    <div
      className="rules-topbar"
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="rules-topbar-left">
        <img
          src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
          alt="Open Headers"
          className="rules-topbar-logo"
        />
        <span className="rules-topbar-title">Open Headers</span>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onOpenManager={onOpenWorkspaceManager}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, maxWidth: 420, justifyContent: 'center' }}>
        <Button
          className="rules-topbar-search"
          type="text"
          onClick={onCommandPalette}
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Space size={4}>
            <SearchOutlined style={{ color: token.colorTextTertiary }} />
            <span style={{ color: token.colorTextTertiary }}>Search or run a command...</span>
            <kbd
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: token.colorBgElevated,
                color: token.colorTextTertiary,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {commandPaletteLabel}
            </kbd>
          </Space>
        </Button>
      </div>

      <div className="rules-topbar-right">
        <EnvironmentSelector
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onSwitch={onSwitchEnvironment}
          onCreateEnvironment={onCreateEnvironment}
          onOpenEnvironment={onOpenEnvironment}
          onOpenWorkspaceVariables={onOpenWorkspaceVariables}
          onOpenVault={onOpenVault}
          activeCollectionId={activeCollectionId}
          activeCollectionPinnedEnvIds={
            allCollections.find((c) => c.uid === activeCollectionId)?.pinnedEnvironmentIds ?? []
          }
          activeCollectionDefaultEnvId={
            allCollections.find((c) => c.uid === activeCollectionId)?.defaultEnvironmentId ?? null
          }
          onSetCollectionPinnedEnvs={onSetCollectionPinnedEnvs}
        />
        <Tooltip title={<ShortcutHintTitle label={openSettingsLabel}>Settings</ShortcutHintTitle>}>
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar;
