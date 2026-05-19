/**
 * org-scope-vocabulary — the single place the workspace org-binding UI
 * turns an {@link OrgScopeKind} into user-facing wording, an icon, and a
 * tag colour (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4).
 *
 * Every surface — the "where does this live?" badge, the sync-scope
 * picker, the two-personal-Orgs onboarding — reads from here so the
 * three scope kinds stay described consistently.
 */

import { CloudOutlined, DesktopOutlined, TeamOutlined } from '@ant-design/icons';
import type { OrgDescriptor, OrgScopeKind } from '@openheaders/core/identity';
import type * as React from 'react';

export interface OrgScopeVisual {
  /** Short label for the inline badge. Team scope overrides this with the Org name. */
  badgeLabel: string;
  /** Sync-scope picker row label, phrased as the §6.4 table. */
  pickerLabel: string;
  /** One-line explanation of the scope's reach. */
  description: string;
  /** antd `Tag` colour token. */
  tagColor: string;
  icon: React.ComponentType<{ style?: React.CSSProperties; className?: string }>;
}

const VOCABULARY: Record<OrgScopeKind, OrgScopeVisual> = {
  local: {
    badgeLabel: 'On this device',
    pickerLabel: 'Local to this device',
    description: 'Stays on this device. Never synced anywhere.',
    tagColor: 'default',
    icon: DesktopOutlined,
  },
  personal: {
    badgeLabel: 'My devices',
    pickerLabel: 'Synced across my devices',
    description: 'Reaches every device signed in as you.',
    tagColor: 'blue',
    icon: CloudOutlined,
  },
  team: {
    badgeLabel: 'Team',
    pickerLabel: 'Shared with team',
    description: 'Shared with everyone in this team.',
    tagColor: 'purple',
    icon: TeamOutlined,
  },
};

export function orgScopeVisual(scopeKind: OrgScopeKind): OrgScopeVisual {
  return VOCABULARY[scopeKind];
}

/**
 * The label shown on the badge for a concrete Org. Team Orgs read by
 * name (a user can belong to several); local / personal scopes use the
 * fixed scope wording.
 */
export function orgBadgeLabel(descriptor: OrgDescriptor): string {
  return descriptor.scopeKind === 'team' ? descriptor.name : VOCABULARY[descriptor.scopeKind].badgeLabel;
}
