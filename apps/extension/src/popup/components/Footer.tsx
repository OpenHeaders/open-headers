import {
  AppstoreOutlined,
  EditOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlaySquareOutlined,
  SettingOutlined,
  StarOutlined,
  TrademarkCircleTwoTone,
  VideoCameraTwoTone,
} from '@ant-design/icons';
import { useKeyboardNav } from '@context/KeyboardNavContext';
import { useRules } from '@hooks/useRules';
import { getAppLauncher } from '@utils/app-launcher';
import { BridgeError, call } from '@utils/bridge';
import { focusFirstDropdownItem } from '@utils/focus-dropdown-item';
import { App, Button, Dropdown, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { useSetting } from '@/workbench/settings/hooks';
import { useSurface } from '@/shared/surface';
import { openWorkspace } from '@/shared/workspace-intent';
import { usePopupShortcutLabel } from '../shortcuts/popup-shortcuts';
import RecordingButton from './RecordingButton';

const { Text } = Typography;

const formatHotkeyForDisplay = (hotkey: string): string => {
  if (!hotkey) return 'Not set';
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  return hotkey
    .replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl')
    .replace('Command', 'Cmd')
    .replace('Control', 'Ctrl');
};

const Footer: React.FC = () => {
  const { setFooterActions, setIsShortcutsOverlayVisible } = useKeyboardNav();
  const surface = useSurface();
  const version = __APP_VERSION__;
  const { token } = theme.useToken();
  const [useWidget, setUseWidget] = useSetting('recording.showWidget');
  const [enableVideoRecording, setEnableVideoRecording] = useSetting('recording.videoEnabled');
  const [rawRecordingHotkey] = useSetting('recording.hotkey');
  const [recordingHotkeyEnabled, setRecordingHotkeyEnabled] = useSetting('recording.hotkeyEnabled');
  const [optionsTooltipOpen, setOptionsTooltipOpen] = useState(false);
  const [optionsDropdownOpen, setOptionsDropdownOpen] = useState(false);
  const [isRulesExecutionPaused, setIsRulesExecutionPaused] = useSetting('rulesEngine.paused');
  const { message } = App.useApp();
  const appLauncher = getAppLauncher();

  const { isConnected } = useRules();

  const recordingHotkey = rawRecordingHotkey ? formatHotkeyForDisplay(rawRecordingHotkey) : 'Not set';

  // Live chord hints for footer tooltips — repaint whenever the user
  // rebinds any of these in Settings → Keyboard.
  const optionsLabel = usePopupShortcutLabel('toggle-options-menu');
  const helpLabel = usePopupShortcutLabel('toggle-shortcuts-help');
  const _workspaceLabel = usePopupShortcutLabel('open-workspace');
  const _recordingLabel = usePopupShortcutLabel('toggle-recording');

  const handleWidgetToggle = (checked: boolean): void => {
    setUseWidget(checked);
  };

  const handleOpenWebsite = async () => {
    try {
      const response = await call('openTab', { url: 'https://openheaders.io' });
      if (response.success) window.close();
    } catch (error) {
      if (!(error instanceof BridgeError)) throw error;
    }
  };

  const handleOpenRecordViewer = async () => {
    if (!isConnected) {
      message.warning('Please connect to the desktop app to view workflows');
      return;
    }
    await appLauncher.launchOrFocus({ tab: 'record-viewer' });
    message.info('Switch to OpenHeaders app to view workflows');
  };

  const handleVideoRecordingToggle = (checked: boolean): void => {
    if (!isConnected) {
      message.warning('Please connect to the desktop app to change video recording settings');
      return;
    }
    setEnableVideoRecording(checked);
  };

  const handleEditHotkey = async () => {
    if (!isConnected) {
      message.warning('Please connect to the desktop app to edit hotkey settings');
      return;
    }
    await appLauncher.launchOrFocus({ tab: 'settings', settingsTab: 'workflows', action: 'editHotkey' });
    message.info('Switch to OpenHeaders app to edit recording hotkey');
  };

  const handleHotkeyToggle = (checked: boolean): void => {
    if (!isConnected) {
      message.warning('Please connect to the desktop app to change hotkey settings');
      return;
    }
    setRecordingHotkeyEnabled(checked);
  };

  const handleGlobalRulesToggle = async (checked: boolean) => {
    setIsRulesExecutionPaused(!checked);
    message.success(checked ? 'Rules execution resumed' : 'Rules execution paused');
  };

  // Register keyboard-accessible actions with parent
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleGlobalRulesToggle is stable in practice — including it would cause infinite re-registration
  const handleTogglePauseForKeyboard = useCallback(() => {
    void handleGlobalRulesToggle(isRulesExecutionPaused);
  }, [isRulesExecutionPaused]);

  const handleToggleRecordingForKeyboard = useCallback(() => {
    const recordBtn = document.querySelector('.recording-button') as HTMLButtonElement | null;
    if (recordBtn && !recordBtn.disabled) recordBtn.click();
  }, []);

  const handleToggleOptionsForKeyboard = useCallback(() => {
    setOptionsDropdownOpen((prev) => {
      if (!prev) focusFirstDropdownItem();
      return !prev;
    });
  }, []);

  const handleOpenWorkspace = useCallback(() => {
    void openWorkspace({ kind: 'open-workspace' }, surface.mode);
  }, [surface.mode]);

  const handleOpenSettings = useCallback(() => {
    void openWorkspace({ kind: 'open-settings' }, surface.mode);
  }, [surface.mode]);

  useEffect(() => {
    setFooterActions({
      onToggleRecording: handleToggleRecordingForKeyboard,
      onToggleRulesPause: handleTogglePauseForKeyboard,
      onToggleOptions: handleToggleOptionsForKeyboard,
      onOpenWorkspace: handleOpenWorkspace,
      onOpenSettings: handleOpenSettings,
    });
  }, [
    setFooterActions,
    handleToggleRecordingForKeyboard,
    handleTogglePauseForKeyboard,
    handleToggleOptionsForKeyboard,
    handleOpenWorkspace,
    handleOpenSettings,
  ]);

  // When options dropdown is open, handle keyboard actions on focused menu items
  useEffect(() => {
    if (!optionsDropdownOpen) return;
    const handleOptionsKeyDown = (e: KeyboardEvent) => {
      const focused = document.activeElement as HTMLElement | null;
      if (!focused?.closest('.ant-dropdown-menu-item')) return;

      // Enter/Space — toggle the switch inside the focused item
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const toggle = focused.querySelector('.ant-switch') as HTMLButtonElement | null;
        if (toggle) toggle.click();
        return;
      }

      // 'e' — click the edit button inside the focused item (e.g. hotkey edit)
      if (e.key === 'e') {
        const editBtn = focused
          .querySelector('.ant-btn .anticon-edit, .anticon-edit')
          ?.closest('button') as HTMLButtonElement | null;
        if (editBtn && !editBtn.disabled) {
          e.preventDefault();
          editBtn.click();
        }
        return;
      }
    };
    document.addEventListener('keydown', handleOptionsKeyDown, true);
    return () => document.removeEventListener('keydown', handleOptionsKeyDown, true);
  }, [optionsDropdownOpen]);

  const optionsMenuItems = [
    {
      key: 'general-label',
      label: (
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
          GENERAL
        </Text>
      ),
      disabled: true,
    },
    {
      key: 'widget',
      label: (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation prevents menu close
        // biome-ignore lint/a11y/useKeyWithClickEvents: not a true interactive element
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '270px' }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Tooltip title="Display recording widget with a timer (drag to reposition)" placement="top">
            <Space>
              <AppstoreOutlined />
              <span>Show Widget</span>
              <InfoCircleOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />
            </Space>
          </Tooltip>
          <Switch size="small" checked={useWidget} onChange={handleWidgetToggle} />
        </div>
      ),
    },
    {
      key: 'hotkey',
      label: (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation prevents menu close
        // biome-ignore lint/a11y/useKeyWithClickEvents: not a true interactive element
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '270px' }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Tooltip title="Global keyboard shortcut to start/stop recording" placement="top">
            <Space>
              <TrademarkCircleTwoTone />
              <span>Hotkey</span>
              <InfoCircleOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />
            </Space>
          </Tooltip>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {recordingHotkey && recordingHotkey !== 'Not set' ? (
              <Space size={4}>
                {recordingHotkey.split('+').map((key, index) => (
                  <Tag
                    key={index}
                    style={{
                      margin: 0,
                      fontSize: '11px',
                    }}
                  >
                    {key}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                Not set
              </Text>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Tooltip title={!isConnected ? 'App not connected' : 'Edit hotkey in settings'}>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  size="small"
                  disabled={!isConnected}
                  onClick={handleEditHotkey}
                  style={{ padding: '0 4px', height: '20px', minWidth: 'auto' }}
                />
              </Tooltip>
              <Switch
                size="small"
                checked={isConnected && recordingHotkeyEnabled}
                disabled={!isConnected}
                onChange={handleHotkeyToggle}
              />
            </span>
          </div>
        </div>
      ),
    },
    { key: 'divider1', type: 'divider' as const },
    {
      key: 'recording-types-label',
      label: (
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
          RECORDING TYPES
        </Text>
      ),
      disabled: true,
    },
    {
      key: 'session',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '250px' }}>
          <Tooltip
            title="Record all browser events (DOM, console, network, storage) and interactions (page, mouse, input)"
            placement="top"
          >
            <Space>
              <FileTextOutlined />
              <span>Session</span>
              <InfoCircleOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />
            </Space>
          </Tooltip>
          <Tooltip title="Session recording is always enabled by default" placement="top">
            <Switch size="small" checked={true} disabled={true} style={{ opacity: 0.5 }} />
          </Tooltip>
        </div>
      ),
    },
    {
      key: 'video',
      label: (
        // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation prevents menu close
        // biome-ignore lint/a11y/useKeyWithClickEvents: not a true interactive element
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: '270px' }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Tooltip title="Record current screen in video format (.webm/.mp4)" placement="top">
            <Space>
              <VideoCameraTwoTone />
              <span>Video</span>
              <InfoCircleOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />
            </Space>
          </Tooltip>
          <Tooltip
            title={!isConnected ? 'App not connected' : 'Video recording might require additional system permissions'}
            placement="top"
          >
            <Switch
              size="small"
              checked={enableVideoRecording}
              disabled={!isConnected}
              onChange={handleVideoRecordingToggle}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div
      className="footer"
      style={{ backgroundColor: token.colorBgContainer, borderTop: `1px solid ${token.colorBorderSecondary}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <RecordingButton useWidget={useWidget} />
        <Tooltip title={!isConnected ? 'App not connected' : 'View and manage recorded workflows in desktop app'}>
          <Button
            icon={<PlaySquareOutlined />}
            onClick={handleOpenRecordViewer}
            size="middle"
            disabled={!isConnected}
            style={{ height: '36px', padding: '0 20px', fontWeight: 500, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
          >
            <span className="oh-collapse-label">View Workflows</span>
          </Button>
        </Tooltip>
        <Dropdown
          menu={{ items: optionsMenuItems }}
          placement="topRight"
          trigger={['click']}
          open={optionsDropdownOpen}
          onOpenChange={(open, info) => {
            // Don't close when interacting with menu items (Enter/click) — these are toggle items
            if (!open && info.source === 'menu') return;
            setOptionsDropdownOpen(open);
            if (open) setOptionsTooltipOpen(false);
          }}
        >
          <Tooltip
            title={<ShortcutHintTitle label={optionsLabel}>Recording options</ShortcutHintTitle>}
            open={optionsTooltipOpen}
            onOpenChange={setOptionsTooltipOpen}
          >
            <Button
              icon={<SettingOutlined />}
              size="middle"
              style={{ height: '36px', padding: '0 10px', fontWeight: 500, boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}
            >
              <span className="oh-collapse-label">Options</span>
            </Button>
          </Tooltip>
        </Dropdown>

        <Tooltip title={<ShortcutHintTitle label={helpLabel}>Keyboard shortcuts</ShortcutHintTitle>}>
          <span
            className="kbd-key oh-help-shortcut"
            role="button"
            tabIndex={0}
            onClick={() => setIsShortcutsOverlayVisible((prev: boolean) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setIsShortcutsOverlayVisible((prev: boolean) => !prev);
            }}
            style={{ cursor: 'pointer', marginLeft: '4px' }}
          >
            ?
          </span>
        </Tooltip>
      </div>

      <div>
        <Space size={8} align="center">
          <Text className="oh-version" style={{ fontSize: '11px', color: token.colorTextTertiary }}>
            v{version}
          </Text>
          <Tooltip title="Help us with a star on GitHub">
            <Button
              className="github-star-button"
              type="text"
              icon={<StarOutlined />}
              onClick={() => {
                void chrome.tabs.create({ url: 'https://github.com/OpenHeaders/open-headers-app' });
              }}
              size="small"
              style={{ padding: '0 4px', height: '20px', minWidth: 'auto' }}
            />
          </Tooltip>
          <Tooltip title="Visit our website">
            <Button
              className="oh-decorative"
              type="text"
              icon={<GlobalOutlined />}
              onClick={handleOpenWebsite}
              size="small"
              style={{ padding: '0 4px', height: '20px', minWidth: 'auto' }}
            />
          </Tooltip>
        </Space>
      </div>
    </div>
  );
};

export default Footer;
