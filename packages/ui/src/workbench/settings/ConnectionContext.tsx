import type React from 'react';
import { createContext, type ReactNode, useContext } from 'react';

interface ConnectionContextValue {
  isConnected: boolean;
}

const ConnectionContext = createContext<ConnectionContextValue>({ isConnected: false });

export const ConnectionProvider: React.FC<{ value: ConnectionContextValue; children: ReactNode }> = ({
  value,
  children,
}) => <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;

export function useSettingsConnection(): ConnectionContextValue {
  return useContext(ConnectionContext);
}
