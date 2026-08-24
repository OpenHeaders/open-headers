/**
 * The LIVE mount decision (the server access plan A7, as gated S12) —
 * a thin top-level component deriving Workbench-vs-screen from the
 * live workspace list:
 *
 *   - zero workspaces on a joined tab → the awaiting-access screen,
 *     resolving in place when the first grant syncs down;
 *   - workspaces present but no usable active pointer (an adoption
 *     hint that never synced, a grant arriving on the screen, a
 *     revoke-then-regrant) → promote the first workspace in sort
 *     order, then mount;
 *   - otherwise → the Workbench, which assumes ≥1 workspace and an
 *     active pointer throughout.
 *
 * The decision re-derives on every workspace-store change, so an admin
 * revoking the user's LAST workspace mid-session honestly takes the
 * Workbench down to the screen — a state that became reachable at
 * runtime once no local seed remains on a joined tab.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { listWorkspaces, onWorkspaceStoreChange } from '@openheaders/oracle/workspace/extension-workspace-store';
import Workbench from '@openheaders/ui/workbench/App';
import { useEffect, useReducer } from 'react';
import { AwaitingAccessScreen } from '@/AwaitingAccessScreen';
import type { DaemonWire } from '@/host/daemon-wire';
import { hasUsableActiveWorkspace, promoteFirstWorkspaceWhenUnset } from '@/host/mount-decision';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';

export interface WorkbenchMountProps {
  wire: DaemonWire;
}

export function WorkbenchMount({ wire }: WorkbenchMountProps): React.JSX.Element | null {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onWorkspaceStoreChange(bump), []);

  const hasWorkspaces = listWorkspaces().length > 0;
  const activeUsable = hasUsableActiveWorkspace();

  useEffect(() => {
    if (hasWorkspaces && !activeUsable) {
      void promoteFirstWorkspaceWhenUnset().catch((err: unknown) => {
        logger.warn('WorkbenchMount', 'could not promote a workspace to active', err);
      });
    }
  }, [hasWorkspaces, activeUsable]);

  if (!hasWorkspaces) return <AwaitingAccessScreen wire={wire} />;
  // Promotion in flight — the flip lands as a store change and
  // re-renders into the Workbench a beat later.
  if (!activeUsable) return null;
  return <Workbench resolveIdentity={resolveWorkbenchIdentity} />;
}
