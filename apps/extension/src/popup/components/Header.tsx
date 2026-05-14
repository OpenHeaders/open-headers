import { NodeExpandOutlined, SettingOutlined } from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { App, Button, Space, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect } from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { useSurface } from '@openheaders/ui/shared/surface';
import { hostNavigation } from '@openheaders/core/navigation';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { getBrowserAPI } from '@/types/browser';
import { useSetting } from '@/workbench/settings/hooks';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import { SurfaceTargetIcon } from './SurfaceTargetIcon';
import WorkspacePill from './WorkspacePill';

const { Title, Text } = Typography;

const Header: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const surface = useSurface();
  const { setHeaderActions } = useKeyboardNav();
  const [isRulesExecutionPaused, setIsRulesExecutionPaused] = useSetting('rulesEngine.paused');
  const openSettingsLabel = usePopupShortcutLabel('open-settings');
  const togglePauseLabel = usePopupShortcutLabel('toggle-rules-pause');
  const toggleSurfaceLabel = usePopupShortcutLabel('toggle-surface');

  const handleSwitchSurface = useCallback(async (): Promise<void> => {
    const next = surface.mode === 'popup' ? 'sidepanel' : 'popup';
    let result: { opened: boolean };
    try {
      result = await hostNavigation.switchViewMode(next);
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
  }, [surface.mode, message]);

  useEffect(() => {
    setHeaderActions({
      onToggleSurface: () => {
        void handleSwitchSurface();
      },
    });
  }, [setHeaderActions, handleSwitchSurface]);

  const switchTooltip =
    surface.mode === 'popup'
      ? 'Switch to side panel (stays open as you browse)'
      : 'Switch to popup mode (toolbar click)';

  const handleGlobalRulesToggle = async (checked: boolean): Promise<void> => {
    setIsRulesExecutionPaused(!checked);
    message.success(checked ? 'Rules execution resumed' : 'Rules execution paused');
  };

  const handleOpenSettings = (): void => {
    void openWorkspace({ kind: 'open-settings' }, surface.mode);
  };

  // Sidepanel is narrower than the popup. Drop the logo + brand
  // wordmark there so the workspace pill and right-side controls
  // (surface switch, pause toggle, settings) keep their breathing
  // room. The StatusPill (rendered in the footer) is the single
  // source of truth for desktop-app connection state on both surfaces.
  const isSidepanel = surface.mode === 'sidepanel';

  return (
    <div className="header">
      <Space align="center" size={8}>
        {!isSidepanel && (
          <>
            <img
              src={getBrowserAPI().runtime.getURL('images/logo-pixel.svg')}
              alt="Open Headers"
              style={{ width: 26, height: 26 }}
            />
            <Title level={4} className="popup-header-title" style={{ margin: 0 }}>
              Open Headers
            </Title>
          </>
        )}
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
        <Tooltip title={<ShortcutHintTitle label={toggleSurfaceLabel}>{switchTooltip}</ShortcutHintTitle>}>
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
