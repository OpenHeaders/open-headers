/**
 * OpenDaemonAdminContext — hands the shell's `openDaemonAdmin` action
 * (open the daemon administration console tab) to deep workbench
 * components — the settings backend card's CTA — without threading a
 * prop through every layer. Same shape as {@link OpenSettingsContext}.
 *
 * Mounted by the workbench shell. Consumers receive `null` when no
 * shell provides the action (other surfaces, tests) and should hide
 * the affordance instead of rendering a dead button.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

export type OpenDaemonAdmin = () => void;

const OpenDaemonAdminContext = createContext<OpenDaemonAdmin | null>(null);

export const OpenDaemonAdminProvider: React.FC<{
  openDaemonAdmin: OpenDaemonAdmin;
  children: React.ReactNode;
}> = ({ openDaemonAdmin, children }) => (
  <OpenDaemonAdminContext.Provider value={openDaemonAdmin}>{children}</OpenDaemonAdminContext.Provider>
);

export function useOpenDaemonAdmin(): OpenDaemonAdmin | null {
  return useContext(OpenDaemonAdminContext);
}
