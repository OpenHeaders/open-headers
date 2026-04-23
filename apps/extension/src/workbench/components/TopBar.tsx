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
import { useSettingValue } from '../settings/hooks';
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

  // Activity-bar width in rules.less: 64px with labels, 36px compact.
  // We mirror that onto the topbar's outer grid tracks so the logo
  // centers over the left bar, the product name/workspace starts at
  // the left dock edge, the env selector ends at the right dock edge,
  // and the settings icon centers over the right bar — independent of
  // which docks are open. (NB: dock-layout.css has duplicate 96px rules
  // that lose to rules.less because it's imported later; if those are
  // unified, update these numbers too.)
  const showLabels = useSettingValue('workspaceLayout.showToolWindowLabels');
  const activityBarWidth = showLabels ? 64 : 36;

  return (
    <div
      className="rules-topbar"
      style={
        {
          background: token.colorBgLayout,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          // Drives the grid column widths in rules.less — keeps the
          // topbar's outer slots exactly aligned with the activity bars.
          '--ab-width': `${activityBarWidth}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="rules-topbar-logo-slot"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <img
          src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
          alt="Open Headers"
          className="rules-topbar-logo"
        />
      </div>
      <div className="rules-topbar-left">
        <span className="rules-topbar-title">Open Headers</span>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onOpenManager={onOpenWorkspaceManager}
        />
      </div>

      <div aria-hidden />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
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

      <div aria-hidden />

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
      </div>
      <div
        className="rules-topbar-settings-slot"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Tooltip title={<ShortcutHintTitle label={openSettingsLabel}>Settings</ShortcutHintTitle>}>
          <Button size="small" type="text" icon={<SettingOutlined />} onClick={onOpenSettings} />
        </Tooltip>
      </div>
    </div>
  );
};

export default TopBar;
