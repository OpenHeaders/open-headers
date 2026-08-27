/**
 * Git domain tab body — server workspace ↔ repository bindings (the
 * git-sync plan §11.5): the settings Git pages stacked as one card over
 * the gated dispatch wire; paths and repos live on the daemon. No
 * native picker here: binds go through the path input.
 */

import { Select, theme } from 'antd';
import { useEffect, useState } from 'react';
import type React from 'react';
import { type BridgeRpcRequest, type BridgeRpcResponse, hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { WorkspaceTreeRpcType, WorkspaceTreeTransport } from '../../components/git/transport';
import GitWorkspaceCard from '../../settings/components/git/git-workspace-card';
import { SectionHeader } from './section-chrome';
import { useServerDirectory } from './use-server-directory';

/**
 * The Git card's call seam over the admin wire: every workspace-tree
 * verb rides `oh.daemon.workspaceTree.dispatch` to the daemon spine's
 * shared verb table (the git-sync plan §11.5). The dispatch channel's wire
 * response is untyped by construction (one channel, many ops), so the
 * op's own response shape is asserted here — the one narrowing seam.
 */
const adminGitTransport: WorkspaceTreeTransport = async <K extends WorkspaceTreeRpcType>(
  type: K,
  ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
): Promise<BridgeRpcResponse<K>> =>
  (await hostBridge.call('oh.daemon.workspaceTree.dispatch', {
    op: type,
    ...(args[0] !== undefined ? { payload: args[0] as Record<string, unknown> } : {}),
  })) as BridgeRpcResponse<K>;

const ServerAdminGitSection: React.FC = () => {
  const t = useT();
  const { token } = theme.useToken();
  const { serverWorkspaces, workspaceOptions } = useServerDirectory(true);
  const [gitWorkspaceId, setGitWorkspaceId] = useState<string | null>(null);

  // Land on the SERVER's first workspace so the card targets a
  // workspace the daemon's git bindings actually hold; the Select
  // re-targets it.
  useEffect(() => {
    if (gitWorkspaceId === null && serverWorkspaces && serverWorkspaces.length > 0) {
      setGitWorkspaceId(serverWorkspaces[0].id);
    }
  }, [gitWorkspaceId, serverWorkspaces]);

  return (
    <section style={{ marginBottom: 12 }}>
      <SectionHeader
        title={t('workbench.serverAdmin.git.sectionTitle')}
        hint={t('workbench.serverAdmin.git.sectionHint')}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '0 2px' }}>
        <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
          {t('workbench.serverAdmin.git.workspaceLabel')}
        </span>
        <Select
          size="small"
          value={gitWorkspaceId}
          onChange={(value) => setGitWorkspaceId(value)}
          style={{ minWidth: 220 }}
          options={[...workspaceOptions]}
          data-testid="server-admin-git-workspace"
        />
      </div>
      {gitWorkspaceId !== null && (
        <GitWorkspaceCard transport={adminGitTransport} workspaceId={gitWorkspaceId} />
      )}
    </section>
  );
};

export default ServerAdminGitSection;
