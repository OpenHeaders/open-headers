/**
 * Shared "server may be lying about Content-Type" state machine.
 *
 * Given raw body text and a declared mime, exposes:
 *   - the currently-effective mime (declared, or the user's override)
 *   - a sniffed suggestion (when the declared mime is generic AND the
 *     body looks like something structured we can offer to reinterpret)
 *   - apply / clear actions for the override
 *
 * Owning this once — instead of re-implementing the same three
 * `useState` + `useMemo` + two `useCallback` quartet in every body
 * viewer — means the sniffer contract has exactly one implementation.
 */

import { useCallback, useMemo, useState } from 'react';
import { type DetectedFormat, detectedFormatToMime, sniffMisdeclared } from './content-sniff';

export interface SniffedContent {
  /** What the server claimed. Unchanged across override state. */
  declaredMime: string;
  /**
   * The mime downstream renderers should drive off. Equals
   * `declaredMime` unless the user has applied an override, in which
   * case the override's canonical mime is used (e.g. `application/json`
   * when the user clicked "Parse as JSON").
   */
  effectiveMime: string;
  /** Active override, or `null` if the declared mime is in effect. */
  override: DetectedFormat | null;
  /**
   * Sniffer suggestion. Non-null when the declared mime is generic
   * AND the body looks like a structured format we'd be willing to
   * reinterpret. `null` as soon as an override is applied — at that
   * point the toolbar should show "revert", not "parse".
   */
  suggestion: DetectedFormat | null;
  applyOverride: (format: DetectedFormat) => void;
  clearOverride: () => void;
}

export function useSniffedContent(text: string, declaredMime: string): SniffedContent {
  const [override, setOverride] = useState<DetectedFormat | null>(null);

  const suggestion = useMemo(
    () => (override ? null : sniffMisdeclared(text, declaredMime)),
    [text, declaredMime, override],
  );

  const effectiveMime = override ? detectedFormatToMime(override) : declaredMime;

  const applyOverride = useCallback((format: DetectedFormat) => {
    setOverride(format);
  }, []);
  const clearOverride = useCallback(() => setOverride(null), []);

  return { declaredMime, effectiveMime, override, suggestion, applyOverride, clearOverride };
}
