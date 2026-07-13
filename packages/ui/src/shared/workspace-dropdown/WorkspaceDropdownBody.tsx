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

import {
  CheckCircleFilled,
  CheckCircleOutlined,
  DesktopOutlined,
  ExportOutlined,
  GlobalOutlined,
  ImportOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { OrgDescriptor } from '@openheaders/core/identity';
import { orgFullLabel, resolveOrgActiveWorkspace } from '@openheaders/core/identity';
import { getHostStorage, OH } from '@openheaders/core/storage';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Divider, Input, Popover, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderWorkspacePrefix } from '../../workbench/components/workspace/workspace-prefix';
import { type OrgSyncAnnotation, orphanedOrgAnnotation, useOrgSyncAnnotations } from '../backend';
import { useBackendReach } from '../hooks/useBackendReach';
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
  /**
   * Opens the back-end Settings category. When supplied, the dropdown
   * shows the "extend your reach" footer — rows contextual to the
   * connected backend's {@link BackendReach} tier. Omit it to hide the
   * footer entirely.
   */
  onOpenBackendSettings?: () => void;
  /**
   * Placement for popovers inside this dropdown body (the reach-row
   * footer and the "ACTIVE" tag explainer). Narrow surfaces (popup /
   * sidepanel) prefer `top` — `right` would overflow the viewport on a
   * 350-400px window. Wide surfaces (workbench / devpanel) keep the
   * default `right` so the popover doesn't cover the rows above it.
   */
  popoverPlacement?: 'top' | 'right';
}

/** Title + body content block for any popover this dropdown renders. */
function renderPopoverBlock(title: string, body: string): React.ReactNode {
  return (
    <div style={{ maxWidth: 260 }}>
      <Text strong style={{ fontSize: 12 }}>
        {title}
      </Text>
      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {body}
        </Text>
      </div>
    </div>
  );
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
  onOpenBackendSettings,
  popoverPlacement = 'right',
}) => {
  const { token } = theme.useToken();
  // widest drives the "extend your reach" ladder (a step already reached
  // anywhere drops out); self labels the home Org's host-kind hint.
  const { widest: reach, self: selfReach } = useBackendReach();
  const annotateOrg = useOrgSyncAnnotations();
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef<InputRef>(null);

  // The per-Org `orgId → workspaceId` maps that resolve which workspace
  // an Org-switch lands on. Used both to label the Org header (naming
  // the workspace it switches to) and to perform the switch — one
  // snapshot keeps the two in sync. Subscribed (not one-shot): the
  // dropdown body stays mounted across open/close, and `OH.orgActiveWorkspace`
  // is rewritten on every workspace switch — a one-shot load would go
  // stale and the header would name the wrong target.
  const [orgPrefs, setOrgPrefs] = useState<{
    remembered: Record<string, string>;
    defaults: Record<string, string>;
  }>({ remembered: {}, defaults: {} });

  useEffect(() => {
    const storage = getHostStorage();
    if (!storage) return;
    let cancelled = false;
    const hydrate = (): void => {
      void Promise.all([storage.get(OH.orgActiveWorkspace), storage.get(OH.preferencesDefaultWorkspace)]).then(
        ([remembered, defaults]) => {
          if (!cancelled) setOrgPrefs({ remembered: remembered ?? {}, defaults: defaults ?? {} });
        },
      );
    };
    hydrate();
    const unsubscribers = [
      storage.subscribe(OH.orgActiveWorkspace, hydrate),
      storage.subscribe(OH.preferencesDefaultWorkspace, hydrate),
    ];
    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) unsubscribe?.();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(q));
  }, [workspaces, searchText]);

  // Org is the top-level container — group the (already search-filtered)
  // list by Org, ordered by the catalogue. No filtering: every Org's
  // workspaces are reachable so a tab can switch to anything. The header
  // shows even with a single Org: it names where the workspaces live and
  // signals that the binding can be extended. `null` (flat list) only
  // when there is no catalogue at all (pre-bootstrap).
  const groups = useMemo(() => {
    if (!orgGrouping || orgGrouping.catalogue.length < 1) return null;
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

  // "Extend your reach" footer — contextual to the connected backend's
  // reach tier (`null` = no backend). Each row names the *benefit*; its
  // popover explains the *how*. A tier the user has already reached
  // drops out, so the footer only ever points at genuine next steps;
  // at `wan` reach there is nothing above, so the footer disappears.
  const reachRows = useMemo(() => {
    if (!onOpenBackendSettings) return [];
    const rows: Array<{ key: string; icon: React.ReactNode; label: string; popover: React.ReactNode }> = [];
    if (reach === null) {
      rows.push({
        key: 'multi-browser',
        icon: <GlobalOutlined style={{ fontSize: 12 }} />,
        label: 'Sync across browsers on this device',
        popover: renderPopoverBlock(
          'Multi-browser',
          'Install the desktop app — every browser on this device then shares the same workspaces.',
        ),
      });
    }
    if (reach === 'loopback') {
      rows.push({
        key: 'multi-device',
        icon: <DesktopOutlined style={{ fontSize: 12 }} />,
        label: 'Sync across your devices',
        popover: renderPopoverBlock(
          'Multi-device',
          'In the desktop app, turn on “Sync with devices on your network” so your devices on the same network share workspaces.',
        ),
      });
    }
    if (reach !== 'wan') {
      rows.push({
        key: 'multi-user',
        icon: <TeamOutlined style={{ fontSize: 12 }} />,
        label: 'Sync with your team',
        popover: renderPopoverBlock(
          'Multi-user',
          'Connect to a shared server — on your network or over the internet — so everyone on it works in the same workspaces.',
        ),
      });
    }
    return rows;
  }, [reach, onOpenBackendSettings]);

  const handleClose = (): void => {
    setSearchText('');
    onClose();
  };

  // One segment of the compact action row (Export | Manage | Import) —
  // equal-width, centered, non-wrapping so a crowded row widens the
  // shrink-to-fit popup instead of breaking words.
  const footerSegment = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <div
      role="menuitem"
      className="oh-env-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flex: 1,
        whiteSpace: 'nowrap',
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        color: token.colorTextSecondary,
      }}
      onClick={() => {
        onClick();
        handleClose();
      }}
    >
      {icon}
      <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{label}</Text>
    </div>
  );

  const pickWorkspace = (id: string, isSelected: boolean, isActive: boolean): void => {
    if (mode === 'workbench') {
      if (!isSelected) onSwitch?.(id);
    } else {
      if (!isActive) onPromoteActive(id);
    }
    handleClose();
  };

  // The workspace an Org-header click would switch to — its remembered →
  // default → first workspace (`resolveOrgActiveWorkspace`).
  const resolveOrgTarget = (orgId: string): ExtensionWorkspace | null => {
    const id = resolveOrgActiveWorkspace(orgId, workspaces, orgPrefs.remembered, orgPrefs.defaults);
    return id ? (workspaces.find((w) => w.id === id) ?? null) : null;
  };

  // Switching to an Org routes its resolved target through the surface's
  // normal pick handler — per-tab in workbench, global active in system.
  const handleSwitchOrg = (orgId: string): void => {
    const targetWs = resolveOrgTarget(orgId);
    if (!targetWs) return;
    pickWorkspace(targetWs.id, targetWs.id === selectedId, targetWs.id === activeId);
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
          <Popover
            placement={popoverPlacement}
            mouseEnterDelay={0.3}
            zIndex={token.zIndexPopupBase + 100}
            content={renderPopoverBlock(
              'Active workspace',
              'The rule engine is injecting this workspace’s http rules for changing live traffic. Only one workspace can be active at a time, per browser.',
            )}
          >
            <Text
              style={{
                fontSize: 10,
                color: isSelected ? token.colorPrimaryText : token.colorTextTertiary,
                flexShrink: 0,
                letterSpacing: 0.5,
                cursor: 'help',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              ACTIVE
            </Text>
          </Popover>
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

  // The popover an Org header shows on hover: the full consequence of
  // the click — which Org and which workspace the switch moves FROM and
  // TO, plus why that workspace is the landing target (it mirrors the
  // remembered → default → first chain of `resolveOrgActiveWorkspace`).
  const renderOrgSwitchPopover = (
    orgId: string,
    label: string,
    targetWs: ExtensionWorkspace | null,
  ): React.ReactNode => {
    const currentId = mode === 'workbench' ? selectedId : activeId;
    const currentWs = currentId ? (workspaces.find((w) => w.id === currentId) ?? null) : null;
    const currentOrg = currentWs && orgGrouping ? orgGrouping.describe(currentWs.orgId) : null;
    const currentOrgLabel = currentOrg ? orgFullLabel(currentOrg, selfReach) : null;
    const reason = targetWs
      ? orgPrefs.remembered[orgId] === targetWs.id
        ? 'it’s the workspace you last used in this Org'
        : orgPrefs.defaults[orgId] === targetWs.id
          ? 'it’s this Org’s default workspace'
          : 'it’s this Org’s first workspace'
      : null;
    return (
      <div style={{ maxWidth: 280 }}>
        <Text strong style={{ fontSize: 12 }}>
          {`Switch to ${label}`}
        </Text>
        {!targetWs ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              This Org has no workspaces yet, so there is nothing to switch to.
            </Text>
          </div>
        ) : targetWs.id === currentWs?.id ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {`You’re already on “${targetWs.name}” in this Org.`}
            </Text>
          </div>
        ) : (
          <>
            {currentOrgLabel && currentWs && currentWs.orgId !== orgId && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {`Org: ${currentOrgLabel} → ${label}`}
                </Text>
              </div>
            )}
            {currentWs && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {`Workspace: ${currentWs.name} → ${targetWs.name}`}
                </Text>
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {`Lands on “${targetWs.name}” because ${reason}.`}
              </Text>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderOrgHeader = (orgId: string, descriptor: OrgDescriptor | null): React.ReactNode => {
    // A null descriptor in grouped mode means the Org left the identity
    // snapshot — its backend record was removed with local copies kept.
    const label = descriptor ? orgFullLabel(descriptor, selfReach) : 'No longer syncing';
    const annotation: OrgSyncAnnotation | null = descriptor ? annotateOrg(orgId) : orphanedOrgAnnotation();
    // Name the workspace the switch lands on — the header shows the Org's
    // intent; the popover makes the concrete consequence visible.
    const targetWs = resolveOrgTarget(orgId);
    const ariaLabel = targetWs ? `Switch to ${label} → ${targetWs.name}` : `Switch to ${label}`;
    return (
      <Popover
        placement={popoverPlacement}
        mouseEnterDelay={0.4}
        zIndex={token.zIndexPopupBase + 100}
        content={renderOrgSwitchPopover(orgId, label, targetWs)}
      >
        <div
          role="button"
          aria-label={ariaLabel}
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
          {annotation && (
            <Text
              style={{
                fontSize: 10,
                color: annotation.tone === 'warning' ? token.colorWarningText : token.colorTextTertiary,
                maxWidth: 190,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {annotation.text}
            </Text>
          )}
        </div>
      </Popover>
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

      {reachRows.length > 0 && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          {reachRows.map((row) => (
            <Popover
              key={row.key}
              placement={popoverPlacement}
              mouseEnterDelay={0.3}
              content={row.popover}
              // The Dropdown panel this body lives in portals at
              // `zIndexPopupBase + 50`; lift the popover above it so it
              // doesn't render behind the rows it explains.
              zIndex={token.zIndexPopupBase + 100}
            >
              <div
                role="menuitem"
                className="oh-env-row"
                style={{ ...baseRowStyle, color: token.colorTextSecondary }}
                onClick={() => {
                  onOpenBackendSettings?.();
                  handleClose();
                }}
              >
                {row.icon}
                <Text style={{ fontSize: 13 }}>{row.label}</Text>
              </div>
            </Popover>
          ))}
        </>
      )}

      <Divider style={{ margin: '4px 0' }} />

      {/* Compact action shortcuts — one row, segments split by vertical
          dividers (same treatment as the env selector's scope row).
          Deliberately the LAST row so the destructive-adjacent data
          actions sit at the popup's edge, away from the switch rows. */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {footerSegment(<ExportOutlined style={{ fontSize: 12 }} />, 'Export', onExport)}
        <Divider type="vertical" style={{ height: 'auto', margin: '4px 0', alignSelf: 'stretch' }} />
        {footerSegment(<SettingOutlined style={{ fontSize: 12 }} />, 'Manage workspaces', onOpenManager)}
        <Divider type="vertical" style={{ height: 'auto', margin: '4px 0', alignSelf: 'stretch' }} />
        {footerSegment(<ImportOutlined style={{ fontSize: 12 }} />, 'Import', onImport)}
      </div>
    </div>
  );
};
