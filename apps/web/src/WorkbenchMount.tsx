/**
 * The LIVE mount decision (the server access plan A7, as gated S12;
 * widened by the access-foundation admin posture) — a thin top-level
 * component deriving the surface from the live workspace list plus the
 * shared admin-status store:
 *
 *   - zero workspaces on a joined tab → wait for the admin probe to
 *     settle (no A7 flash), then: a server admin mounts the Workbench
 *     in the zero-workspace admin posture (role/system windows only);
 *     everyone else lands the awaiting-access screen exactly as
 *     before, resolving in place when the first grant syncs down;
 *   - workspaces present but no usable active pointer (an adoption
 *     hint that never synced, a grant arriving on the screen, a
 *     revoke-then-regrant) → promote the first workspace in sort
 *     order, then mount;
 *   - otherwise → the Workbench, which assumes ≥1 workspace and an
 *     active pointer throughout.
 *
 * The decision re-derives on every workspace-store change, so both
 * live arcs hold: an admin revoking the user's LAST workspace takes an
 * admin's tab to the admin posture (a non-admin's to the screen), and
 * a grant landing resolves either state into the full Workbench. The
 * Workbench element is keyed per posture so a posture flip re-mounts
 * the shell — the view-state resolvers re-run against the new
 * workspace reality instead of surviving it in place.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { listWorkspaces, onWorkspaceStoreChange } from '@openheaders/oracle/workspace/extension-workspace-store';
import { getActiveExtensionWorkspaceSyncMirror } from '@openheaders/ui/context';
import Workbench from '@openheaders/ui/workbench/App';
import {
  reprobeServerAdminStatus,
  useServerAdminStatus,
  useServerAdminStatusSettled,
} from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { useEffect, useReducer, useState } from 'react';
import { AwaitingAccessScreen } from '@/AwaitingAccessScreen';
import type { DaemonWire } from '@/host/daemon-wire';
import { hasUsableActiveWorkspace, promoteFirstWorkspaceWhenUnset, resolveMountSurface } from '@/host/mount-decision';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';

/** How long the zero-workspace branch waits for the admin probe before
 *  falling back to the awaiting-access screen. In the normal arc the
 *  probe answers right after the wire handshake (sub-second); only an
 *  unreachable daemon runs the window out, and A7 — which keeps
 *  re-asking identity itself — beats a blank page there. */
const ADMIN_PROBE_GRACE_MS = 4_000;

export interface WorkbenchMountProps {
  wire: DaemonWire;
}

export function WorkbenchMount({ wire }: WorkbenchMountProps): React.JSX.Element | null {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onWorkspaceStoreChange(bump), []);

  const hasWorkspaces = listWorkspaces().length > 0;
  const activeUsable = hasUsableActiveWorkspace();
  const adminStatus = useServerAdminStatus();
  const adminSettled = useServerAdminStatusSettled();

  // The store's own probe may fire before the wire joins and read a
  // transient denied — a completed handshake is the signal that a real
  // answer is now reachable, so re-ask immediately (the store's
  // cooldown would otherwise sit on the stale rejection).
  useEffect(() => {
    if (adminSettled) return;
    return wire.subscribeHandshake((state) => {
      if (state === 'welcomed' || state === 'catching-up' || state === 'synced') reprobeServerAdminStatus();
    });
  }, [wire, adminSettled]);

  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    if (hasWorkspaces || adminSettled) return;
    const timer = setTimeout(() => setGraceElapsed(true), ADMIN_PROBE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [hasWorkspaces, adminSettled]);

  // The admin posture derives its window set from the ui workspace
  // mirror — mount only once its bootstrap snapshot settled, so the
  // registry never seeds workspace windows it would immediately drop.
  const [mirrorHydrated, setMirrorHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void getActiveExtensionWorkspaceSyncMirror().hydrated.then(() => {
      if (!cancelled) setMirrorHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hasWorkspaces && !activeUsable) {
      void promoteFirstWorkspaceWhenUnset().catch((err: unknown) => {
        logger.warn('WorkbenchMount', 'could not promote a workspace to active', err);
      });
    }
  }, [hasWorkspaces, activeUsable]);

  const surface = resolveMountSurface({
    hasWorkspaces,
    activeUsable,
    adminSettled,
    adminStatus,
    graceElapsed,
    workspaceMirrorHydrated: mirrorHydrated,
  });

  if (surface === 'awaiting-access') return <AwaitingAccessScreen wire={wire} />;
  // Pending — promotion in flight, admin answer owed, or the mirror
  // hydrating; the flip lands as a store/status change and re-renders
  // into the settled surface a beat later.
  if (surface === 'pending') return null;
  return <Workbench key={surface} resolveIdentity={resolveWorkbenchIdentity} />;
}
