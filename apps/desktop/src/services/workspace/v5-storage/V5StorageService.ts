/**
 * WorkspaceStorageService — reads and writes the git-based YAML workspace format.
 *
 * Directory layout:
 *
 *   workspace-root/
 *   ├── workspace.yaml                     # version, name
 *   ├── workspace-vars.yaml                # workspace-level variables
 *   ├── workspace-vars.secret.yaml         # gitignored workspace secrets
 *   ├── environments/
 *   │   ├── dev.yaml                       # flat key-value
 *   │   ├── staging.yaml
 *   │   └── production.secret.yaml         # gitignored
 *   ├── requests/
 *   │   └── auth-a1b2/                     # collection (has _collection.yaml)
 *   │       ├── _collection.yaml           # name, vars, sort
 *   │       ├── login-x7k2/               # request item (has request.yaml)
 *   │       │   ├── request.yaml           # name, method, url, headers, params, auth
 *   │       │   ├── body.json              # body content
 *   │       │   └── scripts.js             # pre/post scripts
 *   │       └── tokens/                    # grouping folder
 *   │           ├── _folder.yaml           # optional metadata
 *   │           └── refresh-m9p1/
 *   │               ├── request.yaml
 *   │               └── body.json
 *   ├── rules/
 *   │   └── dev-overrides-c3d4/            # collection
 *   │       ├── _collection.yaml
 *   │       └── inject-auth-r5t9/
 *   │           └── rule.yaml
 *   └── .gitignore
 *
 * Conventions:
 *   - _collection.yaml → marks a directory as a collection
 *   - _folder.yaml → marks a directory as a grouping folder (optional)
 *   - request.yaml → marks a directory as a request item
 *   - rule.yaml → marks a directory as a rule item
 *   - Folder names: slug + 4-char uid suffix (e.g. login-x7k2)
 *   - body.* extension = content type (json, xml, graphql, form, multipart, txt)
 *   - *.secret.yaml = always gitignored
 *
 * This module is pure I/O — no business logic, no state.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { V5 } from '@openheaders/core/types';
import { V5 as V5Values } from '@openheaders/core/types';
import YAML from 'yaml';
import mainLogger from '@/utils/mainLogger';

const { createLogger } = mainLogger;
const log = createLogger('WorkspaceStorage');

// ── Path conventions ───────────────────────────────────────────────

function requestsDir(root: string): string {
  return path.join(root, 'requests');
}
function rulesDir(root: string): string {
  return path.join(root, 'rules');
}
function environmentsDir(root: string): string {
  return path.join(root, 'environments');
}

// ── YAML helpers ───────────────────────────────────────────────────

async function readYaml<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return YAML.parse(content) as T;
  } catch {
    return null;
  }
}

async function writeYaml(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const content = YAML.stringify(data, { lineWidth: 0 });
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSubdirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

// ── Slug + UID helpers (from @openheaders/core) ──────────────────

import { extractUid, generateUid, toFolderName } from '@openheaders/core/utils';

// ── Body type ↔ file extension mapping ─────────────────────────────

const BODY_EXTENSION_MAP: Record<string, V5.BodyType> = {
  '.json': 'json',
  '.xml': 'xml',
  '.graphql': 'graphql',
  '.form': 'form',
  '.multipart': 'multipart',
  '.txt': 'text',
};

const BODY_TYPE_TO_EXT: Record<V5.BodyType, string> = {
  none: '',
  json: '.json',
  xml: '.xml',
  graphql: '.graphql',
  form: '.form',
  multipart: '.multipart',
  text: '.txt',
};

function detectBodyType(dir: string, files: string[]): { type: V5.BodyType; fileName: string | null } {
  for (const file of files) {
    if (!file.startsWith('body')) continue;
    const ext = path.extname(file);
    const bodyType = BODY_EXTENSION_MAP[ext];
    if (bodyType) return { type: bodyType, fileName: file };
  }
  return { type: 'none', fileName: null };
}

// ── Workspace manifest (workspace.yaml) ────────────────────────────

interface WorkspaceYaml {
  version: number;
  name: string;
  description?: string;
}

export async function readWorkspaceManifest(root: string): Promise<V5.Workspace | null> {
  const data = await readYaml<WorkspaceYaml>(path.join(root, 'workspace.yaml'));
  if (!data) return null;
  return {
    version: data.version,
    name: data.name,
    description: data.description,
    rootPath: root,
  };
}

export async function writeWorkspaceManifest(root: string, workspace: V5.Workspace): Promise<void> {
  const yaml: WorkspaceYaml = {
    version: workspace.version,
    name: workspace.name,
  };
  if (workspace.description) yaml.description = workspace.description;
  await writeYaml(path.join(root, 'workspace.yaml'), yaml);
}

// ── Workspace variables (workspace-vars.yaml) ──────────────────────

export async function readWorkspaceVariables(root: string): Promise<V5.WorkspaceVariables> {
  const data = await readYaml<Record<string, string>>(path.join(root, 'workspace-vars.yaml'));
  if (!data) return { variables: [] };
  return {
    variables: Object.entries(data).map(([name, value]) => ({ name, value, type: 'default' })),
  };
}

export async function writeWorkspaceVariables(root: string, vars: V5.WorkspaceVariables): Promise<void> {
  const flat: Record<string, string> = {};
  for (const v of vars.variables) {
    flat[v.name] = v.value;
  }
  await writeYaml(path.join(root, 'workspace-vars.yaml'), flat);
}

// ── Vault (workspace-vars.secret.yaml — gitignored) ────────────────

export async function readVault(root: string): Promise<V5.Vault> {
  const data = await readYaml<Record<string, string>>(path.join(root, 'workspace-vars.secret.yaml'));
  if (!data) return { secrets: [] };
  return {
    secrets: Object.entries(data).map(([name, value]) => ({ name, value })),
  };
}

export async function writeVault(root: string, vault: V5.Vault): Promise<void> {
  if (vault.secrets.length === 0) return;
  const flat: Record<string, string> = {};
  for (const s of vault.secrets) {
    flat[s.name] = s.value;
  }
  await writeYaml(path.join(root, 'workspace-vars.secret.yaml'), flat);
}

// ── Environments (environments/*.yaml) ─────────────────────────────

export async function readAllEnvironments(root: string): Promise<V5.Environment[]> {
  const envDir = environmentsDir(root);
  const environments: V5.Environment[] = [];

  try {
    const files = await fs.promises.readdir(envDir);
    for (const file of files) {
      if (!file.endsWith('.yaml') || file.endsWith('.secret.yaml') || file.endsWith('.secret.yaml.template')) continue;

      const envName = file.replace('.yaml', '');
      const data = await readYaml<Record<string, string>>(path.join(envDir, file));
      if (!data) continue;

      // Check for matching secret file
      const secretData = await readYaml<Record<string, string>>(path.join(envDir, `${envName}.secret.yaml`));

      const variables: V5.Variable[] = Object.entries(data).map(([name, value]) => ({
        name,
        value,
        type: 'default' as const,
      }));

      // Merge secrets
      if (secretData) {
        for (const [name, value] of Object.entries(secretData)) {
          const existing = variables.find((v) => v.name === name);
          if (existing) {
            existing.value = value;
            existing.type = 'secret';
          } else {
            variables.push({ name, value, type: 'secret' });
          }
        }
      }

      environments.push({
        name: envName,
        path: `environments/${file}`,
        variables,
        isActive: false,
      });
    }
  } catch {
    // environments/ directory might not exist
  }

  return environments;
}

export async function writeEnvironment(root: string, env: V5.Environment): Promise<void> {
  const envDir = environmentsDir(root);
  const defaultVars: Record<string, string> = {};
  const secretVars: Record<string, string> = {};

  for (const v of env.variables) {
    if (v.type === 'secret') {
      secretVars[v.name] = v.value;
    } else {
      defaultVars[v.name] = v.value;
    }
  }

  // Write non-secret vars (committed)
  await writeYaml(path.join(envDir, `${env.name}.yaml`), defaultVars);

  // Write secret vars (gitignored)
  if (Object.keys(secretVars).length > 0) {
    await writeYaml(path.join(envDir, `${env.name}.secret.yaml`), secretVars);

    // Write template (committed, empty values)
    const template: Record<string, string> = {};
    for (const name of Object.keys(secretVars)) {
      template[name] = '';
    }
    await writeYaml(path.join(envDir, `${env.name}.secret.yaml.template`), template);
  }
}

// ── Requests ───────────────────────────────────────────────────────

/** On-disk shape of request.yaml (no uid/path — those are derived from folder). */
interface RequestYaml {
  name: string;
  method: V5.HttpMethod;
  url: string;
  headers?: Array<{ key: string; value: string; enabled?: boolean }>;
  params?: Array<{ key: string; value: string; enabled?: boolean }>;
  auth?: V5.AuthConfig;
}

/**
 * Read a single request from its item folder.
 * Assembles the unified Request from request.yaml + body.* + scripts.js.
 */
export async function readRequest(itemDir: string): Promise<V5.Request | null> {
  const data = await readYaml<RequestYaml>(path.join(itemDir, 'request.yaml'));
  if (!data) return null;

  const folderName = path.basename(itemDir);
  const uid = extractUid(folderName);
  const relativePath = itemDir; // caller should make this relative

  // Detect and read body file
  let body: V5.RequestBody = { type: 'none' };
  try {
    const files = await fs.promises.readdir(itemDir);
    const { type: bodyType, fileName: bodyFile } = detectBodyType(itemDir, files);
    if (bodyType !== 'none' && bodyFile) {
      const content = await readTextFile(path.join(itemDir, bodyFile));
      body = { type: bodyType, content: content ?? undefined };

      // GraphQL variables
      if (bodyType === 'graphql') {
        const graphqlVars = await readTextFile(path.join(itemDir, 'variables.json'));
        if (graphqlVars) body.graphqlVariables = graphqlVars;
      }
    }
  } catch {
    // No body files
  }

  // Read scripts
  const scriptsContent = await readTextFile(path.join(itemDir, 'scripts.js'));
  let preRequestScript: string | undefined;
  let testScript: string | undefined;
  if (scriptsContent) {
    // Extract pre-request and post-response functions
    // For now, store the full scripts.js content as preRequestScript
    // A proper parser can be added later
    preRequestScript = scriptsContent;
  }

  return {
    uid,
    path: relativePath,
    name: data.name,
    method: data.method,
    url: data.url,
    headers: data.headers ?? [],
    params: data.params ?? [],
    auth: data.auth ?? { type: 'none' },
    body,
    preRequestScript,
    testScript,
  };
}

/**
 * Write a request to its item folder.
 * Splits the unified Request back into request.yaml + body.* + scripts.js.
 */
export async function writeRequest(itemDir: string, request: V5.Request): Promise<void> {
  await fs.promises.mkdir(itemDir, { recursive: true });

  // Write request.yaml (only non-default fields)
  const yaml: RequestYaml = {
    name: request.name,
    method: request.method,
    url: request.url,
  };

  if (request.headers.length > 0) {
    yaml.headers = request.headers.map((h) => {
      const entry: { key: string; value: string; enabled?: boolean } = { key: h.key, value: h.value };
      if (h.enabled === false) entry.enabled = false; // only write when disabled
      return entry;
    });
  }

  if (request.params.length > 0) {
    yaml.params = request.params.map((p) => {
      const entry: { key: string; value: string; enabled?: boolean } = { key: p.key, value: p.value };
      if (p.enabled === false) entry.enabled = false;
      return entry;
    });
  }

  if (request.auth.type !== 'none') {
    yaml.auth = request.auth;
  }

  await writeYaml(path.join(itemDir, 'request.yaml'), yaml);

  // Write body file
  if (request.body.type !== 'none' && request.body.content) {
    const ext = BODY_TYPE_TO_EXT[request.body.type];
    if (ext) {
      await writeTextFile(path.join(itemDir, `body${ext}`), request.body.content);
    }

    // GraphQL variables
    if (request.body.type === 'graphql' && request.body.graphqlVariables) {
      await writeTextFile(path.join(itemDir, 'variables.json'), request.body.graphqlVariables);
    }
  }

  // Write scripts
  if (request.preRequestScript || request.testScript) {
    const parts: string[] = [];
    if (request.preRequestScript) parts.push(request.preRequestScript);
    if (request.testScript) parts.push(request.testScript);
    await writeTextFile(path.join(itemDir, 'scripts.js'), parts.join('\n\n'));
  }
}

// ── Collections (requests|rules section) ───────────────────────────

/** On-disk shape of _collection.yaml. */
interface CollectionYaml {
  name?: string;
  description?: string;
  vars?: Record<string, string>;
  sort?: number;
}

/**
 * Read a collection from its directory.
 * A collection is any directory containing _collection.yaml.
 */
async function readCollectionMeta(collDir: string): Promise<V5.Collection | null> {
  const data = await readYaml<CollectionYaml>(path.join(collDir, '_collection.yaml'));
  const folderName = path.basename(collDir);
  const uid = extractUid(folderName);

  // _collection.yaml might not exist for a bare collection dir
  // In that case, derive the name from the folder
  const name = data?.name ?? folderName.replace(/-[a-z0-9]{4}$/, '').replace(/-/g, ' ');

  const variables: V5.Variable[] = data?.vars
    ? Object.entries(data.vars).map(([k, v]) => ({ name: k, value: v, type: 'default' as const }))
    : [];

  return {
    uid,
    path: collDir,
    name,
    description: data?.description,
    variables,
    sort: data?.sort,
  };
}

/**
 * Read all request collections from requests/ directory.
 * Builds the full tree (collections → folders → request items).
 */
export async function readAllCollections(root: string): Promise<V5.CollectionTree[]> {
  return readSectionCollections(requestsDir(root), 'request');
}

/**
 * Read all rule collections from rules/ directory.
 */
export async function readAllRuleCollections(root: string): Promise<V5.CollectionTree[]> {
  return readSectionCollections(rulesDir(root), 'rule');
}

async function readSectionCollections(
  sectionDir: string,
  itemType: 'request' | 'rule',
): Promise<V5.CollectionTree[]> {
  const collections: V5.CollectionTree[] = [];
  const collFolders = await listSubdirectories(sectionDir);

  for (const folderName of collFolders) {
    const collDir = path.join(sectionDir, folderName);

    // A collection must have _collection.yaml (or we treat any dir as one)
    const collection = await readCollectionMeta(collDir);
    if (!collection) continue;

    collection.path = collDir;
    const tree = await buildTree(collDir, itemType);
    collections.push({ ...collection, tree });
  }

  return collections;
}

/** Recursively build the sidebar tree for a collection directory. */
async function buildTree(dir: string, itemType: 'request' | 'rule'): Promise<V5.TreeNode[]> {
  const nodes: V5.TreeNode[] = [];
  const subFolders = await listSubdirectories(dir);

  for (const folderName of subFolders) {
    const subDir = path.join(dir, folderName);
    const uid = extractUid(folderName);

    // Check if this is an item folder
    const itemFile = itemType === 'request' ? 'request.yaml' : 'rule.yaml';
    if (await fileExists(path.join(subDir, itemFile))) {
      if (itemType === 'request') {
        const data = await readYaml<RequestYaml>(path.join(subDir, 'request.yaml'));
        if (data) {
          nodes.push({
            type: 'request',
            uid,
            name: data.name,
            path: subDir,
            method: data.method,
          });
        }
      }
      // Rule tree nodes can be added here when needed
    } else {
      // It's a grouping folder — recurse
      const children = await buildTree(subDir, itemType);
      nodes.push({
        type: 'folder',
        uid,
        name: folderName.replace(/-[a-z0-9]{4}$/, '').replace(/-/g, ' '),
        path: subDir,
        children,
      });
    }
  }

  return nodes;
}

export async function writeCollection(sectionDir: string, collection: V5.Collection): Promise<void> {
  const folderName = toFolderName(collection.name, collection.uid);
  const collDir = path.join(sectionDir, folderName);
  await fs.promises.mkdir(collDir, { recursive: true });

  const yaml: CollectionYaml = {};
  yaml.name = collection.name;
  if (collection.description) yaml.description = collection.description;
  if (collection.variables.length > 0) {
    yaml.vars = {};
    for (const v of collection.variables) {
      yaml.vars[v.name] = v.value;
    }
  }
  if (collection.sort != null) yaml.sort = collection.sort;

  await writeYaml(path.join(collDir, '_collection.yaml'), yaml);
}

// ── Read all requests across all collections ───────────────────────

export async function readAllRequests(root: string): Promise<V5.Request[]> {
  const requests: V5.Request[] = [];
  await findItemFolders(requestsDir(root), 'request.yaml', async (itemDir) => {
    const request = await readRequest(itemDir);
    if (request) requests.push(request);
  });
  return requests;
}

// ── Rules ──────────────────────────────────────────────────────────

export async function readAllRules(root: string): Promise<V5.Rule[]> {
  const rules: V5.Rule[] = [];
  await findItemFolders(rulesDir(root), 'rule.yaml', async (itemDir) => {
    const rule = await readRule(itemDir);
    if (rule) rules.push(rule);
  });
  return rules;
}

/**
 * Read a rule from its item folder (rule.yaml).
 * YAML is parsed loosely — the caller validates the shape.
 */
async function readRule(itemDir: string): Promise<V5.Rule | null> {
  const raw = await readYaml<Record<string, unknown>>(path.join(itemDir, 'rule.yaml'));
  if (!raw || typeof raw.name !== 'string' || typeof raw.type !== 'string') return null;

  const folderName = path.basename(itemDir);
  const uid = extractUid(folderName);
  const match = (raw.match ?? {}) as Record<string, unknown>;

  const base = {
    uid,
    path: itemDir,
    name: raw.name as string,
    enabled: raw.enabled !== false,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    domains: Array.isArray(match.domains) ? (match.domains as string[]) : [],
    urlPatterns: Array.isArray(match.url) ? (match.url as string[]) : undefined,
    methods: Array.isArray(match.method) ? (match.method as V5.HttpMethod[]) : undefined,
    resourceTypes: Array.isArray(match.resource_type) ? (match.resource_type as V5.ResourceType[]) : undefined,
  };

  const action = (raw.action ?? raw.actions ?? {}) as Record<string, unknown>;

  switch (raw.type) {
    case 'header':
      return {
        ...base,
        type: 'header',
        action: action as unknown as V5.HeaderAction,
        staticValue: typeof raw.staticValue === 'string' ? raw.staticValue : undefined,
      };
    case 'redirect':
      return { ...base, type: 'redirect', action: action as unknown as V5.RedirectAction };
    case 'body':
      return { ...base, type: 'body', action: action as unknown as V5.BodyAction };
    case 'inject':
      return { ...base, type: 'inject', action: action as unknown as V5.InjectAction };
    case 'block':
      return { ...base, type: 'block', action: action as unknown as V5.BlockAction };
    case 'delay':
      return { ...base, type: 'delay', action: action as unknown as V5.DelayAction };
    case 'mock':
      return { ...base, type: 'mock', action: action as unknown as V5.MockAction };
    default:
      return null;
  }
}

export async function writeRule(itemDir: string, rule: V5.Rule): Promise<void> {
  await fs.promises.mkdir(itemDir, { recursive: true });

  const yaml: Record<string, unknown> = {
    name: rule.name,
    type: rule.type,
    enabled: rule.enabled,
  };

  if (rule.tags.length > 0) yaml.tags = rule.tags;

  yaml.match = {
    ...(rule.domains.length > 0 && { domains: rule.domains }),
    ...(rule.urlPatterns && { url: rule.urlPatterns }),
    ...(rule.methods && { method: rule.methods }),
    ...(rule.resourceTypes && { resource_type: rule.resourceTypes }),
  };

  yaml.action = rule.action;

  // For header rules, include staticValue at top level
  if (rule.type === 'header' && 'staticValue' in rule) {
    yaml.staticValue = rule.staticValue;
  }

  await writeYaml(path.join(itemDir, 'rule.yaml'), yaml);
}

export async function writeAllRules(root: string, rules: V5.Rule[]): Promise<void> {
  for (const rule of rules) {
    const folderName = toFolderName(rule.name, rule.uid);
    const itemDir = path.join(rulesDir(root), folderName);
    await writeRule(itemDir, rule);
  }
}

// ── Gitignore ──────────────────────────────────────────────────────

export async function writeGitignore(root: string): Promise<void> {
  const gitignorePath = path.join(root, '.gitignore');
  if (await fileExists(gitignorePath)) return;
  await fs.promises.writeFile(gitignorePath, V5Values.V5_GITIGNORE, 'utf-8');
}

// ── Full workspace write (scaffolding a new workspace) ─────────────

export interface WorkspaceWriteData {
  workspace: V5.Workspace;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
  collections: Array<{
    collection: V5.Collection;
    requests: V5.Request[];
  }>;
  rules: V5.Rule[];
  environments: V5.Environment[];
}

export async function writeFullWorkspace(root: string, data: WorkspaceWriteData): Promise<void> {
  log.info(`Writing workspace to ${root}`);

  await writeWorkspaceManifest(root, data.workspace);
  await writeWorkspaceVariables(root, data.workspaceVariables);
  await writeVault(root, data.vault);
  await writeGitignore(root);

  // Write request collections
  for (const { collection, requests } of data.collections) {
    await writeCollection(requestsDir(root), collection);
    const collFolderName = toFolderName(collection.name, collection.uid);
    for (const request of requests) {
      const requestFolderName = toFolderName(request.name, request.uid);
      const itemDir = path.join(requestsDir(root), collFolderName, requestFolderName);
      await writeRequest(itemDir, request);
    }
  }

  // Write rules (flat for now — collection hierarchy can be added later)
  await writeAllRules(root, data.rules);

  // Write environments
  for (const env of data.environments) {
    await writeEnvironment(root, env);
  }

  log.info(
    `Workspace written: ${data.collections.length} collections, ${data.rules.length} rules, ${data.environments.length} environments`,
  );
}

// ── Detection ──────────────────────────────────────────────────────

/** Delete an item folder (request or rule) from disk. */
export async function deleteItemFolder(itemDir: string): Promise<void> {
  await fs.promises.rm(itemDir, { recursive: true, force: true });
}

/** Delete an environment's YAML files from disk. */
export async function deleteEnvironmentFiles(root: string, envName: string): Promise<void> {
  const envDir = environmentsDir(root);
  const filesToDelete = [
    path.join(envDir, `${envName}.yaml`),
    path.join(envDir, `${envName}.secret.yaml`),
    path.join(envDir, `${envName}.secret.yaml.template`),
  ];
  for (const f of filesToDelete) {
    await fs.promises.rm(f, { force: true }).catch(() => {});
  }
}

/** Rename an environment's YAML files on disk. */
export async function renameEnvironmentFiles(root: string, oldName: string, newName: string): Promise<void> {
  const envDir = environmentsDir(root);
  const renames: [string, string][] = [
    [`${oldName}.yaml`, `${newName}.yaml`],
    [`${oldName}.secret.yaml`, `${newName}.secret.yaml`],
    [`${oldName}.secret.yaml.template`, `${newName}.secret.yaml.template`],
  ];
  for (const [from, to] of renames) {
    const src = path.join(envDir, from);
    if (await fileExists(src)) {
      await fs.promises.rename(src, path.join(envDir, to));
    }
  }
}

/** Check if a directory contains a workspace (has workspace.yaml). */
export async function isV5Workspace(root: string): Promise<boolean> {
  return fileExists(path.join(root, 'workspace.yaml'));
}

// ── Internal helpers ───────────────────────────────────────────────

/** Recursively find all item folders (containing a specific marker file) and call a handler. */
async function findItemFolders(
  dir: string,
  markerFile: string,
  handler: (itemDir: string) => Promise<void>,
): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const subDir = path.join(dir, entry.name);

    if (await fileExists(path.join(subDir, markerFile))) {
      await handler(subDir);
    } else {
      // Recurse into subdirectories (collection/folder hierarchy)
      await findItemFolders(subDir, markerFile, handler);
    }
  }
}
