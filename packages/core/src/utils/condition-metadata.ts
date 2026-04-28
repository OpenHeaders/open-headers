/**
 * Single source of truth for `RuleCondition` row identity and DNR-slot rules.
 *
 * Every consumer (editor picker, structural validator, DNR compiler,
 * importers) reads from `CONDITION_META`. Keeping the metadata in `core`
 * means the editor and the compiler can never disagree about which rows
 * are duplicates, which types share a DNR slot, or whether Chrome's DNR
 * even supports a given condition.
 *
 * # The slot-key model
 *
 * Every condition row maps to **exactly one** Chrome DNR field — its
 * "slot". Two rows with the same slot key cannot coexist on a rule:
 * one would silently overwrite the other (`urlFilter` / `regexFilter` /
 * `domainType` are scalar fields), or one row's user intent would be
 * indistinguishable from the other (`requestDomains: [a]` and
 * `requestDomains: [b]` collapse to one OR'd list — having two rows
 * pretends to AND when Chrome OR's).
 *
 * The editor enforces "one row per slot" by disabling already-used
 * types in the picker; the structural validator flags the same. With
 * uniqueness enforced, the AND-between-rows label users see in the
 * editor is always semantically correct, and the OR-within-row badge
 * is the only OR in the model.
 *
 * # Header types are special
 *
 * `response-header` and `exclude-response-header` carry a `headerName`
 * alongside `values`. Two rows of `response-header` for `Set-Cookie`
 * collapse, but two rows for `Set-Cookie` and `X-Foo` are independent
 * fields on Chrome's `responseHeaders[]` array — the slot identity
 * therefore includes the header name. The picker can't predict the
 * header name a user will type next, so it doesn't gate header types
 * up-front; the structural validator catches `(type, headerName)`
 * duplicates after the fact.
 *
 * # `valueLogic` (UI hint only)
 *
 * Independent of slot identity: tells the editor's per-row badge
 * whether multiple values inside one row OR (most plural fields) or
 * carry a single scalar. Pure UI hint — has no compiler effect.
 *
 * # `supportedByDnr`
 *
 * Chrome MV3 DNR has no request-header matching. `request-header` /
 * `exclude-request-header` ship nothing today; the editor hides them
 * (legacy data still renders so users can switch the type), and the
 * validator surfaces a structural issue if they slip through.
 */

import type { ConditionType, RuleCondition } from '../types/v5/rule';

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

/**
 * Semantic shape of a row's `values` payload. Drives consumer behaviors
 * that vary by shape:
 *
 *   - `'domain'`  — bare hostnames. The editor renders multi-line
 *                   tag-like input; the resolver post-resolve sanitizes
 *                   each entry; the validator runs hostname checks.
 *   - `'method'`  — HTTP method tokens (GET / POST / …). Multi-select.
 *   - `'resource'`— Chrome resource-type tokens. Multi-select.
 *   - `'pattern'` — single URL pattern (filter or regex source).
 *   - `'header'`  — `(name, values[])` pair. Editor renders a name
 *                   field + values input; values are matched as
 *                   substrings against incoming headers.
 *   - `'enum'`    — `'firstParty' | 'thirdParty'`. Single-select.
 *
 * One source of truth for editor / resolver / validator so the three
 * surfaces can never disagree about what counts as e.g. "a domain row".
 */
export type ConditionValueShape = 'domain' | 'method' | 'resource' | 'pattern' | 'header' | 'enum';

export interface ConditionTypeMeta {
  type: ConditionType;
  /**
   * Conflict group — types sharing a group occupy the same DNR slot and
   * cannot coexist on a rule. `undefined` means the type's own name is
   * its slot key (the common case). The only group that exists today is
   * `'url-pattern'` for `url-filter` + `url-regex`, which both write
   * `urlFilter` / `regexFilter` mutually exclusively.
   */
  mutexGroup?: string;
  /**
   * Header types' slot identity includes `headerName`. Compute the
   * effective slot via `getConditionSlotKey(condition)` rather than
   * reading this flag directly.
   */
  perHeader?: boolean;
  /** False when Chrome MV3 DNR has no matching field for this condition. */
  supportedByDnr: boolean;
  /** How multiple values in one row combine. Drives editor input hints. */
  valueLogic: ConditionValueLogic;
  /** Semantic shape of the row's value payload. See `ConditionValueShape`. */
  valueShape: ConditionValueShape;
  /**
   * Default order in the "Add condition" picker. Lower = more
   * prominent. Drives the editor's first-unclaimed-type pick when the
   * user adds a new row, so the default lands on a useful slot
   * (request-domains / url-filter) rather than alphabetically first.
   */
  pickerOrder: number;
}

const META: Record<ConditionType, ConditionTypeMeta> = {
  // ── URL matching: share one DNR slot (urlFilter / regexFilter are mutex) ──
  'url-filter': {
    type: 'url-filter',
    mutexGroup: 'url-pattern',
    supportedByDnr: true,
    valueLogic: 'single',
    valueShape: 'pattern',
    pickerOrder: 10,
  },
  'url-regex': {
    type: 'url-regex',
    mutexGroup: 'url-pattern',
    supportedByDnr: true,
    valueLogic: 'single',
    valueShape: 'pattern',
    pickerOrder: 11,
  },

  // ── Domain filtering ──
  'request-domains': {
    type: 'request-domains',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'domain',
    pickerOrder: 0,
  },
  'exclude-request-domains': {
    type: 'exclude-request-domains',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'domain',
    pickerOrder: 20,
  },
  'initiator-domains': {
    type: 'initiator-domains',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'domain',
    pickerOrder: 21,
  },
  'exclude-initiator-domains': {
    type: 'exclude-initiator-domains',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'domain',
    pickerOrder: 22,
  },

  // ── Request filtering ──
  'request-methods': {
    type: 'request-methods',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'method',
    pickerOrder: 30,
  },
  'exclude-request-methods': {
    type: 'exclude-request-methods',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'method',
    pickerOrder: 31,
  },
  'resource-types': {
    type: 'resource-types',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'resource',
    pickerOrder: 32,
  },
  'exclude-resource-types': {
    type: 'exclude-resource-types',
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'resource',
    pickerOrder: 33,
  },
  'domain-type': {
    type: 'domain-type',
    supportedByDnr: true,
    valueLogic: 'single',
    valueShape: 'enum',
    pickerOrder: 34,
  },

  // ── Header matching (Chrome 128+, response-side only) ──
  // Each row ships one `responseHeaders[]` entry keyed by `headerName`,
  // so the slot identity includes the header name. Two rows of the same
  // type for DIFFERENT header names are independent slots; same name is
  // a duplicate.
  'response-header': {
    type: 'response-header',
    perHeader: true,
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'header',
    pickerOrder: 40,
  },
  'exclude-response-header': {
    type: 'exclude-response-header',
    perHeader: true,
    supportedByDnr: true,
    valueLogic: 'or',
    valueShape: 'header',
    pickerOrder: 41,
  },
};

/** Frozen metadata table. Never mutated after module load. */
export const CONDITION_META: Readonly<Record<ConditionType, ConditionTypeMeta>> = Object.freeze(META);

/**
 * Type-only slot key — the part of the slot identity derivable from the
 * condition type alone. For per-header types the full slot also includes
 * `headerName`; use `getConditionSlotKey(condition)` when you have the
 * full row in hand.
 *
 * Returns the mutex group when one is declared, otherwise the type name
 * itself. Never returns null today (every supported type has a slot);
 * the return type stays nullable so future "free-floating" types can opt
 * out by returning null.
 */
export function getConditionTypeSlotKey(type: ConditionType): string | null {
  const meta = CONDITION_META[type];
  if (!meta) return null;
  return meta.mutexGroup ?? type;
}

/**
 * Full slot key for a condition row. Header types incorporate the
 * row's `headerName` so two rows for different header names live in
 * different slots; an empty header name returns `null` (the row hasn't
 * claimed a slot yet — common mid-edit) so it can never be the loser
 * of a duplicate-slot conflict.
 */
export function getConditionSlotKey(condition: RuleCondition): string | null {
  const meta = CONDITION_META[condition.type];
  if (!meta) return null;
  if (meta.perHeader) {
    const name = condition.headerName?.trim();
    if (!name) return null;
    return `${condition.type}::${name.toLowerCase()}`;
  }
  return meta.mutexGroup ?? condition.type;
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

/**
 * Types whose `valueShape` matches the given shape. Exists so consumers
 * can ask "which condition types are domains?" without re-deriving the
 * answer locally — the metadata table is the single source of truth.
 *
 * Returns an immutable Set keyed by `ConditionType` for O(1) `has`
 * checks (the common consumer pattern: "is this type a domain row?").
 */
const TYPES_BY_SHAPE = new Map<ConditionValueShape, ReadonlySet<ConditionType>>();
for (const meta of Object.values(META)) {
  const set = TYPES_BY_SHAPE.get(meta.valueShape);
  if (set) (set as Set<ConditionType>).add(meta.type);
  else TYPES_BY_SHAPE.set(meta.valueShape, new Set([meta.type]));
}
// Freeze each shape's set so callers can't mutate the metadata view.
for (const [shape, set] of TYPES_BY_SHAPE) {
  TYPES_BY_SHAPE.set(shape, new Set(set));
}

export function getConditionTypesByShape(shape: ConditionValueShape): ReadonlySet<ConditionType> {
  return TYPES_BY_SHAPE.get(shape) ?? new Set();
}

/** Convenience predicate — is this condition type a domain-list row? */
export function isDomainListConditionType(type: ConditionType): boolean {
  return CONDITION_META[type]?.valueShape === 'domain';
}

/**
 * Condition types whose post-resolve VALUES list should be split on
 * `[,\n]` so a template variable carrying a comma-separated list lands
 * as multiple Chrome-array entries instead of one literal string. Any
 * row whose semantic shape is "list of independent tokens" qualifies —
 * domain lists, method lists, resource-type lists. Single-pattern types
 * (`url-filter`, `url-regex`, `domain-type`) and header rows do NOT
 * split — a comma there could be part of a legitimate value.
 */
export function isListShapedConditionType(type: ConditionType): boolean {
  const shape = CONDITION_META[type]?.valueShape;
  return shape === 'domain' || shape === 'method' || shape === 'resource';
}
