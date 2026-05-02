/**
 * Publication-gate predicates shared across every entity that carries a
 * `published?: boolean` field (Rule, LiveWorkflow, LiveVariable, …).
 *
 * The publication gate exists so side-effect runners (DNR compile,
 * inject manager, refresh scheduler, variable resolver, …) never
 * observe a half-typed runtime value while the entity is still flagged
 * `published === true`. Per-keystroke streaming edits land in a real
 * entity from the moment of creation, but the gate flips to `false` on
 * the first edit so runners stay on the previously-published state
 * until the user explicitly re-publishes.
 *
 * "Edit" here means a change to a field that the runners actually
 * consume. Cosmetic fields — `name` shown in the UI, `description`
 * shown in the inspector — are invisible to runners and must NOT
 * auto-unpublish, otherwise renaming an entity in the sidebar drops it
 * back to draft state for no functional reason.
 *
 * `published` itself is metadata too: writing it is the explicit
 * publication gesture (`applyXPublish`); the predicate must not treat
 * it as a runtime change or it would auto-revert publishes.
 *
 * The predicate is entity-agnostic by construction. The same shape
 * scales to future publication-gated entities by passing an optional
 * `extraMetadataKeys` set covering entity-specific cosmetic fields —
 * mirrors how the awareness layer's `<EntityField>` is universal but
 * each entity contributes its own `<entity>-paths.ts`. Today every
 * publication-gated entity in the system shares exactly the universal
 * set, so the extension argument is reserved future-proofing.
 */

/**
 * Top-level entity keys that don't affect runtime semantics — pure
 * metadata across every publication-gated entity. `published` itself
 * is included so the explicit publish gesture (`applyXPublish` writing
 * `{ published: true }` directly) never trips the auto-unpublish branch.
 *
 * `enabled` is deliberately NOT in this set even though some entities
 * carry it: toggling enabled is observable to the runtime (it's the
 * runner's "skip me" gate) and benefits from the same publication-gate
 * serialization safety as any other runtime change. Entities that
 * expose enabled toggles via a dedicated `applyXToggle` path bypass
 * `applyXUpdate` entirely; the few cases that DO route through
 * `applyXUpdate` should auto-unpublish like any other runtime edit.
 */
export const UNIVERSAL_METADATA_KEYS: ReadonlySet<string> = new Set(['name', 'description', 'published']);

/**
 * `true` when applying `updates` to a published entity should
 * auto-flip `published: false` — the update touches at least one
 * runtime-affecting field (any key outside the metadata set).
 *
 * `extraMetadataKeys`: optional per-entity addition for fields that
 * are cosmetic in that entity's domain but aren't in the universal
 * set. Today every publication-gated entity uses the universal set
 * unmodified; the parameter is the extension hook for future entities
 * (mirrors the per-entity-paths-file pattern in the awareness layer).
 *
 * Empty updates return `false` (nothing to write, nothing to gate).
 * Updates explicitly setting `published` are always treated as
 * metadata regardless of other keys — the publish/unpublish gesture
 * itself is never the trigger for the auto-augment.
 */
export function shouldAutoUnpublishOnUpdate(
  updates: Record<string, unknown>,
  extraMetadataKeys?: ReadonlySet<string>,
): boolean {
  if (updates.published !== undefined) return false;
  for (const key of Object.keys(updates)) {
    if (UNIVERSAL_METADATA_KEYS.has(key)) continue;
    if (extraMetadataKeys?.has(key)) continue;
    return true;
  }
  return false;
}
