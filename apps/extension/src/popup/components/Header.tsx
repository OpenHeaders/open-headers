import { DownloadOutlined, NodeExpandOutlined, SettingOutlined } from '@ant-design/icons';
import { useRules } from '@hooks/useRules';
import { App, Badge, Button, Space, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { useSetting } from '@/rules/settings/hooks';
import { useSurface } from '@/shared/surface';
import { switchViewMode } from '@/shared/view-mode';
import { getBrowserAPI } from '@/types/browser';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import { SurfaceTargetIcon } from './SurfaceTargetIcon';
import WorkspacePill from './WorkspacePill';

const { Title, Text } = Typography;

const Header: React.FC = () => {
  const { token } = theme.useToken();
  const { isConnected, isStatusLoaded } = useRules();
  const { message } = App.useApp();
  const surface = useSurface();
  const [isRulesExecutionPaused, setIsRulesExecutionPaused] = useSetting('rulesEngine.paused');
  const openSettingsLabel = usePopupShortcutLabel('open-settings');
  const togglePauseLabel = usePopupShortcutLabel('toggle-rules-pause');

  const handleSwitchSurface = async (): Promise<void> => {
    const next = surface.mode === 'popup' ? 'sidepanel' : 'popup';
    let result: { opened: boolean };
    try {
      result = await switchViewMode(next);
    } catch {
      message.error('Could not switch view');
      return;
    }
    if (surface.mode === 'popup') {
      // We're inside the popup — close it so focus lands on the
      // sidepanel that just opened.
      window.close();
      return;
    }
    // We're inside the sidepanel switching to popup. switchViewMode
    // already invoked openPopup() + closed the sidepanel. If the popup
    // couldn't auto-open (typically because the extension isn't pinned
    // to the toolbar) tell the user how to find it.
    if (!result.opened) {
      message.info('Popup mode active. Pin the extension and click the toolbar icon to open it.');
    }
  };

  const switchTooltip =
    surface.mode === 'popup'
      ? 'Switch to side panel (stays open as you browse)'
      : 'Switch to popup mode (toolbar click)';

  const handleGlobalRulesToggle = async (checked: boolean): Promise<void> => {
    setIsRulesExecutionPaused(!checked);
    message.success(checked ? 'Rules execution resumed' : 'Rules execution paused');
  };

  const handleOpenSettings = (): void => {
    const url = getBrowserAPI().runtime.getURL('workspace.html#/settings');
    getBrowserAPI().tabs.create({ url });
  };

  const disconnectedTooltip = (
    <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 240 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Desktop app not detected</div>
      <div style={{ opacity: 0.8, marginBottom: 8 }}>
        Install the desktop app to unlock workspaces, variables, team sync, and workflow recordings.
      </div>
      <Button
        type="primary"
        size="small"
        icon={<DownloadOutlined />}
        onClick={() => window.open('https://openheaders.io', '_blank')}
        style={{ fontSize: 11, height: 24 }}
      >
        Get the desktop app
      </Button>
    </div>
  );

  return (
    <div className="header">
      <Space align="center" size={8}>
        <img
          src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
          alt="Open Headers"
          style={{ width: 26, height: 26 }}
        />
        <Title level={4} className="popup-header-title" style={{ margin: 0 }}>
          Open Headers
        </Title>
        {isStatusLoaded &&
          (isConnected ? (
            <Badge status="success" />
          ) : (
            <Tooltip title={disconnectedTooltip} placement="bottom" styles={{ root: { maxWidth: 280 } }}>
              <span style={{ cursor: 'help', display: 'inline-flex' }}>
                <Badge status="error" />
              </span>
            </Tooltip>
          ))}
        <WorkspacePill />
      </Space>
      <Space align="center" size={12}>
        <div
          className="header-rules-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 8px',
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <NodeExpandOutlined
            style={{
              fontSize: '14px',
              color: isRulesExecutionPaused ? token.colorWarning : token.colorTextSecondary,
            }}
          />
          <Text
            style={{
              fontSize: '12px',
              color: isRulesExecutionPaused ? token.colorWarning : token.colorTextSecondary,
            }}
          >
            Rules
          </Text>
          <Tooltip
            title={
              <ShortcutHintTitle label={togglePauseLabel}>
                {isRulesExecutionPaused
                  ? 'Resume rules execution'
                  : 'Pause all rules (preserves individual rule settings)'}
              </ShortcutHintTitle>
            }
          >
            <Switch
              size="default"
              checked={!isRulesExecutionPaused}
              onChange={handleGlobalRulesToggle}
              checkedChildren="Active"
              unCheckedChildren="Paused"
            />
          </Tooltip>
        </div>
        <Tooltip title={switchTooltip}>
          <Button
            type="text"
            size="small"
            icon={<SurfaceTargetIcon target={surface.mode === 'popup' ? 'sidepanel' : 'popup'} />}
            onClick={() => {
              void handleSwitchSurface();
            }}
            aria-label={switchTooltip}
            style={{
              padding: '4px 8px',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
            }}
          />
        </Tooltip>
        <Tooltip title={<ShortcutHintTitle label={openSettingsLabel}>Open settings</ShortcutHintTitle>}>
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={handleOpenSettings}
            style={{
              padding: '4px 8px',
              height: 'auto',
              display: 'flex',
              alignItems: 'center',
            }}
          />
        </Tooltip>
      </Space>
    </div>
  );
};

export default Header;
