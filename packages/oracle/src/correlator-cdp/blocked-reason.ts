/**
 * CDP block-reason → short label word.
 *
 * `Network.loadingFailed` carries a fine-grained `blockedReason` the
 * net-stack code can't express: the generic `net::ERR_BLOCKED_BY_RESPONSE`
 * collapses CORP / COEP / COOP rejections to one code, while CDP names the
 * exact policy. We fold the protocol's reason values into the compact
 * vocabulary the status cell renders as `(blocked:<word>)`, grouping the
 * several cross-origin-policy variants under their policy family so the
 * label stays readable.
 *
 * Pure + total: an unrecognized reason (a value a newer browser adds)
 * falls through to `other`, matching the catch-all the heuristic path uses.
 */

/** Exact CDP reason → label word; cross-origin-policy families collapse below. */
const EXACT: Readonly<Record<string, string>> = {
  csp: 'csp',
  'mixed-content': 'mixed-content',
  origin: 'origin',
  inspector: 'inspector',
  'subresource-filter': 'subresource-filter',
  'content-type': 'content-type',
  other: 'other',
};

/** Reason-prefix → family word for the cross-origin-policy variants. */
const FAMILY: ReadonlyArray<readonly [string, string]> = [
  ['coep', 'coep'],
  ['coop', 'coop'],
  ['corp', 'corp'],
];

/**
 * Map a CDP `blockedReason` to its label word, or `undefined` when the
 * value is absent. Unknown reasons resolve to `other`.
 */
export function cdpBlockedReasonLabel(reason: string | undefined): string | undefined {
  if (reason === undefined || reason === '') return undefined;
  const exact = EXACT[reason];
  if (exact !== undefined) return exact;
  for (const [prefix, word] of FAMILY) {
    if (reason.startsWith(prefix)) return word;
  }
  return 'other';
}
