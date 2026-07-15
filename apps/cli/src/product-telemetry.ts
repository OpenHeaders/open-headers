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
 * default on. The first enabled run prints the user-signed §8 notice to
 * stderr — stdout stays the machine contract — and persists
 * `telemetryNoticeShown` so the notice prints exactly once. Disabled
 * runs skip the channel entirely and never print the notice (nothing is
 * collected, so there is nothing to disclose).
 *
 * Every telemetry failure is silent — a broken config file or an
 * unreachable endpoint must never change a command's outcome.
 */

import {
  createInMemoryProductTelemetrySessionStore,
  PRODUCT_TELEMETRY_ENDPOINT,
  ProductTelemetryController,
  parseTelemetryAppVersion,
  type TelemetryEnvelope,
  type TelemetryEvent,
  type TelemetryPlatform,
  type TelemetryTransport,
} from '@openheaders/core/telemetry';
import { type CliConfig, cliConfigPath, readCliConfig, writeCliConfig } from './config-store';
import { CLI_VERSION } from './version';

export const TELEMETRY_ENV = 'OH_TELEMETRY';

/** Plan §8 CLI first-run notice, user-signed, rendered for a terminal. */
export const TELEMETRY_NOTICE =
  'Open Headers CLI collects anonymous usage counts (command names and versions — never your data or targets). ' +
  'Opt out anytime: export OH_TELEMETRY=0. Details: https://openheaders.io/privacy';

const FLUSH_ABORT_MS = 500;

export interface CliProductTelemetry {
  /** Best-effort exit flush; never throws, never blocks past the transport abort. */
  finish(): Promise<void>;
}

export interface CliProductTelemetryDeps {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  cliVersion?: string;
  /** First-run notice sink; production prints one stderr line. */
  notify?: (line: string) => void;
  configPath?: string;
  /** Test seams; production uses the aborting fetch transport + wall clock. */
  transport?: TelemetryTransport;
  now?: () => number;
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
    host: 'cli',
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
    if (!readTelemetryEnabled(env, config.telemetry)) return inert;

    if (config.telemetryNoticeShown !== true) {
      (deps.notify ?? ((line) => console.error(line)))(TELEMETRY_NOTICE);
      // Best-effort persistence: an unwritable config dir means the
      // notice repeats next run, never that the command fails. A file we
      // could not read is never overwritten — the user was told to fix
      // it, and their content must survive for that.
      if (configReadable) {
        await writeCliConfig(configPath, { ...config, telemetryNoticeShown: true }).catch(() => undefined);
      }
    }

    const controller = new ProductTelemetryController({
      transport: deps.transport ?? abortingFetchTransport,
      now: deps.now ?? Date.now,
      sessionStore: createInMemoryProductTelemetrySessionStore(),
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
