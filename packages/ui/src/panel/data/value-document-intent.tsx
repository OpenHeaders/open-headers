/**
 * Value-document open intent — the seam between the rule quick-editors
 * and the editor tab group. The quick-editor popovers render from the
 * popover host's tree position (a sibling of the panel content, above
 * where the tab-group state lives), so they can't receive the opener
 * as a prop. Instead the provider mounts ABOVE the popover host and
 * the tab-group owner registers the real opener into it:
 * `useOpenValueDocument` returns null until one is registered, so
 * callers gate their affordance on readiness (the workbench never
 * mounts the provider — no affordance there by construction).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BuildRuleValueTabInput } from './inspector-tab';

export type RuleValueDocumentTarget = Omit<BuildRuleValueTabInput, 'timestamp'>;

type OpenValueDocument = (target: RuleValueDocumentTarget) => void;

interface ValueDocumentIntentRegistry {
  opener: OpenValueDocument | null;
  setOpener: (open: OpenValueDocument | null) => void;
}

const ValueDocumentIntentContext = createContext<ValueDocumentIntentRegistry | null>(null);

export function ValueDocumentIntentProvider({ children }: { children: React.ReactNode }) {
  const [opener, setOpenerState] = useState<OpenValueDocument | null>(null);
  // Function-valued state: the setter wraps in a thunk so React never
  // mistakes the opener for a state updater. Stable identity — the
  // register effect keys on it, not on the changing registry object.
  const setOpener = useCallback((open: OpenValueDocument | null) => setOpenerState(() => open), []);
  const value = useMemo<ValueDocumentIntentRegistry>(() => ({ opener, setOpener }), [opener, setOpener]);
  return <ValueDocumentIntentContext.Provider value={value}>{children}</ValueDocumentIntentContext.Provider>;
}

/**
 * Register the real opener (the tab-group owner). Cleared on unmount.
 *
 * Registers a stable trampoline that reads the latest `open` from a ref, so
 * the provider's state is written once per mount — never per `open`
 * identity. Keying the effect on the caller's function would make every
 * re-registration a context-state write, and a caller whose function
 * changes per render then loops render → cleanup `setOpener(null)` →
 * `setOpener(next)` → context change → render, straight into React's
 * nested-update limit (#185).
 */
export function useRegisterValueDocumentOpener(open: OpenValueDocument): void {
  const setOpener = useContext(ValueDocumentIntentContext)?.setOpener;
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
export function useOpenValueDocument(): OpenValueDocument | null {
  return useContext(ValueDocumentIntentContext)?.opener ?? null;
}
