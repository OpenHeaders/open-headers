/**
 * WorkspaceSwitcher — TopBar dropdown for picking the editing-scope
 * workspace of this workbench tab. Thin wrapper around
 * `WorkspaceDropdownBody` in `mode='workbench'`: row click switches
 * THIS tab; per-row check icon promotes a workspace to ACTIVE without
 * switching this tab.
 *
 * Also the home of the org-binding UX cluster (U3.5–U3.7,
 * UNIFIED_ORACLE_MODEL.md §6.2 / §6.4): each dropdown row carries a
 * "where does this live?" badge that doubles as the sync-scope picker,
 * the trigger shows the selected workspace's binding, and the
 * two-personal-Orgs onboarding surfaces here the first time a user
 * holds more than one Org.
 */

import { describeOrg, orgCatalogue, shouldShowOrgOnboarding } from '@openheaders/core/identity';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import { App, Button, Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import { executePublish } from '../../shared/mode-switch';
import { useActiveOrg } from '../../shared/hooks/useActiveOrg';
import { useIdentitySnapshot } from '../../shared/hooks/useIdentitySnapshot';
import { useOrgBindingPrefs } from '../../shared/hooks/useOrgBindingPrefs';
import { useWorkspaces } from '../../shared/hooks/useWorkspaces';
import { WorkspaceDropdownBody } from '../../shared/workspace-dropdown/WorkspaceDropdownBody';
import { OrgOnboardingModal } from '../../shared/workspace-org/OrgOnboardingModal';
import { WorkspaceOrgBadge } from '../../shared/workspace-org/WorkspaceOrgBadge';
import { renderWorkspacePrefix } from './workspace-prefix';

const { Text } = Typography;

interface WorkspaceSwitcherProps {
  workspaces: ExtensionWorkspace[];
  /** The editing-scope workspace id — what THIS tab is editing. */
  activeWorkspaceId: string | null;
  /** Switch the editing-scope workspace for this tab. */
  onSwitch: (id: string) => void;
  onOpenManager: () => void;
  onExport: () => void;
  onImport: () => void;
  /** Promote a workspace id to ACTIVE (popup/sidepanel/devpanel follow). */
  setActiveWorkspace: (id: string) => Promise<boolean>;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onOpenManager,
  onExport,
  onImport,
  setActiveWorkspace,
}) => {
  const { token } = theme.useToken();
  const { modal, message } = App.useApp();
  const [open, setOpen] = useState(false);
  const activeGlobalId = useActiveWorkspaceId();

  const snapshot = useIdentitySnapshot();
  const catalogue = useMemo(() => orgCatalogue(snapshot), [snapshot]);
  const { prefs, isReady: prefsReady, acknowledgeOnboarding } = useOrgBindingPrefs();
  const { activeOrgId, setActiveOrg } = useActiveOrg(snapshot);
  const { updateWorkspace } = useWorkspaces();

  const selected = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const promoteWorkspaceToActive = useCallback(
    (id: string) => {
      const target = workspaces.find((w) => w.id === id);
      if (!target) return;
      modal.confirm({
        title: `Make "${target.name}" the active workspace?`,
        content: `The popup, side-panel, and any new ${instanceLabelPlural()} that aren't pinned to a specific workspace will switch to "${target.name}".`,
        okText: 'Make active',
        cancelText: 'Cancel',
        onOk: async () => {
          const ok = await setActiveWorkspace(target.id);
          if (ok) message.success(`"${target.name}" is now the active workspace`);
        },
      });
    },
    [workspaces, modal, message, setActiveWorkspace],
  );

  const handlePickOrg = useCallback(
    async (workspaceId: string, orgId: string) => {
      const target = workspaces.find((w) => w.id === workspaceId);
      const result = await updateWorkspace(workspaceId, { orgId });
      if (result.success) {
        const descriptor = describeOrg(snapshot, orgId);
        message.success(
          `"${target?.name ?? 'Workspace'}" now lives in ${descriptor?.name ?? 'the selected scope'}`,
        );
      } else {
        message.error('Could not change where this workspace lives');
      }
    },
    [workspaces, updateWorkspace, snapshot, message],
  );

  // Publishing into a team Org (U5.6) pushes the workspace's data up to
  // an authenticated backend — it goes through the permission-gated
  // `oh.sync.publishWorkspace` channel, not the raw `orgId` flip
  // `handlePickOrg` uses for local/personal scopes.
  const handlePublishOrg = useCallback(
    async (workspaceId: string, orgId: string) => {
      const target = workspaces.find((w) => w.id === workspaceId);
      const descriptor = describeOrg(snapshot, orgId);
      const result = await executePublish({ workspaceId, targetOrgId: orgId });
      if (result.ok) {
        message.success(
          `"${target?.name ?? 'Workspace'}" is now published to ${descriptor?.name ?? 'the team'}`,
        );
      } else {
        message.error(
          result.reason === 'target-not-authorized'
            ? 'You do not have permission to publish to this team'
            : 'Could not publish this workspace',
        );
      }
    },
    [workspaces, snapshot, message],
  );

  // Gate on `prefsReady` so an already-acknowledged user never sees the
  // modal flash in the window before `OH.orgBindingPrefs` loads.
  const showOnboarding = prefsReady && shouldShowOrgOnboarding(snapshot, prefs.onboardingAcknowledgedAt);

  if (!selected) return null;

  return (
    <>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        popupRender={() => (
          <WorkspaceDropdownBody
            workspaces={workspaces}
            selectedId={activeWorkspaceId}
            activeId={activeGlobalId}
            mode="workbench"
            onSwitch={onSwitch}
            onPromoteActive={promoteWorkspaceToActive}
            onExport={onExport}
            onImport={onImport}
            onOpenManager={onOpenManager}
            onClose={() => setOpen(false)}
            orgBinding={{
              catalogue,
              describe: (orgId) => describeOrg(snapshot, orgId),
              onPickOrg: handlePickOrg,
              onPublishOrg: handlePublishOrg,
            }}
            orgScope={{
              catalogue,
              activeOrgId,
              onSwitchOrg: (orgId) => {
                void setActiveOrg(orgId);
              },
            }}
          />
        )}
        trigger={['click']}
        placement="bottomLeft"
      >
        <Button
          type="text"
          size="small"
          aria-label={`This ${instanceLabel()} is editing workspace: ${selected.name}. Click to switch.`}
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
            {renderWorkspacePrefix({ icon: selected.icon, color: selected.color }, token, { size: 18 })}
            <Text style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.name}
            </Text>
            <WorkspaceOrgBadge descriptor={describeOrg(snapshot, selected.orgId)} compact />
          </Space>
        </Button>
      </Dropdown>

      <OrgOnboardingModal
        open={showOnboarding}
        catalogue={catalogue}
        homeOrgId={snapshot?.user.homeOrgId ?? ''}
        onAcknowledge={acknowledgeOnboarding}
      />
    </>
  );
};

export default WorkspaceSwitcher;
