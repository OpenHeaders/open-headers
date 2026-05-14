import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { SurfaceInfo, SurfaceMode } from './types';

const SurfaceContext = createContext<SurfaceInfo | null>(null);

interface SurfaceProviderProps {
  mode: SurfaceMode;
  children: ReactNode;
}

export function SurfaceProvider({ mode, children }: SurfaceProviderProps): ReactNode {
  const value = useMemo<SurfaceInfo>(
    () => ({
      mode,
      presenceName: mode,
      dismissesOnBlur: mode === 'popup',
    }),
    [mode],
  );
  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

/**
 * Read the active surface. Throws if no provider is mounted — every
 * extension page that consumes shared UI components must wrap them in
 * SurfaceProvider so behavior never silently picks the wrong default.
 */
export function useSurface(): SurfaceInfo {
  const ctx = useContext(SurfaceContext);
  if (!ctx) throw new Error('useSurface must be used inside <SurfaceProvider>');
  return ctx;
}
