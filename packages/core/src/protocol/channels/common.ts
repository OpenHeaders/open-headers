/**
 * Channel-registry shared shapes — small structural types referenced by
 * more than one domain module in this directory.
 *
 * Kept separate so a workspace-domain module and the broadcast contract
 * can both name {@link WorkspaceSnapshot} without one importing the
 * other.
 */

import type { ExtensionWorkspace } from '../../types';

/** Snapshot returned whenever the UI needs the current workspace list + active id. */
export interface WorkspaceSnapshot {
  workspaces: ExtensionWorkspace[];
  activeWorkspaceId: string;
}

/** Shared shape for a folder descriptor returned by create-folder RPCs. */
export interface FolderDescriptor {
  uid: string;
  path: string;
  name: string;
}
