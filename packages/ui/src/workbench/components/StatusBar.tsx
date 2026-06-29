/**
 * StatusBar — bottom bar with breadcrumb, status pill, theme dropdown,
 * and version. The panel toggles and layout menu live in the top bar
 * (see TopBar.tsx) so the footer stays focused on status, not chrome.
 *
 * Theme switcher and version visibility are gated by
 * `workspaceLayout.footerShow*` settings exposed in the Settings page.
 */

import { BulbFilled, BulbOutlined } from '@ant-design/icons';
import { Dropdown, type MenuProps, Space, theme } from 'antd';
import type React from 'react';
import { useActiveEditorLifecycle } from '@openheaders/ui/shared/awareness';
import { DebugModePill } from '@openheaders/ui/shared/debug-mode';
import { LifecyclePill } from '@openheaders/ui/shared/editor-shell';
import { productStatusExtras, StatusPill } from '@openheaders/ui/shared/status';
import { useInspectorNav } from '../hooks/useInspectorNav';
import { setSettingValue } from '../settings';
import { useSettingValue } from '../settings/hooks';
import BreadcrumbBar from './BreadcrumbBar';
import { renderWorkspacePrefix } from './workspace-prefix';

type ThemeMode = 'light' | 'dark' | 'auto';

declare const __APP_VERSION__: string;

interface StatusBarProps {
  /** Active workspace — renders as the leading breadcrumb chip (icon + name). */
  workspace?: { name: string; icon?: string; color?: string };
  /** Breadcrumb path of the focused-leaf active tab (excluding workspace). */
  segments: string[];
  onRename?: (newName: string) => void;
  autoRenameKey?: string | null;
}

const THEME_DISPLAY: Record<ThemeMode, { icon: React.ReactNode; text: string; color: string }> = {
  light: { icon: <BulbOutlined style={{ fontSize: 12 }} />, text: 'Light', color: '#faad14' },
  dark: { icon: <BulbFilled style={{ fontSize: 12 }} />, text: 'Dark', color: '#722ed1' },
  auto: { icon: <span style={{ fontSize: 12 }}>&#x25D0;</span>, text: 'Auto', color: '#1890ff' },
};

const StatusBar: React.FC<StatusBarProps> = ({
  workspace,
  segments,
  onRename,
  autoRenameKey,
}) => {
  const { token } = theme.useToken();
  const themeMode = useSettingValue('appearance.theme');
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
          trailingNode={lifecycle?.status ? <LifecyclePill status={lifecycle.status} placement="top" /> : null}
        />
      </div>

      <div className="rules-statusbar-right">
        <DebugModePill tabSource="none" onOpenDocs={openDocs} />
        <StatusPill
          density="full"
          label="System status"
          renderSubsystemExtras={productStatusExtras}
          onOpenDocs={openDocs}
        />
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
                      <span>{THEME_DISPLAY[mode].text}</span>
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
