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
 *
 * Org switcher (Phase U5.9): when {@link WorkspaceDropdownBodyProps.orgGrouping}
 * is supplied the list is GROUPED by Org — every Org, no filter — so a
 * workbench tab can roam to any workspace in any Org. Clicking an Org
 * header switches to that Org (per the surface's mode). A footer shows
 * the globally active workspace + its Org.
 */

import { CheckCircleFilled, CheckCircleOutlined, ExportOutlined, ImportOutlined, SettingOutlined } from '@ant-design/icons';
import type { OrgDescriptor } from '@openheaders/core/identity';
import { orgIdentityLabel, resolveOrgActiveWorkspace } from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Divider, Input, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { renderWorkspacePrefix } from '../../workbench/components/workspace-prefix';
import { OrgIcon } from '../workspace-org/OrgIcon';
import { WorkspaceOrgBadge } from '../workspace-org/WorkspaceOrgBadge';
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
  /**
   * Org switcher (U5.9). When supplied, the list is grouped by Org —
   * every Org, no filter — so tabs roam free. An Org header switches to
   * that Org: it resolves the Org's remembered / default / first
   * workspace and routes it through the surface's normal pick handler.
   * A footer shows the globally active workspace + its Org.
   */
  orgGrouping?: {
    /** Every Org the identity belongs to, local → personal → team. */
    catalogue: OrgDescriptor[];
    /** Resolve an `orgId` to its descriptor; `null` pre-bootstrap. */
    describe: (orgId: string) => OrgDescriptor | null;
  };
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
  orgGrouping,
}) => {
  const { token } = theme.useToken();
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef<InputRef>(null);

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, searchText]);

  // Org is the top-level container — group the (already search-filtered)
  // list by Org, ordered by the catalogue. No filtering: every Org's
  // workspaces are reachable so a tab can switch to anything. `null`
  // (flat list) until the identity actually holds more than one Org —
  // with a single Org the headers + switch gesture would be noise.
  const groups = useMemo(() => {
    if (!orgGrouping || orgGrouping.catalogue.length <= 1) return null;
    const byOrg = new Map<string, ExtensionWorkspace[]>();
    for (const w of filtered) {
      const arr = byOrg.get(w.orgId);
      if (arr) arr.push(w);
      else byOrg.set(w.orgId, [w]);
    }
    const ordered: Array<{ orgId: string; descriptor: OrgDescriptor | null; items: ExtensionWorkspace[] }> = [];
    for (const descriptor of orgGrouping.catalogue) {
      const items = byOrg.get(descriptor.id);
      if (items && items.length > 0) ordered.push({ orgId: descriptor.id, descriptor, items });
      byOrg.delete(descriptor.id);
    }
    // Workspaces whose Org isn't in the catalogue (e.g. the pre-bootstrap
    // sentinel) still get a group so they're never unreachable.
    for (const [orgId, items] of byOrg) ordered.push({ orgId, descriptor: null, items });
    return ordered;
  }, [orgGrouping, filtered]);

  const activeWorkspace = useMemo(
    () => (activeId ? (workspaces.find((w) => w.id === activeId) ?? null) : null),
    [workspaces, activeId],
  );

  const handleClose = (): void => {
    setSearchText('');
    onClose();
  };

  const pickWorkspace = (id: string, isSelected: boolean, isActive: boolean): void => {
    if (mode === 'workbench') {
      if (!isSelected) onSwitch?.(id);
    } else {
      if (!isActive) onPromoteActive(id);
    }
    handleClose();
  };

  // Switching to an Org lands on its remembered → default → first
  // workspace (`resolveOrgActiveWorkspace`), then routes through the
  // surface's normal pick handler — per-tab in workbench, global active
  // in system mode.
  const handleSwitchOrg = (orgId: string): void => {
    const storage = getHostStorage();
    void Promise.all([
      storage?.get(OH.orgActiveWorkspace) ?? Promise.resolve(undefined),
      storage?.get(OH.preferencesDefaultWorkspace) ?? Promise.resolve(undefined),
    ]).then(([remembered, defaults]) => {
      const target = resolveOrgActiveWorkspace(orgId, workspaces, remembered ?? {}, defaults ?? {});
      if (!target) return;
      const targetWs = workspaces.find((w) => w.id === target);
      if (!targetWs) return;
      pickWorkspace(target, target === selectedId, target === activeId);
    });
  };

  const renderRow = (w: ExtensionWorkspace): React.ReactNode => {
    const isSelected = w.id === selectedId;
    const isActive = w.id === activeId;
    const rowStyle: React.CSSProperties = isSelected
      ? { ...baseRowStyle, background: token.colorPrimaryBg, color: token.colorPrimaryText }
      : { ...baseRowStyle };
    return (
      <div
        key={w.id}
        role="menuitem"
        aria-current={isSelected ? 'true' : undefined}
        className="oh-env-row"
        style={rowStyle}
        onClick={() => pickWorkspace(w.id, isSelected, isActive)}
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
            <Tooltip title={isActive ? 'Active workspace' : 'Set active'} placement="top" mouseEnterDelay={0.3}>
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
          isActive && <CheckCircleFilled style={{ fontSize: 14, color: token.colorPrimary, flexShrink: 0 }} />
        )}
      </div>
    );
  };

  const renderOrgHeader = (orgId: string, descriptor: OrgDescriptor | null): React.ReactNode => {
    const label = descriptor ? orgIdentityLabel(descriptor) : 'Other workspaces';
    return (
      <Tooltip title={`Switch to ${label}`} placement="left" mouseEnterDelay={0.4}>
        <div
          role="button"
          aria-label={`Switch to ${label}`}
          className="oh-env-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            margin: '2px 0 0',
            borderRadius: 4,
            cursor: 'pointer',
          }}
          onClick={() => handleSwitchOrg(orgId)}
        >
          {descriptor && (
            <OrgIcon descriptor={descriptor} size={12} style={{ color: token.colorTextTertiary }} />
          )}
          <Text
            style={{
              flex: 1,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: token.colorTextTertiary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </Text>
        </div>
      </Tooltip>
    );
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

      <Divider style={{ margin: '4px 0' }} />

      {filtered.length === 0 && (
        <div style={{ padding: '8px 8px 10px', textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {searchText.trim() ? 'No workspaces match your search.' : 'No workspaces yet.'}
          </Text>
        </div>
      )}

      <div style={{ maxHeight: groups ? 220 : 108, overflowY: 'auto' }}>
        {groups
          ? groups.map((group) => (
              <div key={group.orgId}>
                {renderOrgHeader(group.orgId, group.descriptor)}
                {group.items.map(renderRow)}
              </div>
            ))
          : filtered.map(renderRow)}
      </div>

      {orgGrouping && orgGrouping.catalogue.length > 1 && activeWorkspace && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px' }}>
            <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
              Active:
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeWorkspace.name}
            </Text>
            <WorkspaceOrgBadge descriptor={orgGrouping.describe(activeWorkspace.orgId)} compact />
          </div>
        </>
      )}

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
