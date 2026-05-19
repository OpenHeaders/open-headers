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
 */

import { CheckOutlined, TeamOutlined } from '@ant-design/icons';
import type { OrgDescriptor } from '@openheaders/core/identity';
import { App, Dropdown, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { WorkspaceOrgBadge } from './WorkspaceOrgBadge';
import { orgScopeVisual } from './org-scope-vocabulary';

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
  compact?: boolean;
}

function scopeRowLabel(descriptor: OrgDescriptor, selected: boolean): React.ReactNode {
  const visual = orgScopeVisual(descriptor.scopeKind);
  const Icon = visual.icon;
  const title = descriptor.scopeKind === 'team' ? descriptor.name : visual.pickerLabel;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0', minWidth: 240 }}>
      <Icon style={{ fontSize: 14, marginTop: 2 }} />
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
  compact,
}) => {
  const { token } = theme.useToken();
  const { modal } = App.useApp();

  const hasTeamOrg = catalogue.some((o) => o.scopeKind === 'team');

  const commitPick = useCallback(
    (descriptor: OrgDescriptor): void => {
      if (descriptor.id === currentOrgId) return;
      if (descriptor.scopeKind === 'team') {
        modal.confirm({
          title: `Move "${workspaceName}" to ${descriptor.name}?`,
          content:
            'Everyone in this team gains access to the workspace. Its history stays private — team members see it from this point forward.',
          okText: 'Move to team',
          cancelText: 'Cancel',
          onOk: () => onPick(descriptor.id),
        });
        return;
      }
      void onPick(descriptor.id);
    },
    [currentOrgId, workspaceName, modal, onPick],
  );

  const items: MenuProps['items'] = catalogue.map((descriptor) => ({
    key: descriptor.id,
    label: scopeRowLabel(descriptor, descriptor.id === currentOrgId),
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
