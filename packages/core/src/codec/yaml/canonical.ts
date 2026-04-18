/**
 * Canonical YAML stringify options.
 *
 * One fixed style for every entity in the v5 format so two clients
 * writing the same entity produce byte-identical output. Round-trip
 * fixtures assert this. Matches invariant #16 (yaml eemeli) +
 * invariant #17 (one platform-agnostic codec) — see
 * docs/V5_FOUNDATION_PLAN.md §Phase 0.
 */

import type { ToStringOptions } from 'yaml';

export const CANONICAL_STRINGIFY_OPTIONS: ToStringOptions = {
  indent: 2,
  /** Disable line wrapping — long strings stay on one line for stable diffs. */
  lineWidth: 0,
  /** Prefer double quotes when quoting is required; never use single quotes. */
  singleQuote: false,
  /** Plain (unquoted) is the default for both keys and scalars where valid. */
  defaultStringType: 'PLAIN',
  defaultKeyType: 'PLAIN',
};
