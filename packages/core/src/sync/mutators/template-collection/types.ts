/**
 * Template-collection mutator catalog — routing constants.
 *
 * Distinct from {@link COLLECTION_ENTITY_TYPE} and
 * {@link REQUEST_COLLECTION_ENTITY_TYPE}: rule, request, and template
 * collections share the same `Collection` schema on disk but live
 * under different storage keys (`oh.ws.<id>.collections` vs
 * `oh.ws.<id>.requestCollections` vs `oh.ws.<id>.templateCollections`)
 * and are owned by different stores (`rule-store` vs `request-store` vs
 * `template-store`). The sync engine's `(workspaceId, type, id)`
 * identity triple keeps the three namespaces formally independent.
 *
 * Variable + name editing surfaces ship today; pinned-environment
 * editing remains additive future work (copy the rule-collection
 * shape with the routing constant swapped if/when it lands).
 */

/** Routing key carried on every template-collection mutation envelope. */
export const TEMPLATE_COLLECTION_ENTITY_TYPE = 'template-collection';

/** Set path holding the variable list on a template-collection entity. */
export const TEMPLATE_COLLECTION_VARS_PATH = 'variables';
