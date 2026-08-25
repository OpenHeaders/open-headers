/**
 * Audit domain tab body — the queryable audit reports. Actor names
 * resolve through the directory, loaded here at view time (§9.3);
 * workspace labels resolve through the server's own projection.
 */

import type React from 'react';
import ServerAuditReports from './ServerAuditReports';
import { useServerDirectory } from './use-server-directory';

const ServerAdminAuditSection: React.FC = () => {
  const { users, workspaceName, workspaceOptions } = useServerDirectory(true);
  return (
    <ServerAuditReports
      users={(users ?? []).map((u) => ({ userId: u.userId, displayName: u.displayName }))}
      workspaceName={workspaceName}
      workspaceOptions={workspaceOptions}
    />
  );
};

export default ServerAdminAuditSection;
