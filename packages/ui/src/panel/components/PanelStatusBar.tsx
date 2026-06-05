/**
 * PanelStatusBar — DevTools panel footer with traffic counts, the
 * shared system-status pill, theme dropdown, and version. The panel
 * toggles + layout menu live in PanelToolbar so layout chrome stays
 * at the top across all surfaces.
 */

import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import { useTheme } from '@openheaders/ui/context';
import { productStatusExtras, StatusPill } from '@openheaders/ui/shared/status';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { Dropdown, type MenuProps, Space, theme, Tooltip } from 'antd';
import type React from 'react';

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
  /** Requests whose rules actually ran. */
  modifiedCount?: number;
  /** Requests that failed or returned an error status. */
  failedCount?: number;
  /** Requests served from cache. */
  cachedCount?: number;
  /** Distinct navigations observed — drives the current-page label. */
  pageCount?: number;
  /** Origin of the navigation the timing milestones describe. */
  pageOrigin?: string | null;
  /**
   * This tab's requests are sourced from the higher-fidelity DevTools
   * protocol (CDP) rather than the default path — shows the "CDP-enhanced"
   * pill so the user knows the rows carry richer data.
   */
  cdpEnhanced?: boolean;
}

function formatTiming(ms: number | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Host portion of an origin for the compact current-page label. */
function originHost(origin: string | null | undefined): string {
  if (!origin) return '';
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

const PanelStatusBar: React.FC<PanelStatusBarProps> = ({
  requestCount,
  transferredSize,
  resourceSize,
  finishTime,
  dclMs,
  loadMs,
  tabCount,
  modifiedCount = 0,
  failedCount = 0,
  cachedCount = 0,
  pageOrigin,
  cdpEnhanced = false,
}) => {
  const { token } = theme.useToken();
  const { themeMode, setThemeMode } = useTheme();

  const showVersion = useSettingValue('devpanelLayout.footerShowVersion');
  const showThemeSwitcher = useSettingValue('devpanelLayout.footerShowThemeSwitcher');
  const showModified = useSettingValue('devpanelLayout.footerShowModified');
  const showFailed = useSettingValue('devpanelLayout.footerShowFailed');
  const showCached = useSettingValue('devpanelLayout.footerShowCached');
  const showPageContext = useSettingValue('devpanelLayout.footerShowPageContext');

  const dclText = formatTiming(dclMs);
  const loadText = formatTiming(loadMs);
  const hasTiming = Boolean(finishTime || dclText || loadText);
  const pageHost = originHost(pageOrigin);
  // Each chip is visible iff its View toggle is on — the count/host is
  // still shown at zero so toggling is always observable. The page label
  // additionally needs a known host + timing to anchor to.
  const showPageLabel = showPageContext && hasTiming && pageHost !== '';

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
        {/* Cumulative traffic across whatever the log holds. */}
        <span className="rules-statusbar-item">
          {requestCount} request{requestCount === 1 ? '' : 's'}
        </span>
        {showModified && (
          <span
            className="rules-statusbar-item"
            style={{ color: modifiedCount > 0 ? token.colorPrimary : token.colorTextTertiary }}
            title="Requests your rules modified"
          >
            {modifiedCount} modified
          </span>
        )}
        {showFailed && (
          <span
            className="rules-statusbar-item"
            style={{ color: failedCount > 0 ? token.colorError : token.colorTextTertiary }}
            title="Failed or error-status requests"
          >
            {failedCount} failed
          </span>
        )}
        {showCached && (
          <span className="rules-statusbar-item" style={{ color: token.colorTextTertiary }} title="Requests served from cache">
            {cachedCount} cached
          </span>
        )}
        <span className="rules-statusbar-item">
          {transferredSize} transferred
          {resourceSize && resourceSize !== transferredSize ? ` / ${resourceSize} resources` : ''}
        </span>

        {/* This-navigation milestones — divider keeps them legibly apart
            from the cumulative counts so Finish reads as per-page. */}
        {hasTiming && <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />}
        {finishTime && <span className="rules-statusbar-item">Finish: {finishTime}</span>}
        {dclText && (
          <span className="rules-statusbar-item" style={{ color: '#1a73e8' }} title="DOMContentLoaded">
            DOMContentLoaded: {dclText}
          </span>
        )}
        {loadText && (
          <span className="rules-statusbar-item" style={{ color: '#d93025' }} title="Load event">
            Load: {loadText}
          </span>
        )}
        {hasTiming && showPageLabel && (
          <span className="rules-statusbar-item" style={{ color: token.colorTextTertiary }} title={pageOrigin ?? undefined}>
            {pageHost}
          </span>
        )}

        {tabCount > 0 && (
          <span className="rules-statusbar-item">
            {tabCount} tab{tabCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="rules-statusbar-right">
        {cdpEnhanced && (
          <>
            <Tooltip title="This tab's requests use higher-fidelity DevTools-protocol data: the exact initiator call stack, precise block reasons, and on-the-wire headers.">
              <span
                className="rules-statusbar-item"
                style={{ color: token.colorSuccess, fontWeight: 500, cursor: 'default' }}
              >
                CDP-enhanced
              </span>
            </Tooltip>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorderSecondary }} />
          </>
        )}
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
