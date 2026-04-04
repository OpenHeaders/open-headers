/**
 * V5StorageService — reads and writes the v5 directory tree structure.
 *
 * Directory layout:
 *   workspace-root/
 *   ├── .openheaders/
 *   │   ├── workspace.json          # WorkspaceManifest
 *   │   ├── globals.json            # GlobalsFile
 *   │   └── vault.enc               # VaultFile (.gitignored)
 *   ├── collections/
 *   │   └── <name>/
 *   │       ├── collection.json     # CollectionFile
 *   │       └── <folder>/
 *   │           └── <name>.request.json
 *   ├── rules/
 *   │   └── <tag>--<name>.rule.json
 *   ├── environments/
 *   │   └── <name>.env.json
 *   ├── environments.local/
 *   │   └── <name>.values.json      # (.gitignored)
 *   └── .gitignore
 *
 * All reads/writes use atomicWriter for crash safety.
 * This module is pure I/O — no business logic, no state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { V5 } from '@openheaders/core/types';
import atomicWriter from '@/utils/atomicFileWriter';
import mainLogger from '@/utils/mainLogger';

const { createLogger } = mainLogger;
const log = createLogger('V5StorageService');

// ── Path helpers ───────────────────────────────────────────────────

function ohDir(root: string): string {
  return path.join(root, '.openheaders');
}
function collectionsDir(root: string): string {
  return path.join(root, 'collections');
}
function rulesDir(root: string): string {
  return path.join(root, 'rules');
}
function environmentsDir(root: string): string {
  return path.join(root, 'environments');
}
function environmentsLocalDir(root: string): string {
  return path.join(root, 'environments.local');
}

// ── Ensure directory exists ────────────────────────────────────────

async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

// ── Slugify helper ─────────────────────────────────────────────────

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Read helpers ───────────────────────────────────────────────────

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    return await atomicWriter.readJson<T>(filePath);
  } catch {
    return null;
  }
}

async function listJsonFiles(dirPath: string, suffix: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dirPath);
    return entries.filter((e) => e.endsWith(suffix)).map((e) => path.join(dirPath, e));
  } catch {
    return [];
  }
}

async function listSubdirectories(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}

// ── Workspace manifest ─────────────────────────────────────────────

export async function readWorkspaceManifest(root: string): Promise<V5.WorkspaceManifest | null> {
  return readJsonSafe<V5.WorkspaceManifest>(path.join(ohDir(root), 'workspace.json'));
}

export async function writeWorkspaceManifest(root: string, manifest: V5.WorkspaceManifest): Promise<void> {
  await ensureDir(ohDir(root));
  await atomicWriter.writeJson(path.join(ohDir(root), 'workspace.json'), manifest, { pretty: true });
}

// ── Globals ────────────────────────────────────────────────────────

export async function readGlobals(root: string): Promise<V5.Globals> {
  const data = await readJsonSafe<V5.GlobalsFile>(path.join(ohDir(root), 'globals.json'));
  return { variables: data?.variables ?? [] };
}

export async function writeGlobals(root: string, globals: V5.Globals): Promise<void> {
  await ensureDir(ohDir(root));
  const file: V5.GlobalsFile = { version: V5.STORAGE_VERSION, variables: globals.variables };
  await atomicWriter.writeJson(path.join(ohDir(root), 'globals.json'), file, { pretty: true });
}

// ── Vault ──────────────────────────────────────────────────────────
// NOTE: In production, vault.enc should be encrypted at rest.
// For Phase 1, we store as plain JSON (same security as v4 environments.json).
// Encryption will be added in a follow-up.

export async function readVault(root: string): Promise<V5.Vault> {
  const data = await readJsonSafe<V5.VaultFile>(path.join(ohDir(root), 'vault.enc'));
  return data?.vault ?? { secrets: [] };
}

export async function writeVault(root: string, vault: V5.Vault): Promise<void> {
  await ensureDir(ohDir(root));
  const file: V5.VaultFile = { version: V5.STORAGE_VERSION, vault };
  await atomicWriter.writeJson(path.join(ohDir(root), 'vault.enc'), file, { pretty: true });
}

// ── Collections ────────────────────────────────────────────────────

export async function readCollection(collectionDir: string): Promise<V5.Collection | null> {
  return readJsonSafe<V5.Collection>(path.join(collectionDir, 'collection.json'));
}

export async function writeCollection(root: string, collection: V5.Collection): Promise<void> {
  const dir = path.join(collectionsDir(root), slugify(collection.name));
  await ensureDir(dir);
  const file: V5.CollectionFile = { version: V5.STORAGE_VERSION, ...collection };
  await atomicWriter.writeJson(path.join(dir, 'collection.json'), file, { pretty: true });
}

export async function readAllCollections(root: string): Promise<V5.CollectionWithTree[]> {
  const collDirs = await listSubdirectories(collectionsDir(root));
  const collections: V5.CollectionWithTree[] = [];

  for (const collDir of collDirs) {
    const collection = await readCollection(collDir);
    if (!collection) continue;

    const tree = await buildCollectionTree(collDir);
    collections.push({ ...collection, tree });
  }

  return collections;
}

async function buildCollectionTree(dir: string): Promise<V5.CollectionNode[]> {
  const nodes: V5.CollectionNode[] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'collection.json') continue;

      if (entry.isDirectory()) {
        const children = await buildCollectionTree(path.join(dir, entry.name));
        nodes.push({
          type: 'folder',
          id: `folder-${slugify(entry.name)}`,
          name: entry.name,
          children,
        });
      } else if (entry.name.endsWith('.request.json')) {
        const request = await readJsonSafe<V5.Request>(path.join(dir, entry.name));
        if (request) {
          nodes.push({
            type: 'request',
            id: request.id,
            name: request.name,
            method: request.method,
          });
        }
      }
    }
  } catch {
    // Directory might not exist yet
  }

  return nodes;
}

// ── Requests ───────────────────────────────────────────────────────

export async function readRequest(requestPath: string): Promise<V5.Request | null> {
  return readJsonSafe<V5.Request>(requestPath);
}

/**
 * Read all requests from all collections in the workspace.
 * Recursively scans for .request.json files.
 */
export async function readAllRequests(root: string): Promise<V5.Request[]> {
  const requests: V5.Request[] = [];
  await findRequestFiles(collectionsDir(root), requests);
  return requests;
}

async function findRequestFiles(dir: string, results: V5.Request[]): Promise<void> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findRequestFiles(fullPath, results);
      } else if (entry.name.endsWith('.request.json')) {
        const req = await readJsonSafe<V5.Request>(fullPath);
        if (req) results.push(req);
      }
    }
  } catch {
    // Directory might not exist
  }
}

export async function writeRequest(
  root: string,
  collectionName: string,
  folderPath: string[],
  request: V5.Request,
): Promise<void> {
  const dir = path.join(collectionsDir(root), slugify(collectionName), ...folderPath.map(slugify));
  await ensureDir(dir);
  const fileName = `${slugify(request.name)}.request.json`;
  const file: V5.RequestFile = { version: V5.STORAGE_VERSION, ...request };
  await atomicWriter.writeJson(path.join(dir, fileName), file, { pretty: true });
}

// ── Rules ──────────────────────────────────────────────────────────

export async function readAllRules(root: string): Promise<V5.Rule[]> {
  const files = await listJsonFiles(rulesDir(root), '.rule.json');
  const rules: V5.Rule[] = [];

  for (const filePath of files) {
    const rule = await readJsonSafe<V5.Rule>(filePath);
    if (rule) rules.push(rule);
  }

  return rules;
}

export async function writeRule(root: string, rule: V5.Rule): Promise<void> {
  await ensureDir(rulesDir(root));
  const tag = rule.tags.length > 0 ? slugify(rule.tags[0]) : 'untagged';
  const name = slugify(rule.name || rule.id);
  const fileName = `${tag}--${name}.rule.json`;
  const file: V5.RuleFile = { version: V5.STORAGE_VERSION, ...rule };
  await atomicWriter.writeJson(path.join(rulesDir(root), fileName), file, { pretty: true });
}

export async function writeAllRules(root: string, rules: V5.Rule[]): Promise<void> {
  await ensureDir(rulesDir(root));
  for (const rule of rules) {
    await writeRule(root, rule);
  }
}

// ── Environments ───────────────────────────────────────────────────

export async function readAllEnvironments(root: string): Promise<V5.Environment[]> {
  const envFiles = await listJsonFiles(environmentsDir(root), '.env.json');
  const valueFiles = await listJsonFiles(environmentsLocalDir(root), '.values.json');

  // Build lookup of local values by environment ID
  const valueLookup = new Map<string, Record<string, string>>();
  for (const valFile of valueFiles) {
    const data = await readJsonSafe<V5.EnvironmentLocalValues>(valFile);
    if (data) valueLookup.set(data.environmentId, data.values);
  }

  const environments: V5.Environment[] = [];
  for (const envFile of envFiles) {
    const manifest = await readJsonSafe<V5.EnvironmentManifest>(envFile);
    if (!manifest) continue;

    const localValues = valueLookup.get(manifest.id) ?? {};

    const variables: V5.Variable[] = manifest.variables.map((def) => ({
      name: def.name,
      value: localValues[def.name] ?? '',
      type: def.type,
      source: def.source,
    }));

    environments.push({
      id: manifest.id,
      name: manifest.name,
      variables,
      isActive: false, // caller sets the active environment
    });
  }

  return environments;
}

export async function writeEnvironment(
  root: string,
  env: V5.Environment,
  manifest: V5.EnvironmentManifest,
): Promise<void> {
  // Write manifest (synced)
  await ensureDir(environmentsDir(root));
  const envFile: V5.EnvironmentFile = { version: V5.STORAGE_VERSION, ...manifest };
  await atomicWriter.writeJson(path.join(environmentsDir(root), `${slugify(env.name)}.env.json`), envFile, {
    pretty: true,
  });

  // Write local values (gitignored)
  await ensureDir(environmentsLocalDir(root));
  const values: Record<string, string> = {};
  for (const v of env.variables) {
    values[v.name] = v.value;
  }
  const valuesFile: V5.EnvironmentValuesFile = {
    version: V5.STORAGE_VERSION,
    environmentId: env.id,
    values,
  };
  await atomicWriter.writeJson(path.join(environmentsLocalDir(root), `${slugify(env.name)}.values.json`), valuesFile, {
    pretty: true,
  });
}

// ── Gitignore ──────────────────────────────────────────────────────

export async function writeGitignore(root: string): Promise<void> {
  const gitignorePath = path.join(root, '.gitignore');
  try {
    await fs.promises.access(gitignorePath);
    // File exists — don't overwrite
  } catch {
    await fs.promises.writeFile(gitignorePath, V5.V5_GITIGNORE, 'utf-8');
  }
}

// ── Full workspace write (used by migration) ──────────────────────

export interface V5WorkspaceWriteData {
  manifest: V5.WorkspaceManifest;
  globals: V5.Globals;
  vault: V5.Vault;
  collections: Array<{
    collection: V5.Collection;
    requests: V5.Request[];
    tree: V5.CollectionNode[];
    folderPaths: Map<string, string[]>;
  }>;
  rules: V5.Rule[];
  environments: V5.Environment[];
  environmentManifests: V5.EnvironmentManifest[];
}

export async function writeFullWorkspace(root: string, data: V5WorkspaceWriteData): Promise<void> {
  log.info(`Writing v5 workspace to ${root}`);

  await writeWorkspaceManifest(root, data.manifest);
  await writeGlobals(root, data.globals);
  await writeVault(root, data.vault);
  await writeGitignore(root);

  for (const coll of data.collections) {
    await writeCollection(root, coll.collection);
    for (const request of coll.requests) {
      const folderPath = coll.folderPaths.get(request.id) ?? [];
      await writeRequest(root, coll.collection.name, folderPath, request);
    }
  }

  await writeAllRules(root, data.rules);

  for (let i = 0; i < data.environments.length; i++) {
    await writeEnvironment(root, data.environments[i], data.environmentManifests[i]);
  }

  log.info(
    `v5 workspace written: ${data.collections.length} collections, ${data.rules.length} rules, ${data.environments.length} environments`,
  );
}

// ── Detection ──────────────────────────────────────────────────────

/**
 * Check if a directory contains a v5 workspace.
 */
export async function isV5Workspace(root: string): Promise<boolean> {
  try {
    await fs.promises.access(path.join(ohDir(root), 'workspace.json'));
    return true;
  } catch {
    return false;
  }
}
