/**
 * Template mutator catalog — routing constants + row shapes.
 *
 * One set-modeled path lives on the Template entity:
 *
 *   - `conditions` — saved rule conditions (`{ type, values, headerName? }`)
 *
 * Every other template field — `name`, `description`, `icon`,
 * `ruleType`, `path`, `formValues`, `includes`, `createdAt`,
 * `updatedAt` — flows through `setField` scalars. Two design choices
 * to call out:
 *
 *   - **`formValues` and `includes` are scalars (whole-object replacement).**
 *     `formValues` is a free-form `Record<string, unknown>` whose shape
 *     varies by `ruleType`; `includes` is a small fixed-shape sub-object
 *     toggling whether conditions/formValues participate when the
 *     template is applied. Per-field LWW within either would either
 *     need branch-aware paths the catalog can't know in advance, or
 *     would silently strand fields on a ruleType flip. Whole-object
 *     replacement is the v1 contract (parallel to request `auth` /
 *     `body` and rule conditions). The editor surface is the single
 *     producer today; sub-field LWW lands as a Phase B+ wrinkle if a
 *     multi-surface template editor ships.
 *   - **No `recompileDnr` / no `INVALIDATE_RESOLVER` side-effects.**
 *     Templates are passive snapshots applied on demand; saving one
 *     never invalidates DNR or the variables resolver. Side effects
 *     are empty across every factory.
 */

/** Routing key carried on every template mutation envelope. */
export const TEMPLATE_ENTITY_TYPE = 'template';

/** Set path for saved rule-condition rows. */
export const TEMPLATE_CONDITIONS_PATH = 'conditions';

/**
 * Wire shape for a template-condition row. Mirrors `RuleCondition`
 * field-for-field but typed locally so the catalog stays decoupled
 * from `@openheaders/core/types` (the same way other catalogs keep
 * their row shapes local).
 */
export interface TemplateConditionLike {
  /**
   * Persisted per-row identity. Doubles as the sync engine's itemId so
   * row identity round-trips through save/reload — same posture as
   * `RuleConditionLike.uid` and `HeaderModification.uid`.
   */
  uid: string;
  type: string;
  values: string[];
  headerName?: string;
}
