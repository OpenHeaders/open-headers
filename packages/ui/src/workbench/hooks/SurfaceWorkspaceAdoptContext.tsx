/**
 * SurfaceWorkspaceAdoptContext — lets a backend (daemon) switch re-pin
 * THIS workbench surface to the app instance's active workspace.
 *
 * Switching back-end mode repoints the active-workspace pointer to the
 * new daemon's default workspace (the data plane adopts it on first
 * join — `sync-handshake.ts`). But workbench tabs deliberately do NOT
 * auto-follow active changes (`useWorkbenchWorkspaceSlice` is a no-op),
 * and the old binding stays valid because every host's workspaces
 * coexist in one multi-org list — so the surface would otherwise keep
 * rendering the previous host's workspace. The switch flow calls this
 * to snap the initiating surface (and its URL, via
 * `useUrlWorkspaceBindingMirror`) onto the new active workspace once the
 * new host's workspaces are live.
 *
 * Provided only by the workbench surface (App.tsx). Popup / side-panel /
 * devtools-panel follow global active by design, so the consumer hook
 * returns `null` there and the switch flow skips the re-pin.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

/**
 * Re-pin the current workbench surface to the active workspace after a
 * back-end switch. Resolves once the new host's workspaces are live and
 * the surface has been re-pinned (or a settle timeout elapses).
 */
export type AdoptActiveWorkspaceIntoSurface = () => Promise<void>;

const SurfaceWorkspaceAdoptContext = createContext<AdoptActiveWorkspaceIntoSurface | null>(null);

export const SurfaceWorkspaceAdoptProvider: React.FC<{
  adopt: AdoptActiveWorkspaceIntoSurface;
  children: React.ReactNode;
}> = ({ adopt, children }) => (
  <SurfaceWorkspaceAdoptContext.Provider value={adopt}>{children}</SurfaceWorkspaceAdoptContext.Provider>
);

/** `null` outside the workbench surface — the caller skips the re-pin. */
export function useSurfaceWorkspaceAdopt(): AdoptActiveWorkspaceIntoSurface | null {
  return useContext(SurfaceWorkspaceAdoptContext);
}
