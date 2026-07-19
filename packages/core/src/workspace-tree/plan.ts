/**
 * Tree planner — one workspace snapshot in, the complete deterministic
 * file set out (GIT_PLAN.md §10 Phase 2; SYNC_ENGINE_DESIGN.md §23).
 *
 * Placement comes from each entity's mutator-maintained `path`; file
 * contents come from the canonical per-entity codecs, so the plan is
 * byte-deterministic for byte-identical state (§23.3) and unknown
 * fields ride back into their documents via the {@link TreeUnknownFields}
 * map. The planner never touches a filesystem — the Node host diffs the
 * returned set against disk and writes/deletes accordingly.
 */

import {
  serializeCollection,
  serializeEnvironment,
  serializeFolder,
  serializeGrpcRequest,
  serializeLiveVariable,
  serializeLiveWorkflow,
  serializeRequest,
  serializeRule,
  serializeSpec,
  serializeTemplate,
  serializeVault,
  serializeWebSocketRequest,
  serializeWorkspace,
  serializeWorkspaceVariables,
} from '../codec/yaml';
import type { UnknownField } from '../codec/yaml/unknown-fields';
import { makeParsed, mergePatch, type WriteableDocument } from '../schemas/document';
import type { Workspace } from '../types/workspace';
import {
  COLLECTION_MANIFEST_FILE,
  environmentFilePath,
  environmentSecretFilePath,
  environmentSecretTemplateFilePath,
  FOLDER_MANIFEST_FILE,
  GITIGNORE_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  SPEC_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  VAULT_DOC_KEY,
  VAULT_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
  WORKSPACE_DOC_KEY,
  WORKSPACE_GITIGNORE_CONTENT,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_DOC_KEY,
  WORKSPACE_VARS_FILE,
} from './layout';
import type { TreeFile, TreeUnknownFields, WorkspaceTreeState } from './types';

/**
 * Reconstitute a writeable document from a typed value + its stored
 * unknown-field rows — the serialize-side counterpart of `makeParsed`.
 */
function toWrite<T>(value: T, rows: readonly UnknownField[] | undefined): WriteableDocument<T> {
  return mergePatch(makeParsed(value, rows ?? []), () => {});
}

/**
 * `Workspace.orgId` is host-local tenancy context: whitelisted out of
 * `WORKSPACE_FIELD_ORDER`, it only ever reaches the file as a captured
 * unknown row (S2 decision). When the stored rows don't carry one —
 * a workspace that has never round-tripped through a tree — mint the
 * rider from the typed value so the emitted manifest stays parseable
 * (the schema requires `orgId` on read).
 */
function workspaceRows(workspace: Workspace, rows: readonly UnknownField[] | undefined): readonly UnknownField[] {
  const stored = rows ?? [];
  if (stored.some((row) => row.path === '/orgId')) return stored;
  return [...stored, { path: '/orgId', value: workspace.orgId }];
}

/**
 * Emit the `workspace.yaml` manifest for one workspace — the identity
 * file bind writes before any full materialize runs (§3.5). Same emit
 * path the planner uses, so bind-authored and materializer-authored
 * manifests are byte-identical.
 */
export function serializeWorkspaceManifest(workspace: Workspace, rows?: readonly UnknownField[]): string {
  return serializeWorkspace(toWrite(workspace, workspaceRows(workspace, rows)));
}

/**
 * Plan the complete materialized tree for one workspace. Output is
 * sorted by path and duplicate-free (case-insensitively — macOS and
 * Windows filesystems would silently merge what a case-sensitive plan
 * keeps apart; a collision is a state corruption worth failing loudly on).
 */
export function planWorkspaceTree(state: WorkspaceTreeState, unknowns: TreeUnknownFields = {}): TreeFile[] {
  const files: TreeFile[] = [];
  const add = (path: string, content: string): void => {
    files.push({ path, content });
  };

  add(GITIGNORE_FILE, WORKSPACE_GITIGNORE_CONTENT);
  add(
    WORKSPACE_MANIFEST_FILE,
    serializeWorkspace(toWrite(state.workspace, workspaceRows(state.workspace, unknowns[WORKSPACE_DOC_KEY]))),
  );

  if (state.workspaceVariables !== null) {
    add(
      WORKSPACE_VARS_FILE,
      serializeWorkspaceVariables(toWrite(state.workspaceVariables, unknowns[WORKSPACE_VARS_DOC_KEY])),
    );
  }
  if (state.vault !== null && state.vault.secrets.length > 0) {
    add(VAULT_FILE, serializeVault(toWrite(state.vault, unknowns[VAULT_DOC_KEY])));
  }

  for (const collection of [...state.collections, ...state.requestCollections, ...state.templateCollections]) {
    const out = serializeCollection(toWrite(collection, unknowns[collection.uid]));
    add(`${collection.path}/${COLLECTION_MANIFEST_FILE}`, out.collectionYaml);
    if (out.preRequestScript) add(`${collection.path}/${out.preRequestScript.fileName}`, out.preRequestScript.content);
    if (out.postResponseScript) {
      add(`${collection.path}/${out.postResponseScript.fileName}`, out.postResponseScript.content);
    }
  }

  for (const folder of [...state.folders, ...state.requestFolders, ...state.templateFolders]) {
    const out = serializeFolder(toWrite(folder, unknowns[folder.uid]));
    add(`${folder.path}/${FOLDER_MANIFEST_FILE}`, out.folderYaml);
    if (out.preRequestScript) add(`${folder.path}/${out.preRequestScript.fileName}`, out.preRequestScript.content);
    if (out.postResponseScript)
      add(`${folder.path}/${out.postResponseScript.fileName}`, out.postResponseScript.content);
  }

  for (const rule of state.rules) {
    add(`${rule.path}/${RULE_MANIFEST_FILE}`, serializeRule(toWrite(rule, unknowns[rule.uid])));
  }

  for (const request of state.requests) {
    const out = serializeRequest(toWrite(request, unknowns[request.uid]));
    add(`${request.path}/${REQUEST_MANIFEST_FILE}`, out.requestYaml);
    for (const sibling of [out.bodyFile, out.variablesFile, out.preRequestScript, out.postResponseScript]) {
      if (sibling) add(`${request.path}/${sibling.fileName}`, sibling.content);
    }
  }

  for (const grpcRequest of state.grpcRequests) {
    const out = serializeGrpcRequest(toWrite(grpcRequest, unknowns[grpcRequest.uid]));
    add(`${grpcRequest.path}/${GRPC_REQUEST_MANIFEST_FILE}`, out.grpcYaml);
    if (out.messageFile) add(`${grpcRequest.path}/${out.messageFile.fileName}`, out.messageFile.content);
  }

  for (const websocketRequest of state.websocketRequests) {
    const out = serializeWebSocketRequest(toWrite(websocketRequest, unknowns[websocketRequest.uid]));
    add(`${websocketRequest.path}/${WEBSOCKET_REQUEST_MANIFEST_FILE}`, out.websocketYaml);
    if (out.messageFile) add(`${websocketRequest.path}/${out.messageFile.fileName}`, out.messageFile.content);
  }

  for (const template of state.templates) {
    add(`${template.path}/${TEMPLATE_MANIFEST_FILE}`, serializeTemplate(toWrite(template, unknowns[template.uid])));
  }

  for (const spec of state.specs) {
    const out = serializeSpec(toWrite(spec, unknowns[spec.uid]));
    add(`${spec.path}/${SPEC_MANIFEST_FILE}`, out.specYaml);
    for (const file of out.files) {
      add(`${spec.path}/${file.fileName}`, file.content);
    }
  }

  for (const liveWorkflow of state.liveWorkflows) {
    add(
      `${liveWorkflow.path}/${LIVE_WORKFLOW_MANIFEST_FILE}`,
      serializeLiveWorkflow(toWrite(liveWorkflow, unknowns[liveWorkflow.uid])),
    );
  }

  for (const liveVariable of state.liveVariables) {
    add(
      `${liveVariable.path}/${LIVE_VARIABLE_MANIFEST_FILE}`,
      serializeLiveVariable(toWrite(liveVariable, unknowns[liveVariable.uid])),
    );
  }

  for (const environment of state.environments) {
    const out = serializeEnvironment(toWrite(environment, unknowns[environment.uid]));
    add(environmentFilePath(environment), out.default);
    if (environment.variables.some((variable) => variable.type === 'secret')) {
      add(environmentSecretFilePath(environment), out.secret);
      add(environmentSecretTemplateFilePath(environment), out.template);
    }
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const seen = new Set<string>();
  for (const file of files) {
    const key = file.path.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`planWorkspaceTree: duplicate tree path "${file.path}" (case-insensitive)`);
    }
    seen.add(key);
  }

  return files;
}
