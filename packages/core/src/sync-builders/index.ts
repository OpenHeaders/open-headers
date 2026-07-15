/**
 * Pure per-entity projection + mutation-batch builders.
 *
 * Subpath is split because the renderer-side write clients (still in
 * `apps/extension/src/shared/sync/`) need `variables-replacement` but
 * not `set-diff`; keeping the barrel tight avoids accidental
 * back-references from UI.
 */

export {
  type FieldDiffArgs,
  synthesizeFieldDiff,
} from './field-diff';
export {
  type LiveSetEntry,
  type SetDiffArgs,
  synthesizeSetDiff,
  toLiveSetEntries,
} from './set-diff';
export {
  buildVariablesReplacement,
  normalizeVariableRow,
  type VariableLike,
  type VariablesReplacementBindings,
  type VariablesReplacementInput,
  type VariableType,
} from './variables-replacement';
