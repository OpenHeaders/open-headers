/**
 * useInspectorNav — shared context for navigating the right-pane Docs panel.
 *
 * The name is historical (the right pane used to be called "Inspector").
 * Today it exists only to let any component request that the Docs panel
 * open at a specific section:
 *
 *   openDocs('section-id')
 *     1. Ask the host to open the right pane and switch to Docs.
 *     2. Record the pending section + a monotonic counter so DocsPanel
 *        scrolls to it (counter forces a re-scroll even when the same
 *        section is requested twice).
 *
 * The host (App.tsx) wires `onOpenInspector` to the workspace layout
 * state machine's `setRightPanel('docs')`. Tab-switching now lives in
 * the right ActivityBar — this hook no longer tracks an active tab.
 */

import type React from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface InspectorNavContextValue {
  /** Open the docs panel and scroll to a section. */
  openDocs: (sectionId: string) => void;
  /** Current section id requested — consumed by DocsPanel. */
  pendingSection: string | null;
  /** Monotonic counter that forces re-scroll even for the same section. */
  pendingCounter: number;
  /** Called by DocsPanel once it has scrolled to `pendingSection`. */
  clearPending: () => void;
  /**
   * Callback ref set by App.tsx. When `openDocs` fires, this is invoked so
   * the host can open the right pane via its state machine. Ref-based so
   * the provider doesn't re-render when the host rewires.
   */
  onOpenInspector: React.MutableRefObject<(() => void) | null>;
}

const InspectorNavContext = createContext<InspectorNavContextValue | null>(null);

export const InspectorNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [pendingCounter, setPendingCounter] = useState(0);
  const onOpenInspector = useRef<(() => void) | null>(null);

  const openDocs = useCallback((sectionId: string) => {
    setPendingSection(sectionId);
    setPendingCounter((c) => c + 1);
    onOpenInspector.current?.();
  }, []);

  const clearPending = useCallback(() => {
    setPendingSection(null);
  }, []);

  return (
    <InspectorNavContext.Provider value={{ openDocs, pendingSection, pendingCounter, clearPending, onOpenInspector }}>
      {children}
    </InspectorNavContext.Provider>
  );
};

export function useInspectorNav() {
  const ctx = useContext(InspectorNavContext);
  if (!ctx) throw new Error('useInspectorNav must be used within InspectorNavProvider');
  return ctx;
}
