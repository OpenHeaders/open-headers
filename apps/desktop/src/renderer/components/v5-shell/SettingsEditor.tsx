/**
 * SettingsEditor — full-page settings view rendered in the editor area.
 *
 * IDE-style: left nav, right content. Auto-saves on change.
 */

import {
  ApiOutlined,
  AppstoreOutlined,
  BgColorsOutlined,
  BranchesOutlined,
  BugOutlined,
  CloudDownloadOutlined,
  CodeOutlined,
  CompressOutlined,
  DatabaseOutlined,
  EyeInvisibleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  HighlightOutlined,
  LoginOutlined,
  MenuOutlined,
  MoonOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  SunOutlined,
  SyncOutlined,
  VerticalAlignMiddleOutlined,
  VideoCameraOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Select, Space, Switch, Tooltip, Typography, theme } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { useSettings, useTheme } from '@/renderer/contexts';
import type { AppSettings } from '@/types/settings';

const { Text, Title } = Typography;

// ── Section nav items ─────────────────────────────────────────────

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'general', label: 'General', icon: <SettingOutlined /> },
  { key: 'appearance', label: 'Appearance', icon: <BgColorsOutlined /> },
  { key: 'proxy', label: 'Proxy & Recording', icon: <ApiOutlined /> },
  { key: 'developer', label: 'Developer', icon: <CodeOutlined /> },
];

// ── Setting row ───────────────────────────────────────────────────

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
  children: React.ReactNode;
}

function SettingRow({ icon, title, description, disabled, tooltip, children }: SettingRowProps) {
  const { token } = theme.useToken();
  const row = (
    <div
      className="v5-settings-row"
      style={{
        opacity: disabled ? 0.5 : 1,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-settings-row-left">
        <span className="v5-settings-row-icon" style={{ color: token.colorTextTertiary }}>
          {icon}
        </span>
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{title}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {description}
          </Text>
        </div>
      </div>
      <div className="v5-settings-row-right">{children}</div>
    </div>
  );
  return tooltip ? <Tooltip title={tooltip}>{row}</Tooltip> : row;
}

// ── Main component ────────────────────────────────────────────────

export function SettingsEditor() {
  const { token } = theme.useToken();
  const { settings, saveSettings } = useSettings();
  const { themeMode } = useTheme();
  const [activeSection, setActiveSection] = useState('general');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-save helper
  const handleChange = useCallback(
    (field: keyof AppSettings, value: unknown) => {
      const updates: Partial<AppSettings> = { [field]: value };

      // Dependencies
      if (field === 'launchAtLogin' && !value) {
        updates.hideOnLaunch = false;
      }
      if (field === 'autoHighlightTableEntries' && !value) {
        updates.autoScrollTableEntries = false;
      }
      if (field === 'videoRecording' && !value) {
        updates.videoQuality = 'high';
      }

      void saveSettings(updates);
    },
    [saveSettings],
  );

  const scrollToSection = (key: string) => {
    setActiveSection(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOpenPath = (pathKey: string) => {
    void window.electronAPI.openAppPath(pathKey);
  };

  return (
    <div className="v5-settings" style={{ background: token.colorBgContainer }}>
      {/* Left nav */}
      <div className="v5-settings-nav" style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}>
        <Text type="secondary" style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, padding: '12px 16px 6px' }}>
          SETTINGS
        </Text>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`v5-settings-nav-item ${activeSection === item.key ? 'active' : ''}`}
            style={
              activeSection === item.key
                ? { background: token.colorPrimaryBg, color: token.colorPrimary }
                : { color: token.colorText }
            }
            onClick={() => scrollToSection(item.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') scrollToSection(item.key);
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Right content */}
      <div className="v5-settings-content">
        {/* ── General ──────────────────────────────────────── */}
        <div
          ref={(el) => {
            sectionRefs.current.general = el;
          }}
        >
          <Title level={5} style={{ marginBottom: 16 }}>
            General
          </Title>

          <SettingRow icon={<LoginOutlined />} title="Open at login" description="Start automatically when you log in">
            <Switch checked={settings.launchAtLogin} onChange={(v) => handleChange('launchAtLogin', v)} size="small" />
          </SettingRow>

          <SettingRow
            icon={<EyeInvisibleOutlined />}
            title="Hide on start"
            description="Start automatically in background mode"
            disabled={!settings.launchAtLogin}
            tooltip={!settings.launchAtLogin ? "Enable 'Open at login' first" : undefined}
          >
            <Switch
              checked={settings.hideOnLaunch}
              onChange={(v) => handleChange('hideOnLaunch', v)}
              disabled={!settings.launchAtLogin}
              size="small"
            />
          </SettingRow>

          <SettingRow
            icon={<CloudDownloadOutlined />}
            title="Auto-update"
            description="Automatically check for and download updates"
          >
            <Switch
              checked={settings.autoUpdate !== false}
              onChange={(v) => handleChange('autoUpdate', v)}
              size="small"
            />
          </SettingRow>

          <SettingRow icon={<BranchesOutlined />} title="Update channel" description="Choose which releases to receive">
            <Select
              size="small"
              style={{ width: 130 }}
              value={settings.updateChannel || 'production'}
              onChange={(v) => handleChange('updateChannel', v)}
              options={[
                { value: 'production', label: 'Production' },
                { value: 'beta', label: 'Beta' },
              ]}
            />
          </SettingRow>
        </div>

        {/* ── Appearance ───────────────────────────────────── */}
        <div
          ref={(el) => {
            sectionRefs.current.appearance = el;
          }}
          style={{ marginTop: 32 }}
        >
          <Title level={5} style={{ marginBottom: 16 }}>
            Appearance
          </Title>

          <SettingRow icon={<BgColorsOutlined />} title="Theme" description="Choose your preferred color scheme">
            <Select
              size="small"
              style={{ width: 130 }}
              value={settings.theme || themeMode}
              onChange={(v) => handleChange('theme', v)}
              options={[
                {
                  value: 'auto',
                  label: (
                    <Space size={4}>
                      <SyncOutlined style={{ fontSize: 11 }} /> Auto
                    </Space>
                  ),
                },
                {
                  value: 'light',
                  label: (
                    <Space size={4}>
                      <SunOutlined style={{ fontSize: 11 }} /> Light
                    </Space>
                  ),
                },
                {
                  value: 'dark',
                  label: (
                    <Space size={4}>
                      <MoonOutlined style={{ fontSize: 11 }} /> Dark
                    </Space>
                  ),
                },
              ]}
            />
          </SettingRow>

          <SettingRow
            icon={<AppstoreOutlined />}
            title="Show in Dock"
            description="Display app icon in the Dock (macOS)"
          >
            <Switch checked={settings.showDockIcon} onChange={(v) => handleChange('showDockIcon', v)} size="small" />
          </SettingRow>

          <SettingRow
            icon={<MenuOutlined />}
            title="Show in menu bar"
            description="Display icon in the system tray / menu bar"
          >
            <Switch
              checked={settings.showStatusBarIcon}
              onChange={(v) => handleChange('showStatusBarIcon', v)}
              size="small"
            />
          </SettingRow>

          <SettingRow
            icon={<CompressOutlined />}
            title="Compact mode"
            description="Reduce spacing for a denser interface"
          >
            <Switch checked={settings.compactMode} onChange={(v) => handleChange('compactMode', v)} size="small" />
          </SettingRow>

          <SettingRow
            icon={<QuestionCircleOutlined />}
            title="Tutorial mode"
            description="Show helpful information panels throughout the app"
          >
            <Switch checked={settings.tutorialMode} onChange={(v) => handleChange('tutorialMode', v)} size="small" />
          </SettingRow>
        </div>

        {/* ── Proxy & Recording ────────────────────────────── */}
        <div
          ref={(el) => {
            sectionRefs.current.proxy = el;
          }}
          style={{ marginTop: 32 }}
        >
          <Title level={5} style={{ marginBottom: 16 }}>
            Proxy & Recording
          </Title>

          <SettingRow
            icon={<ApiOutlined />}
            title="Proxy auto-start"
            description="Start proxy server automatically when app launches"
          >
            <Switch
              checked={settings.autoStartProxy}
              onChange={(v) => handleChange('autoStartProxy', v)}
              size="small"
            />
          </SettingRow>

          <SettingRow
            icon={<DatabaseOutlined />}
            title="Proxy resource cache"
            description="Cache resources for faster recording playback"
          >
            <Switch
              checked={settings.proxyCacheEnabled}
              onChange={(v) => handleChange('proxyCacheEnabled', v)}
              size="small"
            />
          </SettingRow>

          <SettingRow
            icon={<VideoCameraOutlined />}
            title="Video recording"
            description="Enable screen video recording alongside session recording"
          >
            <Switch
              checked={settings.videoRecording}
              onChange={(v) => handleChange('videoRecording', v)}
              size="small"
            />
          </SettingRow>

          <SettingRow
            icon={<SettingOutlined />}
            title="Video quality"
            description="Video recording quality preset"
            disabled={!settings.videoRecording}
            tooltip={!settings.videoRecording ? "Enable 'Video recording' first" : undefined}
          >
            <Select
              size="small"
              style={{ width: 150 }}
              value={settings.videoQuality || 'high'}
              onChange={(v) => handleChange('videoQuality', v)}
              disabled={!settings.videoRecording}
              options={[
                { value: 'standard', label: 'Standard (5 Mbps)' },
                { value: 'high', label: 'High (10 Mbps)' },
                { value: 'ultra', label: 'Ultra (20 Mbps)' },
              ]}
            />
          </SettingRow>

          <SettingRow
            icon={<HighlightOutlined />}
            title="Auto-highlight table entries"
            description="Highlight table entries based on current record timestamp"
          >
            <Switch
              checked={settings.autoHighlightTableEntries}
              onChange={(v) => handleChange('autoHighlightTableEntries', v)}
              size="small"
            />
          </SettingRow>

          <SettingRow
            icon={<VerticalAlignMiddleOutlined />}
            title="Auto-scroll table entries"
            description="Synchronize table view with current record timestamp"
            disabled={!settings.autoHighlightTableEntries}
            tooltip={!settings.autoHighlightTableEntries ? "Enable 'Auto-highlight' first" : undefined}
          >
            <Switch
              checked={settings.autoScrollTableEntries}
              onChange={(v) => handleChange('autoScrollTableEntries', v)}
              disabled={!settings.autoHighlightTableEntries}
              size="small"
            />
          </SettingRow>
        </div>

        {/* ── Developer ────────────────────────────────────── */}
        <div
          ref={(el) => {
            sectionRefs.current.developer = el;
          }}
          style={{ marginTop: 32 }}
        >
          <Title level={5} style={{ marginBottom: 16 }}>
            Developer
          </Title>

          <SettingRow
            icon={<CodeOutlined />}
            title="Developer mode"
            description="Show technical information and debug panels"
          >
            <Switch checked={settings.developerMode} onChange={(v) => handleChange('developerMode', v)} size="small" />
          </SettingRow>

          <SettingRow
            icon={<FileTextOutlined />}
            title="Log level"
            description="Control the verbosity of application logs"
          >
            <Select
              size="small"
              style={{ width: 130 }}
              value={settings.logLevel || 'info'}
              onChange={(v) => handleChange('logLevel', v)}
              options={[
                {
                  value: 'error',
                  label: (
                    <Space size={4}>
                      <WarningOutlined style={{ fontSize: 11, color: '#ff4d4f' }} /> Error
                    </Space>
                  ),
                },
                {
                  value: 'warn',
                  label: (
                    <Space size={4}>
                      <WarningOutlined style={{ fontSize: 11, color: '#faad14' }} /> Warning
                    </Space>
                  ),
                },
                {
                  value: 'info',
                  label: (
                    <Space size={4}>
                      <BugOutlined style={{ fontSize: 11, color: '#1890ff' }} /> Info
                    </Space>
                  ),
                },
                {
                  value: 'debug',
                  label: (
                    <Space size={4}>
                      <BugOutlined style={{ fontSize: 11, color: '#52c41a' }} /> Debug
                    </Space>
                  ),
                },
              ]}
            />
          </SettingRow>

          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
              QUICK ACCESS
            </Text>
            <Space style={{ width: '100%', marginTop: 8 }} size={8}>
              <Button size="small" icon={<FolderOpenOutlined />} onClick={() => handleOpenPath('logs')}>
                Logs
              </Button>
              <Button size="small" icon={<FolderOutlined />} onClick={() => handleOpenPath('userData')}>
                App Data
              </Button>
              <Button size="small" icon={<FileSearchOutlined />} onClick={() => handleOpenPath('settings')}>
                Settings File
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
}
