/**
 * The home-Org floor at runtime — a host that declared `seedOnEmpty`
 * keeps at least one workspace in its own Org for as long as it runs,
 * not only at boot.
 *
 * The surfaces refuse to delete the last workspace of any Org they see
 * (`isLastWorkspaceInOrg`), on the owning host and on every peer that
 * consumes it. A delete can still land here from a peer that predates
 * that rule, and a refusal at the receiver would leave the two hosts
 * diverged forever (the sender's tombstone outranks our copy). So the
 * floor is restored the way boot restores it: when the home Org holds
 * no workspace, seed the default one again and point the active
 * workspace at it if nothing live is active. Converges everywhere
 * (the seed syncs down like any create) and never diverges.
 *
 * Installed by the hosts that declare `seedOnEmpty: true` (the
 * extension SW, the shared daemon spine); the web host, whose home Org
 * is not where its workspaces live, never installs it.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import { logger } from '@openheaders/core/utils';
import {
  createWorkspace,
  DEFAULT_WORKSPACE_COLOR,
  DEFAULT_WORKSPACE_NAME,
  getWorkspace,
  listWorkspaces,
  onWorkspaceStoreChange,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from './extension-workspace-store';

const SCOPE = 'HomeOrgFloor';

/** Subscribe the floor to the workspace store; returns the unsubscribe. */
export function installHomeOrgFloor(): () => void {
  let restoring = false;
  const restore = async (): Promise<void> => {
    const created = await createWorkspace({ name: DEFAULT_WORKSPACE_NAME, color: DEFAULT_WORKSPACE_COLOR });
    const active = peekActiveWorkspaceId();
    if (active === null || !getWorkspace(active)) {
      await setActiveWorkspaceById(created.id);
    }
    logger.info(SCOPE, `home Org held no workspace — seeded ${created.id} "${created.name}"`);
  };
  return onWorkspaceStoreChange(() => {
    if (restoring) return;
    const homeOrgId = getIdentitySnapshot()?.user.homeOrgId;
    if (!homeOrgId) return;
    if (listWorkspaces().some((ws) => ws.orgId === homeOrgId)) return;
    restoring = true;
    void restore()
      .catch((err: unknown) => {
        logger.warn(SCOPE, 'restoring the home Org floor failed', err);
      })
      .finally(() => {
        restoring = false;
      });
  });
}
