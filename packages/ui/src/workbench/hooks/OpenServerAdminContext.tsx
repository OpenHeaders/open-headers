/**
 * OpenServerAdminContext — hands the shell's `openServerAdmin` action
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

export type OpenServerAdmin = () => void;

const OpenServerAdminContext = createContext<OpenServerAdmin | null>(null);

export const OpenServerAdminProvider: React.FC<{
  openServerAdmin: OpenServerAdmin;
  children: React.ReactNode;
}> = ({ openServerAdmin, children }) => (
  <OpenServerAdminContext.Provider value={openServerAdmin}>{children}</OpenServerAdminContext.Provider>
);

export function useOpenServerAdmin(): OpenServerAdmin | null {
  return useContext(OpenServerAdminContext);
}
