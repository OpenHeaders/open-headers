/**
 * Workspace export selection shape — the user's per-entity-type uid
 * picks for a "selection" scope export. The pure builder
 * (`@openheaders/core/workspace-export`) consumes an already-expanded
 * shape; this is what the UI (and the gatherer that flattens chrome
 * storage into a builder input) speaks.
 *
 * Collections and folders are *expanders*: picking one pulls in every
 * descendant folder/entity plus the parent containers needed for
 * `collectionId` / `folderId` / tree-prefix paths to resolve at import
 * time. Picking a leaf entity ships exactly that entity.
 */
export interface ExportSelection {
  rules?: readonly string[];
  requests?: readonly string[];
  templates?: readonly string[];
  environments?: readonly string[];
  liveWorkflows?: readonly string[];
  liveVariables?: readonly string[];
  collections?: readonly string[];
  folders?: readonly string[];
}
