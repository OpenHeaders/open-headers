/**
 * Daemon boot — the shared spine brought up headless, callable from
 * both faces of the distribution: the `dist/main.js` entry (service
 * units exec it directly) and `ohd run` (foreground run, and the
 * only daemon entry inside the single-binary SEA build, which has no
 * separate main.js to exec).
 *
 * The daemon is the desktop app minus the GUI (the unified-oracle model
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
 * Secrets: with `OH_DAEMON_VAULT_PASSPHRASE` (or `_FILE`) configured,
 * sensitive slots encrypt through the passphrase-derived vault cipher —
 * a wrong passphrase refuses to boot at the unlock check, never
 * silently re-keys. Unconfigured, the storage backend REFUSES sensitive
 * slots rather than writing them plaintext — same posture as
 * desktop-on-Linux without a keyring.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type HostLogger, setHostLogger } from '@openheaders/core/logger';
import { OH } from '@openheaders/core/storage';
import { bootDaemonSpine, installNodeSystemProxy } from '@openheaders/oracle-host-node/daemon';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import {
  loadOrCreateSealKeyFile,
  TRAFFIC_SEAL_KEY_FILE_DAEMON,
  trafficSealKeyConfigSegments,
} from '@openheaders/oracle-host-node/traffic';
import { installDaemonAutoUpdate } from './auto-update';
import { formatBuildStamp, getBuildInfo, resolveAppVersion } from './build-info';
import { DAEMON_CHANGELOG } from './changelog';
import { AUDIT_RETENTION_DEFAULT_DAYS, resolveDaemonConfig } from './config';
import { installH3HelperLocator } from './h3-helper-path';
import { createDaemonLogger } from './logger';
import { type RuntimeManifestWriter, runtimeConfigSnapshot, startRuntimeManifest } from './runtime-manifest';
import { installScriptRuntime } from './script-sandbox/install';
import { ensureSeaPayload } from './sea/payload';
import { createDaemonStatusStore } from './status-store';
import { resolveDaemonCipher } from './vault-cipher';

const SCOPE = 'oh-daemon';

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
 * config, the SEA build unpacks the web payload embedded in the binary
 * (when the pack staged one), and the plain-Node distribution serves
 * the `web/` dir shipped beside the daemon bundle when present; a bare
 * dev build has neither and the daemon runs web-less, exactly as
 * before Phase 4a.
 */
function resolveStaticWebRoot(configured: string | null): { rootDir: string } | undefined {
  if (configured !== null) {
    if (!existsSync(path.join(configured, 'index.html'))) {
      throw new Error(`web root ${configured} does not contain an index.html`);
    }
    return { rootDir: configured };
  }
  const unpacked = ensureSeaPayload('web');
  if (unpacked !== null && existsSync(path.join(unpacked, 'index.html'))) {
    return { rootDir: unpacked };
  }
  // "Beside the daemon bundle" anchors on the entry script, not this
  // module — the bundler places this module in a chunk, and both
  // entries (`dist/main.js`, `dist/cli.js`) sit beside the staged
  // `web/` dir. Dev runs enter from `src/`, find no web/ and serve
  // nothing, as before Phase 4a.
  const entryScript = process.argv[1];
  if (entryScript === undefined) return undefined;
  const bundled = path.join(path.dirname(path.resolve(entryScript)), 'web');
  return existsSync(path.join(bundled, 'index.html')) ? { rootDir: bundled } : undefined;
}

/**
 * Boot the daemon and run until a signal. Owns the whole process from
 * the moment it is called — installs the host logger, signal handlers,
 * and exits the process itself on boot failure, so `dist/main.js` and
 * `ohd run` behave identically.
 */
export async function runDaemon(argv: readonly string[]): Promise<void> {
  // Boot-failure lines must land somewhere even when config resolution
  // itself throws; the resolved level replaces this default below.
  let log: HostLogger = createDaemonLogger({ level: 'info' });
  // Declared out here so a boot that fails after the manifest exists
  // still clears it — a file describing a process that died on the way
  // up would read as a live daemon to `ohd status`.
  let runtimeManifest: RuntimeManifestWriter | null = null;
  try {
    const config = resolveDaemonConfig({ argv, env: process.env });
    log = createDaemonLogger({ level: config.logLevel });
    setHostLogger(log);
    // Owner-only data dir — one 0700 on the root shields everything the
    // daemon persists (storage.json, oracle.db, blobs/, logs/) from
    // other local users. chmod tightens installs created before this
    // gate; on Windows both calls are no-ops and ACLs inherit.
    await fs.mkdir(config.dataDir, { recursive: true, mode: 0o700 });
    await fs.chmod(config.dataDir, 0o700);

    const appVersion = resolveAppVersion();
    const hostStorage = new FileBackedHostStorage({
      filePath: path.join(config.dataDir, 'storage.json'),
      secretCipher: resolveDaemonCipher(config),
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

    // Egress system plane (Off / Env / Manual — Env the tier
    // default): a config answer seeds the per-device slot; the mode's
    // resolver registers now so every send (and refresh) resolves under
    // it. Consulted at send time, so ordering against the spine boot
    // never matters.
    const systemProxy = await installNodeSystemProxy({
      hostStorage,
      ...(config.systemProxy !== null ? { configured: config.systemProxy } : {}),
    });

    const staticWeb = resolveStaticWebRoot(config.webRoot);

    // Traffic-session seal key (the agent-traffic plan §9.5): the
    // headless daemon has no OS keychain, so the key lives as a 0600
    // file in the CONFIG dir — deliberately outside the data dir, so a
    // data-dir exfiltration (backup, cloud sync) alone never carries
    // the key that opens the sealed sessions. Same dir convention as
    // the CLI's `openheaders/cli.json`.
    const trafficSealKey = loadOrCreateSealKeyFile(
      path.join(
        ...trafficSealKeyConfigSegments(process.env, os.homedir(), process.platform),
        TRAFFIC_SEAL_KEY_FILE_DAEMON,
      ),
    );

    // HTTP/3 helper: register where this distribution keeps the
    // bundled `oh-h3-helper` (SEA payload / beside the bundle) so a
    // `'3'` send can spawn it — lazy, so nothing unpacks until then.
    installH3HelperLocator();

    const proxyNote = config.trustedProxy ? ', behind trusted proxy' : '';
    const hostsNote = config.allowedHosts.length > 0 ? `, allowed hosts ${config.allowedHosts.join(' ')}` : '';
    const webNote = staticWeb ? `, web ui from ${staticWeb.rootDir}` : '';
    const oidcNote = config.oidc ? `, sso via ${config.oidc.issuer}` : '';
    const vaultNote = config.vaultPassphrase !== null ? ', vault cipher on' : '';
    const auditNote =
      config.auditRetentionDays !== AUDIT_RETENTION_DEFAULT_DAYS
        ? `, audit retention ${config.auditRetentionDays}d`
        : '';
    const forwardNote = config.auditForwarding ? `, audit stream to ${new URL(config.auditForwarding.url).host}` : '';
    const publicNote = config.publicWorkspaces ? ', public workspaces on' : '';
    const licenseNote = config.licenseRefresh ? '' : ', license refresh off';
    const egressNote =
      systemProxy.mode === 'off'
        ? ', egress proxy off'
        : systemProxy.mode === 'manual'
          ? `, egress proxy ${systemProxy.manualProxyUrl ?? 'unset'}`
          : '';
    log.info(
      SCOPE,
      `starting v${appVersion}${formatBuildStamp(getBuildInfo())} — data dir ${config.dataDir}, bind ${config.bindAddress}:${config.bindPort}${proxyNote}${hostsNote}${webNote}${oidcNote}${vaultNote}${auditNote}${forwardNote}${publicNote}${licenseNote}${egressNote}`,
    );
    if (config.bindAddress === '0.0.0.0' && !config.trustedProxy) {
      log.warn(
        SCOPE,
        'serving cleartext HTTP/WS on all interfaces (allowInsecureLan) — auth tokens and pairing secrets are ' +
          'readable by anyone on the network path; use a TLS-terminating reverse proxy for anything beyond a trusted LAN',
      );
    }

    // What this process is actually doing, on disk for `ohd status` to
    // read: opened BEFORE the spine so the first bind attempt — success
    // or failure — is already on record when it resolves.
    runtimeManifest = startRuntimeManifest({
      dataDir: config.dataDir,
      appVersion,
      configPath: config.configPath,
      config: runtimeConfigSnapshot(config),
      onError: (err) => log.warn(SCOPE, 'could not write the runtime manifest; status will report less', err),
    });
    const manifest = runtimeManifest;

    /**
     * A bind this process cannot hold is fatal HERE, unlike in the
     * desktop host: the spine keeps the daemon alive "until the setting
     * is corrected", but a headless daemon whose socket never opened has
     * no surface left to correct it through — it would sit there deaf
     * while the service manager reports a healthy unit. Exiting non-zero
     * names the cause, hands the retry to the service manager's backoff,
     * and leaves the manifest's `failed` bind behind for `ohd status` to
     * explain afterwards.
     */
    const failBind = (host: string, port: number, err: unknown): never => {
      log.error(
        SCOPE,
        `cannot serve on ${host}:${port} — ${err instanceof Error ? err.message : String(err)}. ` +
          'Another process (an earlier daemon instance?) may already hold that port; ' +
          'free it, or choose another with: ohd install --bind-port <port> && ohd restart',
      );
      process.exit(1);
    };

    const spine = await bootDaemonSpine({
      dataDir: config.dataDir,
      appVersion,
      trafficSealKey,
      // Build-embedded release notes for the admin console's card —
      // empty = entry-less build (the card hides).
      changelogNotes: DAEMON_CHANGELOG === '' ? null : DAEMON_CHANGELOG,
      identity: {
        hostKind: 'daemon',
        displayName: safeOsUsername(),
        // The configured server name when the deployment declares one
        // (A9) — the OS hostname is the container id inside a
        // container, and this Org name is what the served tab's
        // awaiting-access screen reads out.
        orgName: config.serverName ?? safeOsHostname(),
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
      onBindStateChange: (state) => {
        manifest.setBind({ state: state.kind, host: state.host, port: state.port });
        if (state.kind === 'failed') failBind(state.host, state.port, state.error);
      },
      // The server claim's front door (the front-door plan §4.3). The
      // code rides the manifest so `ohd status` can print it beside the
      // URLs a browser reaches this daemon at — status enumerates every
      // interface properly, which a log line written before the bind
      // resolves cannot.
      onSetupCodeChange: (code) => {
        manifest.setSetupCode(code);
        if (code === null) return;
        log.info(SCOPE, 'this server is unclaimed — the first browser to reach it creates the admin account');
        log.info(
          SCOPE,
          `  setup code ${code} — needed to claim it from any machine but this one; every restart mints a new one`,
        );
        log.info(SCOPE, '  where to point that browser: ohd status');
      },
      ...(config.oidc ? { oidc: config.oidc } : {}),
      auditRetentionDays: config.auditRetentionDays,
      ...(config.auditForwarding ? { auditForwarding: config.auditForwarding } : {}),
      ...(config.licenseFile !== null ? { licenseFilePath: config.licenseFile } : {}),
      licenseRefresh: config.licenseRefresh,
      personalSeats: config.personalSeats,
      publicWorkspaces: config.publicWorkspaces,
      staticWeb,
      broadcastLocal: () => {
        // No same-process surfaces yet — the served web app (Phase 4)
        // joins over the WS sync protocol like every other peer.
      },
    });

    // Scripted sends need the spine's stores and executor — install
    // after boot. Registers nothing on the SEA binary (honest
    // scriptless posture) or when the runner bundle is absent.
    const scriptRuntime = installScriptRuntime();

    // Unattended auto-update — opt-in (`updates.autoUpdate`, default
    // off) and read at boot like every daemon setting. When armed on a
    // self-managed binary install it stages verified upgrades daily and
    // restarts through the service manager (auto-update.ts).
    const autoUpdate = installDaemonAutoUpdate({
      enabled: settings['updates.autoUpdate'] === true,
      channel: getBuildInfo()?.channel ?? null,
      log,
    });

    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals): void => {
      if (shuttingDown) return;
      shuttingDown = true;
      log.info(SCOPE, `${signal} — shutting down`);
      manifest.dispose();
      autoUpdate.dispose();
      scriptRuntime?.dispose();
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
  } catch (err) {
    runtimeManifest?.dispose();
    log.error(SCOPE, 'boot failed', err);
    process.exit(1);
  }
}
