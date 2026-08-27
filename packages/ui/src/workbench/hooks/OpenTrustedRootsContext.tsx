/**
 * OpenTrustedRootsContext — hands the shell's `openTrustedRoots` action
 * (open the workspace's trusted-certificates editor tab) to deep
 * workbench components — the Settings TLS groups' read-only line —
 * without threading a prop through every layer. Same shape as
 * {@link OpenVaultContext}.
 *
 * Mounted by the workbench shell. Consumers receive `null` when no
 * shell provides the action (other surfaces, tests) and should hide
 * the affordance instead of rendering a dead link.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

export type OpenTrustedRoots = () => void;

const OpenTrustedRootsContext = createContext<OpenTrustedRoots | null>(null);

export const OpenTrustedRootsProvider: React.FC<{
  openTrustedRoots: OpenTrustedRoots;
  children: React.ReactNode;
}> = ({ openTrustedRoots, children }) => (
  <OpenTrustedRootsContext.Provider value={openTrustedRoots}>{children}</OpenTrustedRootsContext.Provider>
);

export function useOpenTrustedRoots(): OpenTrustedRoots | null {
  return useContext(OpenTrustedRootsContext);
}
