/**
 * Settings-internal navigation. The shell provides its category
 * selector so a row deep inside a pane can jump to another settings
 * page (e.g. the MCP client-config row pointing at the token ledger
 * on Backend › Server) without threading a callback through every
 * pane and field component.
 */

import type React from 'react';
import { createContext, type ReactNode, useContext } from 'react';

type SelectCategory = (categoryId: string) => void;

const NavigationContext = createContext<SelectCategory | null>(null);

export const SettingsNavigationProvider: React.FC<{ selectCategory: SelectCategory; children: ReactNode }> = ({
  selectCategory,
  children,
}) => <NavigationContext.Provider value={selectCategory}>{children}</NavigationContext.Provider>;

/** The shell's category selector, or `null` when rendered outside the settings shell. */
export function useSelectSettingsCategory(): SelectCategory | null {
  return useContext(NavigationContext);
}
