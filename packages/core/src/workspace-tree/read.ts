/**
 * Tree reader — a flat file listing in, a workspace snapshot out
 * (the git-sync plan §10 Phase 2; the tree→engine direction of §3.1 rung 2).
 *
 * Classification is by file-name convention (the same conventions the
 * planner writes): manifest names identify entities, the first path
 * segment identifies which of the three collection trees a container
 * belongs to, and every other file in an entity's directory is handed
 * to that entity's codec as a sibling (codecs ignore what they don't
 * recognize — forward-compat). Files that match no convention are the
 * user's own (README, LICENSE, …) and are silently left alone.
 *
 * Per-document parse failures never abort the read: the entity is
 * skipped and reported as a {@link TreeIssue} row — the seam the
 * quarantine flow (§13.3, Phase 4) will consume.
 *
 * A listing may come with the paths its host listed and did not read
 * (`unread.ts`): each is a row, and a document is not read short of a
 * file beside it. A document's file at a path no tree can hold
 * (`tree-path.ts`) is the same, whichever door listed it.
 */

import * as v from 'valibot';
import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseGraphqlRequest,
  parseGrpcRequest,
  parseLiveVariable,
  parseLiveWorkflow,
  parseMqttRequest,
  parseRequest,
  parseRule,
  parseSpec,
  parseTemplate,
  parseTrustedRoots,
  parseVault,
  parseWebSocketRequest,
  parseWorkspace,
  parseWorkspaceVariables,
  unknownFieldsOf,
} from '../codec/yaml';
import type { ParsedDocument } from '../schemas/document';
import {
  COLLECTION_MANIFEST_FILE,
  ENTITY_MANIFEST_FILES,
  ENVIRONMENTS_DIR,
  FOLDER_MANIFEST_FILE,
  GRAPHQL_REQUEST_MANIFEST_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  MQTT_REQUEST_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  SECRET_FILE_SUFFIX,
  SECRET_TEMPLATE_FILE_SUFFIX,
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
import type {
  TreeFile,
  TreeIssue,
  TreeReadResult,
  TreeShadowed,
  TreeShadowedContainers,
  TreeShadowedLeaves,
  TreeUnknownFields,
  TreeUnread,
} from './types';
import { heldBackIssue, holdTreeFiles, unreadPaths } from './unread';

interface SiblingFile {
  fileName: string;
  content: string;
}

function dirOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function baseOf(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

function firstSegmentOf(path: string): string {
  const idx = path.indexOf('/');
  return idx === -1 ? path : path.slice(0, idx);
}

/** Container bucket for a `_collection.yaml` / `_folder.yaml` by its tree root; null off-tree. */
function pickByTree<T>(tree: string, rules: T, requests: T, templates: T): T | null {
  switch (tree) {
    case 'rules':
      return rules;
    case 'requests':
      return requests;
    case 'templates':
      return templates;
    default:
      return null;
  }
}

/** The issue of a document skipped for a uid another file holds, at its manifest. */
export function duplicateUidIssue(path: string, uid: string): TreeIssue {
  return { path, message: `duplicate uid "${uid}" — entity skipped`, duplicateOf: uid };
}

/** What a document that does not read says — the field first, where the schema names one. */
function failureOf(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  if (!v.isValiError(err)) return err.message;
  const field = v.getDotPath(err.issues[0]);
  return field === null ? err.message : `${field} — ${err.message}`;
}

function noLeaves(): TreeShadowedLeaves {
  return {
    rules: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    templates: [],
  };
}

function noContainers(): TreeShadowedContainers {
  return {
    collections: [],
    folders: [],
    requestCollections: [],
    requestFolders: [],
    templateCollections: [],
    templateFolders: [],
  };
}

/** Read one workspace tree from its complete file listing, and the paths of it that were listed and not read. */
export function readWorkspaceTree(files: readonly TreeFile[], unread: readonly TreeUnread[] = []): TreeReadResult {
  // A file at a path no tree can hold is not read — the sidecar's and
  // git's own among them; a document's stands with a row, like one the
  // host did not read.
  const { held, unheld } = holdTreeFiles(files);
  const notRead = unreadPaths(unread, unheld);
  const issues: TreeIssue[] = [...notRead.issues];
  const unknowns: TreeUnknownFields = {};
  const state: TreeReadResult['state'] = {
    workspace: null,
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    trustedRoots: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
  };

  const byPath = new Map<string, string>();
  const byDir = new Map<string, SiblingFile[]>();
  for (const file of held) {
    byPath.set(file.path, file.content);
    const dir = dirOf(file.path);
    const bucket = byDir.get(dir);
    const entry = { fileName: baseOf(file.path), content: file.content };
    if (bucket) bucket.push(entry);
    else byDir.set(dir, [entry]);
  }

  const shadowed = { ...noLeaves(), ...noContainers() };
  const uncontained = noLeaves();

  const seenUids = new Set<string>();
  const captureUnknowns = (key: string, parsed: ParsedDocument<unknown>): void => {
    const rows = unknownFieldsOf(parsed);
    if (rows.length > 0) unknowns[key] = rows;
  };

  /**
   * Run one document parse; returns null (and records an issue) on
   * failure or on a duplicate uid — the first occurrence of an identity
   * wins, matching the codec discipline that the uid inside the YAML is
   * authoritative while folder names are only mirrors. A collection,
   * folder or leaf skipped that way is kept in `shadows`.
   */
  const ingest = <T extends { uid: string }>(
    manifestPath: string,
    parse: () => ParsedDocument<T>,
    shadows?: TreeShadowed<T>[],
  ): T | null => {
    try {
      const parsed = parse();
      if (seenUids.has(parsed.value.uid)) {
        issues.push(duplicateUidIssue(manifestPath, parsed.value.uid));
        shadows?.push({ entity: parsed.value, unknowns: unknownFieldsOf(parsed) });
        return null;
      }
      seenUids.add(parsed.value.uid);
      captureUnknowns(parsed.value.uid, parsed);
      return parsed.value;
    } catch (err) {
      issues.push({ path: manifestPath, message: failureOf(err) });
      return null;
    }
  };

  const siblingsFor = (dir: string, manifestFile: string): SiblingFile[] => {
    const all = byDir.get(dir) ?? [];
    return all.filter((entry) => entry.fileName !== manifestFile && !ENTITY_MANIFEST_FILES.has(entry.fileName));
  };

  /**
   * A tree leaf is read inside a collection or folder of its own tree
   * and nowhere else: containment is the parent's set, and a leaf with
   * no container has no set to be held in. A file-presence test — a
   * container whose manifest does not parse keeps its children here;
   * whether the workspace has that container is asked where a read
   * meets the engine (`containment.ts`). A leaf under another tree's
   * container is refused for its tree, not for a directory that holds
   * no container.
   *
   * A leaf of its own tree in a directory with no manifest is skipped
   * the same and kept in `aside`: the engine may hold that directory as
   * a container whose manifest was removed, which the files cannot say.
   * One that does not parse is left to the row of its place.
   */
  const contained = <T>(
    manifestPath: string,
    tree: string,
    kind: string,
    parse: () => ParsedDocument<T>,
    aside: TreeShadowed<T>[],
  ): boolean => {
    const parent = dirOf(dirOf(manifestPath));
    const stands = (manifest: string): boolean => byPath.has(manifest) || notRead.stands(manifest);
    const container = stands(`${parent}/${COLLECTION_MANIFEST_FILE}`) || stands(`${parent}/${FOLDER_MANIFEST_FILE}`);
    const ownTree = firstSegmentOf(manifestPath) === tree;
    const held = container && ownTree;
    if (!held) {
      issues.push({
        path: manifestPath,
        message: container
          ? `${kind} under "${firstSegmentOf(manifestPath)}", not "${tree}" — skipped`
          : `${kind} in no collection or folder — skipped`,
        ...(container ? {} : { uncontainedIn: parent }),
      });
      if (!container && ownTree) {
        try {
          const parsed = parse();
          aside.push({ entity: parsed.value, unknowns: unknownFieldsOf(parsed) });
        } catch {
          // Not a document either: the row of its place stands for it.
        }
      }
    }
    return held;
  };

  // ── Root singletons ────────────────────────────────────────────────

  const workspaceYaml = byPath.get(WORKSPACE_MANIFEST_FILE);
  if (workspaceYaml === undefined) {
    // One that stands and was not read has its own row, and is not missing.
    if (!notRead.stands(WORKSPACE_MANIFEST_FILE) && !notRead.unlisted(WORKSPACE_MANIFEST_FILE)) {
      issues.push({ path: WORKSPACE_MANIFEST_FILE, message: 'missing workspace.yaml — not a workspace tree' });
    }
  } else {
    try {
      const parsed = parseWorkspace(workspaceYaml);
      captureUnknowns(WORKSPACE_DOC_KEY, parsed);
      state.workspace = parsed.value;
    } catch (err) {
      issues.push({ path: WORKSPACE_MANIFEST_FILE, message: failureOf(err) });
    }
  }

  const workspaceVarsYaml = byPath.get(WORKSPACE_VARS_FILE);
  if (workspaceVarsYaml !== undefined) {
    try {
      const parsed = parseWorkspaceVariables(workspaceVarsYaml);
      captureUnknowns(WORKSPACE_VARS_DOC_KEY, parsed);
      state.workspaceVariables = parsed.value;
    } catch (err) {
      issues.push({ path: WORKSPACE_VARS_FILE, message: failureOf(err) });
    }
  }

  const vaultYaml = byPath.get(VAULT_FILE);
  if (vaultYaml !== undefined) {
    try {
      const parsed = parseVault(vaultYaml);
      captureUnknowns(VAULT_DOC_KEY, parsed);
      state.vault = parsed.value;
    } catch (err) {
      issues.push({ path: VAULT_FILE, message: failureOf(err) });
    }
  }

  const trustedRootsYaml = byPath.get(TRUSTED_ROOTS_FILE);
  if (trustedRootsYaml !== undefined) {
    try {
      const parsed = parseTrustedRoots(trustedRootsYaml);
      captureUnknowns(TRUSTED_ROOTS_DOC_KEY, parsed);
      state.trustedRoots = parsed.value;
    } catch (err) {
      issues.push({ path: TRUSTED_ROOTS_FILE, message: failureOf(err) });
    }
  }

  // ── Entities by manifest convention ────────────────────────────────

  for (const [path, content] of byPath) {
    const dir = dirOf(path);
    const base = baseOf(path);
    const tree = firstSegmentOf(path);

    if (ENTITY_MANIFEST_FILES.has(base)) {
      const beside = notRead.beside(dir);
      if (beside !== undefined) {
        issues.push(heldBackIssue(path, beside));
        continue;
      }
    }

    switch (base) {
      case COLLECTION_MANIFEST_FILE: {
        const bucket = pickByTree(tree, state.collections, state.requestCollections, state.templateCollections);
        const shadows = pickByTree(
          tree,
          shadowed.collections,
          shadowed.requestCollections,
          shadowed.templateCollections,
        );
        if (bucket === null || shadows === null) {
          issues.push({ path, message: `collection outside a known tree root ("${tree}") — skipped` });
          break;
        }
        const value = ingest(
          path,
          () => parseCollection(content, { path: dir, siblings: siblingsFor(dir, COLLECTION_MANIFEST_FILE) }),
          shadows,
        );
        if (value) bucket.push(value);
        break;
      }
      case FOLDER_MANIFEST_FILE: {
        const bucket = pickByTree(tree, state.folders, state.requestFolders, state.templateFolders);
        const shadows = pickByTree(tree, shadowed.folders, shadowed.requestFolders, shadowed.templateFolders);
        if (bucket === null || shadows === null) {
          issues.push({ path, message: `folder outside a known tree root ("${tree}") — skipped` });
          break;
        }
        const value = ingest(
          path,
          () => parseFolder(content, { path: dir, siblings: siblingsFor(dir, FOLDER_MANIFEST_FILE) }),
          shadows,
        );
        if (value) bucket.push(value);
        break;
      }
      case RULE_MANIFEST_FILE: {
        const parse = () => parseRule(content, { path: dir });
        if (!contained(path, 'rules', 'rule', parse, uncontained.rules)) break;
        const value = ingest(path, parse, shadowed.rules);
        if (value) state.rules.push(value);
        break;
      }
      case REQUEST_MANIFEST_FILE: {
        const parse = () => parseRequest(content, { path: dir, siblings: siblingsFor(dir, REQUEST_MANIFEST_FILE) });
        if (!contained(path, 'requests', 'request', parse, uncontained.requests)) break;
        const value = ingest(path, parse, shadowed.requests);
        if (value) state.requests.push(value);
        break;
      }
      case GRPC_REQUEST_MANIFEST_FILE: {
        const parse = () =>
          parseGrpcRequest(content, { path: dir, siblings: siblingsFor(dir, GRPC_REQUEST_MANIFEST_FILE) });
        if (!contained(path, 'requests', 'gRPC request', parse, uncontained.grpcRequests)) break;
        const value = ingest(path, parse, shadowed.grpcRequests);
        if (value) state.grpcRequests.push(value);
        break;
      }
      case WEBSOCKET_REQUEST_MANIFEST_FILE: {
        const parse = () =>
          parseWebSocketRequest(content, { path: dir, siblings: siblingsFor(dir, WEBSOCKET_REQUEST_MANIFEST_FILE) });
        if (!contained(path, 'requests', 'WebSocket request', parse, uncontained.websocketRequests)) break;
        const value = ingest(path, parse, shadowed.websocketRequests);
        if (value) state.websocketRequests.push(value);
        break;
      }
      case MQTT_REQUEST_MANIFEST_FILE: {
        const parse = () =>
          parseMqttRequest(content, { path: dir, siblings: siblingsFor(dir, MQTT_REQUEST_MANIFEST_FILE) });
        if (!contained(path, 'requests', 'MQTT request', parse, uncontained.mqttRequests)) break;
        const value = ingest(path, parse, shadowed.mqttRequests);
        if (value) state.mqttRequests.push(value);
        break;
      }
      case GRAPHQL_REQUEST_MANIFEST_FILE: {
        const parse = () =>
          parseGraphqlRequest(content, { path: dir, siblings: siblingsFor(dir, GRAPHQL_REQUEST_MANIFEST_FILE) });
        if (!contained(path, 'requests', 'GraphQL request', parse, uncontained.graphqlRequests)) break;
        const value = ingest(path, parse, shadowed.graphqlRequests);
        if (value) state.graphqlRequests.push(value);
        break;
      }
      case TEMPLATE_MANIFEST_FILE: {
        const parse = () => parseTemplate(content, { path: dir });
        if (!contained(path, 'templates', 'template', parse, uncontained.templates)) break;
        const value = ingest(path, parse, shadowed.templates);
        if (value) state.templates.push(value);
        break;
      }
      case SPEC_MANIFEST_FILE: {
        const value = ingest(path, () =>
          parseSpec(content, { path: dir, siblings: siblingsFor(dir, SPEC_MANIFEST_FILE) }),
        );
        if (value) state.specs.push(value);
        break;
      }
      case LIVE_WORKFLOW_MANIFEST_FILE: {
        const value = ingest(path, () => parseLiveWorkflow(content, { path: dir }));
        if (value) state.liveWorkflows.push(value);
        break;
      }
      case LIVE_VARIABLE_MANIFEST_FILE: {
        const value = ingest(path, () => parseLiveVariable(content, { path: dir }));
        if (value) state.liveVariables.push(value);
        break;
      }
      default:
        break;
    }
  }

  // ── Environments (name-derived files, secret-split pairing) ────────

  for (const [path, content] of byPath) {
    if (dirOf(path) !== ENVIRONMENTS_DIR) continue;
    if (!path.endsWith('.yaml') || path.endsWith(SECRET_FILE_SUFFIX) || path.endsWith(SECRET_TEMPLATE_FILE_SUFFIX)) {
      continue;
    }
    const secretPath = `${path.slice(0, -'.yaml'.length)}${SECRET_FILE_SUFFIX}`;
    if (notRead.stands(secretPath)) {
      issues.push(heldBackIssue(path, baseOf(secretPath)));
      continue;
    }
    const secret = byPath.get(secretPath);
    const value = ingest(path, () =>
      parseEnvironment({ default: content, ...(secret !== undefined ? { secret } : {}) }),
    );
    if (value) state.environments.push(value);
  }

  return { state, unknowns, issues, shadowed, uncontained };
}
