/**
 * org-scope-vocabulary — two decoupled vocabularies the workspace
 * org-binding UI reads from (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4):
 *
 *   - sync-reach    — keyed by {@link OrgScopeKind}: the picker wording,
 *                     the one-line reach explanation, and the tag colour.
 *   - host-kind     — keyed by {@link HostKind}: the base identity glyph
 *                     for the host process that minted the Org.
 *
 * The identity *label* itself is `orgIdentityLabel` from core — the home
 * Org reads in the second person by host kind, a joined Org by its name.
 * `isSynthetic` drives neither vocabulary; it records trust-by-process.
 */

import { CloudServerOutlined, DesktopOutlined, GlobalOutlined } from '@ant-design/icons';
import type { OrgScopeKind } from '@openheaders/core/identity';
import type { HostKind } from '@openheaders/core/types';
import type * as React from 'react';

type IconComponent = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

/** The sync-reach vocabulary for one scope kind. */
export interface OrgScopeVisual {
  /** Sync-scope picker row label, phrased as the §6.4 table. */
  pickerLabel: string;
  /** One-line explanation of the scope's reach. */
  description: string;
  /** antd `Tag` colour token. */
  tagColor: string;
}

const SCOPE_VOCABULARY: Record<OrgScopeKind, OrgScopeVisual> = {
  local: {
    pickerLabel: 'Local to this device',
    description: 'Stays on this device. Never synced anywhere.',
    tagColor: 'default',
  },
  personal: {
    pickerLabel: 'Synced across my devices',
    description: 'Reaches every device signed in as you.',
    tagColor: 'blue',
  },
  team: {
    pickerLabel: 'Shared with team',
    description: 'Shared with everyone in this team.',
    tagColor: 'purple',
  },
};

export function orgScopeVisual(scopeKind: OrgScopeKind): OrgScopeVisual {
  return SCOPE_VOCABULARY[scopeKind];
}

/** The base identity glyph for the host process that minted the Org. */
const HOST_KIND_ICON: Record<HostKind, IconComponent> = {
  browser: GlobalOutlined,
  desktop: DesktopOutlined,
  daemon: CloudServerOutlined,
};

export function hostKindIcon(hostKind: HostKind): IconComponent {
  return HOST_KIND_ICON[hostKind];
}
