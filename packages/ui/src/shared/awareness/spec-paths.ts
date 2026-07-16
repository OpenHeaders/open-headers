/**
 * Canonical schema-aligned field paths for Spec entities.
 *
 * Mirrors `variable-paths.ts`: scalar leaves publish under their schema
 * field name; `files` rows are uid-keyed (`file.uid` is the sync
 * engine's set-member itemId) so paths preserve identity through
 * rename and reorder. The set prefix matches the mutator catalog's
 * `SPEC_FILES_PATH` (`'files'`); the conflict field-tree in
 * `workbench/components/specs/spec-conflict-adapter.ts` emits the same
 * strings, so awareness chips and per-leaf conflict tracking key off
 * one vocabulary.
 */

export type SpecScalarLeaf = 'name' | 'description' | 'format' | 'rootFileUid';
export type SpecFileLeaf = 'fileName' | 'content';

export interface SpecPathBundle {
  /** Scalar leaf paths — identical to the schema field names. */
  scalar(leaf: SpecScalarLeaf): string;
  /** Set root — used for path-prefix presence + set-level conflict keys. */
  files: string;
  /** Per-file generator. `uid` is the file row's persisted uid. */
  file(uid: string, leaf: SpecFileLeaf): string;
}

export const SPEC_PATHS: SpecPathBundle = {
  scalar: (leaf) => leaf,
  files: 'files',
  file: (uid, leaf) => `files.${uid}.${leaf}`,
};
