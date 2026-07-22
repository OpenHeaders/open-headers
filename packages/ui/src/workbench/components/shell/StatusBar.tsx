/**
 * StatusBar — bottom bar with breadcrumb, status pill, theme dropdown,
 * and version. The panel toggles and layout menu live in the top bar
 * (see TopBar.tsx) so the footer stays focused on status, not chrome.
 *
 * Theme switcher and version visibility are gated by
 * `workspaceLayout.footerShow*` settings exposed in the Settings page.
 */

import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import { getLocaleDef, LOCALES, type MessageKey } from '@openheaders/i18n';
import { Dropdown, type MenuProps, Space, theme } from 'antd';
import type React from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { useActiveEditorLifecycle } from '@openheaders/ui/shared/awareness';
import { BackgroundTasksIndicator } from '@openheaders/ui/shared/background-tasks';
import { DebugModePill } from '@openheaders/ui/shared/debug-mode';
import { LifecyclePill } from '@openheaders/ui/shared/editor-shell';
import { LanguageIcon } from '@openheaders/ui/shared/icons';
import { AddonsPill, productStatusExtras, productStatusInlineActions, StatusPill } from '@openheaders/ui/shared/status';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { useSettingValue } from '../../settings/hooks';
import { set as setSettingValue } from '../../settings/store';
import BreadcrumbBar from './BreadcrumbBar';
import { renderWorkspacePrefix } from '../workspace/workspace-prefix';

type ThemeMode = 'light' | 'dark' | 'auto';

declare const __APP_VERSION__: string;

interface StatusBarProps {
  /** Active workspace — renders as the leading breadcrumb chip (icon + name). */
  workspace?: { name: string; icon?: string; color?: string };
  /** Breadcrumb path of the focused-leaf active tab (excluding workspace). */
  segments: string[];
  /** Chrome-only provenance rendered after the last segment (e.g.
   *  `from “‹example›”` on a Try-forked draft). Not part of the path —
   *  stays outside the renameable segment list. */
  provenance?: string;
  onRename?: (newName: string) => void;
  autoRenameKey?: string | null;
}

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; textKey: MessageKey }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, textKey: 'workbench.shell.statusbar.theme.light' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, textKey: 'workbench.shell.statusbar.theme.dark' },
  auto: { icon: <span style={{ fontSize: 12 }}>&#x25D0;</span>, textKey: 'workbench.shell.statusbar.theme.auto' },
};

const StatusBar: React.FC<StatusBarProps> = ({
  workspace,
  segments,
  provenance,
  onRename,
  autoRenameKey,
}) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const themeMode = useSettingValue('appearance.theme');
  const language = useSettingValue('general.language');

  // Per-mode accents from the antd preset palettes — the active algorithm
  // regenerates them per theme, so each hue stays readable on both
  // backgrounds (unlike the fixed hex accents these replaced).
  const themeModeColor: Record<ThemeMode, string> = {
    light: token.gold7,
    dark: token.purple7,
    auto: token.colorPrimary,
  };
  // Mirror TopBar: the footer's left padding expands/contracts with the
  // activity bar so the breadcrumb starts at the same X as "Open Headers"
  // above it, regardless of whether tool-window labels are on.
  const showToolWindowLabels = useSettingValue('workspaceLayout.showToolWindowLabels');
  const barWidthLeft = useSettingValue('workspaceLayout.activityBarWidthLeft');
  const barWidthRight = useSettingValue('workspaceLayout.activityBarWidthRight');
  const activityBarWidthLeft = showToolWindowLabels ? barWidthLeft : 36;
  const activityBarWidthRight = showToolWindowLabels ? barWidthRight : 36;
  const { openDocs } = useInspectorNav();

  const showVersion = useSettingValue('workspaceLayout.footerShowVersion');
  const showThemeSwitcher = useSettingValue('workspaceLayout.footerShowThemeSwitcher');
  const lifecycle = useActiveEditorLifecycle();

  return (
    <div
      className="rules-statusbar"
      style={
        {
          background: token.colorBgLayout,
          color: token.colorTextSecondary,
          '--ab-width-left': `${activityBarWidthLeft}px`,
          '--ab-width-right': `${activityBarWidthRight}px`,
        } as React.CSSProperties
      }
    >
      <div className="rules-statusbar-left">
        <BreadcrumbBar
          leadingNode={
            workspace ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {renderWorkspacePrefix({ icon: workspace.icon, color: workspace.color }, token, { size: 14 })}
                <span
                  style={{
                    color: token.colorTextTertiary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {workspace.name}
                </span>
              </span>
            ) : undefined
          }
          segments={segments}
          onRename={onRename}
          autoRenameKey={autoRenameKey}
          trailingNode={
            provenance || lifecycle?.status ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {provenance && (
                  <span
                    style={{
                      color: token.colorTextTertiary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {provenance}
                  </span>
                )}
                {lifecycle?.status ? <LifecyclePill status={lifecycle.status} placement="top" /> : null}
              </span>
            ) : null
          }
        />
      </div>

      <div className="rules-statusbar-right">
        <BackgroundTasksIndicator />
        <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
        <DebugModePill tabSource="none" onOpenDocs={openDocs} />
        <StatusPill
          density="full"
          label={t('workbench.shell.statusbar.systemStatus')}
          renderSubsystemExtras={productStatusExtras}
          renderSubsystemInlineAction={productStatusInlineActions}
          onOpenDocs={openDocs}
        />
        <AddonsPill />
        {showThemeSwitcher && (
          <>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
            <Dropdown
              menu={{
                items: (['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => ({
                  key: mode,
                  label: (
                    <Space size={4}>
                      {THEME_DISPLAY[mode].icon}
                      <span>{t(THEME_DISPLAY[mode].textKey)}</span>
                      {themeMode === mode && <span style={{ marginLeft: 4 }}>&#x2713;</span>}
                    </Space>
                  ),
                  onClick: () => setSettingValue('appearance.theme', mode),
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
                <span style={{ fontSize: 10 }}>
                  {THEME_DISPLAY[themeMode as ThemeMode] ? t(THEME_DISPLAY[themeMode as ThemeMode].textKey) : null}
                </span>
              </div>
            </Dropdown>
          </>
        )}
        <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
        <Dropdown
          menu={{
            items: [
              {
                key: 'auto',
                label: (
                  <Space size={4}>
                    <span>{t('workbench.settings.def.general.language.option.auto.label')}</span>
                    {language === 'auto' && <span style={{ marginLeft: 4 }}>&#x2713;</span>}
                  </Space>
                ),
                onClick: () => setSettingValue('general.language', 'auto'),
              },
              // Native names are each language's self-designation — never translated.
              ...LOCALES.filter((l) => !l.synthetic).map((l) => ({
                key: l.code,
                label: (
                  <Space size={4}>
                    <span>{l.nativeName}</span>
                    {language === l.code && <span style={{ marginLeft: 4 }}>&#x2713;</span>}
                  </Space>
                ),
                onClick: () => setSettingValue('general.language', l.code),
              })),
            ] as MenuProps['items'],
          }}
          placement="topRight"
          trigger={['hover']}
        >
          <div
            className="rules-statusbar-item"
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <LanguageIcon locale={locale} style={{ fontSize: 13 }} />
            <span style={{ fontSize: 10 }}>{getLocaleDef(locale)?.nativeName}</span>
          </div>
        </Dropdown>
        {showVersion && (
          <>
            <div className="rules-statusbar-divider" style={{ background: token.colorBorder }} />
            <span className="rules-statusbar-item" style={{ fontSize: 10, color: token.colorTextTertiary }}>
              v{__APP_VERSION__}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
