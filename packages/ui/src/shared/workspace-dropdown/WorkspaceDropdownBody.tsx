/**
 * WorkspaceDropdownBody — shared dropdown body for picking a workspace.
 *
 * Used by:
 *   - Workbench `WorkspaceSwitcher` (TopBar) in `mode='workbench'`:
 *     row click switches THIS tab's editing scope; the per-row check
 *     icon promotes a workspace to ACTIVE without switching this tab.
 *     Selected and active can differ — that's the flexible workbench
 *     surface.
 *   - Popup / sidepanel / devpanel pills in `mode='system'`:
 *     those surfaces always follow ACTIVE, so the only meaningful
 *     gesture is "set active". Row click promotes the workspace to
 *     ACTIVE; the per-row check icon is hidden because it would be
 *     redundant. Selected ≡ active here.
 */

import { CheckCircleFilled, CheckCircleOutlined, ExportOutlined, ImportOutlined, SettingOutlined } from '@ant-design/icons';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Divider, Input, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { renderWorkspacePrefix } from '../../workbench/components/workspace-prefix';
import './WorkspaceDropdownBody.css';

const { Text } = Typography;

export type WorkspaceDropdownMode = 'workbench' | 'system';

export interface WorkspaceDropdownBodyProps {
  workspaces: ExtensionWorkspace[];
  /** Editing-scope (selected) workspace id for this surface. */
  selectedId: string | null;
  /** Globally active workspace id (the one popup/sidepanel/devpanel follow). */
  activeId: string | null;
  mode: WorkspaceDropdownMode;
  /**
   * Switch the editing-scope workspace for this surface (workbench
   * mode). Not invoked in system mode — system surfaces follow ACTIVE,
   * so {@link onPromoteActive} handles row clicks instead.
   */
  onSwitch?: (id: string) => void;
  /** Promote the given workspace to ACTIVE. */
  onPromoteActive: (id: string) => void;
  onExport: () => void;
  onImport: () => void;
  onOpenManager: () => void;
  onClose: () => void;
  /**
   * Optional extra search-row content (e.g. a settings popover trigger
   * for the workbench surface). Rendered to the right of the search
   * input.
   */
  searchRowExtra?: React.ReactNode;
}

const baseRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 8px',
  cursor: 'pointer',
  borderRadius: 4,
  minWidth: 240,
};

export const WorkspaceDropdownBody: React.FC<WorkspaceDropdownBodyProps> = ({
  workspaces,
  selectedId,
  activeId,
  mode,
  onSwitch,
  onPromoteActive,
  onExport,
  onImport,
  onOpenManager,
  onClose,
  searchRowExtra,
}) => {
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef<InputRef>(null);

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, searchText]);

  const handleClose = (): void => {
    setSearchText('');
    onClose();
  };

  return (
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
        {searchRowExtra}
      </div>

      {filtered.length > 0 && <Divider style={{ margin: '4px 0' }} />}

      <div
        // Cap the visible rows at 3 — taller lists scroll. Each row is
        // ~32px (5px padding × 2 + 22px content); the cap is computed
        // generously so the third row never feels half-clipped behind a
        // border.
        style={{ maxHeight: 108, overflowY: 'auto' }}
      >
      {filtered.map((w) => {
        const isSelected = w.id === selectedId;
        const isActive = w.id === activeId;
        const rowStyle: React.CSSProperties = isSelected
          ? {
              ...baseRowStyle,
              background: token.colorPrimaryBg,
              color: token.colorPrimaryText,
            }
          : { ...baseRowStyle };
        return (
          <div
            key={w.id}
            role="menuitem"
            aria-current={isSelected ? 'true' : undefined}
            className="oh-env-row"
            style={rowStyle}
            onClick={() => {
              if (mode === 'workbench') {
                if (!isSelected) onSwitch?.(w.id);
              } else {
                if (!isActive) onPromoteActive(w.id);
              }
              handleClose();
            }}
          >
            {renderWorkspacePrefix({ icon: w.icon, color: w.color }, token, { size: 16 })}
            <Text
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 13,
                color: 'inherit',
                fontWeight: isSelected ? 500 : 400,
              }}
            >
              {w.name}
            </Text>
            {isActive && (
              <Text
                style={{
                  fontSize: 10,
                  color: isSelected ? token.colorPrimaryText : token.colorTextTertiary,
                  flexShrink: 0,
                  letterSpacing: 0.5,
                }}
              >
                ACTIVE
              </Text>
            )}
            {mode === 'workbench' ? (
              <div className="oh-env-row-actions">
                <Tooltip
                  title={isActive ? 'Active workspace' : 'Set active'}
                  placement="top"
                  mouseEnterDelay={0.3}
                >
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={isActive ? 'Active workspace' : `Make "${w.name}" the active workspace`}
                    className="oh-env-row-action"
                    style={isActive ? { opacity: 1, cursor: 'default' } : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isActive) return;
                      onPromoteActive(w.id);
                      handleClose();
                    }}
                  >
                    {isActive ? (
                      <CheckCircleFilled style={{ fontSize: 14, color: token.colorPrimary }} />
                    ) : (
                      <CheckCircleOutlined style={{ fontSize: 14, color: token.colorTextTertiary }} />
                    )}
                  </span>
                </Tooltip>
              </div>
            ) : (
              isActive && (
                <CheckCircleFilled style={{ fontSize: 14, color: token.colorPrimary, flexShrink: 0 }} />
              )
            )}
          </div>
        );
      })}
      </div>

      <Divider style={{ margin: '4px 0' }} />

      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...baseRowStyle, color: token.colorTextSecondary }}
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
        style={{ ...baseRowStyle, color: token.colorTextSecondary }}
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
        style={{ ...baseRowStyle, color: token.colorTextSecondary }}
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
};
