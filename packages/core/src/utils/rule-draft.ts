/**
 * Rule draft utilities — shared transformations on RuleDraft shapes.
 *
 * The DevTools panel (and any future tool) hands the workspace a full
 * raw URL via `RuleDraftBase.url`. The workspace converts that URL
 * into a `url-filter` pattern using one of four strategies, configured
 * by the user via `rulesEngine.draftUrlStrategy`:
 *
 *   - `exact`         → the full URL verbatim, including query string
 *   - `path-wildcard` → wildcard the last path segment (default).
 *                       Most useful for REST endpoints where the user
 *                       wants the rule to cover siblings without
 *                       hand-editing.
 *   - `host-only`     → match every URL on the host
 *   - `raw`           → pass the URL straight through without any
 *                       transformation, same as `exact` today, kept
 *                       as a named alias so future tweaks to `exact`
 *                       (e.g. stripping fragment) don't silently
 *                       change the "I want this literal URL" contract
 *
 * Kept in core because both the valibot schema and the workspace hook
 * need to agree on the allowed strategy values and the transformation
 * semantics. Callers in the extension / desktop app import this
 * helper directly; no duplication.
 */

export type DraftUrlStrategy = 'exact' | 'path-wildcard' | 'host-only' | 'raw';

export const DRAFT_URL_STRATEGIES: readonly DraftUrlStrategy[] = [
  'exact',
  'path-wildcard',
  'host-only',
  'raw',
] as const;

/**
 * Transform a raw URL into a `url-filter` pattern per the chosen
 * strategy. Invalid URLs fall through to the raw input — the workspace
 * will surface a validation error later if the pattern is unusable,
 * which is better than silently dropping the pre-fill.
 */
export function deriveUrlFilter(rawUrl: string, strategy: DraftUrlStrategy): string {
  if (!rawUrl) return '';

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // Not a well-formed URL (e.g. relative paths, malformed inputs).
    // Pass it through; the rule editor will flag it on save.
    return rawUrl;
  }

  switch (strategy) {
    case 'raw':
      return rawUrl;

    case 'exact':
      // Same as raw today but with normalization through the URL
      // parser — strips default ports, re-serializes, etc. Matches the
      // "I want this exact URL" intent more precisely than passing
      // through un-normalized input.
      return parsed.toString();

    case 'host-only':
      return `${parsed.protocol}//${parsed.host}/*`;

    case 'path-wildcard': {
      const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
      if (segments.length === 0) {
        // Root path — host-only is the only meaningful wildcard.
        return `${parsed.protocol}//${parsed.host}/*`;
      }
      // Replace the final segment with `*`. If the original URL was
      // `/v1/users/42` the filter becomes `/v1/users/*`, which covers
      // sibling IDs without widening to the whole host.
      segments[segments.length - 1] = '*';
      return `${parsed.protocol}//${parsed.host}/${segments.join('/')}`;
    }
  }
}
