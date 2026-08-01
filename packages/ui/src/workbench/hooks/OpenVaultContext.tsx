/**
 * OpenVaultContext — hands the shell's `openVault` action (open the
 * device-vault editor tab) to deep workbench components — the outbound
 * proxy pane's empty credential picker — without threading a prop
 * through every layer. Same shape as {@link OpenServerAdminContext}.
 *
 * Mounted by the workbench shell. Consumers receive `null` when no
 * shell provides the action (other surfaces, tests) and should hide
 * the affordance instead of rendering a dead button.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

export type OpenVault = () => void;

const OpenVaultContext = createContext<OpenVault | null>(null);

export const OpenVaultProvider: React.FC<{
  openVault: OpenVault;
  children: React.ReactNode;
}> = ({ openVault, children }) => <OpenVaultContext.Provider value={openVault}>{children}</OpenVaultContext.Provider>;

export function useOpenVault(): OpenVault | null {
  return useContext(OpenVaultContext);
}
