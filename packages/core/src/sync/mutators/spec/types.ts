/**
 * Spec mutator catalog — routing constants.
 *
 * A Spec is scalar metadata (`name`, `description`, `format`,
 * `rootFileUid`) plus one set-modeled path: `files`, the source-file
 * set. Set-member identity = the file's stable `uid` (NOT the
 * user-mutable `fileName`) — renames converge per-(path, uid) LWW like
 * variable rows. File `content` rides the whole row: the editor saves
 * the buffer as one gesture, so an upsert of the row is the write
 * unit (same posture as `ScriptPackage.source`).
 *
 * No side effects: specs are design-time documents — no DNR recompile,
 * no resolver invalidation rides along.
 */

/** Routing key carried on every spec mutation envelope. */
export const SPEC_ENTITY_TYPE = 'spec';

/** Set path holding the source-file set on a spec entity. */
export const SPEC_FILES_PATH = 'files';
