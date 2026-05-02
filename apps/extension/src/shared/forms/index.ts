/**
 * Shared cross-editor form primitives.
 *
 * Entity-agnostic React hooks every editor reaches for. Same role as
 * `@/shared/awareness` but for form/state-reconcile concerns.
 *
 * ─── Universal convention: derived dirty ─────────────────────────────
 *
 * **Dirty is a projection, not an event log.** Every editor derives
 * `isDirty` from a structural comparison between its current form
 * state and the canonical mirrored entity:
 *
 *     isDirty = stableStringify(projectFromForm(values))
 *             !== stableStringify(projectFromEntity(liveEntity))
 *
 * Consequences (industry standard — VS Code, Word, Google Docs,
 * React Hook Form, Notion, Linear, Figma all do this):
 *
 *   - Manual revert ("01" → "02" → "01") auto-clears dirty.
 *   - Take-Theirs (writes canonical theirs into the form) auto-clears
 *     dirty once the broadcast lands and the canonical baseline matches.
 *   - Save commits the form; canonical updates; dirty derives `false`
 *     without any imperative reset.
 *
 * Editors must NOT keep imperative `setDirty(true)` calls in
 * `onValuesChange` / template-apply / paste handlers. Those flag
 * dirty even when the user reverts — sticky, broken UX.
 *
 * Each editor's projection function is editor-specific (antd Form's
 * `getFieldsValue` shape vs controlled-state `Draft` shape vs …) and
 * lives next to its `buildEntity` / `draftFromEntity` helpers. The
 * shared util here is the canonical-order fingerprint
 * (`stableStringify`) so two structurally-equal projections with
 * different insertion order compare equal.
 */

export { useEntityReprime } from './use-entity-reprime';
export type {
  EntityReprimeHandle,
  EntityReprimeScope,
  UseEntityReprimeOptions,
} from './use-entity-reprime';
export { stableStringify } from './fingerprint';
