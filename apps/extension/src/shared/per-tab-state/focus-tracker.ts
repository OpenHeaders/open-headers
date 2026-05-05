/**
 * Focus + visibility tracking for the donor-claim predicate.
 *
 * Per design § 7.1: the donor-claim guard is
 *   `visibilityState === 'visible' && hasFocus() && (bootstrap || mutation)`
 *
 * This module exposes:
 *   - `isFocusedAndVisible()` — the synchronous predicate.
 *   - `subscribeFocus(fn)` — fires whenever the underlying signal
 *     changes (visibilitychange / window focus / window blur). The
 *     callback re-evaluates the predicate; this module never publishes
 *     on its own.
 *
 * Lint asserts (per status doc Convention compliance §) that publishers
 * gate on this predicate before writing to the donor record.
 */

export function isFocusedAndVisible(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  return true;
}

export type FocusSubscriber = () => void;

export function subscribeFocus(fn: FocusSubscriber): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }
  const onVisibility = () => fn();
  const onFocus = () => fn();
  const onBlur = () => fn();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onFocus);
  window.addEventListener('blur', onBlur);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('blur', onBlur);
  };
}
