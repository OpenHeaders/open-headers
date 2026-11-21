/**
 * Administration section vocabulary — one entry per administration
 * domain. The dock panel renders these as nav rows; each row opens its
 * own singleton workbench tab scoped to exactly that domain (no
 * everything-page). The registry is the single source of truth for the
 * section set, order, icons, and copy keys, so the panel, the tab
 * opener, and the tab body can never disagree.
 */

import {
  AuditOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  LaptopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { getIdentitySnapshot, orgCatalogue } from '@openheaders/core/identity';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type { ServerAdminSection } from '../../types';

export type { ServerAdminSection };

export interface ServerAdminSectionDef {
  readonly id: ServerAdminSection;
  readonly labelKey: MessageKey;
  readonly hintKey: MessageKey;
  readonly icon: React.ReactNode;
}

export const SERVER_ADMIN_SECTIONS: readonly ServerAdminSectionDef[] = [
  {
    id: 'users',
    labelKey: 'workbench.serverAdmin.panel.users',
    hintKey: 'workbench.serverAdmin.panel.usersHint',
    icon: <TeamOutlined />,
  },
  {
    id: 'devices',
    labelKey: 'workbench.serverAdmin.panel.devices',
    hintKey: 'workbench.serverAdmin.panel.devicesHint',
    icon: <LaptopOutlined />,
  },
  {
    id: 'git',
    labelKey: 'workbench.serverAdmin.panel.git',
    hintKey: 'workbench.serverAdmin.panel.gitHint',
    icon: <BranchesOutlined />,
  },
  {
    id: 'audit',
    labelKey: 'workbench.serverAdmin.panel.audit',
    hintKey: 'workbench.serverAdmin.panel.auditHint',
    icon: <AuditOutlined />,
  },
  {
    id: 'server',
    labelKey: 'workbench.serverAdmin.panel.server',
    hintKey: 'workbench.serverAdmin.panel.serverHint',
    icon: <CloudServerOutlined />,
  },
];

export const SERVER_ADMIN_SECTION_MAP: ReadonlyMap<ServerAdminSection, ServerAdminSectionDef> = new Map(
  SERVER_ADMIN_SECTIONS.map((def) => [def.id, def]),
);

/**
 * The rows the nav offers on this host. The Server domain belongs to a
 * standalone server alone: a desktop app — its own window, or a browser
 * tab on the Workbench it serves — shows its build under Settings ›
 * About and keeps the requests switch under Backup and Sync › Your
 * devices, so the row would open a tab with nothing of its own.
 */
export function visibleServerAdminSections(): readonly ServerAdminSectionDef[] {
  const desktopAppAnswers =
    getCurrentHost() === 'desktop' ||
    orgCatalogue(getIdentitySnapshot()).some((org) => !org.isHome && org.hostKind === 'desktop');
  return desktopAppAnswers ? SERVER_ADMIN_SECTIONS.filter((def) => def.id !== 'server') : SERVER_ADMIN_SECTIONS;
}

/**
 * The singleton tab id for a section. The Users tab keeps the historic
 * `server-admin` id so layouts persisted before the decomposition
 * restore onto the directory surface instead of dangling.
 */
export function serverAdminTabId(section: ServerAdminSection): string {
  return section === 'users' ? 'server-admin' : `server-admin-${section}`;
}
