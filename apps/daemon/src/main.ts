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
import { existsSync, promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type HostLogger, setHostLogger } from '@openheaders/core/logger';
import { OH } from '@openheaders/core/storage';
import { bootDaemonSpine } from '@openheaders/oracle-host-node/daemon';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import { formatBuildStamp, getBuildInfo } from './build-info';
import { resolveDaemonConfig } from './config';
import { createDaemonLogger } from './logger';
import { noCipherYet } from './no-cipher';
import { createDaemonStatusStore } from './status-store';

const SCOPE = 'oh-daemon';

const appVersion: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

// Boot-failure lines must land somewhere even when config resolution
// itself throws; the resolved level replaces this default in `main`.
let log: HostLogger = createDaemonLogger({ level: 'info' });

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

/**
 * The directory the static web route serves, or undefined for no route.
 * An explicitly configured root must hold an `index.html` — a typo'd
 * path refuses to boot rather than silently serving 404s. Without
 * config, the `web/` dir shipped beside the daemon bundle is served
 * when present (the packed distribution stages the web app there); a
 * bare dev build has none and the daemon runs web-less, exactly as
 * before Phase 4a.
 */
function resolveStaticWebRoot(configured: string | null): { rootDir: string } | undefined {
  if (configured !== null) {
    if (!existsSync(path.join(configured, 'index.html'))) {
      throw new Error(`web root ${configured} does not contain an index.html`);
    }
    return { rootDir: configured };
  }
  const bundled = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
  return existsSync(path.join(bundled, 'index.html')) ? { rootDir: bundled } : undefined;
}

async function main(): Promise<void> {
  const config = resolveDaemonConfig({ argv: process.argv.slice(2), env: process.env });
  log = createDaemonLogger({ level: config.logLevel });
  setHostLogger(log);
  await fs.mkdir(config.dataDir, { recursive: true });

  const hostStorage = new FileBackedHostStorage({
    filePath: path.join(config.dataDir, 'storage.json'),
    secretCipher: noCipherYet,
    log: (level, msg, ...rest) => log[level](SCOPE, msg, ...rest),
  });

  // Seed the bind the supervisor watches. The config file/argv is the
  // daemon's UI; the settings record is the spine's contract.
  const settings = (await hostStorage.get(OH.settingsUser)) ?? {};
  await hostStorage.set(OH.settingsUser, {
    ...settings,
    'backend.bindAddress': config.bindAddress,
    'backend.bindPort': config.bindPort,
  });

  const staticWeb = resolveStaticWebRoot(config.webRoot);

  const proxyNote = config.trustedProxy ? ', behind trusted proxy' : '';
  const hostsNote = config.allowedHosts.length > 0 ? `, allowed hosts ${config.allowedHosts.join(' ')}` : '';
  const webNote = staticWeb ? `, web ui from ${staticWeb.rootDir}` : '';
  const oidcNote = config.oidc ? `, sso via ${config.oidc.issuer}` : '';
  log.info(
    SCOPE,
    `starting v${appVersion}${formatBuildStamp(getBuildInfo())} — data dir ${config.dataDir}, bind ${config.bindAddress}:${config.bindPort}${proxyNote}${hostsNote}${webNote}${oidcNote}`,
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
    admission: {
      trustedProxy: config.trustedProxy,
      allowedHosts: config.allowedHosts,
    },
    ...(config.oidc ? { oidc: config.oidc } : {}),
    staticWeb,
    broadcastLocal: () => {
      // No same-process surfaces yet — the served web app (Phase 4)
      // joins over the WS sync protocol like every other peer.
    },
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(SCOPE, `${signal} — shutting down`);
    void spine
      .dispose()
      .catch((err: unknown) => {
        log.error(SCOPE, 'dispose failed', err);
      })
      .finally(() => {
        process.exit(0);
      });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  log.error(SCOPE, 'boot failed', err);
  process.exit(1);
});
