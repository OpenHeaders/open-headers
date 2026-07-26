/**
 * PanelStatusBar — DevTools panel footer with traffic counts, the
 * shared system-status pill, theme dropdown, and version. The panel
 * toggles + layout menu live in PanelToolbar so layout chrome stays
 * at the top across all surfaces.
 *
 * Under the Focused-tool footer scope (`devpanelLayout.footerScope`)
 * the left side follows the focused tool window: Storage and Console
 * render the lines they publish through the footer-status store,
 * Search its session summary; everything else falls back to the
 * Network figures.
 */

import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { DebugModeDormantNotice, DebugModePill } from '@openheaders/ui/shared/debug-mode';
import {
  AddonsPill,
  productStatusExtras,
  productStatusInlineActions,
  StatusPill,
  type StatusPillProps,
} from '@openheaders/ui/shared/status';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { Dropdown, type MenuProps, Space, theme } from 'antd';
import type React from 'react';
import { type SearchFooterStatus, searchFooterLine } from '../data/footer-status';
import { useConsoleFooterStatus, useStorageFooterStatus } from '../data/stores/footer-status-store';
import type { PanelToolWindowId } from '../data/tool-windows';
import { type FocusedToolLayout, useFocusedToolWindow } from '../data/use-focused-tool-window';
import { formatFooterDuration } from '../data/timing/footer-timing';

declare const __APP_VERSION__: string;

type ThemeMode = 'light' | 'dark' | 'auto';

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; textKey: MessageKey }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, textKey: 'panel.status.theme.light' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, textKey: 'panel.status.theme.dark' },
  auto: { icon: <span style={{ fontSize: 12 }}>{'◐'}</span>, textKey: 'panel.status.theme.auto' },
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
  /** Tool-window layout — resolves which window the focused dock shows,
   * for the Focused-tool footer scope. */
  tl: FocusedToolLayout;
  /** Search state summary — rendered while Search is the focused tool. */
  searchStatus: SearchFooterStatus;
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

interface NetworkFooterClusterProps {
  requestCount: number;
  transferredSize: string;
  resourceSize: string;
  subset?: FooterSubset;
  finishTime: string;
  dclText: string;
  loadText: string;
  modifiedCount: number;
  failedCount: number;
  cachedCount: number;
  showModified: boolean;
  showFailed: boolean;
  showCached: boolean;
  showPageLabel: boolean;
  pageHost: string;
  pageOrigin?: string | null;
  hasTiming: boolean;
}

/** The Network tool's footer figures — today's always-on line, and the
 *  fallback every tool without its own summary renders. */
const NetworkFooterCluster: React.FC<NetworkFooterClusterProps> = ({
  requestCount,
  transferredSize,
  resourceSize,
  subset,
  finishTime,
  dclText,
  loadText,
  modifiedCount,
  failedCount,
  cachedCount,
  showModified,
  showFailed,
  showCached,
  showPageLabel,
  pageHost,
  pageOrigin,
  hasTiming,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <>
      {/* Cumulative traffic across whatever the log holds — or `subset / total`
          while a filter hides rows (browser summary-bar parity). The
          `dt-resp-hide-*` classes shed lower-value figures as the panel
          narrows (panel-responsive.css); the request count survives every
          tier. */}
      <span className="rules-statusbar-item">
        {subset
          ? t('panel.status.requestsSubset', { subset: subset.requestCount, total: requestCount })
          : t('panel.status.requests', { count: requestCount })}
      </span>
      {showModified && (
        <span
          className="rules-statusbar-item dt-resp-hide-sm"
          style={{ color: modifiedCount > 0 ? token.colorPrimary : token.colorTextTertiary }}
          title={t('panel.status.modifiedTitle')}
        >
          {t('panel.status.modified', { count: modifiedCount })}
        </span>
      )}
      {showFailed && (
        <span
          className="rules-statusbar-item dt-resp-hide-sm"
          style={{ color: failedCount > 0 ? token.colorError : token.colorTextTertiary }}
          title={t('panel.status.failedTitle')}
        >
          {t('panel.status.failed', { count: failedCount })}
        </span>
      )}
      {showCached && (
        <span
          className="rules-statusbar-item dt-resp-hide-md"
          style={{ color: token.colorTextTertiary }}
          title={t('panel.status.cachedTitle')}
        >
          {t('panel.status.cached', { count: cachedCount })}
        </span>
      )}
      {subset ? (
        <>
          <span className="rules-statusbar-item dt-resp-hide-sm">
            {t('panel.status.transferredSubset', { subset: subset.transferredSize, total: subset.totalTransferredSize })}
          </span>
          <span className="rules-statusbar-item dt-resp-hide-sm">
            {t('panel.status.resourcesSubset', { subset: subset.resourceSize, total: subset.totalResourceSize })}
          </span>
        </>
      ) : (
        <span className="rules-statusbar-item dt-resp-hide-sm">
          {resourceSize && resourceSize !== transferredSize
            ? t('panel.status.transferredAndResources', { transferred: transferredSize, resources: resourceSize })
            : t('panel.status.transferredOnly', { size: transferredSize })}
        </span>
      )}

      {/* This-navigation milestones. The per-item dividers (panel-shell.css)
          already separate Finish from the cumulative counts. DOMContentLoaded
          and Load figures keep the raw event names (English boundary). */}
      {finishTime && (
        <span className="rules-statusbar-item dt-resp-hide-md">{t('panel.status.finish', { time: finishTime })}</span>
      )}
      {dclText && (
        <span className="rules-statusbar-item dt-resp-hide-md" style={{ color: '#1a73e8' }} title="DOMContentLoaded">
          DOMContentLoaded: {dclText}
        </span>
      )}
      {loadText && (
        <span
          className="rules-statusbar-item dt-resp-hide-md"
          style={{ color: '#d93025' }}
          title={t('panel.status.loadEventTitle')}
        >
          Load: {loadText}
        </span>
      )}
      {hasTiming && showPageLabel && (
        <span
          className="rules-statusbar-item dt-resp-hide-md"
          style={{ color: token.colorTextTertiary }}
          title={pageOrigin ?? undefined}
        >
          {pageHost}
        </span>
      )}
    </>
  );
};

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
  tl,
  searchStatus,
}) => {
  const t = useT();
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

  // Focused-tool footer scope: which tool window's summary the left side
  // shows. `network` keeps today's line; `focused` follows the focused
  // dock's active window — Storage / Console publish their lines through
  // the footer-status store (their state lives in their views), Search
  // rides the App-level session. A tool with nothing to say (no status
  // published, idle search, other tools) falls back to the Network line.
  const footerScope = useSettingValue('devpanelLayout.footerScope');
  const focusedTool = useFocusedToolWindow(tl);
  const storageStatus = useStorageFooterStatus();
  const consoleStatus = useConsoleFooterStatus();
  const searchLine = searchFooterLine(t, searchStatus);
  const scopedTool: PanelToolWindowId = footerScope === 'focused' ? focusedTool : 'network';
  const footerTool: 'network' | 'storage' | 'console' | 'search' =
    scopedTool === 'storage' && storageStatus !== null && (storageStatus.summary !== '' || storageStatus.alert !== '')
      ? 'storage'
      : scopedTool === 'console' && consoleStatus !== null
        ? 'console'
        : scopedTool === 'search' && searchLine !== ''
          ? 'search'
          : 'network';

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
        color: token.colorTextSecondary,
      }}
    >
      <div className="rules-statusbar-left">
        {footerTool === 'storage' && storageStatus !== null ? (
          <>
            {storageStatus.summary !== '' && <span className="rules-statusbar-item">{storageStatus.summary}</span>}
            {storageStatus.matches !== '' && (
              <span className="rules-statusbar-item" style={{ color: token.colorTextTertiary }}>
                {storageStatus.matches}
              </span>
            )}
            {storageStatus.alert !== '' && (
              <span className="rules-statusbar-item" style={{ color: token.colorError }}>
                {storageStatus.alert}
              </span>
            )}
          </>
        ) : footerTool === 'console' && consoleStatus !== null ? (
          <>
            <span className="rules-statusbar-item">
              {consoleStatus.visibleCount !== consoleStatus.totalCount
                ? t('panel.status.messagesOf', { visible: consoleStatus.visibleCount, total: consoleStatus.totalCount })
                : t('panel.status.messages', { count: consoleStatus.totalCount })}
            </span>
            <span
              className="rules-statusbar-item"
              style={{ color: consoleStatus.errorCount > 0 ? token.colorError : token.colorTextTertiary }}
              title={t('panel.status.errorsTitle')}
            >
              {t('panel.status.errors', { count: consoleStatus.errorCount })}
            </span>
            <span
              className="rules-statusbar-item"
              style={{ color: consoleStatus.warningCount > 0 ? token.colorWarning : token.colorTextTertiary }}
              title={t('panel.status.warningsTitle')}
            >
              {t('panel.status.warnings', { count: consoleStatus.warningCount })}
            </span>
          </>
        ) : footerTool === 'search' ? (
          <span className="rules-statusbar-item">{searchLine}</span>
        ) : (
          <NetworkFooterCluster
            requestCount={requestCount}
            transferredSize={transferredSize}
            resourceSize={resourceSize}
            subset={subset}
            finishTime={finishTime}
            dclText={dclText}
            loadText={loadText}
            modifiedCount={modifiedCount}
            failedCount={failedCount}
            cachedCount={cachedCount}
            showModified={showModified}
            showFailed={showFailed}
            showCached={showCached}
            showPageLabel={showPageLabel}
            pageHost={pageHost}
            pageOrigin={pageOrigin}
            hasTiming={hasTiming}
          />
        )}

        {tabCount > 0 && (
          <span className="rules-statusbar-item dt-resp-hide-sm">{t('panel.status.tabs', { count: tabCount })}</span>
        )}
      </div>
      <div className="rules-statusbar-right">
        <DebugModeDormantNotice tabSource="inspected" hasRealizableRule={hasRealizableDebugRule} />
        {/* Classed wrapper: the onboarding tour's finale anchors here. */}
        <span className="dt-footer-debug-cluster" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <DebugModePill tabSource="inspected" onOpenDocs={handleOpenDocs} />
        </span>
        <StatusPill
          density="full"
          label={t('panel.status.systemStatus')}
          renderSubsystemExtras={productStatusExtras}
          renderSubsystemInlineAction={productStatusInlineActions}
          onOpenDocs={handleOpenDocs}
        />
        <span className="dt-resp-hide-sm" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <AddonsPill />
        </span>
        {showThemeSwitcher && (
          <>
            <div className="rules-statusbar-divider dt-resp-hide-md" style={{ background: token.colorBorderSecondary }} />
            <Dropdown
              menu={{
                items: (['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => ({
                  key: mode,
                  label: (
                    <Space size={4}>
                      {THEME_DISPLAY[mode].icon}
                      <span>{t(THEME_DISPLAY[mode].textKey)}</span>
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
                className="rules-statusbar-item dt-resp-hide-md"
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
                <span style={{ fontSize: 10 }}>
                  {THEME_DISPLAY[themeMode as ThemeMode] ? t(THEME_DISPLAY[themeMode as ThemeMode].textKey) : null}
                </span>
              </div>
            </Dropdown>
          </>
        )}
        {showVersion && (
          <>
            <div className="rules-statusbar-divider dt-resp-hide-lg" style={{ background: token.colorBorderSecondary }} />
            <span className="rules-statusbar-item dt-resp-hide-lg" style={{ fontSize: 10, color: token.colorTextTertiary }}>
              v{__APP_VERSION__}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default PanelStatusBar;
