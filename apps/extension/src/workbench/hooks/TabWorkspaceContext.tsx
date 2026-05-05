/**
 * TabWorkspaceContext — surface-scoped wrapper for the per-tab workspace
 * seam.
 *
 * Mounted at the workbench surface (App.tsx, alongside the slice owner)
 * with the value computed via `useTabWorkspaceId(perTab)`. Components
 * inside the workbench tree consume via `useWorkbenchTabWorkspaceId()`.
 * Other surfaces (popup, side-panel, devtools panel) do NOT mount the
 * provider — the consumer hook falls back to `useActiveWorkspaceId()`,
 * preserving the system-scoped read for browser-global UI.
 *
 * See `MULTI_WORKSPACE_PER_TAB_DESIGN.md` § 5.2 + § 6.2.
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import { createContext, useContext } from 'react';
import type React from 'react';

const TabWorkspaceContext = createContext<string | null | undefined>(undefined);

export const TabWorkspaceProvider: React.FC<{
  workspaceId: string | null;
  children: React.ReactNode;
}> = ({ workspaceId, children }) => (
  <TabWorkspaceContext.Provider value={workspaceId}>{children}</TabWorkspaceContext.Provider>
);

/**
 * Resolve the workspace id for the *editing surface* the consumer sits
 * in. Workbench surface: returns the tab's binding (per-tab mode) or
 * the global default (global mode). Other surfaces: falls back to
 * `useActiveWorkspaceId` — the global default.
 */
export function useWorkbenchTabWorkspaceId(): string | null {
  const fromContext = useContext(TabWorkspaceContext);
  const fromGlobal = useActiveWorkspaceId();
  if (fromContext === undefined) return fromGlobal;
  return fromContext;
}
