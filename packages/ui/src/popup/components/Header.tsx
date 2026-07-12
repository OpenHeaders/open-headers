import { NodeExpandOutlined, SettingOutlined } from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { hostNavigation } from '@openheaders/core/navigation';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { NotificationsIcon } from '@openheaders/ui/shared/notifications';
import { useSurface } from '@openheaders/ui/shared/surface';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { useSetting, useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import { App, Button, Space, Switch, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect } from 'react';
import { useKeyboardNav } from '../shortcuts/KeyboardNavContext';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import { SurfaceTargetIcon } from './SurfaceTargetIcon';
import WorkspacePill from './WorkspacePill';

const { Title, Text } = Typography;

const Header: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const surface = useSurface();
  const { setHeaderActions } = useKeyboardNav();
  const [isRulesExecutionPaused, setIsRulesExecutionPaused] = useSetting('rulesEngine.paused');
  const settingsReady = useSettingsReady();
  const openSettingsLabel = usePopupShortcutLabel('open-settings');
  const togglePauseLabel = usePopupShortcutLabel('toggle-rules-pause');
  const toggleSurfaceLabel = usePopupShortcutLabel('toggle-surface');

  const handleSwitchSurface = useCallback(async (): Promise<void> => {
    const next = surface.mode === 'popup' ? 'sidepanel' : 'popup';
    try {
      await hostNavigation.switchViewMode(next);
    } catch {
      message.error(t('popup.header.switchFailed'));
      return;
    }
    if (surface.mode === 'popup') {
      // We're inside the popup — close it so focus lands on the
      // sidepanel that just opened.
      window.close();
    }
    // Sidepanel → popup: the sidebar self-closes via the navigation
    // host's renderer-side adapter call. On Chromium the popup
    // auto-opens via action.openPopup; on Firefox the user clicks the
    // toolbar themselves once the binding has switched.
  }, [surface.mode, message, t]);

  useEffect(() => {
    setHeaderActions({
      onToggleSurface: () => {
        void handleSwitchSurface();
      },
    });
  }, [setHeaderActions, handleSwitchSurface]);

  const switchTooltip =
    surface.mode === 'popup' ? t('popup.header.switchToSidePanel') : t('popup.header.switchToPopup');

  const handleGlobalRulesToggle = async (checked: boolean): Promise<void> => {
    setIsRulesExecutionPaused(!checked);
    message.success(checked ? t('popup.header.rulesResumed') : t('popup.header.rulesPaused'));
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
              src={hostAssets.resolveUrl('images/logo-pixel.svg')}
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
            {t('popup.header.rulesLabel')}
          </Text>
          {/* Mount the switch only after settings hydrate, else it animates from
              the default on popup re-open; width reserved so the chip can't shift. */}
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 64 }}>
            {settingsReady && (
              <Tooltip
                title={
                  <ShortcutHintTitle label={togglePauseLabel}>
                    {isRulesExecutionPaused ? t('popup.header.resumeRules') : t('popup.header.pauseRules')}
                  </ShortcutHintTitle>
                }
              >
                <Switch
                  size="default"
                  checked={!isRulesExecutionPaused}
                  onChange={handleGlobalRulesToggle}
                  checkedChildren={t('popup.status.active')}
                  unCheckedChildren={t('popup.status.paused')}
                />
              </Tooltip>
            )}
          </span>
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
        <Tooltip title={<ShortcutHintTitle label={openSettingsLabel}>{t('popup.header.openSettings')}</ShortcutHintTitle>}>
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
        <Tooltip title={t('popup.header.notifications')}>
          <Button
            type="text"
            size="small"
            icon={<NotificationsIcon />}
            onClick={() => {
              void openWorkspace({ kind: 'open-notifications' }, surface.mode);
            }}
            aria-label={t('popup.header.openNotifications')}
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
