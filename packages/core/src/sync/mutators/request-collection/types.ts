/**
 * Request-collection mutator catalog — routing constants.
 *
 * Distinct from {@link COLLECTION_ENTITY_TYPE}: rule collections and
 * request collections share the same `Collection` schema on disk
 * but live under different storage keys (`oh.ws.<id>.collections` vs
 * `oh.ws.<id>.requestCollections`) and are owned by different stores
 * (`rule-store` vs `request-store`). The sync engine's `(workspaceId,
 * type, id)` identity triple keeps the two namespaces formally
 * independent — a uid collision between a rule collection and a
 * request collection cannot cause cross-pollination because the
 * routing key disambiguates them at every layer (oracle locks,
 * projector dispatch, snapshot RPCs, awareness).
 *
 * Variable + name editing surfaces ship today; pinned-environment
 * editing remains additive future work (copy the rule-collection
 * shape with the routing constant swapped if/when it lands).
 */

/** Routing key carried on every request-collection mutation envelope. */
export const REQUEST_COLLECTION_ENTITY_TYPE = 'request-collection';

/** Set path holding the variable list on a request-collection entity. */
export const REQUEST_COLLECTION_VARS_PATH = 'variables';
