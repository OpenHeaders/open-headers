/**
 * WorkspaceSwitcher — TopBar dropdown for picking the editing-scope
 * workspace of this workbench tab. Thin wrapper around
 * `WorkspaceDropdownBody` in `mode='workbench'`: row click switches
 * THIS tab; per-row check icon promotes a workspace to ACTIVE without
 * switching this tab.
 */

import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/useActiveWorkspaceId';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import { App, Button, Dropdown, Space, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';
import { instanceLabel, instanceLabelPlural } from '@openheaders/ui/shared/host-vocabulary';
import { WorkspaceDropdownBody } from '@/shared/workspace-dropdown/WorkspaceDropdownBody';
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

  if (!selected) return null;

  return (
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
        </Space>
      </Button>
    </Dropdown>
  );
};

export default WorkspaceSwitcher;
