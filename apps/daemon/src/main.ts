/**
 * Standalone daemon entry point — boot the shared spine headless.
 *
 * The daemon is the desktop app minus the GUI (UNIFIED_ORACLE_MODEL.md
 * §3): the same `bootDaemonSpine` the desktop main process calls, with
 * the headless edges injected — plain file-backed host storage, a local
 * status store, a no-op surface broadcast (no renderer exists until the
 * served web app, Phase 4), and the platform state dir as the data dir.
 *
 * The configured bind is seeded into the `backend.bindAddress` /
 * `backend.bindPort` settings the spine's bind supervisor watches — one
 * bind contract for both distributions, and a future admin surface can
 * rebind at runtime through the same settings the desktop UI writes.
 *
 * Secrets: no OS-keychain cipher is wired yet (a passphrase/keytar
 * cipher is a Phase 2/3 concern), so the storage backend REFUSES
 * sensitive slots rather than writing them plaintext — same posture as
 * desktop-on-Linux without a keyring.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { setHostLogger } from '@openheaders/core/logger';
import { OH } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import { bootDaemonSpine } from '@openheaders/oracle-host-node/daemon';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import { resolveDaemonConfig } from './config';
import { createDaemonStatusStore } from './status-store';

const SCOPE = 'oh-daemon';

const appVersion: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

/**
 * No cipher until the daemon grows a passphrase/keychain story: report
 * unavailable so `FileBackedHostStorage` refuses sensitive slots
 * instead of downgrading them to plaintext on disk.
 */
const noCipherYet: SecretCipher = {
  isAvailable: () => false,
  encrypt() {
    throw new Error('secret cipher not configured');
  },
  decrypt() {
    throw new Error('secret cipher not configured');
  },
};

function safeOsUsername(): string {
  try {
    return os.userInfo().username || 'Local';
  } catch {
    return 'Local';
  }
}

function safeOsHostname(): string {
  try {
    return os.hostname().replace(/\.local$/, '') || 'Local';
  } catch {
    return 'Local';
  }
}

async function main(): Promise<void> {
  setHostLogger(consoleLogger);
  const config = resolveDaemonConfig({ argv: process.argv.slice(2), env: process.env });
  await fs.mkdir(config.dataDir, { recursive: true });

  const hostStorage = new FileBackedHostStorage({
    filePath: path.join(config.dataDir, 'storage.json'),
    secretCipher: noCipherYet,
    log: (level, msg, ...rest) => consoleLogger[level](SCOPE, msg, ...rest),
  });

  // Seed the bind the supervisor watches. The config file/argv is the
  // daemon's UI; the settings record is the spine's contract.
  const settings = (await hostStorage.get(OH.settingsUser)) ?? {};
  await hostStorage.set(OH.settingsUser, {
    ...settings,
    'backend.bindAddress': config.bindAddress,
    'backend.bindPort': config.bindPort,
  });

  consoleLogger.info(
    SCOPE,
    `starting v${appVersion} — data dir ${config.dataDir}, bind ${config.bindAddress}:${config.bindPort}`,
  );

  const spine = await bootDaemonSpine({
    dataDir: config.dataDir,
    appVersion,
    identity: {
      hostKind: 'daemon',
      displayName: safeOsUsername(),
      orgName: safeOsHostname(),
    },
    handshakeIdentity: {
      role: 'daemon',
      nodeId: `daemon-${randomUUID()}`,
      agent: `@openheaders/daemon@${appVersion}`,
    },
    localAppId: 'daemon',
    hostStorage,
    status: createDaemonStatusStore(),
    broadcastLocal: () => {
      // No same-process surfaces yet — the served web app (Phase 4)
      // joins over the WS sync protocol like every other peer.
    },
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    consoleLogger.info(SCOPE, `${signal} — shutting down`);
    void spine
      .dispose()
      .catch((err: unknown) => {
        consoleLogger.error(SCOPE, 'dispose failed', err);
      })
      .finally(() => {
        process.exit(0);
      });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  consoleLogger.error(SCOPE, 'boot failed', err);
  process.exit(1);
});
