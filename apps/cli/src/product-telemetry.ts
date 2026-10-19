/**
 * Product-telemetry host adapter for the CLI (the telemetry plan §2/§7;
 * the error reports plan, fork 4) — the short-lived-process sibling of
 * the extension SW and desktop main adapters. One `oh` invocation is
 * one session: the id and latches live in the controller's in-memory
 * store, SHARED by the two channels (usage counting, then crash and
 * error reports, booted in that order so one id is minted), and the
 * host-owned cadence is a single best-effort flush on exit (the
 * transport aborts quickly so a slow network can never hold a finished
 * command hostage).
 *
 * Gates: `OH_TELEMETRY` env var (`0`/`false`/`off` kills BOTH channels;
 * any other value forces usage counting on) → the `telemetry` and
 * `errorReports` keys in `cli.json`, each independent → default on. No
 * runtime notice: the disclosure lives in the docs and the privacy
 * page, and the terminal stays quiet. A disabled channel skips its
 * work entirely (nothing is collected).
 *
 * Every telemetry failure is silent — a broken config file or an
 * unreachable endpoint must never change a command's outcome.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import {
  createInMemoryProductTelemetryInstallStore,
  createInMemoryProductTelemetrySessionStore,
  createPathOwnOriginTest,
  type ErrorReportContext,
  ErrorReportController,
  type ErrorReportEnvelope,
  type ErrorReportInput,
  type ErrorReportTransport,
  macOsMajorFromDarwinRelease,
  mintTelemetryInstallId,
  PRODUCT_ERROR_REPORTS_ENDPOINT,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  type ProductTelemetryInstallStore,
  parseTelemetryAppVersion,
  type TelemetryChannelId,
  type TelemetryEnvelope,
  type TelemetryEnvelopeFacts,
  type TelemetryEvent,
  type TelemetryPlatform,
  type TelemetryTransport,
  toErrorReport,
  toTelemetryArch,
  windowsMajorFromVersion,
} from '@openheaders/core/telemetry';
import { type CliConfig, cliConfigPath, readCliConfig, writeCliConfig } from './config-store';
import { CLI_VERSION } from './version';

export const TELEMETRY_ENV = 'OH_TELEMETRY';

const FLUSH_ABORT_MS = 500;

export interface CliProductTelemetry {
  /** Best-effort exit flush of both channels; never throws, never blocks past the transport abort. */
  finish(): Promise<void>;
  /** Record one of this invocation's own failures (the error reports plan, fork 4); `finish` delivers it. */
  reportError(input: ErrorReportInput): void;
}

export interface CliProductTelemetryDeps {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  /** The binary's own architecture (`process.arch`); a translated run is indistinguishable here and reads as the binary's. */
  arch?: NodeJS.Architecture;
  /** `os.release()` — the Darwin kernel on macOS, `10.0.<build>` on Windows; only the coarse OS major ever leaves (S35). */
  osRelease?: string;
  cliVersion?: string;
  /** Distribution channel stamped on every envelope; defaults to detection from the running script's path. */
  channel?: TelemetryChannelId;
  configPath?: string;
  /** The running script (`process.argv[1]`) and the executable — the frames under them are ours (law 4). */
  scriptPath?: string;
  execPath?: string;
  /** Test seams; production uses the aborting fetch transports + wall clock. */
  transport?: TelemetryTransport;
  errorTransport?: ErrorReportTransport;
  now?: () => number;
}

function envFlagSet(value: string | undefined): boolean {
  return value !== undefined && value !== '' && !['0', 'false'].includes(value.toLowerCase());
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
 *
 * Two shapes are development by construction and report `dev`: any run
 * under a CI runner (`CI` / `GITHUB_ACTIONS` — the e2e and release
 * smoke legs), and a plain script outside every package-manager tree
 * (a repo checkout's `dist/`). The CLI never reports `unknown`.
 */
export function detectCliChannel(scriptPath: string, execPath = '', env: NodeJS.ProcessEnv = {}): TelemetryChannelId {
  if (envFlagSet(env.CI) || envFlagSet(env.GITHUB_ACTIONS)) return 'dev';
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
  return 'dev';
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

function envTurnsOff(env: NodeJS.ProcessEnv): boolean {
  const raw = env[TELEMETRY_ENV];
  return raw !== undefined && raw !== '' && ['0', 'false', 'off'].includes(raw.toLowerCase());
}

/** `OH_TELEMETRY` decides when set; otherwise the config key; otherwise on. */
export function readTelemetryEnabled(env: NodeJS.ProcessEnv, configTelemetry: boolean | undefined): boolean {
  const raw = env[TELEMETRY_ENV];
  if (raw !== undefined && raw !== '') {
    return !['0', 'false', 'off'].includes(raw.toLowerCase());
  }
  return configTelemetry !== false;
}

/**
 * The second switch (the error reports plan §4.2 law 1): independent of
 * usage counting, but `OH_TELEMETRY` off silences both — one variable
 * for "this process reports nothing". A set env value never forces
 * reports on; the config key still decides.
 */
export function readErrorReportsEnabled(env: NodeJS.ProcessEnv, configErrorReports: boolean | undefined): boolean {
  if (envTurnsOff(env)) return false;
  return configErrorReports !== false;
}

function telemetryPlatform(platform: NodeJS.Platform): TelemetryPlatform | null {
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'win';
  if (platform === 'linux') return 'linux';
  return null;
}

function buildSessionStart(platform: NodeJS.Platform): TelemetryEvent | null {
  // Unmappable platforms skip the event rather than misreport; the
  // per-process facts ride the envelope, so nothing is left to carry.
  return telemetryPlatform(platform) ? { name: 'session_start' } : null;
}

/**
 * The OS major (S35) from the kernel release — the only version read a
 * Node process has without a native call: Darwin's major maps onto the
 * macOS marketing major, Windows resolves 10 vs 11 by build, Linux has
 * no product-meaningful major and stays unstamped.
 */
function telemetryOsMajor(platform: TelemetryPlatform, release: string): number | null {
  if (platform === 'mac') return macOsMajorFromDarwinRelease(release);
  if (platform === 'win') return windowsMajorFromVersion(release);
  return null;
}

/**
 * Per-process envelope facts (plan §3, S15), the same on both channels.
 * The CLI's interface is English-only, so `en` is the honest locale
 * fact — the OS locale is not the interface language and is never read.
 */
function buildEnvelopeFacts(
  channel: TelemetryChannelId,
  platform: NodeJS.Platform,
  arch: NodeJS.Architecture,
  osRelease: string,
  cliVersion: string,
): TelemetryEnvelopeFacts {
  const mapped = telemetryPlatform(platform);
  const mappedArch = toTelemetryArch(arch);
  const osVersion = mapped !== null ? telemetryOsMajor(mapped, osRelease) : null;
  return {
    channel,
    appVersion: parseTelemetryAppVersion(cliVersion),
    locale: 'en',
    ...(mapped !== null ? { platform: mapped } : {}),
    ...(mappedArch !== null ? { arch: mappedArch } : {}),
    ...(osVersion !== null ? { osVersion } : {}),
  };
}

// One envelope per process per channel, so the abort guard is per-call disposable.
function createAbortingTransport<T>(endpoint: string): { send(envelope: T): Promise<boolean> } {
  return {
    async send(envelope: T): Promise<boolean> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FLUSH_ABORT_MS);
      try {
        const response = await fetch(endpoint, {
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
}

const abortingFetchTransport: TelemetryTransport =
  createAbortingTransport<TelemetryEnvelope>(PRODUCT_TELEMETRY_ENDPOINT);
const abortingErrorTransport: ErrorReportTransport =
  createAbortingTransport<ErrorReportEnvelope>(PRODUCT_ERROR_REPORTS_ENDPOINT);

const inert: CliProductTelemetry = { finish: async () => undefined, reportError: () => undefined };

/**
 * Boot both channels for this invocation: resolve the gates, queue
 * `session_start` on the usage channel (no runtime notice — the
 * disclosure lives in the docs, per the module header), arm the error
 * channel on the same session. Returns the exit-flush handle; every
 * failure path degrades to the inert handle.
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
    const usageEnabled = readTelemetryEnabled(env, config.telemetry);
    const errorsEnabled = readErrorReportsEnabled(env, config.errorReports);
    if (!usageEnabled) {
      // Off means no identity: a disabled run wipes any stored install
      // id (the first_run sent-bit stays — it carries no identity).
      if (configReadable && (config.telemetryInstallId !== undefined || config.telemetryInstalledAt !== undefined)) {
        const { telemetryInstallId: _id, telemetryInstalledAt: _at, ...rest } = config;
        await writeCliConfig(configPath, rest).catch(() => undefined);
      }
    }
    if (!usageEnabled && !errorsEnabled) return inert;

    const now = deps.now ?? Date.now;
    const channel = deps.channel ?? detectCliChannel(process.argv[1] ?? '', process.execPath, env);
    const platform = deps.platform ?? process.platform;
    const arch = deps.arch ?? process.arch;
    const osRelease = deps.osRelease ?? os.release();
    const cliVersion = deps.cliVersion ?? CLI_VERSION;
    const facts = () => buildEnvelopeFacts(channel, platform, arch, osRelease, cliVersion);
    // One session for both channels; the usage controller boots first
    // and mints it, the error controller reads it.
    const sessionStore = createInMemoryProductTelemetrySessionStore();

    let usage: ProductTelemetryController | null = null;
    if (usageEnabled) {
      // An unreadable config gets a one-invocation in-memory identity
      // (pre-latched so it never announces a first_run) — the file is
      // never overwritten; the command's own read raises the loud error.
      const installStore = configReadable
        ? createConfigInstallStore(configPath)
        : createInMemoryProductTelemetryInstallStore({ installId: mintTelemetryInstallId(), installedAt: now() });
      usage = new ProductTelemetryController({
        transport: deps.transport ?? abortingFetchTransport,
        now,
        sessionStore,
        installStore,
        host: 'cli',
        facts,
        getEnabled: () => true,
        subscribeEnabled: () => undefined,
        buildSessionStart: async () => buildSessionStart(platform),
      });
      await usage.init();
    }

    let errors: ErrorReportController | null = null;
    if (errorsEnabled) {
      errors = new ErrorReportController({
        transport: deps.errorTransport ?? abortingErrorTransport,
        now,
        sessionStore,
        host: 'cli',
        facts,
        getEnabled: () => true,
        subscribeEnabled: () => undefined,
      });
      await errors.init();
    }
    const scriptPath = deps.scriptPath ?? process.argv[1] ?? '';
    const execPath = deps.execPath ?? process.execPath;
    const context: ErrorReportContext = {
      isOwnOrigin: createPathOwnOriginTest({ roots: [scriptPath === '' ? '' : path.dirname(scriptPath), execPath] }),
    };
    const errorController = errors;

    return {
      reportError: (input) => {
        if (!errorController) return;
        void errorController.report(toErrorReport(input, context)).catch(() => undefined);
      },
      finish: async () => {
        await usage?.flush().catch(() => undefined);
        await errorController?.flush().catch(() => undefined);
      },
    };
  } catch {
    return inert;
  }
}
