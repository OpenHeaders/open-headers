/**
 * WorkspaceDivergencePill — status-bar pill that surfaces per-tab
 * workspace divergence in MWPT per-tab mode.
 *
 * Hidden in global mode OR when the tab's workspace matches the global
 * default. Click opens a popover with two actions:
 *
 *   1. **Re-bind tab to default workspace** — slice-only write; only
 *      affects this tab. Single click.
 *   2. **Make this tab's workspace the new global default** — confirms
 *      first (the gesture re-binds every tab + popup + side-panel +
 *      DNR rule set).
 *
 * Composable with `FooterDonorPill` — same surface, same shape, no
 * coupling between the two.
 *
 * See `MULTI_WORKSPACE_PER_TAB_DESIGN.md` § 7.
 */

import { ApartmentOutlined } from '@ant-design/icons';
import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Popover, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import type { PerTabStateApi } from '@/shared/per-tab-state';
import type { WorkbenchViewState } from '../hooks/useToolLayout';
import { readWorkspaceFallThrough } from '../hooks/useToolLayout';
import { useSettingValue } from '../settings/hooks';
import { renderWorkspacePrefix } from './workspace-prefix';

interface WorkspaceDivergencePillProps {
  perTab: PerTabStateApi<WorkbenchViewState>;
  workspaces: V5.ExtensionWorkspace[];
  setActiveWorkspace: (id: string) => Promise<boolean>;
}

const TOOLTIP =
  'Per-tab workspace mode is on. Other tabs, the popup, and network rules use the default workspace.';

const WorkspaceDivergencePill: React.FC<WorkspaceDivergencePillProps> = ({
  perTab,
  workspaces,
  setActiveWorkspace,
}) => {
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const mode = useSettingValue('general.workspaceSwitchScope');
  const globalActiveId = useActiveWorkspaceId();
  const tabBoundId = perTab.initial.workspace?.workspaceId ?? null;

  const onRebindToDefault = useCallback(async () => {
    if (!globalActiveId) return;
    const data = await readWorkspaceFallThrough(globalActiveId);
    perTab.onPersist((prev) => ({ ...prev, workspace: { workspaceId: globalActiveId, data } }));
  }, [perTab, globalActiveId]);

  const tabWorkspace = workspaces.find((w) => w.id === tabBoundId) ?? null;
  const defaultWorkspace = workspaces.find((w) => w.id === globalActiveId) ?? null;

  const onPromoteToGlobal = useCallback(() => {
    if (!tabBoundId || !tabWorkspace) return;
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
        const ok = await setActiveWorkspace(tabBoundId);
        if (ok) message.success(`${tabWorkspace.name} is now the default workspace`);
      },
    });
  }, [tabBoundId, tabWorkspace, modal, message, setActiveWorkspace]);

  if (mode !== 'per-tab') return null;
  if (!tabBoundId || !globalActiveId) return null;
  if (tabBoundId === globalActiveId) return null;

  const popoverContent = (
    <div style={{ minWidth: 260, maxWidth: 360 }}>
      <Typography.Paragraph style={{ marginBottom: 8, fontSize: 12 }}>
        This tab is editing <strong>{tabWorkspace?.name ?? 'unknown'}</strong>. The default workspace is{' '}
        <strong>{defaultWorkspace?.name ?? 'unknown'}</strong>. Network rules, the popup, and the side-panel always use
        the default.
      </Typography.Paragraph>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Button size="small" block onClick={onRebindToDefault}>
          Re-bind tab to default workspace
        </Button>
        <Button size="small" block onClick={onPromoteToGlobal}>
          Make this tab’s workspace the new default…
        </Button>
      </Space>
    </div>
  );

  const tabName = tabWorkspace?.name ?? 'tab';
  const defaultName = defaultWorkspace?.name ?? 'default';

  return (
    <Popover content={popoverContent} placement="topRight" trigger={['click']}>
      <Tooltip title={TOOLTIP} placement="top">
        <span
          className="rules-statusbar-item"
          role="button"
          tabIndex={0}
          aria-label={`Tab is editing ${tabName}; default workspace is ${defaultName}`}
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
            background: token.colorWarningBg,
            color: token.colorWarning,
            borderColor: token.colorWarningBorder,
          }}
        >
          <ApartmentOutlined style={{ fontSize: 10 }} />
          {tabWorkspace ? renderWorkspacePrefix({ icon: tabWorkspace.icon, color: tabWorkspace.color }, token, { size: 12 }) : null}
          <span>
            {tabName} · default {defaultName}
          </span>
        </span>
      </Tooltip>
    </Popover>
  );
};

export default WorkspaceDivergencePill;
