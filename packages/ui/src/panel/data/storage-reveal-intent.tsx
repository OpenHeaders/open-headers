/**
 * Cookie-reveal intent — the seam between a header row's "Show in
 * Storage" button and the Storage tool window. Same shape as
 * `value-view-intent`: the row renders deep inside a request tab, far
 * from where the tool-window layout and the reveal request live, so the
 * panel shell registers the real revealer and the row gates its button
 * on one being there (a host without the provider never offers it).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CookieRevealTarget } from './cookies/cookie-reveal';

type RevealCookiesInStorage = (target: CookieRevealTarget) => void;

interface StorageRevealIntentRegistry {
  revealer: RevealCookiesInStorage | null;
  setRevealer: (reveal: RevealCookiesInStorage | null) => void;
}

const StorageRevealIntentContext = createContext<StorageRevealIntentRegistry | null>(null);

export function StorageRevealIntentProvider({ children }: { children: React.ReactNode }) {
  const [revealer, setRevealerState] = useState<RevealCookiesInStorage | null>(null);
  // Function-valued state: the setter wraps in a thunk so React never
  // mistakes the revealer for a state updater.
  const setRevealer = useCallback(
    (reveal: RevealCookiesInStorage | null) => setRevealerState(() => reveal),
    [],
  );
  const value = useMemo<StorageRevealIntentRegistry>(() => ({ revealer, setRevealer }), [revealer, setRevealer]);
  return <StorageRevealIntentContext.Provider value={value}>{children}</StorageRevealIntentContext.Provider>;
}

/** Register the real revealer (the panel shell). Cleared on unmount.
 *  A stable trampoline reads the latest `reveal` from a ref, so the
 *  provider's state is written once per mount. */
export function useRegisterCookieRevealer(reveal: RevealCookiesInStorage): void {
  const setRevealer = useContext(StorageRevealIntentContext)?.setRevealer;
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    if (setRevealer === undefined) return;
    setRevealer((target) => revealRef.current(target));
    return () => setRevealer(null);
  }, [setRevealer]);
}

/** The dispatch, or null when no revealer is registered — gate the
 *  affordance on it. */
export function useRevealCookiesInStorage(): RevealCookiesInStorage | null {
  return useContext(StorageRevealIntentContext)?.revealer ?? null;
}
