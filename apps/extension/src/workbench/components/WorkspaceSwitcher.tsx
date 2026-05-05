/**
 * WorkspaceSwitcher — TopBar dropdown for switching the active workspace,
 * surfacing the workspace-switch-scope mode inline (global vs
 * per-window-or-tab). Layout mirrors `EnvironmentSelector`: first row is
 * search + mode label + settings icon, then the workspace list, then the
 * footer actions (export / import / manage).
 *
 * Divergence (editing-scope ≠ global default in per-window-or-tab mode)
 * is surfaced by a DEFAULT badge on the global default's row; the active
 * editing-scope workspace carries the checkmark.
 */

import {
  CheckOutlined,
  DownOutlined,
  ExportOutlined,
  ImportOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { V5 } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Button, Divider, Dropdown, Input, Popover, Radio, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { instanceLabel, instanceLabelPlural } from '@/shared/host-vocabulary';
import { useSetting } from '../settings/hooks';
import { renderWorkspacePrefix } from './workspace-prefix';

const { Text } = Typography;

interface WorkspaceSwitcherProps {
  workspaces: V5.ExtensionWorkspace[];
  /** The editing-scope workspace id — what THIS surface is editing. */
  activeWorkspaceId: string | null;
  onSwitch: (id: string) => void;
  onOpenManager: () => void;
  onExport: () => void;
  onImport: () => void;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onOpenManager,
  onExport,
  onImport,
}) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<InputRef>(null);
  const [mode, setMode] = useSetting('general.workspaceSwitchScope');
  // Global-default id read directly: the switcher is the per-tab seam's
  // sibling — the divergence rendering is the whole reason it knows the
  // default. (BC-MWPT-3 allowlist entry covers this read.)
  const globalDefaultId = useActiveWorkspaceId();

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, searchText]);

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    cursor: 'pointer',
    borderRadius: token.borderRadiusSM,
    minWidth: 240,
  };

  const handleClose = (): void => {
    setOpen(false);
    setSearchText('');
  };

  const modeLabel = mode === 'global' ? 'Global' : `Per ${instanceLabel()}`;

  const dropdownContent = (
    <div
      style={{
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '6px 4px',
        minWidth: 320,
        maxWidth: 460,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '0 4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Input
          ref={searchRef}
          size="small"
          placeholder="Search workspaces…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ fontSize: 12, flex: 1 }}
          autoFocus
        />
        <Text type="secondary" style={{ fontSize: 11, userSelect: 'none' }}>
          Mode: {modeLabel}
        </Text>
        <Popover
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          trigger="click"
          placement="bottomRight"
          arrow={false}
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
          content={
            <div style={{ padding: 2, width: 320 }} onClick={(e) => e.stopPropagation()}>
              <Text strong style={{ display: 'block', padding: '4px 8px 6px', fontSize: 12 }}>
                When switching workspaces
              </Text>
              <div
                className="oh-env-row"
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: token.borderRadiusSM,
                }}
                onClick={() => {
                  setMode('global');
                  setSettingsOpen(false);
                }}
              >
                <Radio checked={mode === 'global'} style={{ marginRight: 0, pointerEvents: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.3 }}>Global</div>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                    Switching workspace updates every {instanceLabel()} and surface (default).
                  </Text>
                </div>
              </div>
              <div
                className="oh-env-row"
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: token.borderRadiusSM,
                }}
                onClick={() => {
                  setMode('per-window-or-tab');
                  setSettingsOpen(false);
                }}
              >
                <Radio
                  checked={mode === 'per-window-or-tab'}
                  style={{ marginRight: 0, pointerEvents: 'none' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.3 }}>Per {instanceLabel()}</div>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                    Switching workspace in one {instanceLabel()} leaves other {instanceLabelPlural()} alone. Network
                    rules and the popup always use the default workspace.
                  </Text>
                </div>
              </div>
            </div>
          }
        >
          <Tooltip title="Workspace switching behavior" placement="top" mouseEnterDelay={0.3}>
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />}
              aria-label="Workspace switching behavior"
            />
          </Tooltip>
        </Popover>
      </div>

      {filtered.length > 0 && <Divider style={{ margin: '4px 0' }} />}

      {filtered.map((w) => {
        const isActive = w.id === activeWorkspaceId;
        const isDefault = w.id === globalDefaultId;
        return (
          <div
            key={w.id}
            role="menuitem"
            className="oh-env-row"
            style={rowStyle}
            onClick={() => {
              if (!isActive) onSwitch(w.id);
              handleClose();
            }}
          >
            <span style={{ width: 14, flexShrink: 0 }}>
              {isActive && <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
            </span>
            {renderWorkspacePrefix({ icon: w.icon, color: w.color }, token, { size: 16 })}
            <Text style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
              {w.name}
            </Text>
            {isDefault && mode === 'per-window-or-tab' && (
              <Tooltip
                title={`Default workspace — used by the popup, side-panel, and network rules. Other ${instanceLabelPlural()} can edit a different workspace.`}
                placement="top"
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: token.colorTextTertiary,
                    flexShrink: 0,
                    cursor: 'help',
                  }}
                >
                  DEFAULT
                </Text>
              </Tooltip>
            )}
          </div>
        );
      })}

      <Divider style={{ margin: '4px 0' }} />

      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onExport();
          handleClose();
        }}
      >
        <ExportOutlined style={{ fontSize: 12 }} />
        <Text style={{ fontSize: 13 }}>Export…</Text>
      </div>
      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onImport();
          handleClose();
        }}
      >
        <ImportOutlined style={{ fontSize: 12 }} />
        <Text style={{ fontSize: 13 }}>Import…</Text>
      </div>
      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onOpenManager();
          handleClose();
        }}
      >
        <SettingOutlined style={{ fontSize: 12 }} />
        <Text style={{ fontSize: 13 }}>Manage workspaces…</Text>
      </div>
    </div>
  );

  if (!active) return null;

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearchText('');
      }}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button
        type="text"
        size="small"
        aria-label={`Active workspace: ${active.name}. Click to switch.`}
        style={{
          padding: '0 8px',
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          color: token.colorText,
        }}
      >
        <Space size={6}>
          {renderWorkspacePrefix({ icon: active.icon, color: active.color }, token, { size: 18 })}
          <Text style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active.name}
          </Text>
          <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default WorkspaceSwitcher;
