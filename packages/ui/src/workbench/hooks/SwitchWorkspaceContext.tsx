/**
 * SwitchWorkspaceContext — hands the shell's workspace switch (the
 * same gesture the switcher and the import flow make: re-pin this tab,
 * optionally make the target active, with the dirty-draft guard) to
 * deep workbench components without threading a prop through every
 * layer. Lets the Git bind form land the workbench on a workspace it
 * just opened from a folder.
 *
 * Mounted by the workbench shell. Consumers receive `null` when no
 * shell provides the action (the Server Admin console's Git card, other
 * surfaces, tests) and should finish without the jump.
 */

import { createContext, useContext } from 'react';
import type React from 'react';

export type SwitchWorkspace = (targetId: string, opts?: { makeActive?: boolean }) => Promise<boolean>;

const SwitchWorkspaceContext = createContext<SwitchWorkspace | null>(null);

export const SwitchWorkspaceProvider: React.FC<{
  switchWorkspace: SwitchWorkspace;
  children: React.ReactNode;
}> = ({ switchWorkspace, children }) => (
  <SwitchWorkspaceContext.Provider value={switchWorkspace}>{children}</SwitchWorkspaceContext.Provider>
);

export function useSwitchWorkspace(): SwitchWorkspace | null {
  return useContext(SwitchWorkspaceContext);
}
