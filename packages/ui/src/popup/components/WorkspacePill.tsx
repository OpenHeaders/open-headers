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
import { describeOrg, orgCatalogue } from '@openheaders/core/identity';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { useSurface } from '@openheaders/ui/shared/surface';
import { WorkspaceDropdownBody } from '@openheaders/ui/shared/workspace-dropdown/WorkspaceDropdownBody';
import { WorkspaceOrgBadge } from '@openheaders/ui/shared/workspace-org/WorkspaceOrgBadge';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { renderWorkspacePrefix } from '@openheaders/ui/workbench/components/workspace/workspace-prefix';
import { Button, Dropdown, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';

const WorkspacePill: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  const surface = useSurface();
  const { workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspace } = useWorkspaces();
  const snapshot = useIdentitySnapshot();
  const catalogue = useMemo(() => orgCatalogue(snapshot), [snapshot]);
  const [open, setOpen] = useState(false);

  if (!activeWorkspace) return null;

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      popupRender={() => (
        <WorkspaceDropdownBody
          open={open}
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
          onOpenBackendSettings={() => {
            void openWorkspace({ kind: 'open-settings', target: { categoryId: 'backend' } }, surface.mode);
          }}
          popoverPlacement="top"
          onClose={() => setOpen(false)}
          orgGrouping={{
            catalogue,
            describe: (orgId) => describeOrg(snapshot, orgId),
          }}
        />
      )}
      trigger={['click']}
      placement="bottomLeft"
    >
      {/* Default antd Button (no type/border overrides) so the trigger
          gets the same native hover as the workbench / devtools
          workspace selectors. */}
      <Button
        size="small"
        className="oh-workspace-pill"
        aria-label={t('popup.header.activeWorkspace', { name: activeWorkspace.name })}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          height: 22,
          borderRadius: 4,
          fontSize: 12,
          color: token.colorText,
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {renderWorkspacePrefix({ icon: activeWorkspace.icon, color: activeWorkspace.color }, token, { size: 14 })}
        <span
          style={{
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {activeWorkspace.name}
        </span>
        {catalogue.length > 1 && (
          <span
            className="oh-workspace-pill-org"
            style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}
          >
            <WorkspaceOrgBadge
              descriptor={describeOrg(snapshot, activeWorkspace.orgId)}
              compact
              suppressTooltip={open}
            />
          </span>
        )}
        <DownOutlined style={{ fontSize: 8, color: token.colorTextTertiary, flexShrink: 0 }} />
      </Button>
    </Dropdown>
  );
};

export default WorkspacePill;
