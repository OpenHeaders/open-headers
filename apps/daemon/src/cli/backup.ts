/**
 * `ohd backup / restore` — command plumbing over the sqlite-free
 * core in `backup-manifest.ts`. Like `audit`, this module is loaded
 * via dynamic import from `cli.ts`: it is the only backup path that
 * reaches better-sqlite3 (through the oracle-host-node snapshot
 * helper), so it becomes its own chunk and the entry bundle stays
 * sqlite-free by construction.
 *
 * Both commands run OFFLINE by contract — not because they write
 * `storage.json` (backup doesn't), but because a consistent snapshot
 * spans three stores (`storage.json`, `oracle.db`, `blobs/`) that only
 * a stopped daemon holds mutually still.
 */

import { createRequire } from 'node:module';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { snapshotSqliteDatabase } from '@openheaders/oracle-host-node/sync/sqlite-snapshot';
import { getBuildInfo } from '../build-info';
import { existingStateFiles, restoreSnapshot, verifySnapshot, writeSnapshot } from './backup-manifest';
import { CONFIG_OPTIONS, resolveConfigFlags } from './config-flags';
import { assertDaemonStopped } from './daemon-stopped';

function daemonVersion(): string {
  const fromBuild = getBuildInfo()?.version;
  if (fromBuild !== undefined) return fromBuild;
  return (createRequire(import.meta.url)('../../package.json') as { version: string }).version;
}

function defaultDestDir(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `openheaders-daemon-backup-${stamp}`;
}

export async function commandBackup(argv: readonly string[]): Promise<void> {
  const { values, positionals } = parseArgs({ args: [...argv], options: CONFIG_OPTIONS, allowPositionals: true });
  const config = resolveConfigFlags(values);
  const destDir = path.resolve(positionals[0] ?? defaultDestDir());
  await assertDaemonStopped(
    config,
    'A snapshot copied under a live daemon would tear across storage.json, oracle.db, and blobs/.',
  );
  const manifest = await writeSnapshot({
    dataDir: config.dataDir,
    destDir,
    daemonVersion: daemonVersion(),
    snapshotDatabase: snapshotSqliteDatabase,
  });
  const totalBytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  console.log(`Backup written: ${destDir}`);
  console.log(`  ${manifest.files.length} file(s), ${totalBytes} bytes, daemon v${manifest.daemonVersion}`);
  console.log('');
  console.log('Restore with:');
  console.log(`  ohd restore ${destDir}`);
}

export async function commandRestore(argv: readonly string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: { ...CONFIG_OPTIONS, force: { type: 'boolean' } },
    allowPositionals: true,
  });
  const config = resolveConfigFlags(values);
  const snapshotDir = positionals[0];
  if (snapshotDir === undefined) throw new Error('usage: ohd restore <backup-dir> [--force]');
  await assertDaemonStopped(
    config,
    'Restored files under a live daemon would be clobbered by its next storage.json flush.',
  );
  const manifest = await verifySnapshot(path.resolve(snapshotDir));
  const existing = await existingStateFiles(config.dataDir);
  if (existing.length > 0 && !values.force) {
    throw new Error(
      `the data dir ${config.dataDir} already holds ${existing.join(', ')} — ` +
        'pass --force to replace them with the snapshot (back the current state up first).',
    );
  }
  const restored = await restoreSnapshot(path.resolve(snapshotDir), config.dataDir, manifest);
  console.log(`Restored ${restored.length} file(s) into ${config.dataDir}`);
  console.log(`  snapshot from ${manifest.createdAt} (daemon v${manifest.daemonVersion})`);
  console.log('');
  console.log('Start the daemon: ohd start');
}
