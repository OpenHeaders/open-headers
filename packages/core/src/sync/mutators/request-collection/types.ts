/**
 * Request-collection mutator catalog — routing constants.
 *
 * Distinct from {@link COLLECTION_ENTITY_TYPE}: rule collections and
 * request collections share the same `V5.Collection` schema on disk
 * but live under different storage keys (`oh.ws.<id>.collections` vs
 * `oh.ws.<id>.requestCollections`) and are owned by different stores
 * (`rule-store` vs `request-store`). The sync engine's `(workspaceId,
 * type, id)` identity triple keeps the two namespaces formally
 * independent — a uid collision between a rule collection and a
 * request collection cannot cause cross-pollination because the
 * routing key disambiguates them at every layer (oracle locks,
 * projector dispatch, snapshot RPCs, awareness).
 *
 * Renderer surfaces today don't expose collection-variable editing or
 * pinned-environment editing for request collections, so this catalog
 * ships only `renameRequestCollection`. Adding variable / pinned
 * factories later is purely additive — copy the rule-collection shapes
 * with the routing constant swapped.
 */

/** Routing key carried on every request-collection mutation envelope. */
export const REQUEST_COLLECTION_ENTITY_TYPE = 'request-collection';
