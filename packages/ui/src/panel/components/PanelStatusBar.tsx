/**
 * PanelStatusBar — DevTools panel footer with traffic counts, the
 * shared system-status pill, theme dropdown, and version. The panel
 * toggles + layout menu live in PanelToolbar so layout chrome stays
 * at the top across all surfaces.
 */

import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import { useTheme } from '@openheaders/ui/context';
import { DebugModeDormantNotice, DebugModePill } from '@openheaders/ui/shared/debug-mode';
import { productStatusExtras, StatusPill, type StatusPillProps } from '@openheaders/ui/shared/status';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { Dropdown, type MenuProps, Space, theme } from 'antd';
import type React from 'react';
import { formatFooterDuration } from '../data/timing/footer-timing';

declare const __APP_VERSION__: string;

type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; text: string }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, text: 'Light' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, text: 'Dark' },
  auto: { icon: <span style={{ fontSize: 12 }}>{'◐'}</span>, text: 'Auto' },
};

/**
 * Filtered-subset footer figures. Present only when an active filter hides at
 * least one row; the status bar then renders `subset / total` for requests /
 * transferred / resources (the browser's summary-bar behavior). Finish / DCL /
 * Load are page-level and stay full regardless.
 */
interface FooterSubset {
  /** Subset request count (the total count is the `requestCount` prop). */
  requestCount: number;
  /** Subset transferred / resource sizes, both pre-formatted in kB. */
  transferredSize: string;
  resourceSize: string;
  /** Full transferred / resource sizes in the SAME kB unit — the browser keeps
   * both sides of `subset / total` in kB (never rolling to MB) so they compare
   * directly, so the totals here differ from the MB-rolling single-form props. */
  totalTransferredSize: string;
  totalResourceSize: string;
}

interface PanelStatusBarProps {
  requestCount: number;
  transferredSize: string;
  resourceSize: string;
  /** When set (a filter is hiding rows), render `subset / total` for the
   * request/transferred/resource chips. Omitted → single full-total display. */
  subset?: FooterSubset;
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
  /** True when a live debug-tier rule is realizable now (debug-tier + static),
   * so the dormant-notice chip has something to be dormant about. */
  hasRealizableDebugRule?: boolean;
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
  subset,
  finishTime,
  dclMs,
  loadMs,
  tabCount,
  modifiedCount = 0,
  failedCount = 0,
  cachedCount = 0,
  pageOrigin,
  hasRealizableDebugRule = false,
}) => {
  const { token } = theme.useToken();
  const { themeMode, setThemeMode } = useTheme();

  // Per-mode accents from the antd preset palettes — the active algorithm
  // regenerates them per theme, so each hue stays readable on both
  // backgrounds (unlike the fixed hex accents these replaced).
  const themeModeColor: Record<ThemeMode, string> = {
    light: token.gold7,
    dark: token.purple7,
    auto: token.colorPrimary,
  };

  // The DevTools panel can't host the workbench Docs panel itself, so the
  // pill (i) buttons open the workbench and scroll it to the section —
  // same route the popup/sidepanel footer uses (`open-docs` intent).
  const handleOpenDocs: StatusPillProps['onOpenDocs'] = (sectionId) => {
    void openWorkspace({ kind: 'open-docs', section: sectionId }, 'devpanel');
  };

  const showVersion = useSettingValue('devpanelLayout.footerShowVersion');
  const showThemeSwitcher = useSettingValue('devpanelLayout.footerShowThemeSwitcher');
  const showModified = useSettingValue('devpanelLayout.footerShowModified');
  const showFailed = useSettingValue('devpanelLayout.footerShowFailed');
  const showCached = useSettingValue('devpanelLayout.footerShowCached');
  const showPageContext = useSettingValue('devpanelLayout.footerShowPageContext');

  const dclText = formatFooterDuration(dclMs);
  const loadText = formatFooterDuration(loadMs);
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
        {/* Cumulative traffic across whatever the log holds — or `subset / total`
            while a filter hides rows (browser summary-bar parity). */}
        <span className="rules-statusbar-item">
          {subset
            ? `${subset.requestCount} / ${requestCount} requests`
            : `${requestCount} request${requestCount === 1 ? '' : 's'}`}
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
        {subset ? (
          <>
            <span className="rules-statusbar-item">
              {subset.transferredSize} / {subset.totalTransferredSize} transferred
            </span>
            <span className="rules-statusbar-item">
              {subset.resourceSize} / {subset.totalResourceSize} resources
            </span>
          </>
        ) : (
          <span className="rules-statusbar-item">
            {transferredSize} transferred
            {resourceSize && resourceSize !== transferredSize ? ` / ${resourceSize} resources` : ''}
          </span>
        )}

        {/* This-navigation milestones. The per-item dividers (panel-shell.css)
            already separate Finish from the cumulative counts. */}
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
        <DebugModeDormantNotice tabSource="inspected" hasRealizableRule={hasRealizableDebugRule} />
        <DebugModePill tabSource="inspected" onOpenDocs={handleOpenDocs} />
        <StatusPill
          density="full"
          label="System status"
          renderSubsystemExtras={productStatusExtras}
          onOpenDocs={handleOpenDocs}
        />
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
              trigger={['hover']}
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
                  color: themeModeColor[themeMode as ThemeMode] ?? token.colorPrimary,
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
