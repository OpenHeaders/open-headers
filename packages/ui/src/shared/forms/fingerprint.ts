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
 * Mirrors `JSON.stringify`'s undefined-handling: keys whose value is
 * `undefined` are dropped entirely (not emitted as `"key":undefined`).
 * The canonical side round-trips through host persistence which strips
 * undefined leaves, so a form-side projection that retains an
 * undefined-valued key (e.g. an antd Form.Item spread that left a
 * cleared field as `{... headerName: undefined}`) would otherwise
 * fingerprint as structurally different from its persisted twin —
 * forcing the editor into a permanent dirty state with no user-visible
 * way to clear it. Matching JSON's drop-undefined contract removes
 * that whole class of bug at the comparison layer.
 *
 * Pure, no allocation amortization tricks — fingerprinting is on the
 * keystroke critical path but the cost is bounded by entity size, not
 * mutation log size, and runs at antd Form's coalesced re-render rate.
 */

export function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec)
    .filter((k) => rec[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(',')}}`;
}
