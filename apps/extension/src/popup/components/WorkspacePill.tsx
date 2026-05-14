/**
 * WorkspacePill — popup / sidepanel workspace indicator + switcher.
 *
 * System surfaces (popup, sidepanel, devpanel) always reflect the
 * ACTIVE workspace, so picking a workspace here promotes it to ACTIVE.
 * No separate "make active" gesture — row click is the make-active
 * gesture (selected ≡ active in these surfaces).
 *
 * Renders the same `WorkspaceDropdownBody` as workbench's
 * `WorkspaceSwitcher`, just in `mode='system'`. Trigger is the compact
 * pill button — popup is too narrow for a full TopBar treatment.
 */

import { DownOutlined } from '@ant-design/icons';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/useWorkspaces';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useSurface } from '@openheaders/ui/shared/surface';
import { WorkspaceDropdownBody } from '@/shared/workspace-dropdown/WorkspaceDropdownBody';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { renderWorkspacePrefix } from '@/workbench/components/workspace-prefix';

const WorkspacePill: React.FC = () => {
  const { token } = theme.useToken();
  const surface = useSurface();
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspace } = useWorkspaces();
  const [open, setOpen] = useState(false);

  if (!activeWorkspace) return null;

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => (
        <WorkspaceDropdownBody
          workspaces={workspaces}
          selectedId={activeWorkspaceId}
          activeId={activeWorkspaceId}
          mode="system"
          onPromoteActive={(id) => {
            void setActiveWorkspace(id);
          }}
          onExport={() => {
            void openWorkspace({ kind: 'open-export-modal' }, surface.mode);
          }}
          onImport={() => {
            void openWorkspace({ kind: 'open-import-modal' }, surface.mode);
          }}
          onOpenManager={() => {
            void openWorkspace({ kind: 'open-workspace-manager' }, surface.mode);
          }}
          onClose={() => setOpen(false)}
        />
      )}
      trigger={['click']}
      placement="bottomLeft"
    >
      <button
        type="button"
        aria-label={`Active workspace: ${activeWorkspace.name}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          height: 22,
          borderRadius: 4,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          cursor: 'pointer',
          fontSize: 12,
          color: token.colorText,
        }}
      >
        {renderWorkspacePrefix({ icon: activeWorkspace.icon, color: activeWorkspace.color }, token, { size: 14 })}
        <span
          style={{
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {activeWorkspace.name}
        </span>
        <DownOutlined style={{ fontSize: 8, color: token.colorTextTertiary }} />
      </button>
    </Dropdown>
  );
};

export default WorkspacePill;
