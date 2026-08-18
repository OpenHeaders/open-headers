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
 */

import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseGrpcRequest,
  parseLiveVariable,
  parseLiveWorkflow,
  parseRequest,
  parseRule,
  parseSpec,
  parseTemplate,
  parseVault,
  parseWebSocketRequest,
  parseWorkspace,
  parseWorkspaceVariables,
  unknownFieldsOf,
} from '../codec/yaml';
import type { ParsedDocument } from '../schemas/document';
import {
  COLLECTION_MANIFEST_FILE,
  ENVIRONMENTS_DIR,
  FOLDER_MANIFEST_FILE,
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
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_DOC_KEY,
  WORKSPACE_VARS_FILE,
} from './layout';
import type { TreeFile, TreeIssue, TreeReadResult, TreeUnknownFields } from './types';

interface SiblingFile {
  fileName: string;
  content: string;
}

const ENTITY_MANIFEST_FILES: ReadonlySet<string> = new Set([
  COLLECTION_MANIFEST_FILE,
  FOLDER_MANIFEST_FILE,
  RULE_MANIFEST_FILE,
  REQUEST_MANIFEST_FILE,
  GRPC_REQUEST_MANIFEST_FILE,
  WEBSOCKET_REQUEST_MANIFEST_FILE,
  TEMPLATE_MANIFEST_FILE,
  SPEC_MANIFEST_FILE,
  LIVE_WORKFLOW_MANIFEST_FILE,
  LIVE_VARIABLE_MANIFEST_FILE,
]);

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

/** Read one workspace tree from its complete file listing. */
export function readWorkspaceTree(files: readonly TreeFile[]): TreeReadResult {
  const issues: TreeIssue[] = [];
  const unknowns: TreeUnknownFields = {};
  const state: TreeReadResult['state'] = {
    workspace: null,
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
  };

  const byPath = new Map<string, string>();
  const byDir = new Map<string, SiblingFile[]>();
  for (const file of files) {
    const first = firstSegmentOf(file.path);
    if (first === OH_SIDECAR_DIR || first === '.git') continue;
    byPath.set(file.path, file.content);
    const dir = dirOf(file.path);
    const bucket = byDir.get(dir);
    const entry = { fileName: baseOf(file.path), content: file.content };
    if (bucket) bucket.push(entry);
    else byDir.set(dir, [entry]);
  }

  const seenUids = new Set<string>();
  const captureUnknowns = (key: string, parsed: ParsedDocument<unknown>): void => {
    const rows = unknownFieldsOf(parsed);
    if (rows.length > 0) unknowns[key] = rows;
  };

  /**
   * Run one document parse; returns null (and records an issue) on
   * failure or on a duplicate uid — the first occurrence of an identity
   * wins, matching the codec discipline that the uid inside the YAML is
   * authoritative while folder names are only mirrors.
   */
  const ingest = <T extends { uid: string }>(manifestPath: string, parse: () => ParsedDocument<T>): T | null => {
    try {
      const parsed = parse();
      if (seenUids.has(parsed.value.uid)) {
        issues.push({ path: manifestPath, message: `duplicate uid "${parsed.value.uid}" — entity skipped` });
        return null;
      }
      seenUids.add(parsed.value.uid);
      captureUnknowns(parsed.value.uid, parsed);
      return parsed.value;
    } catch (err) {
      issues.push({ path: manifestPath, message: err instanceof Error ? err.message : String(err) });
      return null;
    }
  };

  const siblingsFor = (dir: string, manifestFile: string): SiblingFile[] => {
    const all = byDir.get(dir) ?? [];
    return all.filter((entry) => entry.fileName !== manifestFile && !ENTITY_MANIFEST_FILES.has(entry.fileName));
  };

  // ── Root singletons ────────────────────────────────────────────────

  const workspaceYaml = byPath.get(WORKSPACE_MANIFEST_FILE);
  if (workspaceYaml === undefined) {
    issues.push({ path: WORKSPACE_MANIFEST_FILE, message: 'missing workspace.yaml — not a workspace tree' });
  } else {
    try {
      const parsed = parseWorkspace(workspaceYaml);
      captureUnknowns(WORKSPACE_DOC_KEY, parsed);
      state.workspace = parsed.value;
    } catch (err) {
      issues.push({ path: WORKSPACE_MANIFEST_FILE, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const workspaceVarsYaml = byPath.get(WORKSPACE_VARS_FILE);
  if (workspaceVarsYaml !== undefined) {
    try {
      const parsed = parseWorkspaceVariables(workspaceVarsYaml);
      captureUnknowns(WORKSPACE_VARS_DOC_KEY, parsed);
      state.workspaceVariables = parsed.value;
    } catch (err) {
      issues.push({ path: WORKSPACE_VARS_FILE, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const vaultYaml = byPath.get(VAULT_FILE);
  if (vaultYaml !== undefined) {
    try {
      const parsed = parseVault(vaultYaml);
      captureUnknowns(VAULT_DOC_KEY, parsed);
      state.vault = parsed.value;
    } catch (err) {
      issues.push({ path: VAULT_FILE, message: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── Entities by manifest convention ────────────────────────────────

  for (const [path, content] of byPath) {
    const dir = dirOf(path);
    const base = baseOf(path);
    const tree = firstSegmentOf(path);

    switch (base) {
      case COLLECTION_MANIFEST_FILE: {
        const bucket = pickByTree(tree, state.collections, state.requestCollections, state.templateCollections);
        if (bucket === null) {
          issues.push({ path, message: `collection outside a known tree root ("${tree}") — skipped` });
          break;
        }
        const value = ingest(path, () =>
          parseCollection(content, { path: dir, siblings: siblingsFor(dir, COLLECTION_MANIFEST_FILE) }),
        );
        if (value) bucket.push(value);
        break;
      }
      case FOLDER_MANIFEST_FILE: {
        const bucket = pickByTree(tree, state.folders, state.requestFolders, state.templateFolders);
        if (bucket === null) {
          issues.push({ path, message: `folder outside a known tree root ("${tree}") — skipped` });
          break;
        }
        const value = ingest(path, () =>
          parseFolder(content, { path: dir, siblings: siblingsFor(dir, FOLDER_MANIFEST_FILE) }),
        );
        if (value) bucket.push(value);
        break;
      }
      case RULE_MANIFEST_FILE: {
        const value = ingest(path, () => parseRule(content, { path: dir }));
        if (value) state.rules.push(value);
        break;
      }
      case REQUEST_MANIFEST_FILE: {
        const value = ingest(path, () =>
          parseRequest(content, { path: dir, siblings: siblingsFor(dir, REQUEST_MANIFEST_FILE) }),
        );
        if (value) state.requests.push(value);
        break;
      }
      case GRPC_REQUEST_MANIFEST_FILE: {
        const value = ingest(path, () =>
          parseGrpcRequest(content, { path: dir, siblings: siblingsFor(dir, GRPC_REQUEST_MANIFEST_FILE) }),
        );
        if (value) state.grpcRequests.push(value);
        break;
      }
      case WEBSOCKET_REQUEST_MANIFEST_FILE: {
        const value = ingest(path, () =>
          parseWebSocketRequest(content, { path: dir, siblings: siblingsFor(dir, WEBSOCKET_REQUEST_MANIFEST_FILE) }),
        );
        if (value) state.websocketRequests.push(value);
        break;
      }
      case TEMPLATE_MANIFEST_FILE: {
        const value = ingest(path, () => parseTemplate(content, { path: dir }));
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
    const secret = byPath.get(`${path.slice(0, -'.yaml'.length)}${SECRET_FILE_SUFFIX}`);
    const value = ingest(path, () =>
      parseEnvironment({ default: content, ...(secret !== undefined ? { secret } : {}) }),
    );
    if (value) state.environments.push(value);
  }

  return { state, unknowns, issues };
}
