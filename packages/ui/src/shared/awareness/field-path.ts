/**
 * Generic `data-field-path` ancestor-walk helper.
 *
 * Several editors (LiveVariableEditor, LiveWorkflowEditor,
 * RequestEditor) publish per-field awareness by tagging schema-aligned
 * leaves with `data-field-path` attributes on layout-stable wrappers,
 * then walking up from a focus event's target to the nearest
 * ancestor carrying the attribute. Originally lived next to the
 * Live editors; promoted here since it carries no Live-specific
 * knowledge — any editor with `data-field-path` markers can use it.
 */

export function readFieldPath(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const owner = target.closest('[data-field-path]');
  if (!(owner instanceof HTMLElement)) return null;
  return owner.dataset.fieldPath ?? null;
}
