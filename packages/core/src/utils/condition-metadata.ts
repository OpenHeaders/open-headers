/**
 * Single source of truth for `RuleCondition` type semantics.
 *
 * Every consumer (editor picker, structural validator, DNR compiler,
 * importers) reads from `CONDITION_META`. Keeping the metadata in `core`
 * means the editor and the compiler can never disagree about whether a
 * condition is a singleton, whether two types share a DNR slot, or
 * whether Chrome's DNR even supports it.
 *
 * Three properties drive everything:
 *
 *   - `cardinality` — `'singleton'` types map to a scalar field on the
 *     emitted DNR rule (`urlFilter`, `regexFilter`, `domainType`). A second
 *     row of the same singleton would silently overwrite. `'plural'` types
 *     concatenate values across rows (Chrome OR's the resulting list).
 *   - `mutexGroup` — types in the same group occupy the SAME DNR slot.
 *     `url-filter` + `url-regex` both write `urlPattern` in the compiler,
 *     so they're mutually exclusive even though they're nominally different
 *     types. The editor and validator both use the group as the conflict key.
 *   - `supportedByDnr` — Chrome MV3 DNR has no request-header matching.
 *     `request-header` and `exclude-request-header` ship nothing today.
 *     The editor hides them from the picker (legacy data still renders);
 *     the validator surfaces a structural issue if they slip through.
 */

import type { ConditionType } from '../types/v5/rule';

export type ConditionCardinality = 'singleton' | 'plural';

/**
 * How values inside ONE row combine (within that row's input control):
 *
 *   - `'or'`     — multiple values match if ANY value matches (most plural
 *                  fields: domains, methods, resource types, header values).
 *   - `'single'` — the row holds one scalar value (`url-filter`, `url-regex`,
 *                  `domain-type`).
 *
 * The combination of *rows* is always AND — that's a property of the rule,
 * not a per-condition setting. We surface this per row so users see at the
 * input level whether comma-separating into one row is even meaningful.
 */
export type ConditionValueLogic = 'or' | 'single';

export interface ConditionTypeMeta {
  type: ConditionType;
  cardinality: ConditionCardinality;
  /**
   * Conflict group — types sharing a group occupy the same DNR slot and
   * cannot coexist on a rule. `undefined` means "no conflict with any
   * other type". For singleton types without a shared group, the type's
   * own name acts as the implicit group.
   */
  mutexGroup?: string;
  /** False when Chrome MV3 DNR has no matching field for this condition. */
  supportedByDnr: boolean;
  /** How multiple values in one row combine. Drives editor input hints. */
  valueLogic: ConditionValueLogic;
}

const META: Record<ConditionType, ConditionTypeMeta> = {
  // ── URL matching: singletons sharing one DNR slot ──
  // The compiler writes both into a single `urlPattern` variable in
  // buildDnrCondition; emitting both means whichever processed last wins.
  'url-filter': {
    type: 'url-filter',
    cardinality: 'singleton',
    mutexGroup: 'url-pattern',
    supportedByDnr: true,
    valueLogic: 'single',
  },
  'url-regex': {
    type: 'url-regex',
    cardinality: 'singleton',
    mutexGroup: 'url-pattern',
    supportedByDnr: true,
    valueLogic: 'single',
  },

  // ── Domain filtering: plural lists, OR within row ──
  'request-domains': { type: 'request-domains', cardinality: 'plural', supportedByDnr: true, valueLogic: 'or' },
  'exclude-request-domains': {
    type: 'exclude-request-domains',
    cardinality: 'plural',
    supportedByDnr: true,
    valueLogic: 'or',
  },
  'initiator-domains': { type: 'initiator-domains', cardinality: 'plural', supportedByDnr: true, valueLogic: 'or' },
  'exclude-initiator-domains': {
    type: 'exclude-initiator-domains',
    cardinality: 'plural',
    supportedByDnr: true,
    valueLogic: 'or',
  },

  // ── Request filtering ──
  'request-methods': { type: 'request-methods', cardinality: 'plural', supportedByDnr: true, valueLogic: 'or' },
  'exclude-request-methods': {
    type: 'exclude-request-methods',
    cardinality: 'plural',
    supportedByDnr: true,
    valueLogic: 'or',
  },
  'resource-types': { type: 'resource-types', cardinality: 'plural', supportedByDnr: true, valueLogic: 'or' },
  'exclude-resource-types': {
    type: 'exclude-resource-types',
    cardinality: 'plural',
    supportedByDnr: true,
    valueLogic: 'or',
  },
  'domain-type': { type: 'domain-type', cardinality: 'singleton', supportedByDnr: true, valueLogic: 'single' },

  // ── Header matching (Chrome 128+, response-side only) ──
  // Chrome MV3 DNR never shipped request-header matching; we don't model
  // those types at all. `supportedByDnr` exists for the day a future type
  // gets added before its DNR backing lands.
  'response-header': { type: 'response-header', cardinality: 'plural', supportedByDnr: true, valueLogic: 'or' },
  'exclude-response-header': {
    type: 'exclude-response-header',
    cardinality: 'plural',
    supportedByDnr: true,
    valueLogic: 'or',
  },
};

/** Frozen metadata table. Never mutated after module load. */
export const CONDITION_META: Readonly<Record<ConditionType, ConditionTypeMeta>> = Object.freeze(META);

/** Resolve the conflict-group key for a type. Falls back to the type itself for ungrouped singletons. */
export function getConditionMutexKey(type: ConditionType): string | null {
  const meta = CONDITION_META[type];
  if (!meta || meta.cardinality !== 'singleton') return null;
  return meta.mutexGroup ?? type;
}

/** True when Chrome MV3 DNR can actually match on this condition type. */
export function isConditionSupportedByDnr(type: ConditionType): boolean {
  return CONDITION_META[type]?.supportedByDnr ?? false;
}

/** Sorted list of every supported condition type — useful for editor pickers. */
export function listSupportedConditionTypes(): ConditionType[] {
  return Object.values(CONDITION_META)
    .filter((m) => m.supportedByDnr)
    .map((m) => m.type);
}
