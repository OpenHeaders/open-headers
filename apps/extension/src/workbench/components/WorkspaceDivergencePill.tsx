/**
 * WorkspaceDivergencePill — status-bar pill for the per-tab workspace
 * mode.
 *
 * Three states:
 *
 *   - **Global mode** (`general.workspaceSwitchScope === 'global'`,
 *     default) — neutral/dim pill: "Workspace synced across tabs". The
 *     tooltip teaches the per-tab option. Clicking opens Settings to
 *     the `general.workspaceSwitchScope` row. Surfaced in global mode
 *     so users can discover the per-tab feature without hunting through
 *     Settings.
 *   - **Per-tab mode + bound** (tab matches global default) — neutral
 *     pill: "Per-tab on · bound to default". Clicking opens Settings.
 *   - **Per-tab mode + diverged** (tab ≠ global default) — warning
 *     pill: "<tab name> · default <default name>". Clicking opens a
 *     popover with two actions: re-bind to default (single click), or
 *     promote tab's workspace to global default (confirms first).
 *
 * Composable with `FooterDonorPill` — same surface, same shape, no
 * coupling between the two.
 *
 * See `MULTI_WORKSPACE_PER_WINDOW_OR_TAB_DESIGN.md` § 7.
 */

import { ApartmentOutlined, LinkOutlined } from '@ant-design/icons';
import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Popover, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import type { EditingScopeViewStateApi } from '@/shared/editing-scope-view-state';
import type { WorkbenchViewState } from '../hooks/useToolLayout';
import { readWorkspaceFallThrough } from '../hooks/useToolLayout';
import { useSettingValue } from '../settings/hooks';
import { renderWorkspacePrefix } from './workspace-prefix';

interface WorkspaceDivergencePillProps {
  perTab: EditingScopeViewStateApi<WorkbenchViewState>;
  workspaces: V5.ExtensionWorkspace[];
  setActiveWorkspace: (id: string) => Promise<boolean>;
  openSettings: (target?: { settingKey?: string; categoryId?: string }) => void;
}

const TOOLTIP_GLOBAL =
  'Switching workspace updates every tab. Click to change to per-tab mode in Settings.';
const TOOLTIP_BOUND =
  'Per-tab workspace mode is on. This tab is on the default workspace. Switching workspace here will only affect this tab.';
const TOOLTIP_DIVERGED =
  'Per-tab workspace mode is on. Other tabs, the popup, and network rules use the default workspace.';

const SETTING_TARGET = { settingKey: 'general.workspaceSwitchScope', categoryId: 'general' };

const WorkspaceDivergencePill: React.FC<WorkspaceDivergencePillProps> = ({
  perTab,
  workspaces,
  setActiveWorkspace,
  openSettings,
}) => {
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const mode = useSettingValue('general.workspaceSwitchScope');
  const globalActiveId = useActiveWorkspaceId();
  const editingScopeBoundId = perTab.initial.workspace?.workspaceId ?? null;

  const onRebindToDefault = useCallback(async () => {
    if (!globalActiveId) return;
    const data = await readWorkspaceFallThrough(globalActiveId);
    perTab.onPersist((prev) => ({ ...prev, workspace: { workspaceId: globalActiveId, data } }));
  }, [perTab, globalActiveId]);

  const tabWorkspace = workspaces.find((w) => w.id === editingScopeBoundId) ?? null;
  const defaultWorkspace = workspaces.find((w) => w.id === globalActiveId) ?? null;

  const onPromoteToGlobal = useCallback(() => {
    if (!editingScopeBoundId || !tabWorkspace) return;
    modal.confirm({
      title: 'Make this tab’s workspace the new default?',
      content: (
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Every tab, the popup, the side-panel, and network rules will switch to{' '}
          <strong>{tabWorkspace.name}</strong>.
        </Typography.Paragraph>
      ),
      okText: 'Make default',
      cancelText: 'Cancel',
      onOk: async () => {
        const ok = await setActiveWorkspace(editingScopeBoundId);
        if (ok) message.success(`${tabWorkspace.name} is now the default workspace`);
      },
    });
  }, [editingScopeBoundId, tabWorkspace, modal, message, setActiveWorkspace]);

  const onOpenSettings = useCallback(() => openSettings(SETTING_TARGET), [openSettings]);

  // ── Visual state machine ────────────────────────────────────────────

  const isPerTab = mode === 'per-window-or-tab';
  const isDiverged = isPerTab && !!editingScopeBoundId && !!globalActiveId && editingScopeBoundId !== globalActiveId;

  const dimStyle: React.CSSProperties = {
    background: 'transparent',
    color: token.colorTextTertiary,
    borderColor: token.colorBorderSecondary,
  };
  const litStyle: React.CSSProperties = {
    background: token.colorPrimaryBg,
    color: token.colorPrimary,
    borderColor: token.colorPrimaryBorder,
  };
  const warnStyle: React.CSSProperties = {
    background: token.colorWarningBg,
    color: token.colorWarning,
    borderColor: token.colorWarningBorder,
  };

  let label: React.ReactNode;
  let tooltip: string;
  let style: React.CSSProperties;
  let icon: React.ReactNode;
  let ariaLabel: string;

  if (isDiverged) {
    icon = <ApartmentOutlined style={{ fontSize: 10 }} />;
    label = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {tabWorkspace
          ? renderWorkspacePrefix({ icon: tabWorkspace.icon, color: tabWorkspace.color }, token, { size: 12 })
          : null}
        <span>
          {tabWorkspace?.name ?? 'tab'} · default {defaultWorkspace?.name ?? 'unknown'}
        </span>
      </span>
    );
    tooltip = TOOLTIP_DIVERGED;
    style = warnStyle;
    ariaLabel = `Tab is editing ${tabWorkspace?.name ?? 'tab'}; default workspace is ${defaultWorkspace?.name ?? 'default'}`;
  } else if (isPerTab) {
    icon = <ApartmentOutlined style={{ fontSize: 10 }} />;
    label = <span>Per-tab · bound to default</span>;
    tooltip = TOOLTIP_BOUND;
    style = litStyle;
    ariaLabel = 'Per-tab workspace mode on; tab bound to the default workspace';
  } else {
    icon = <LinkOutlined style={{ fontSize: 10 }} />;
    label = <span>Workspace synced</span>;
    tooltip = TOOLTIP_GLOBAL;
    style = dimStyle;
    ariaLabel = 'Workspace synced across tabs (global mode); click to change in Settings';
  }

  // ── Render ──────────────────────────────────────────────────────────

  const Pill = (
    <span
      className="rules-statusbar-item"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 6px',
        height: 18,
        border: '1px solid',
        borderRadius: 9,
        cursor: 'pointer',
        fontSize: 10,
        ...style,
      }}
    >
      {icon}
      {label}
    </span>
  );

  // Diverged: clickable popover with the two actions.
  if (isDiverged) {
    const popoverContent = (
      <div style={{ minWidth: 260, maxWidth: 360 }}>
        <Typography.Paragraph style={{ marginBottom: 8, fontSize: 12 }}>
          This tab is editing <strong>{tabWorkspace?.name ?? 'unknown'}</strong>. The default workspace is{' '}
          <strong>{defaultWorkspace?.name ?? 'unknown'}</strong>. Network rules, the popup, and the side-panel always
          use the default.
        </Typography.Paragraph>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Button size="small" block onClick={onRebindToDefault}>
            Re-bind tab to default workspace
          </Button>
          <Button size="small" block onClick={onPromoteToGlobal}>
            Make this tab’s workspace the new default…
          </Button>
          <Button size="small" type="link" block onClick={onOpenSettings}>
            Workspace switch scope settings…
          </Button>
        </Space>
      </div>
    );
    return (
      <Popover content={popoverContent} placement="topRight" trigger={['click']}>
        <Tooltip title={tooltip} placement="top">
          {Pill}
        </Tooltip>
      </Popover>
    );
  }

  // Global / bound: click opens Settings directly. Tooltip carries the
  // discoverability copy.
  return (
    <Tooltip title={tooltip} placement="top">
      <span onClick={onOpenSettings} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenSettings()}>
        {Pill}
      </span>
    </Tooltip>
  );
};

export default WorkspaceDivergencePill;
