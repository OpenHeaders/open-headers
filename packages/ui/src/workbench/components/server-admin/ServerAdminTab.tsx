/**
 * One server-admin domain tab — the slim per-domain editor surface the
 * Server admin panel's rows open (one row → one tab → one domain,
 * never an everything-page). The admin-status gate renders honesty
 * only; the server re-gates every call as the caller per frame, so a
 * revoked admin sees in-band errors here, never a bypass.
 *
 * The Devices and Server domains mount their self-contained components
 * directly (`BackendTokensSection` polls its own ledger,
 * `ServerReleaseNotesCard` reads the served build's entry); Users, Git
 * and Audit have their own section components on the shared directory
 * spine.
 */

import { Empty, Spin } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import BackendTokensSection from '../../settings/components/backend-tokens-section';
import type { ServerAdminSection } from './sections';
import ServerAdminAuditSection from './ServerAdminAuditSection';
import ServerAdminGitSection from './ServerAdminGitSection';
import ServerAdminUsersSection from './ServerAdminUsersSection';
import ServerReleaseNotesCard from './ServerReleaseNotesCard';
import { type ServerAdminStatus, useServerAdminStatus } from './use-server-admin-status';

const SECTION_BODIES: Record<ServerAdminSection, React.FC> = {
  users: ServerAdminUsersSection,
  devices: BackendTokensSection,
  git: ServerAdminGitSection,
  audit: ServerAdminAuditSection,
  server: ServerReleaseNotesCard,
};

const ServerAdminTab: React.FC<{ section: ServerAdminSection }> = ({ section }) => {
  const t = useT();
  const adminStatus: ServerAdminStatus = useServerAdminStatus();

  if (adminStatus === 'unknown') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }
  if (adminStatus === 'denied') {
    return (
      <div style={{ padding: 48 }}>
        <Empty description={t('workbench.serverAdmin.deniedDescription')} />
      </div>
    );
  }

  const Body = SECTION_BODIES[section];
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 32px' }} data-testid="server-admin-tab">
      <Body />
    </div>
  );
};

export default ServerAdminTab;
