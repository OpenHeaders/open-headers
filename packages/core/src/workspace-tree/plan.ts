/**
 * Tree planner — one workspace snapshot in, the complete deterministic
 * file set out (the git-sync plan §10 Phase 2; the sync-engine design §23).
 *
 * Placement comes from each entity's mutator-maintained `path`; file
 * contents come from the canonical per-entity codecs, so the plan is
 * byte-deterministic for byte-identical state (§23.3) and unknown
 * fields ride back into their documents via the {@link TreeUnknownFields}
 * map. The planner never touches a filesystem — the Node host diffs the
 * returned set against disk and writes/deletes accordingly.
 *
 * A document is planned only at paths a tree can hold (`tree-path.ts`):
 * the plan is the last place a path is the engine's alone, before a
 * host joins it under a folder.
 *
 * `.gitignore` and `.gitattributes` are NOT planned: a planned file is
 * one the materializer rewrites to the plan's bytes, and those two are
 * the user's after they are authored (`hygiene.ts`).
 */

import {
  serializeCollection,
  serializeEnvironment,
  serializeFolder,
  serializeGraphqlRequest,
  serializeGrpcRequest,
  serializeLiveVariable,
  serializeLiveWorkflow,
  serializeMqttRequest,
  serializeRequest,
  serializeRule,
  serializeSpec,
  serializeTemplate,
  serializeTrustedRoots,
  serializeVault,
  serializeWebSocketRequest,
  serializeWorkspace,
  serializeWorkspaceVariables,
} from '../codec/yaml';
import type { UnknownField } from '../codec/yaml/unknown-fields';
import { makeParsed, mergePatch, type WriteableDocument } from '../schemas/document';
import type { WorkspaceManifest } from '../types/workspace';
import {
  COLLECTION_MANIFEST_FILE,
  environmentFilePath,
  environmentSecretFilePath,
  environmentSecretTemplateFilePath,
  FOLDER_MANIFEST_FILE,
  GRAPHQL_REQUEST_MANIFEST_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  MQTT_REQUEST_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  SPEC_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  TRUSTED_ROOTS_DOC_KEY,
  TRUSTED_ROOTS_FILE,
  VAULT_DOC_KEY,
  VAULT_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
  WORKSPACE_DOC_KEY,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_DOC_KEY,
  WORKSPACE_VARS_FILE,
} from './layout';
import { treePathIssue, treePathRefusal } from './tree-path';
import type { TreeFile, TreeIssue, TreeUnknownFields, WorkspaceTreeState } from './types';

/**
 * Reconstitute a writeable document from a typed value + its stored
 * unknown-field rows — the serialize-side counterpart of `makeParsed`.
 */
function toWrite<T>(value: T, rows: readonly UnknownField[] | undefined): WriteableDocument<T> {
  return mergePatch(makeParsed(value, rows ?? []), () => {});
}

/**
 * Emit the `workspace.yaml` manifest for one workspace — the identity
 * file bind writes before any full materialize runs (§3.5). Same emit
 * path the planner uses, so bind-authored and materializer-authored
 * manifests are byte-identical. `orgId` never reaches the file — the
 * codec drops it on both directions (the git-sync plan §5, S5 decision).
 */
export function serializeWorkspaceManifest(workspace: WorkspaceManifest, rows?: readonly UnknownField[]): string {
  return serializeWorkspace(toWrite(workspace, rows));
}

/** A workspace's tree as planned. */
export interface WorkspaceTreePlan {
  /** The files of every document a tree can hold — sorted by path, no two at one path. */
  files: TreeFile[];
  /**
   * The rows of the documents left out, each planned at a path no tree
   * can hold (`tree-path.ts`): one at every such file, and one at the
   * manifest where the manifest's own path is not the cause.
   */
  unheld: TreeIssue[];
}

/** A file an entity's codec emits beside its manifest. */
interface BesideFile {
  fileName: string;
  content: string;
}

/** The issue of a document left out for a file of its own that no tree can hold, at its manifest. */
function leftOutIssue(manifest: string, file: string): TreeIssue {
  // Named as it stands beside the manifest: a document's files lie in its manifest's directory, or beneath it.
  return { path: manifest, message: `"${file.slice(manifest.lastIndexOf('/') + 1)}" was not written — skipped` };
}

/**
 * Plan a workspace's documents. A document is planned whole or not at
 * all: one of its files at a path no tree can hold would leave the rest
 * a document short of a file, which reads as one that lost it — so none
 * of it is planned, and its rows say why. A path comes from the entity
 * (`path`, a spec's file names), and the engine holds what its peers
 * sent.
 *
 * The files are sorted by path and duplicate-free (case-insensitively —
 * macOS and Windows filesystems would silently merge what a
 * case-sensitive plan keeps apart; a collision is a state corruption
 * worth failing loudly on).
 */
export function planWorkspaceDocuments(state: WorkspaceTreeState, unknowns: TreeUnknownFields = {}): WorkspaceTreePlan {
  const files: TreeFile[] = [];
  const unheld: TreeIssue[] = [];

  /** One document: its manifest, then the files beside it. */
  const document = (manifest: TreeFile, beside: readonly TreeFile[] = []): void => {
    const planned = [manifest, ...beside];
    const refused = planned.flatMap((file) => {
      const part = treePathRefusal(file.path);
      return part === null ? [] : [{ file, part }];
    });
    if (refused.length === 0) {
      files.push(...planned);
      return;
    }
    for (const { file, part } of refused) unheld.push(treePathIssue(file.path, part, 'not written'));
    if (refused.every(({ file }) => file !== manifest)) unheld.push(leftOutIssue(manifest.path, refused[0].file.path));
  };
  const at = (dir: string, fileName: string, content: string): TreeFile => ({ path: `${dir}/${fileName}`, content });
  const besideIn = (dir: string, emitted: ReadonlyArray<BesideFile | null | undefined>): TreeFile[] =>
    emitted.flatMap((file) => (file ? [at(dir, file.fileName, file.content)] : []));

  document({
    path: WORKSPACE_MANIFEST_FILE,
    content: serializeWorkspace(toWrite(state.workspace, unknowns[WORKSPACE_DOC_KEY])),
  });

  if (state.workspaceVariables !== null) {
    document({
      path: WORKSPACE_VARS_FILE,
      content: serializeWorkspaceVariables(toWrite(state.workspaceVariables, unknowns[WORKSPACE_VARS_DOC_KEY])),
    });
  }
  if (state.vault !== null && state.vault.secrets.length > 0) {
    document({ path: VAULT_FILE, content: serializeVault(toWrite(state.vault, unknowns[VAULT_DOC_KEY])) });
  }
  if (state.trustedRoots !== null && state.trustedRoots.roots.length > 0) {
    document({
      path: TRUSTED_ROOTS_FILE,
      content: serializeTrustedRoots(toWrite(state.trustedRoots, unknowns[TRUSTED_ROOTS_DOC_KEY])),
    });
  }

  for (const collection of [...state.collections, ...state.requestCollections, ...state.templateCollections]) {
    const out = serializeCollection(toWrite(collection, unknowns[collection.uid]));
    document(
      at(collection.path, COLLECTION_MANIFEST_FILE, out.collectionYaml),
      besideIn(collection.path, out.scriptFiles),
    );
  }

  for (const folder of [...state.folders, ...state.requestFolders, ...state.templateFolders]) {
    const out = serializeFolder(toWrite(folder, unknowns[folder.uid]));
    document(at(folder.path, FOLDER_MANIFEST_FILE, out.folderYaml), besideIn(folder.path, out.scriptFiles));
  }

  for (const rule of state.rules) {
    document(at(rule.path, RULE_MANIFEST_FILE, serializeRule(toWrite(rule, unknowns[rule.uid]))));
  }

  for (const request of state.requests) {
    const out = serializeRequest(toWrite(request, unknowns[request.uid]));
    document(
      at(request.path, REQUEST_MANIFEST_FILE, out.requestYaml),
      besideIn(request.path, [out.bodyFile, out.variablesFile, out.preRequestScript, out.postResponseScript]),
    );
  }

  for (const grpcRequest of state.grpcRequests) {
    const out = serializeGrpcRequest(toWrite(grpcRequest, unknowns[grpcRequest.uid]));
    document(
      at(grpcRequest.path, GRPC_REQUEST_MANIFEST_FILE, out.grpcYaml),
      besideIn(grpcRequest.path, [out.messageFile, ...out.scriptFiles]),
    );
  }

  for (const websocketRequest of state.websocketRequests) {
    const out = serializeWebSocketRequest(toWrite(websocketRequest, unknowns[websocketRequest.uid]));
    document(
      at(websocketRequest.path, WEBSOCKET_REQUEST_MANIFEST_FILE, out.websocketYaml),
      besideIn(websocketRequest.path, [out.messageFile, ...out.scriptFiles]),
    );
  }

  for (const mqttRequest of state.mqttRequests) {
    const out = serializeMqttRequest(toWrite(mqttRequest, unknowns[mqttRequest.uid]));
    document(
      at(mqttRequest.path, MQTT_REQUEST_MANIFEST_FILE, out.mqttYaml),
      besideIn(mqttRequest.path, [out.payloadFile, ...out.scriptFiles]),
    );
  }

  for (const graphqlRequest of state.graphqlRequests) {
    const out = serializeGraphqlRequest(toWrite(graphqlRequest, unknowns[graphqlRequest.uid]));
    document(
      at(graphqlRequest.path, GRAPHQL_REQUEST_MANIFEST_FILE, out.graphqlYaml),
      besideIn(graphqlRequest.path, [out.queryFile, out.variablesFile, ...out.scriptFiles]),
    );
  }

  for (const template of state.templates) {
    document(at(template.path, TEMPLATE_MANIFEST_FILE, serializeTemplate(toWrite(template, unknowns[template.uid]))));
  }

  for (const spec of state.specs) {
    const out = serializeSpec(toWrite(spec, unknowns[spec.uid]));
    document(at(spec.path, SPEC_MANIFEST_FILE, out.specYaml), besideIn(spec.path, out.files));
  }

  for (const liveWorkflow of state.liveWorkflows) {
    document(
      at(
        liveWorkflow.path,
        LIVE_WORKFLOW_MANIFEST_FILE,
        serializeLiveWorkflow(toWrite(liveWorkflow, unknowns[liveWorkflow.uid])),
      ),
    );
  }

  for (const liveVariable of state.liveVariables) {
    document(
      at(
        liveVariable.path,
        LIVE_VARIABLE_MANIFEST_FILE,
        serializeLiveVariable(toWrite(liveVariable, unknowns[liveVariable.uid])),
      ),
    );
  }

  for (const environment of state.environments) {
    const out = serializeEnvironment(toWrite(environment, unknowns[environment.uid]));
    const secrets = environment.variables.some((variable) => variable.type === 'secret');
    document(
      { path: environmentFilePath(environment), content: out.default },
      secrets
        ? [
            { path: environmentSecretFilePath(environment), content: out.secret },
            { path: environmentSecretTemplateFilePath(environment), content: out.template },
          ]
        : [],
    );
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

  return { files, unheld };
}

/** The complete file set of one workspace's tree — the files of {@link planWorkspaceDocuments}. */
export function planWorkspaceTree(state: WorkspaceTreeState, unknowns: TreeUnknownFields = {}): TreeFile[] {
  return planWorkspaceDocuments(state, unknowns).files;
}
