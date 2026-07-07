/**
 * Script-package mutator catalog — routing constant.
 *
 * A ScriptPackage is fully flat-scalar — `name`, `description`, and
 * `source` all flow through `setField`; there are no set-modeled paths.
 * `source` is a whole-string scalar (last-writer-wins on the module
 * body) — the editor saves the buffer as one gesture, so intra-source
 * merging would only trade simplicity for surface area no consumer
 * asks for.
 *
 * No side effects: packages are read at script-execution time (the
 * executor snapshots them into the `ScriptExecutionRequest`), so no
 * DNR recompile and no resolver invalidation rides along.
 */

/** Routing key carried on every script-package mutation envelope. */
export const SCRIPT_PACKAGE_ENTITY_TYPE = 'script-package';
