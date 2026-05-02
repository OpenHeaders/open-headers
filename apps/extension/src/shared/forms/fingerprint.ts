/**
 * Stable structural fingerprint — used by editors to compare their
 * current form/draft projection against the canonical mirrored entity
 * for the **derived dirty** model (see `index.ts` for the convention).
 *
 * Sorts object keys at every level so two structurally-equal payloads
 * with different insertion order produce identical strings. Standard
 * JSON.stringify is insertion-ordered, which would report two
 * canonicalized projections as "different" when they're not.
 *
 * Pure, no allocation amortization tricks — fingerprinting is on the
 * keystroke critical path but the cost is bounded by entity size, not
 * mutation log size, and runs at antd Form's coalesced re-render rate.
 */

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
