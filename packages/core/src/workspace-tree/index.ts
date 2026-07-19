/**
 * Workspace tree — pure planner + reader for the materialized YAML
 * working tree (GIT_PLAN.md Phase 2). String-in / string-out like the
 * codec layer beneath it; Node hosts (`@openheaders/oracle-host-node`)
 * layer filesystem I/O, the `.oh/` sidecar, and bind exclusivity on top.
 */

export {
  COLLECTION_MANIFEST_FILE,
  ENVIRONMENTS_DIR,
  environmentFilePath,
  environmentSecretFilePath,
  environmentSecretTemplateFilePath,
  FOLDER_MANIFEST_FILE,
  GITATTRIBUTES_FILE,
  GITIGNORE_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  OH_SIDECAR_DIR,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  SECRET_FILE_SUFFIX,
  SECRET_TEMPLATE_FILE_SUFFIX,
  SPEC_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  VAULT_DOC_KEY,
  VAULT_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
  WORKSPACE_DOC_KEY,
  WORKSPACE_GITATTRIBUTES_CONTENT,
  WORKSPACE_GITIGNORE_CONTENT,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_DOC_KEY,
  WORKSPACE_VARS_FILE,
} from './layout';
export { planWorkspaceTree, serializeWorkspaceManifest } from './plan';
export { readWorkspaceTree } from './read';
export type { TreeFile, TreeIssue, TreeReadResult, TreeUnknownFields, WorkspaceTreeState } from './types';
