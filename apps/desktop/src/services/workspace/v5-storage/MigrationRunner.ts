/**
 * MigrationRunner — detects v4 workspaces and migrates them to v5 format.
 *
 * Strategy: writes v5 directory tree alongside the existing v4 flat files.
 * The v4 files are NOT deleted — they serve as a backup until the migration
 * is verified. The v5 storage lives in a `v5/` subdirectory within each
 * workspace directory:
 *
 *   workspaces/<id>/
 *   ├── sources.json          ← v4 (untouched)
 *   ├── rules.json            ← v4 (untouched)
 *   ├── environments.json     ← v4 (untouched)
 *   ├── proxy-rules.json      ← v4 (untouched)
 *   └── v5/                   ← NEW: v5 directory tree
 *       ├── .openheaders/
 *       ├── collections/
 *       ├── rules/
 *       ├── environments/
 *       └── environments.local/
 *
 * This approach:
 * - Never risks corrupting v4 data
 * - Can be re-run safely (idempotent — overwrites v5/ if it exists)
 * - Allows the app to run on v4 data while v5 is being tested
 */

import fs from 'node:fs';
import path from 'node:path';
import type { V5WorkspaceData } from '@openheaders/core/migration';
import { migrateV4toV5 } from '@openheaders/core/migration';
import type { V5 } from '@openheaders/core/types';
import atomicWriter from '@/utils/atomicFileWriter';
import mainLogger from '@/utils/mainLogger';
import type { V5WorkspaceWriteData } from './V5StorageService';
import { isV5Workspace, writeFullWorkspace } from './V5StorageService';

const { createLogger } = mainLogger;
const log = createLogger('MigrationRunner');

// ── Types ──────────────────────────────────────────────────────────

interface WorkspaceInfo {
  id: string;
  name: string;
  type: string;
  dir: string;
}

interface MigrationReport {
  workspaceId: string;
  workspaceName: string;
  success: boolean;
  alreadyMigrated: boolean;
  collections: number;
  rules: number;
  environments: number;
  vaultSecrets: number;
  warnings: string[];
  error?: string;
}

// ── Path helpers ───────────────────────────────────────────────────

function v5Root(workspaceDir: string): string {
  return path.join(workspaceDir, 'v5');
}

// ── Read v4 data ───────────────────────────────────────────────────

async function readJsonSafe<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const data = await atomicWriter.readJson<T>(filePath);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

async function loadV4WorkspaceData(workspaceDir: string): Promise<V5.V4WorkspaceData> {
  const [sources, rulesStorage, environments, proxyRules] = await Promise.all([
    readJsonSafe<V5.V4Source[]>(path.join(workspaceDir, 'sources.json'), []),
    readJsonSafe<V5.V4RulesStorage>(path.join(workspaceDir, 'rules.json'), {
      version: '3.0.0',
      rules: { header: [], request: [], response: [] },
      metadata: { totalRules: 0, lastUpdated: new Date().toISOString() },
    }),
    readJsonSafe<V5.V4EnvironmentsFile>(path.join(workspaceDir, 'environments.json'), {
      environments: { Default: {} },
      activeEnvironment: 'Default',
    }),
    readJsonSafe<V5.V4ProxyRule[]>(path.join(workspaceDir, 'proxy-rules.json'), []),
  ]);

  return { sources, rules: rulesStorage, environments, proxyRules };
}

// ── Convert migration output to write format ───────────────────────

function toWriteData(workspace: V5WorkspaceData, info: WorkspaceInfo): V5WorkspaceWriteData {
  const now = new Date().toISOString();

  const manifest: V5.WorkspaceManifest = {
    version: '5.0.0',
    id: info.id,
    name: info.name,
    type: info.type === 'git' || info.type === 'team' ? 'team' : 'personal',
    migratedFrom: '4.0.0',
    migratedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const collections = workspace.collections.map((c) => ({
    collection: c.collection,
    requests: c.requests,
    tree: c.tree,
    folderPaths: new Map<string, string[]>(),
  }));

  return {
    manifest,
    workspaceVariables: workspace.workspaceVariables,
    vault: workspace.vault,
    collections,
    rules: workspace.rules,
    environments: workspace.environments,
    environmentManifests: workspace.environmentManifests,
  };
}

// ── Check if workspace has v4 data ─────────────────────────────────

async function hasV4Data(workspaceDir: string): Promise<boolean> {
  try {
    // A v4 workspace has at least one of these files
    const files = ['sources.json', 'rules.json', 'environments.json'];
    for (const file of files) {
      try {
        await fs.promises.access(path.join(workspaceDir, file));
        return true;
      } catch {
        // File doesn't exist, try next
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── Migrate a single workspace ─────────────────────────────────────

async function migrateWorkspace(info: WorkspaceInfo): Promise<MigrationReport> {
  const report: MigrationReport = {
    workspaceId: info.id,
    workspaceName: info.name,
    success: false,
    alreadyMigrated: false,
    collections: 0,
    rules: 0,
    environments: 0,
    vaultSecrets: 0,
    warnings: [],
  };

  try {
    const root = v5Root(info.dir);

    // Check if already migrated
    if (await isV5Workspace(root)) {
      report.alreadyMigrated = true;
      report.success = true;
      log.info(`Workspace "${info.name}" (${info.id}) already migrated to v5`);
      return report;
    }

    // Check if there's v4 data to migrate
    if (!(await hasV4Data(info.dir))) {
      log.info(`Workspace "${info.name}" (${info.id}) has no v4 data, skipping`);
      report.success = true;
      return report;
    }

    log.info(`Migrating workspace "${info.name}" (${info.id}) from v4 to v5...`);

    // 1. Read v4 data
    const v4Data = await loadV4WorkspaceData(info.dir);

    // 2. Run migration
    const { workspace, result } = migrateV4toV5(v4Data);

    if (!result.success) {
      report.error = 'Migration function returned failure';
      report.warnings = result.warnings.map((w) => `${w.entity}.${w.field}: ${w.message}`);
      return report;
    }

    // 3. Convert to write format
    const writeData = toWriteData(workspace, info);

    // 4. Write v5 tree
    await writeFullWorkspace(root, writeData);

    // 5. Report
    report.success = true;
    report.collections = workspace.collections.length;
    report.rules = workspace.rules.length;
    report.environments = workspace.environments.length;
    report.vaultSecrets = workspace.vault.secrets.length;
    report.warnings = result.warnings.map((w) => `${w.entity}.${w.field}: ${w.message}`);

    log.info(
      `Workspace "${info.name}" migrated: ${report.collections} collections, ${report.rules} rules, ${report.environments} environments, ${report.vaultSecrets} vault secrets`,
    );

    return report;
  } catch (error: unknown) {
    report.error = error instanceof Error ? error.message : String(error);
    log.error(`Migration failed for workspace "${info.name}":`, report.error);
    return report;
  }
}

// ── Public API ─────────────────────────────────────────────────────

export interface MigrationRunnerResult {
  reports: MigrationReport[];
  totalMigrated: number;
  totalSkipped: number;
  totalFailed: number;
}

export interface MigrationRunnerOptions {
  /** When false, migration is skipped entirely. Controlled by developerMode setting. */
  enabled: boolean;
}

/**
 * Run migration for all workspaces found in the app data directory.
 *
 * Gated by `options.enabled` — when disabled, returns immediately with
 * an empty result. The caller passes the feature flag; the runner owns
 * the decision to skip.
 *
 * Safe to call multiple times — already-migrated workspaces are skipped.
 */
export async function runMigration(
  appDataPath: string,
  options: MigrationRunnerOptions = { enabled: true },
): Promise<MigrationRunnerResult> {
  if (!options.enabled) {
    return { reports: [], totalMigrated: 0, totalSkipped: 0, totalFailed: 0 };
  }

  log.info('Starting v4 → v5 migration preview (developerMode)...');

  const result: MigrationRunnerResult = {
    reports: [],
    totalMigrated: 0,
    totalSkipped: 0,
    totalFailed: 0,
  };

  // Find all workspace directories
  const workspacesDir = path.join(appDataPath, 'workspaces');
  let workspaceIds: string[];
  try {
    workspaceIds = await fs.promises.readdir(workspacesDir);
  } catch {
    log.info('No workspaces directory found, nothing to migrate');
    return result;
  }

  // Load workspace metadata for names
  const configPath = path.join(appDataPath, 'workspaces.json');
  interface WorkspaceConfig {
    workspaces?: Array<{ id: string; name: string; type: string }>;
  }
  const config = await readJsonSafe<WorkspaceConfig>(configPath, { workspaces: [] });
  const workspaceMap = new Map<string, { name: string; type: string }>();
  for (const ws of config.workspaces ?? []) {
    workspaceMap.set(ws.id, { name: ws.name, type: ws.type });
  }

  // Migrate each workspace
  for (const wsId of workspaceIds) {
    const wsDir = path.join(workspacesDir, wsId);
    const stat = await fs.promises.stat(wsDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const meta = workspaceMap.get(wsId) ?? { name: wsId, type: 'personal' };
    const info: WorkspaceInfo = {
      id: wsId,
      name: meta.name,
      type: meta.type,
      dir: wsDir,
    };

    const report = await migrateWorkspace(info);
    result.reports.push(report);

    if (report.alreadyMigrated) {
      result.totalSkipped++;
    } else if (report.success) {
      result.totalMigrated++;
    } else {
      result.totalFailed++;
    }
  }

  log.info(
    `Migration complete: ${result.totalMigrated} migrated, ${result.totalSkipped} skipped, ${result.totalFailed} failed`,
  );

  return result;
}
