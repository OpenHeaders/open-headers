/**
 * useDocsNav — shared context for navigating the right-pane Docs panel.
 *
 * Any surface that mounts `<DocsPanel>` also mounts `<DocsNavProvider>`
 * above it; any component below can call `openDocs(sectionId)` to ask
 * the host to open the panel and scroll to a section.
 *
 *   openDocs('section-id')
 *     1. Ask the host to open the Docs surface (right pane, tool window, …).
 *     2. Record the pending section + a monotonic counter so `DocsPanel`
 *        scrolls to it (counter forces a re-scroll even when the same
 *        section is requested twice).
 *
 * Wiring: the host populates `onOpenDocs.current` with whatever is
 * needed to make the Docs surface visible (e.g. `setRightPanel('docs')`
 * in the workbench, or `toggleWindow('docs')` in the panel).
 *
 * Historical naming: the workbench previously exposed this as
 * `useInspectorNav` / `InspectorNavProvider`. Those names remain as
 * re-exports in `workbench/hooks/useInspectorNav.tsx` for compatibility
 * with existing callsites.
 */

import type React from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface DocsNavContextValue {
  /** Open the docs panel and scroll to a section. */
  openDocs: (sectionId: string) => void;
  /** Current section id requested — consumed by `DocsPanel`. */
  pendingSection: string | null;
  /** Monotonic counter that forces re-scroll even for the same section. */
  pendingCounter: number;
  /** Called by `DocsPanel` once it has scrolled to `pendingSection`. */
  clearPending: () => void;
  /**
   * Callback ref the host sets to open its docs surface. Ref-based so
   * the provider doesn't re-render when the host rewires.
   */
  onOpenDocs: React.MutableRefObject<(() => void) | null>;
  /**
   * Live mirror of the section `DocsPanel` is currently showing. Used by
   * shortcut handlers (e.g. Shift+?) to decide whether to toggle the
   * panel closed or navigate to a different section. `DocsPanel` pushes
   * via `reportCurrentSection`; consumers read via `currentSectionRef`
   * so the provider doesn't re-render on every section change.
   */
  currentSectionRef: React.MutableRefObject<string | null>;
  reportCurrentSection: (sectionId: string | null) => void;
}

const DocsNavContext = createContext<DocsNavContextValue | null>(null);

export const DocsNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const [pendingCounter, setPendingCounter] = useState(0);
  const onOpenDocs = useRef<(() => void) | null>(null);
  const currentSectionRef = useRef<string | null>(null);

  const openDocs = useCallback((sectionId: string) => {
    setPendingSection(sectionId);
    setPendingCounter((c) => c + 1);
    onOpenDocs.current?.();
  }, []);

  const clearPending = useCallback(() => {
    setPendingSection(null);
  }, []);

  const reportCurrentSection = useCallback((sectionId: string | null) => {
    currentSectionRef.current = sectionId;
  }, []);

  return (
    <DocsNavContext.Provider
      value={{
        openDocs,
        pendingSection,
        pendingCounter,
        clearPending,
        onOpenDocs,
        currentSectionRef,
        reportCurrentSection,
      }}
    >
      {children}
    </DocsNavContext.Provider>
  );
};

export function useDocsNav(): DocsNavContextValue {
  const ctx = useContext(DocsNavContext);
  if (!ctx) throw new Error('useDocsNav must be used within DocsNavProvider');
  return ctx;
}

/**
 * Non-throwing variant — returns `null` when no `DocsNavProvider` is
 * mounted above. Use this from optional UI like "Learn more in the
 * docs" links that should silently no-op when the docs surface isn't
 * reachable (e.g. settings hosted outside the workbench tree).
 */
export function useOptionalDocsNav(): DocsNavContextValue | null {
  return useContext(DocsNavContext);
}
