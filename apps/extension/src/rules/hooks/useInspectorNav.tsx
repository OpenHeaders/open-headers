/**
 * useInspectorNav — shared context for navigating the Inspector docs panel.
 *
 * Any component can call `openDocs('section-id')` to:
 *   1. Open the inspector panel (if closed)
 *   2. Switch to the Docs tab
 *   3. Scroll to the specified section
 */

import type React from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface InspectorNavContextValue {
  /** Open the docs panel and scroll to a section. */
  openDocs: (sectionId: string) => void;
  /** Current section ID requested (consumed by Inspector). */
  pendingSection: string | null;
  /** Counter that increments on every openDocs call — forces re-scroll even for same section. */
  pendingCounter: number;
  /** Clear the pending section after scrolling. */
  clearPending: () => void;
  /** Active inspector tab. */
  activeTab: string;
  /** Set active inspector tab. */
  setActiveTab: (tab: string) => void;
  /** Callback to open the inspector panel — set by App.tsx. */
  onOpenInspector: React.MutableRefObject<(() => void) | null>;
}

const InspectorNavContext = createContext<InspectorNavContextValue | null>(null);

export const InspectorNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [pendingCounter, setPendingCounter] = useState(0);
  const [activeTab, setActiveTab] = useState('docs');
  const onOpenInspector = useRef<(() => void) | null>(null);

  const openDocs = useCallback((sectionId: string) => {
    setActiveTab('docs');
    setPendingSection(sectionId);
    setPendingCounter((c) => c + 1);
    onOpenInspector.current?.();
  }, []);

  const clearPending = useCallback(() => {
    setPendingSection(null);
  }, []);

  return (
    <InspectorNavContext.Provider
      value={{ openDocs, pendingSection, pendingCounter, clearPending, activeTab, setActiveTab, onOpenInspector }}
    >
      {children}
    </InspectorNavContext.Provider>
  );
};

export function useInspectorNav() {
  const ctx = useContext(InspectorNavContext);
  if (!ctx) throw new Error('useInspectorNav must be used within InspectorNavProvider');
  return ctx;
}
