/**
 * Template-collection mutator catalog — routing constants.
 *
 * Distinct from {@link COLLECTION_ENTITY_TYPE} and
 * {@link REQUEST_COLLECTION_ENTITY_TYPE}: rule, request, and template
 * collections share the same `V5.Collection` schema on disk but live
 * under different storage keys (`oh.ws.<id>.collections` vs
 * `oh.ws.<id>.requestCollections` vs `oh.ws.<id>.templateCollections`)
 * and are owned by different stores (`rule-store` vs `request-store` vs
 * `template-store`). The sync engine's `(workspaceId, type, id)`
 * identity triple keeps the three namespaces formally independent.
 *
 * Renderer surfaces today don't expose collection-variable editing or
 * pinned-environment editing for template collections, so this catalog
 * ships only `renameTemplateCollection`. Adding variable / pinned
 * factories later is purely additive — copy the rule-collection shapes
 * with the routing constant swapped.
 */

/** Routing key carried on every template-collection mutation envelope. */
export const TEMPLATE_COLLECTION_ENTITY_TYPE = 'template-collection';
