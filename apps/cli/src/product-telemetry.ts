/**
 * Product-telemetry host adapter for the CLI (`TELEMETRY_PLAN.md` §2/§7)
 * — the short-lived-process sibling of the extension SW and desktop main
 * adapters. One `oh` invocation is one session: the id and latches live
 * in the controller's in-memory store, and the host-owned cadence is a
 * single best-effort flush on exit (the transport aborts quickly so a
 * slow network can never hold a finished command hostage).
 *
 * Gates: `OH_TELEMETRY` env var (`0`/`false`/`off` kills the channel;
 * any other value forces it on) → `telemetry` key in `cli.json` →
 * default on. No runtime notice: the disclosure lives in the docs and
 * the privacy page, and the terminal stays quiet. Disabled runs skip
 * the channel entirely (nothing is collected).
 *
 * Every telemetry failure is silent — a broken config file or an
 * unreachable endpoint must never change a command's outcome.
 */

import {
  createInMemoryProductTelemetryInstallStore,
  createInMemoryProductTelemetrySessionStore,
  mintTelemetryInstallId,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetryInstallStore,
  parseTelemetryAppVersion,
  type TelemetryChannelId,
  type TelemetryEnvelope,
  type TelemetryEvent,
  type TelemetryPlatform,
  type TelemetryTransport,
} from '@openheaders/core/telemetry';
import { type CliConfig, cliConfigPath, readCliConfig, writeCliConfig } from './config-store';
import { CLI_VERSION } from './version';

export const TELEMETRY_ENV = 'OH_TELEMETRY';

const FLUSH_ABORT_MS = 500;

export interface CliProductTelemetry {
  /** Best-effort exit flush; never throws, never blocks past the transport abort. */
  finish(): Promise<void>;
}

export interface CliProductTelemetryDeps {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  cliVersion?: string;
  /** Distribution channel stamped on `first_run`; defaults to detection from the running script's path. */
  channel?: TelemetryChannelId;
  configPath?: string;
  /** Test seams; production uses the aborting fetch transport + wall clock. */
  transport?: TelemetryTransport;
  now?: () => number;
}

/**
 * Where this `oh` came from — a static fact of the installed path
 * (Homebrew cellar vs an npm `node_modules` tree), never a request.
 *
 * Standalone builds embed their entry script in the executable, so
 * `argv[1]` is a virtual bundle path (Bun's `$bunfs`/`~BUN` roots) or
 * the executable itself (Node SEA) — for those the installed binary's
 * own location is the channel fact. A compiled binary outside a
 * package manager's tree can only have come from the release feed
 * (`install.sh`/`install.ps1` or a manual download).
 */
export function detectCliChannel(scriptPath: string, execPath = ''): TelemetryChannelId {
  // Cellar before node_modules: the formula's libexec tree contains one.
  // node_modules before the /homebrew/ residual: `npm -g` under a
  // Homebrew-installed Node lands in /opt/homebrew/lib/node_modules and
  // is an npm install, not a formula.
  if (scriptPath.includes('/Cellar/')) return 'brew';
  if (scriptPath.includes('node_modules')) return 'npm';
  if (scriptPath.includes('/homebrew/')) return 'brew';
  const standalone =
    scriptPath.includes('$bunfs') || scriptPath.includes('~BUN') || (execPath !== '' && scriptPath === execPath);
  if (standalone) {
    const binary = execPath.toLowerCase();
    if (binary.includes('/cellar/') || binary.includes('/homebrew/')) return 'brew';
    if (binary.includes('winget')) return 'winget';
    return 'github-release';
  }
  return 'unknown';
}

/**
 * Durable install identity inside `cli.json` (plan §4, amended
 * 2026-07-16). Only constructed for a readable config — an unreadable
 * file is never overwritten, so those runs get a one-invocation
 * in-memory identity instead. Every write is best-effort: a failure
 * means the identity re-mints next run, never that a command breaks.
 */
function createConfigInstallStore(configPath: string): ProductTelemetryInstallStore {
  const load = (): Promise<CliConfig> => readCliConfig(configPath);
  return {
    async getRecord() {
      try {
        const config = await load();
        return typeof config.telemetryInstallId === 'string' && typeof config.telemetryInstalledAt === 'number'
          ? { installId: config.telemetryInstallId, installedAt: config.telemetryInstalledAt }
          : null;
      } catch {
        return null;
      }
    },
    async setRecord(record) {
      try {
        const config = await load();
        await writeCliConfig(configPath, {
          ...config,
          telemetryInstallId: record.installId,
          telemetryInstalledAt: record.installedAt,
        });
      } catch {
        // Unwritable config = identity re-mints next run.
      }
    },
    async clearRecord() {
      try {
        const { telemetryInstallId: _id, telemetryInstalledAt: _at, ...rest } = await load();
        await writeCliConfig(configPath, rest);
      } catch {
        // Nothing readable to clear.
      }
    },
    async wasFirstRunSent() {
      try {
        return (await load()).telemetryFirstRunSent === true;
      } catch {
        // When in doubt, never re-announce an install.
        return true;
      }
    },
    async markFirstRunSent() {
      try {
        const config = await load();
        await writeCliConfig(configPath, { ...config, telemetryFirstRunSent: true });
      } catch {
        // Best effort; a repeat first_run beats a broken command.
      }
    },
  };
}

/** `OH_TELEMETRY` decides when set; otherwise the config key; otherwise on. */
export function readTelemetryEnabled(env: NodeJS.ProcessEnv, configTelemetry: boolean | undefined): boolean {
  const raw = env[TELEMETRY_ENV];
  if (raw !== undefined && raw !== '') {
    return !['0', 'false', 'off'].includes(raw.toLowerCase());
  }
  return configTelemetry !== false;
}

function telemetryPlatform(platform: NodeJS.Platform): TelemetryPlatform | null {
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'win';
  if (platform === 'linux') return 'linux';
  return null;
}

function buildSessionStart(platform: NodeJS.Platform, cliVersion: string): TelemetryEvent | null {
  const mapped = telemetryPlatform(platform);
  if (!mapped) return null;
  return {
    name: 'session_start',
    appVersion: parseTelemetryAppVersion(cliVersion),
    platform: mapped,
    locale: 'en',
  };
}

// One envelope per process, so the abort guard is per-call disposable.
const abortingFetchTransport: TelemetryTransport = {
  async send(envelope: TelemetryEnvelope): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FLUSH_ABORT_MS);
    try {
      const response = await fetch(PRODUCT_TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      return response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

const inert: CliProductTelemetry = { finish: async () => undefined };

/**
 * Boot the channel for this invocation: resolve the gates, print the
 * first-run notice when owed, and queue `session_start`. Returns the
 * exit-flush handle; every failure path degrades to the inert handle.
 */
export async function bootCliProductTelemetry(deps: CliProductTelemetryDeps = {}): Promise<CliProductTelemetry> {
  try {
    const env = deps.env ?? process.env;
    const configPath = deps.configPath ?? cliConfigPath();
    let config: CliConfig = {};
    let configReadable = true;
    try {
      config = await readCliConfig(configPath);
    } catch {
      // A malformed file counts as empty here; the command's own config
      // read raises the loud fix-or-delete error.
      configReadable = false;
    }
    if (!readTelemetryEnabled(env, config.telemetry)) {
      // Off means no identity: a disabled run wipes any stored install
      // id (the first_run sent-bit stays — it carries no identity).
      if (configReadable && (config.telemetryInstallId !== undefined || config.telemetryInstalledAt !== undefined)) {
        const { telemetryInstallId: _id, telemetryInstalledAt: _at, ...rest } = config;
        await writeCliConfig(configPath, rest).catch(() => undefined);
      }
      return inert;
    }

    const now = deps.now ?? Date.now;
    // An unreadable config gets a one-invocation in-memory identity
    // (pre-latched so it never announces a first_run) — the file is
    // never overwritten; the command's own read raises the loud error.
    const installStore = configReadable
      ? createConfigInstallStore(configPath)
      : createInMemoryProductTelemetryInstallStore({ installId: mintTelemetryInstallId(), installedAt: now() });
    const controller = new ProductTelemetryController({
      transport: deps.transport ?? abortingFetchTransport,
      now,
      sessionStore: createInMemoryProductTelemetrySessionStore(),
      installStore,
      host: 'cli',
      channel: deps.channel ?? detectCliChannel(process.argv[1] ?? '', process.execPath),
      getEnabled: () => true,
      subscribeEnabled: () => undefined,
      buildSessionStart: async () =>
        buildSessionStart(deps.platform ?? process.platform, deps.cliVersion ?? CLI_VERSION),
    });
    await controller.init();

    return {
      finish: async () => {
        await controller.flush().catch(() => undefined);
      },
    };
  } catch {
    return inert;
  }
}
