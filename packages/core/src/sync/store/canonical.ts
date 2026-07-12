/**
 * Canonical JSON: deterministic stringification with object keys
 * sorted recursively. Two materialized snapshots that are
 * structurally equal serialize byte-identically — the property test
 * invariant compares these strings.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Pretty-printed variant for human-facing panes (merge editors): same
 * recursive key sort, 2-space indentation. A saved-side value that
 * round-tripped storage (alphabetized keys) and a form-side draft
 * (insertion order) render line-identical when structurally equal.
 */
export function canonicalJsonPretty(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2);
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[k] = canonicalize((value as Record<string, unknown>)[k]);
  }
  return sorted;
}
