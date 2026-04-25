/**
 * PanelStatusBar — DevTools panel footer with traffic counts, the
 * shared system-status pill, theme dropdown, and version. The panel
 * toggles + layout menu live in PanelToolbar so layout chrome stays
 * at the top across all surfaces.
 */

import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import { Dropdown, type MenuProps, Space, theme } from 'antd';
import type React from 'react';
import { productStatusExtras, StatusPill } from '@/shared/status';
import { useSettingValue } from '@/workbench/settings/hooks';

declare const __APP_VERSION__: string;

type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; text: string; color: string }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, text: 'Light', color: '#faad14' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, text: 'Dark', color: '#722ed1' },
  auto: { icon: <span style={{ fontSize: 12 }}>{'◐'}</span>, text: 'Auto', color: '#1890ff' },
};

interface PanelStatusBarProps {
  requestCount: number;
  transferredSize: string;
  resourceSize: string;
  finishTime: string;
  dclMs?: number;
  loadMs?: number;
  tabCount: number;
}

function formatTiming(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

const PanelStatusBar: React.FC<PanelStatusBarProps> = ({
  requestCount,
  transferredSize,
  resourceSize,
  finishTime,
  dclMs,
  loadMs,
  tabCount,
}) => {
  const { token } = theme.useToken();
  const { themeMode, setThemeMode } = useTheme();

  const showVersion = useSettingValue('devpanelLayout.footerShowVersion');
  const showThemeSwitcher = useSettingValue('devpanelLayout.footerShowThemeSwitcher');

  return (
    <div
      className="rules-statusbar"
      style={{
        background: token.colorBgLayout,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        color: token.colorTextSecondary,
      }}
    >
      <div className="rules-statusbar-left">
        <span className="rules-statusbar-item">
          {requestCount} request{requestCount === 1 ? '' : 's'}
        </span>
        <span className="rules-statusbar-item">
          {transferredSize} transferred
          {resourceSize && resourceSize !== transferredSize ? ` / ${resourceSize} resources` : ''}
        </span>
        {finishTime && <span className="rules-statusbar-item">Finish: {finishTime}</span>}
        {formatTiming(dclMs) && (
          <span className="rules-statusbar-item" style={{ color: '#1a73e8' }} title="DOMContentLoaded">
            DOMContentLoaded: {formatTiming(dclMs)}
          </span>
        )}
        {formatTiming(loadMs) && (
          <span className="rules-statusbar-item" style={{ color: '#d93025' }} title="Load event">
            Load: {formatTiming(loadMs)}
          </span>
        )}
        {tabCount > 0 && (
          <span className="rules-statusbar-item">
            {tabCount} tab{tabCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="rules-statusbar-right">
        <StatusPill density="full" label="System status" renderSubsystemExtras={productStatusExtras} />
        {showThemeSwitcher && (
          <>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
            <Dropdown
              menu={{
                items: (['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => ({
                  key: mode,
                  label: (
                    <Space size={4}>
                      {THEME_DISPLAY[mode].icon}
                      <span>{THEME_DISPLAY[mode].text}</span>
                      {themeMode === mode && <span style={{ marginLeft: 4 }}>{'✓'}</span>}
                    </Space>
                  ),
                  onClick: () => setThemeMode(mode),
                })) as MenuProps['items'],
              }}
              placement="topRight"
              trigger={['click']}
            >
              <div
                className="rules-statusbar-item"
                role="button"
                tabIndex={0}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: THEME_DISPLAY[themeMode as ThemeMode]?.color,
                }}
              >
                {THEME_DISPLAY[themeMode as ThemeMode]?.icon}
                <span style={{ fontSize: 10 }}>{THEME_DISPLAY[themeMode as ThemeMode]?.text}</span>
              </div>
            </Dropdown>
          </>
        )}
        {showVersion && (
          <>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
            <span className="rules-statusbar-item" style={{ fontSize: 10, color: token.colorTextTertiary }}>
              v{__APP_VERSION__}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default PanelStatusBar;
