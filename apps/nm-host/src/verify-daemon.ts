/**
 * Daemon listener verification — the mirror image of the daemon's
 * caller chain (OBSERVABILITY_PLAN.md §4 + §8 Phase 7, the Phase 5
 * server-authentication residual). The daemon proves WHO is asking
 * from OS truth; this module proves WHO is answering: before the host
 * relays a mint, the process LISTENING on the loopback port must be
 * the real desktop app — otherwise a local squatter that bound the
 * port first would hand the extension a token and then receive its
 * sync + telemetry streams.
 *
 * Two rules, same trust argument as the daemon's own path check
 * ("writing inside the install dir means the machine is already
 * lost"):
 *
 *   1. **Shared install root** (every platform): the listener's
 *      executable must resolve inside the same app install tree as
 *      this host binary itself — the host ships in the desktop app's
 *      resources, so the daemon it dials is its own bundle sibling
 *      (`<App>.app/Contents/…` on macOS, the parent of the
 *      `resources` dir on Windows/Linux).
 *   2. **Signing-team rider** (macOS): when this binary carries a
 *      codesign team identity, the listener must carry the same one —
 *      self-referential, so no vendor constant exists to rotate.
 *
 * A host running from the dev layout (`dist-bun` in the monorepo — no
 * recognizable install root) skips enforcement, mirroring the
 * daemon's `requireHostSignature` dev posture: the check guards the
 * shipped topology, and a dev tree has none. Refusals stay coarse on
 * the wire (the extension sees `refused`); the specific detail goes
 * to stderr, which the browser folds into its own extension log.
 *
 * TOCTOU note (accepted, same class as the ratified PID-reuse edge):
 * the listener is proven at bootstrap time; the WS dial that follows
 * could in principle hit a process that grabbed the port in between.
 */

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import * as path from 'node:path';

const COMMAND_TIMEOUT_MS = 10_000;
const COMMAND_MAX_BUFFER = 1024 * 1024;

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

export type CommandRunner = (file: string, args: readonly string[]) => Promise<CommandResult>;

export const defaultCommandRunner: CommandRunner = (file, args) =>
  new Promise((resolve) => {
    execFile(file, [...args], { timeout: COMMAND_TIMEOUT_MS, maxBuffer: COMMAND_MAX_BUFFER }, (err, stdout, stderr) => {
      const code = err === null ? 0 : typeof err.code === 'number' ? err.code : 1;
      resolve({ stdout: String(stdout), stderr: String(stderr), code });
    });
  });

export type DaemonListenerVerification =
  | { readonly ok: true; readonly detail: string }
  | { readonly ok: false; readonly detail: string };

export interface VerifyDaemonListenerOptions {
  /** The daemon's loopback listen port (from the backend URL). */
  readonly port: number;
  /** This host binary's own path (`process.execPath` in the binary). */
  readonly ownExecutablePath: string;
  /** Platform seam — defaults to `process.platform`. */
  readonly platform?: NodeJS.Platform;
  /** Command seam — defaults to real `execFile`. */
  readonly run?: CommandRunner;
}

function safeRealpath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
}

/** Separator-correct path flavor for the platform under verification. */
function pathFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * The app install tree the shipped host lives in: the nearest `.app`
 * bundle ancestor on macOS, the parent of the `resources` dir on
 * Windows/Linux. Null means the host is not running from a shipped
 * layout (dev tree) and verification is not enforced.
 */
export function appInstallRoot(ownExecutablePath: string, platform: NodeJS.Platform): string | null {
  const flavor = pathFor(platform);
  let current = ownExecutablePath;
  for (;;) {
    const parent = flavor.dirname(current);
    if (parent === current) return null;
    current = parent;
    const base = flavor.basename(current);
    if (platform === 'darwin' && base.endsWith('.app')) return current;
    if (platform !== 'darwin' && base.toLowerCase() === 'resources') return flavor.dirname(current);
  }
}

/** Is `candidate` the root itself or a path inside it? */
function isWithinRoot(candidate: string, root: string, platform: NodeJS.Platform): boolean {
  const fold = (value: string): string => (platform === 'win32' ? value.toLowerCase() : value);
  const candidateFolded = fold(candidate);
  const rootFolded = fold(root);
  return candidateFolded === rootFolded || candidateFolded.startsWith(rootFolded + pathFor(platform).sep);
}

/** First pid from `lsof -sTCP:LISTEN -Fp` output — every row already listens on the scoped port. */
export function parseLsofListenerPid(output: string): number | null {
  for (const line of output.split('\n')) {
    if (!line.startsWith('p')) continue;
    const pid = Number.parseInt(line.slice(1), 10);
    if (Number.isInteger(pid)) return pid;
  }
  return null;
}

/** Pid from `ss -tlnpH` rows scoped to the listen port. */
export function parseSsListenerPid(output: string): number | null {
  const match = output.match(/pid=(\d+)/);
  if (!match) return null;
  const pid = Number.parseInt(match[1], 10);
  return Number.isInteger(pid) ? pid : null;
}

/** `ConvertTo-Json` emits a bare object for one row — normalize to a list. */
function parseJsonRows(output: string): Record<string, unknown>[] | null {
  const trimmed = output.trim();
  if (trimmed.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object');
  } catch {
    return null;
  }
}

/** Pid from `Get-NetTCPConnection -State Listen | ConvertTo-Json` rows. */
export function parseNetTcpListenerPid(output: string): number | null {
  const rows = parseJsonRows(output);
  if (rows === null) return null;
  for (const row of rows) {
    const owner = row.OwningProcess;
    if (typeof owner === 'number' && Number.isInteger(owner)) return owner;
  }
  return null;
}

/** Extract `TeamIdentifier=<id>` from `codesign -dv` output (stderr). */
export function parseCodesignTeamId(codesignOutput: string): string | null {
  const match = codesignOutput.match(/^TeamIdentifier=(.+)$/m);
  if (!match) return null;
  const teamId = match[1].trim();
  return teamId.length === 0 || teamId === 'not set' ? null : teamId;
}

function powerShellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function runPowerShell(run: CommandRunner, script: string): Promise<CommandResult> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

async function listenerPid(port: number, platform: NodeJS.Platform, run: CommandRunner): Promise<number | null> {
  if (platform === 'darwin') {
    const lsof = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp']);
    if (lsof.code !== 0 && lsof.stdout.trim().length === 0) return null;
    return parseLsofListenerPid(lsof.stdout);
  }
  if (platform === 'win32') {
    const script =
      `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue ` +
      '| Select-Object -Property LocalPort,OwningProcess | ConvertTo-Json -Compress';
    const result = await runPowerShell(run, script);
    if (result.code !== 0) return null;
    return parseNetTcpListenerPid(result.stdout);
  }
  const ss = await run('ss', ['-tlnpH', `( sport = :${port} )`]);
  if (ss.code !== 0) return null;
  return parseSsListenerPid(ss.stdout);
}

async function executablePathOf(pid: number, platform: NodeJS.Platform, run: CommandRunner): Promise<string | null> {
  if (platform === 'darwin') {
    const result = await run('ps', ['-p', String(pid), '-o', 'comm=']);
    if (result.code !== 0) return null;
    const executable = result.stdout.trim();
    return executable.length > 0 ? executable : null;
  }
  if (platform === 'win32') {
    const script =
      `Get-CimInstance Win32_Process -Filter ${powerShellQuote(`ProcessId = ${pid}`)} ` +
      '| Select-Object -Property ExecutablePath | ConvertTo-Json -Compress';
    const result = await runPowerShell(run, script);
    if (result.code !== 0) return null;
    const rows = parseJsonRows(result.stdout);
    const executable = rows?.[0]?.ExecutablePath;
    return typeof executable === 'string' && executable.length > 0 ? executable : null;
  }
  const exe = await run('readlink', ['-f', `/proc/${pid}/exe`]);
  if (exe.code !== 0) return null;
  const executablePath = exe.stdout.trim();
  return executablePath.length > 0 ? executablePath : null;
}

async function codesignTeamId(executablePath: string, run: CommandRunner): Promise<string | null> {
  const detail = await run('codesign', ['-dv', '--verbose=2', executablePath]);
  if (detail.code !== 0) return null;
  // codesign writes its detail report to stderr.
  return parseCodesignTeamId(`${detail.stderr}\n${detail.stdout}`);
}

/**
 * Verify the process listening on the loopback `port` is the desktop
 * app this host shipped with. Never throws — every failure is a typed
 * refusal the caller maps to the coarse wire answer.
 */
export async function verifyDaemonListener(options: VerifyDaemonListenerOptions): Promise<DaemonListenerVerification> {
  const platform = options.platform ?? process.platform;
  const run = options.run ?? defaultCommandRunner;
  if (platform !== 'darwin' && platform !== 'win32' && platform !== 'linux') {
    return { ok: true, detail: `platform ${platform} has no listener verification chain` };
  }
  const ownPath = safeRealpath(options.ownExecutablePath);
  const installRoot = appInstallRoot(ownPath, platform);
  if (installRoot === null) {
    return { ok: true, detail: `dev layout at ${ownPath} — listener verification not enforced` };
  }

  const pid = await listenerPid(options.port, platform, run);
  if (pid === null) {
    return { ok: false, detail: `no LISTEN owner found on loopback port ${options.port}` };
  }
  const listenerExecutable = await executablePathOf(pid, platform, run);
  if (listenerExecutable === null) {
    return { ok: false, detail: `process info unavailable for listener pid ${pid}` };
  }
  const listenerPath = safeRealpath(listenerExecutable);
  if (!isWithinRoot(listenerPath, installRoot, platform)) {
    return { ok: false, detail: `listener pid ${pid} runs ${listenerPath}, outside install root ${installRoot}` };
  }

  if (platform === 'darwin') {
    const ownTeam = await codesignTeamId(ownPath, run);
    if (ownTeam !== null) {
      const listenerTeam = await codesignTeamId(listenerPath, run);
      if (listenerTeam !== ownTeam) {
        return {
          ok: false,
          detail: `listener ${listenerPath} signing team ${listenerTeam ?? 'absent'} does not match host team ${ownTeam}`,
        };
      }
    }
  }
  return { ok: true, detail: `listener pid ${pid} verified at ${listenerPath}` };
}
