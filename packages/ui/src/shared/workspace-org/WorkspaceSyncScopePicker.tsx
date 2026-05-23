/**
 * WorkspaceSyncScopePicker — the per-workspace sync-scope picker (U3.7,
 * UNIFIED_ORACLE_MODEL.md §6.4). Wraps the {@link WorkspaceOrgBadge} as
 * its trigger so display (U3.5) and edit (U3.7) are one surface: the
 * badge shows where the workspace lives, clicking it opens this menu to
 * move it.
 *
 * Each menu row is one Org from the catalogue, labelled by the §6.4
 * wording ("Local to this device" / "Synced across my devices" /
 * "Shared with team"). Picking an Org flips `Workspace.orgId` — the
 * §6.5 metadata-channel mutation. Moving a workspace into a team Org
 * widens its audience, so that pick is gated behind a confirm.
 *
 * When the catalogue holds no team Org, a disabled hint row explains
 * the "Shared with team" scope unlocks once the user joins a team —
 * the option is surfaced, not hidden, so the model reads as
 * multi-org-native from the first run.
 *
 * Picking a team Org is a Publish (U5.6): moving a workspace into an
 * authenticated backend's `Org` pushes its data UP, which must go
 * through the permission-gated `oh.sync.publishWorkspace` channel — not
 * the raw `orgId` flip a local/personal pick uses. When {@link
 * WorkspaceSyncScopePickerProps.onPublish} is supplied the team pick
 * routes through it; without it the team pick falls back to {@link
 * WorkspaceSyncScopePickerProps.onPick} (callers with no authenticated
 * backend in the catalogue).
 */

import { CheckOutlined, TeamOutlined } from '@ant-design/icons';
import type { OrgDescriptor } from '@openheaders/core/identity';
import { App, Dropdown, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { useBackendMode } from '../hooks/useBackendMode';
import { useBackendReach } from '../hooks/useBackendReach';
import { OrgIcon } from './OrgIcon';
import { WorkspaceOrgBadge } from './WorkspaceOrgBadge';
import { type OrgScopeContext, orgScopeVisual } from './org-scope-vocabulary';

const { Text } = Typography;

export interface WorkspaceSyncScopePickerProps {
  workspaceName: string;
  /** The workspace's current `orgId`. */
  currentOrgId: string;
  /** Resolved descriptor for {@link currentOrgId}; `null` pre-bootstrap. */
  currentDescriptor: OrgDescriptor | null;
  /** Every Org the workspace can be bound to. */
  catalogue: OrgDescriptor[];
  /** Flip `Workspace.orgId` to the chosen Org (§6.5 metadata mutation). */
  onPick: (orgId: string) => void | Promise<void>;
  /**
   * Publish the workspace into a team Org (U5.6). When supplied, picking
   * a team-scoped Org routes here instead of {@link onPick} — the
   * permission-gated `oh.sync.publishWorkspace` path. Omit on surfaces
   * with no authenticated backend in the catalogue.
   */
  onPublish?: (orgId: string) => void | Promise<void>;
  compact?: boolean;
}

function scopeRowLabel(descriptor: OrgDescriptor, selected: boolean, ctx: OrgScopeContext): React.ReactNode {
  const visual = orgScopeVisual(descriptor, ctx);
  const title = descriptor.scopeKind === 'team' ? descriptor.name : visual.pickerLabel;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0', minWidth: 240 }}>
      <OrgIcon descriptor={descriptor} size={14} style={{ marginTop: 2 }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{title}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {visual.description}
        </Text>
      </div>
      {selected && <CheckOutlined style={{ fontSize: 12, marginTop: 3 }} />}
    </div>
  );
}

export const WorkspaceSyncScopePicker: React.FC<WorkspaceSyncScopePickerProps> = ({
  workspaceName,
  currentOrgId,
  currentDescriptor,
  catalogue,
  onPick,
  onPublish,
  compact,
}) => {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const reach = useBackendReach();
  const mode = useBackendMode();
  const scopeCtx: OrgScopeContext = { mode, reach };

  const hasTeamOrg = catalogue.some((o) => o.scopeKind === 'team');

  const commitPick = useCallback(
    (descriptor: OrgDescriptor): void => {
      if (descriptor.id === currentOrgId) return;
      if (descriptor.scopeKind === 'team') {
        // Publishing into a team Org pushes the workspace's data up to
        // an authenticated backend — the permission-gated U5.6 path.
        const commit = onPublish ?? onPick;
        modal.confirm({
          title: `Publish "${workspaceName}" to ${descriptor.name}?`,
          content:
            'The workspace and its data sync up to this team. Everyone in the team gains access from this point forward; its earlier history stays on this device.',
          okText: 'Publish',
          cancelText: 'Cancel',
          onOk: () => commit(descriptor.id),
        });
        return;
      }
      void onPick(descriptor.id);
    },
    [currentOrgId, workspaceName, modal, onPick, onPublish],
  );

  const items: MenuProps['items'] = catalogue.map((descriptor) => ({
    key: descriptor.id,
    label: scopeRowLabel(descriptor, descriptor.id === currentOrgId, scopeCtx),
    onClick: () => commitPick(descriptor),
  }));

  if (!hasTeamOrg) {
    items.push({
      key: '__team-locked__',
      disabled: true,
      label: (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0', minWidth: 240 }}>
          <TeamOutlined style={{ fontSize: 14, marginTop: 2, color: token.colorTextQuaternary }} />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Shared with team
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Available once you join a team.
            </Text>
          </div>
        </div>
      ),
    });
  }

  return (
    <Dropdown trigger={['click']} placement="bottomLeft" menu={{ items, selectable: false }}>
      {/* stopPropagation keeps a badge click from also switching the
          workspace row it sits in; the Dropdown still toggles because
          its handler is bound to this same element. */}
      <span
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', cursor: 'pointer' }}
      >
        <WorkspaceOrgBadge descriptor={currentDescriptor} compact={compact} />
      </span>
    </Dropdown>
  );
};
