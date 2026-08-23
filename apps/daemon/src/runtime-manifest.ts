/**
 * Runtime manifest — what the RUNNING daemon is actually doing, recorded
 * at `<dataDir>/runtime.json` for `ohd status` to read back.
 *
 * `daemon.json` is the configuration's single source of truth, but it
 * states intent: what the NEXT boot will do. A service that started
 * before the file was edited, one whose bind FAILED, or one rebound at
 * runtime from an admin surface is doing something else entirely — and
 * a CLI that only re-resolves the config can do no better than repeat
 * the intent back as if it were fact (which is exactly how a LAN bind
 * that never took effect could be reported as configured and live). The
 * manifest closes that gap: the daemon writes down its pid, the
 * configuration it actually booted with, and every bind state its
 * supervisor reaches, so status reports observations instead of a second
 * guess.
 *
 * The channel is the filesystem, like every other CLI↔daemon seam
 * (`daemon.json`, `storage.json`, `logs/`): no new network surface, and
 * `/healthz` stays deliberately data-free. The file names paths and a
 * pid — nothing secret — but it is written 0600 inside the 0700 data dir
 * anyway, the same posture as everything else the daemon persists.
 *
 * Lifecycle: written at boot BEFORE the first bind attempt (so a bind
 * failure is still on record), rewritten on every bind-state change,
 * removed on clean shutdown. A file a crash left behind is detected as
 * stale through its pid and ignored.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DaemonConfig } from './config';

/** Bumped only on a breaking shape change; a foreign version reads as absent. */
export const RUNTIME_MANIFEST_VERSION = 1;

export function runtimeManifestPath(dataDir: string): string {
  return path.join(dataDir, 'runtime.json');
}

/** The bind lifecycle as the supervisor reaches it. */
export interface RuntimeBind {
  state: 'binding' | 'bound' | 'failed';
  host: string;
  port: number;
}

/**
 * The configuration fields a running daemon can only change by
 * restarting — exactly the set `ohd status` compares against the
 * current `daemon.json` to answer "is a restart owed?".
 */
export interface RuntimeConfigSnapshot {
  dataDir: string;
  bindAddress: string;
  bindPort: number;
  logLevel: string;
  trustedProxy: boolean;
  allowedHosts: readonly string[];
  allowInsecureLan: boolean;
  webRoot: string | null;
}

export interface RuntimeManifest {
  version: number;
  pid: number;
  /** ISO-8601. Uptime is derived on read — a stored one would age on disk. */
  startedAt: string;
  appVersion: string;
  configPath: string;
  config: RuntimeConfigSnapshot;
  /** null until the supervisor's first bind attempt resolves. */
  bind: RuntimeBind | null;
}

export interface RuntimeManifestWriter {
  /** Record the supervisor's latest bind lifecycle event. */
  setBind(bind: RuntimeBind): void;
  /** Remove the manifest — this daemon is going down cleanly. */
  dispose(): void;
}

export interface StartRuntimeManifestInput {
  dataDir: string;
  appVersion: string;
  configPath: string;
  config: RuntimeConfigSnapshot;
  /** Manifest I/O is diagnostics: a failure is reported, never thrown. */
  onError?: (err: unknown) => void;
}

/** The restart-bearing fields of a resolved config, as the manifest stores them. */
export function runtimeConfigSnapshot(config: DaemonConfig): RuntimeConfigSnapshot {
  return {
    dataDir: config.dataDir,
    bindAddress: config.bindAddress,
    bindPort: config.bindPort,
    logLevel: config.logLevel,
    trustedProxy: config.trustedProxy,
    allowedHosts: [...config.allowedHosts],
    allowInsecureLan: config.allowInsecureLan,
    webRoot: config.webRoot,
  };
}

export function startRuntimeManifest(input: StartRuntimeManifestInput): RuntimeManifestWriter {
  const filePath = runtimeManifestPath(input.dataDir);
  const manifest: RuntimeManifest = {
    version: RUNTIME_MANIFEST_VERSION,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    appVersion: input.appVersion,
    configPath: input.configPath,
    config: input.config,
    bind: null,
  };
  let disposed = false;

  const write = (): void => {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
      const tmpPath = path.join(path.dirname(filePath), `.runtime.json.${process.pid}.tmp`);
      fs.writeFileSync(tmpPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      input.onError?.(err);
    }
  };

  write();

  return {
    setBind(bind) {
      if (disposed) return;
      manifest.bind = bind;
      write();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        fs.rmSync(filePath, { force: true });
      } catch (err) {
        input.onError?.(err);
      }
    },
  };
}

/**
 * The manifest a running daemon left, or null when there is none to
 * trust — absent, unreadable, malformed, or written by a version whose
 * shape this build does not know. Never throws: status must still
 * report what it can when the manifest is unusable.
 */
export function readRuntimeManifest(dataDir: string): RuntimeManifest | null {
  let text: string;
  try {
    text = fs.readFileSync(runtimeManifestPath(dataDir), 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return parseManifest(parsed);
}

function parseManifest(parsed: unknown): RuntimeManifest | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (record.version !== RUNTIME_MANIFEST_VERSION) return null;
  if (typeof record.pid !== 'number' || !Number.isInteger(record.pid) || record.pid <= 0) return null;
  if (typeof record.startedAt !== 'string' || Number.isNaN(Date.parse(record.startedAt))) return null;
  if (typeof record.appVersion !== 'string' || typeof record.configPath !== 'string') return null;
  const config = parseConfigSnapshot(record.config);
  if (config === null) return null;
  const bind = record.bind === null || record.bind === undefined ? null : parseBind(record.bind);
  if (record.bind !== null && record.bind !== undefined && bind === null) return null;
  return {
    version: RUNTIME_MANIFEST_VERSION,
    pid: record.pid,
    startedAt: record.startedAt,
    appVersion: record.appVersion,
    configPath: record.configPath,
    config,
    bind,
  };
}

function parseConfigSnapshot(raw: unknown): RuntimeConfigSnapshot | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.dataDir !== 'string' || typeof record.bindAddress !== 'string') return null;
  if (typeof record.bindPort !== 'number' || typeof record.logLevel !== 'string') return null;
  if (typeof record.trustedProxy !== 'boolean' || typeof record.allowInsecureLan !== 'boolean') return null;
  if (!Array.isArray(record.allowedHosts) || record.allowedHosts.some((host) => typeof host !== 'string')) return null;
  if (record.webRoot !== null && typeof record.webRoot !== 'string') return null;
  return {
    dataDir: record.dataDir,
    bindAddress: record.bindAddress,
    bindPort: record.bindPort,
    logLevel: record.logLevel,
    trustedProxy: record.trustedProxy,
    allowedHosts: record.allowedHosts as string[],
    allowInsecureLan: record.allowInsecureLan,
    webRoot: record.webRoot,
  };
}

function parseBind(raw: unknown): RuntimeBind | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const state = record.state;
  if (state !== 'binding' && state !== 'bound' && state !== 'failed') return null;
  if (typeof record.host !== 'string' || typeof record.port !== 'number') return null;
  return { state, host: record.host, port: record.port };
}

/**
 * Does this pid still name a live process? Signal 0 performs the
 * permission and existence checks without delivering anything; `EPERM`
 * means the process exists under another user, which still counts.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
