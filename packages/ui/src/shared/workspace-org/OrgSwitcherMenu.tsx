/**
 * OrgSwitcherMenu — the Org selector header inside the workspace
 * dropdown (Phase U5.9, the org switcher).
 *
 * Org is the top-level container: every workspace belongs to exactly one
 * Org. This header shows the Org the switcher is currently scoped to and
 * lets the user move between Orgs — their own local/personal Org, or a
 * team Org adopted by joining a backend (consume-only join, U5).
 *
 * Switching Org only re-scopes which workspaces the list below shows; it
 * does not touch the active workspace. The user picks a workspace within
 * the chosen Org from the rows below.
 */

import { CheckOutlined, DownOutlined } from '@ant-design/icons';
import type { OrgDescriptor } from '@openheaders/core/identity';
import { Dropdown, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import type React from 'react';
import { orgBadgeLabel, orgScopeVisual } from './org-scope-vocabulary';

const { Text } = Typography;

export interface OrgSwitcherMenuProps {
  /** Every Org the identity belongs to, local → personal → team. */
  catalogue: OrgDescriptor[];
  /** The Org the switcher is currently scoped to; `null` pre-bootstrap. */
  activeOrgId: string | null;
  /** Switch the active Org — re-scopes the workspace list below. */
  onSwitchOrg: (orgId: string) => void;
}

function orgRowLabel(descriptor: OrgDescriptor, selected: boolean): React.ReactNode {
  const visual = orgScopeVisual(descriptor.scopeKind);
  const Icon = visual.icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0', minWidth: 220 }}>
      <Icon style={{ fontSize: 14, marginTop: 2 }} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{orgBadgeLabel(descriptor)}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {visual.description}
        </Text>
      </div>
      {selected && <CheckOutlined style={{ fontSize: 12, marginTop: 3 }} />}
    </div>
  );
}

export const OrgSwitcherMenu: React.FC<OrgSwitcherMenuProps> = ({ catalogue, activeOrgId, onSwitchOrg }) => {
  const { token } = theme.useToken();

  const active = catalogue.find((o) => o.id === activeOrgId) ?? catalogue[0] ?? null;
  if (!active) return null;

  const activeVisual = orgScopeVisual(active.scopeKind);
  const ActiveIcon = activeVisual.icon;

  const items: MenuProps['items'] = catalogue.map((descriptor) => ({
    key: descriptor.id,
    label: orgRowLabel(descriptor, descriptor.id === active.id),
    onClick: () => {
      if (descriptor.id !== active.id) onSwitchOrg(descriptor.id);
    },
  }));

  return (
    <Dropdown trigger={['click']} placement="bottomLeft" menu={{ items, selectable: false }}>
      <div
        role="button"
        aria-label={`Current organization: ${orgBadgeLabel(active)}. Click to switch.`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 6px',
          margin: '0 2px 4px',
          borderRadius: 4,
          cursor: 'pointer',
          background: token.colorFillQuaternary,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ActiveIcon style={{ fontSize: 13, color: token.colorTextSecondary }} />
        <Text
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {orgBadgeLabel(active)}
        </Text>
        <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
      </div>
    </Dropdown>
  );
};
