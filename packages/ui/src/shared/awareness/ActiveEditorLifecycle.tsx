/**
 * `ActiveEditorLifecycle` — workspace-wide "active editor's lifecycle
 * status" state. Mirrors `ActiveEditorDirty`: only the editor whose
 * entity matches the active tab writes here, so the footer can render
 * one chip for whatever the user is currently looking at.
 *
 * The lifecycle status itself is computed by `useEditorShell`; this
 * context just relays it from editor → footer without each editor
 * having to know about the StatusBar.
 */

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { EditorLifecycleStatus } from '../editor-shell/types';

export interface ActiveEditorLifecycleValue {
  entityType: string;
  entityId: string;
  status: EditorLifecycleStatus;
}

const ValueCtx = createContext<ActiveEditorLifecycleValue | null>(null);
const SetterCtx = createContext<(next: ActiveEditorLifecycleValue | null) => void>(() => undefined);

export interface ActiveEditorLifecycleProviderProps {
  children: ReactNode;
}

export function ActiveEditorLifecycleProvider({ children }: ActiveEditorLifecycleProviderProps): ReactNode {
  const [value, setValue] = useState<ActiveEditorLifecycleValue | null>(null);
  const setter = useCallback((next: ActiveEditorLifecycleValue | null) => {
    setValue(next);
  }, []);
  const memoSetter = useMemo(() => setter, [setter]);
  return (
    <ValueCtx.Provider value={value}>
      <SetterCtx.Provider value={memoSetter}>{children}</SetterCtx.Provider>
    </ValueCtx.Provider>
  );
}

export function useActiveEditorLifecycle(): ActiveEditorLifecycleValue | null {
  return useContext(ValueCtx);
}

export function useSetActiveEditorLifecycle(): (next: ActiveEditorLifecycleValue | null) => void {
  return useContext(SetterCtx);
}
