/**
 * Value-view open intent — the seam between the eye's glance popover
 * and the editor tab group. The row surfaces the eye lives on render
 * deep inside tool windows and detail panes, far from where the
 * tab-group state lives, so they can't receive the opener as a prop.
 * Same shape as `value-document-intent`: the provider mounts above the
 * panel content and the tab-group owner registers the real opener;
 * `useOpenValueViewDocument` returns null until one is registered, so
 * the glance gates its document CTA on readiness (a host without the
 * provider — the workbench — never offers it by construction).
 */

import type { ValueViewTabTarget } from '@openheaders/ui/workbench/components/value-editors/useValueViewAction';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type OpenValueViewDocument = (target: ValueViewTabTarget) => void;

interface ValueViewIntentRegistry {
  opener: OpenValueViewDocument | null;
  setOpener: (open: OpenValueViewDocument | null) => void;
}

const ValueViewIntentContext = createContext<ValueViewIntentRegistry | null>(null);

export function ValueViewIntentProvider({ children }: { children: React.ReactNode }) {
  const [opener, setOpenerState] = useState<OpenValueViewDocument | null>(null);
  // Function-valued state: the setter wraps in a thunk so React never
  // mistakes the opener for a state updater. Stable identity — the
  // register effect keys on it, not on the changing registry object.
  const setOpener = useCallback((open: OpenValueViewDocument | null) => setOpenerState(() => open), []);
  const value = useMemo<ValueViewIntentRegistry>(() => ({ opener, setOpener }), [opener, setOpener]);
  return <ValueViewIntentContext.Provider value={value}>{children}</ValueViewIntentContext.Provider>;
}

/**
 * Register the real opener (the tab-group owner). Cleared on unmount.
 *
 * Registers a stable trampoline that reads the latest `open` from a ref,
 * so the provider's state is written once per mount — never per `open`
 * identity (see `value-document-intent` for the render-loop this avoids).
 */
export function useRegisterValueViewOpener(open: OpenValueViewDocument): void {
  const setOpener = useContext(ValueViewIntentContext)?.setOpener;
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (setOpener === undefined) return;
    setOpener((target) => openRef.current(target));
    return () => setOpener(null);
  }, [setOpener]);
}

/** The dispatch, or null when no opener is registered (or the provider
 *  isn't mounted — e.g. the workbench) — gate the affordance on it. */
export function useOpenValueViewDocument(): OpenValueViewDocument | null {
  return useContext(ValueViewIntentContext)?.opener ?? null;
}
