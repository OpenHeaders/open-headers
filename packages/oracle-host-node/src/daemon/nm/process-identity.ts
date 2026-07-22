/**
 * NM caller verification — the OS-truth identity chain behind the
 * `/nm/bootstrap` handoff (OBSERVABILITY_PLAN.md §4 + §8 Phase 7).
 *
 * Nothing on the wire is trusted. Given the connecting socket's remote
 * endpoint, the chain reads three facts from the operating system:
 *
 *   1. which local process OWNS that socket (`lsof` on macOS,
 *      `Get-NetTCPConnection` on Windows, `ss` on Linux) — the
 *      request's true author, whatever its body claims;
 *   2. that process's executable must be the shipped NM host binary
 *      (realpath-compared, optionally signature-verified on packaged
 *      builds — the path sits in the app install dir, so writing it
 *      means the machine is already lost);
 *   3. its PARENT process — the browser that spawned the host per the
 *      NM manifest — must carry an allowlisted vendor identity:
 *      code-signing on the platforms that have it (`codesign` team id
 *      on macOS, Authenticode signer subject CN on Windows), and on
 *      Linux — which has no signing chain — the ratified best-effort
 *      path heuristic: the kernel-reported `/proc/<pid>/exe` must
 *      resolve under a root-owned vendor install root.
 *
 * Only then does the caller earn a token. Every refusal is typed and
 * coarse on the wire (the handler answers a bare reason) with the
 * specific detail kept to the daemon's own log — a probing local
 * process learns nothing about which link of the chain broke.
 *
 * The chain walker is platform-neutral; each platform contributes a
 * probe set (socket owner, process info, signature identity) built on
 * the injected command runner, so every leg is unit-testable without
 * real processes. Platforms without a probe set answer
 * `platform-unsupported` and the extension degrades to the device-flow
 * pairing gesture.
 */

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import {
  findLinuxBrowserByPath,
  findMacosBrowserSigner,
  findWindowsBrowserSigner,
  type VerifiedBrowser,
} from './browser-allowlist';

/** Generous ceiling — Windows PowerShell pays a cold-start toll per probe. */
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

export type NmCallerRefusalReason =
  | 'platform-unsupported'
  | 'owner-not-found'
  | 'process-info-unavailable'
  | 'host-mismatch'
  | 'host-unsigned'
  | 'browser-unverified';

export type NmCallerVerification =
  | {
      readonly ok: true;
      /** Vendor-family display name from the allowlist (token label). */
      readonly browser: VerifiedBrowser;
      /** The spawning browser executable, for the daemon log. */
      readonly browserPath: string;
    }
  | {
      readonly ok: false;
      readonly reason: NmCallerRefusalReason;
      /** Log-only specifics — never sent back over the wire. */
      readonly detail: string;
    };

export interface VerifyNmCallerOptions {
  /** `req.socket.remoteAddress` of the bootstrap request. */
  readonly clientAddress: string;
  /** `req.socket.remotePort` of the bootstrap request. */
  readonly clientPort: number;
  /** Absolute path of the shipped NM host binary. */
  readonly expectedHostPath: string;
  /**
   * Require a valid code signature on the NM host binary itself.
   * Signed distributions pass true; unsigned artifacts (dev builds,
   * unsigned beta channels) rely on the path check alone.
   */
  readonly requireHostSignature: boolean;
  /** This daemon process's own pid — its mirror socket rows are skipped. */
  readonly selfPid?: number;
  /** Platform seam — defaults to `process.platform`. */
  readonly platform?: NodeJS.Platform;
  /** Command seam — defaults to real `execFile`. */
  readonly run?: CommandRunner;
}

/**
 * Strip the IPv4-mapped-IPv6 prefix Node reports for v4 peers on a
 * dual-stack bind so the address matches the OS tables' numeric output.
 */
function normalizeAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

export interface ProcessInfo {
  readonly ppid: number;
  readonly executablePath: string;
}

/**
 * One platform's OS-truth probes. Every method answers null on any
 * failure — the chain walker turns each null into its typed refusal.
 */
interface PlatformProbes {
  /** Pid owning the socket whose LOCAL side is the client endpoint. */
  readonly ownerPid: (clientPort: number, selfPid: number) => Promise<number | null>;
  /** Executable path + parent pid for a live process. */
  readonly processInfo: (pid: number) => Promise<ProcessInfo | null>;
  /** True when the binary carries a valid signed identity. */
  readonly signatureValid: (executablePath: string) => Promise<boolean>;
  /** Allowlisted vendor identity of a signed binary, or null. */
  readonly browserSigner: (executablePath: string) => Promise<VerifiedBrowser | null>;
  /** Canonical form for executable-path equality on this platform. */
  readonly canonicalPath: (candidate: string) => string;
}

function safeRealpath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
}

// ── macOS probes: lsof + ps + codesign ───────────────────────────────

/**
 * Parse `lsof -Fpn` output for the pid whose socket's LOCAL side is the
 * client endpoint. The daemon's own row for the same connection is the
 * mirror (local side = the bound port), so matching the local side —
 * `n<addr>:<clientPort>-><...>` — pins the direction; `selfPid` is
 * skipped as well for belt-and-braces.
 */
export function parseLsofOwnerPid(output: string, clientPort: number, selfPid: number | undefined): number | null {
  let currentPid: number | null = null;
  const localSuffix = `:${clientPort}->`;
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      const parsed = Number.parseInt(line.slice(1), 10);
      currentPid = Number.isInteger(parsed) ? parsed : null;
      continue;
    }
    if (!line.startsWith('n') || currentPid === null) continue;
    if (selfPid !== undefined && currentPid === selfPid) continue;
    const arrow = line.indexOf('->');
    if (arrow === -1) continue;
    const localSide = line.slice(1, arrow + 2);
    if (localSide.endsWith(localSuffix)) return currentPid;
  }
  return null;
}

/**
 * Parse `ps -p <pid> -o ppid=,comm=` — first field is the parent pid,
 * the remainder (which may contain spaces: `/Applications/Google
 * Chrome.app/...`) is the executable path.
 */
export function parsePsProcessInfo(output: string): ProcessInfo | null {
  const line = output.split('\n').find((candidate) => candidate.trim().length > 0);
  if (!line) return null;
  const trimmed = line.trim();
  const firstGap = trimmed.search(/\s/);
  if (firstGap === -1) return null;
  const ppid = Number.parseInt(trimmed.slice(0, firstGap), 10);
  const executablePath = trimmed.slice(firstGap).trim();
  if (!Number.isInteger(ppid) || executablePath.length === 0) return null;
  return { ppid, executablePath };
}

/** Extract `TeamIdentifier=<id>` from `codesign -dv` output (stderr). */
export function parseCodesignTeamId(codesignOutput: string): string | null {
  const match = codesignOutput.match(/^TeamIdentifier=(.+)$/m);
  if (!match) return null;
  const teamId = match[1].trim();
  return teamId.length === 0 || teamId === 'not set' ? null : teamId;
}

/** Valid signature + team id for one binary, or null when either is absent. */
async function readMacosSignatureTeamId(executablePath: string, run: CommandRunner): Promise<string | null> {
  const verify = await run('codesign', ['--verify', executablePath]);
  if (verify.code !== 0) return null;
  const detail = await run('codesign', ['-dv', '--verbose=2', executablePath]);
  if (detail.code !== 0) return null;
  // codesign writes its detail report to stderr.
  return parseCodesignTeamId(`${detail.stderr}\n${detail.stdout}`);
}

function macosProbes(run: CommandRunner): PlatformProbes {
  return {
    ownerPid: async (clientPort, selfPid) => {
      // Scoped to the client's ephemeral port so lsof scans one port's
      // rows, not the whole TCP table.
      const lsof = await run('lsof', ['-nP', `-iTCP:${clientPort}`, '-sTCP:ESTABLISHED', '-Fpn']);
      if (lsof.code !== 0 && lsof.stdout.trim().length === 0) return null;
      return parseLsofOwnerPid(lsof.stdout, clientPort, selfPid);
    },
    processInfo: async (pid) => {
      const result = await run('ps', ['-p', String(pid), '-o', 'ppid=,comm=']);
      if (result.code !== 0) return null;
      return parsePsProcessInfo(result.stdout);
    },
    signatureValid: async (executablePath) => (await readMacosSignatureTeamId(executablePath, run)) !== null,
    browserSigner: async (executablePath) => {
      const teamId = await readMacosSignatureTeamId(executablePath, run);
      if (teamId === null) return null;
      return findMacosBrowserSigner(teamId) ?? null;
    },
    canonicalPath: safeRealpath,
  };
}

// ── Windows probes: Get-NetTCPConnection + Win32_Process +
//    Get-AuthenticodeSignature (Windows PowerShell, JSON output) ─────

function runPowerShell(run: CommandRunner, script: string): Promise<CommandResult> {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

/** Single-quote a value for embedding in a PowerShell command line. */
function powerShellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
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

/**
 * Parse `Get-NetTCPConnection ... | ConvertTo-Json` rows for the pid
 * owning the socket whose LOCAL side is the client's ephemeral port.
 * The daemon's mirror row carries the bound port as its local side, so
 * the port filter pins direction; `selfPid` is skipped as well.
 */
export function parseNetTcpOwnerPid(output: string, clientPort: number, selfPid: number | undefined): number | null {
  const rows = parseJsonRows(output);
  if (rows === null) return null;
  for (const row of rows) {
    if (row.LocalPort !== clientPort) continue;
    const owner = row.OwningProcess;
    if (typeof owner !== 'number' || !Number.isInteger(owner)) continue;
    if (selfPid !== undefined && owner === selfPid) continue;
    return owner;
  }
  return null;
}

/** Parse `Get-CimInstance Win32_Process ... | ConvertTo-Json` output. */
export function parseWin32ProcessInfo(output: string): ProcessInfo | null {
  const rows = parseJsonRows(output);
  if (rows === null || rows.length === 0) return null;
  const row = rows[0];
  const ppid = row.ParentProcessId;
  const executablePath = row.ExecutablePath;
  if (typeof ppid !== 'number' || !Number.isInteger(ppid)) return null;
  if (typeof executablePath !== 'string' || executablePath.length === 0) return null;
  return { ppid, executablePath };
}

export interface AuthenticodeIdentity {
  readonly valid: boolean;
  readonly subjectCommonName: string | null;
}

/**
 * Extract the CN attribute from an X.500 subject as Windows prints it
 * (`CN="Brave Software, Inc.", O=..., C=US`) — a quoted value may
 * contain commas and doubled-quote escapes.
 */
export function parseDnCommonName(subject: string): string | null {
  const match = subject.match(/(?:^|,\s*)CN=("((?:[^"]|"")*)"|[^,]*)/);
  if (!match) return null;
  const value = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[1];
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse the projected `Get-AuthenticodeSignature` JSON envelope. */
export function parseAuthenticodeIdentity(output: string): AuthenticodeIdentity | null {
  const rows = parseJsonRows(output);
  if (rows === null || rows.length === 0) return null;
  const row = rows[0];
  const valid = row.Status === 'Valid';
  const subject = typeof row.Subject === 'string' ? row.Subject : null;
  return { valid, subjectCommonName: valid && subject !== null ? parseDnCommonName(subject) : null };
}

async function readAuthenticodeIdentity(
  executablePath: string,
  run: CommandRunner,
): Promise<AuthenticodeIdentity | null> {
  const script =
    `$sig = Get-AuthenticodeSignature -LiteralPath ${powerShellQuote(executablePath)}; ` +
    `@{ Status = $sig.Status.ToString(); Subject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null } } ` +
    '| ConvertTo-Json -Compress';
  const result = await runPowerShell(run, script);
  if (result.code !== 0) return null;
  return parseAuthenticodeIdentity(result.stdout);
}

function windowsProbes(run: CommandRunner): PlatformProbes {
  return {
    ownerPid: async (clientPort, selfPid) => {
      // Scoped to the client's ephemeral port; SilentlyContinue folds
      // "no matching connection" into empty output instead of an error.
      const script =
        `Get-NetTCPConnection -State Established -LocalPort ${clientPort} -ErrorAction SilentlyContinue ` +
        '| Select-Object -Property LocalPort,OwningProcess | ConvertTo-Json -Compress';
      const result = await runPowerShell(run, script);
      if (result.code !== 0) return null;
      return parseNetTcpOwnerPid(result.stdout, clientPort, selfPid);
    },
    processInfo: async (pid) => {
      const script =
        `Get-CimInstance Win32_Process -Filter ${powerShellQuote(`ProcessId = ${pid}`)} ` +
        '| Select-Object -Property ParentProcessId,ExecutablePath | ConvertTo-Json -Compress';
      const result = await runPowerShell(run, script);
      if (result.code !== 0) return null;
      return parseWin32ProcessInfo(result.stdout);
    },
    signatureValid: async (executablePath) => {
      const identity = await readAuthenticodeIdentity(executablePath, run);
      return identity?.valid === true;
    },
    browserSigner: async (executablePath) => {
      const identity = await readAuthenticodeIdentity(executablePath, run);
      if (identity === null || !identity.valid || identity.subjectCommonName === null) return null;
      return findWindowsBrowserSigner(identity.subjectCommonName) ?? null;
    },
    // Windows paths are case-insensitive; the OS tables also mix drive
    // letter casing, so equality runs over a lowercased realpath.
    canonicalPath: (candidate) => safeRealpath(candidate).toLowerCase(),
  };
}

// ── Linux probes: ss + /proc + install-root path heuristic ───────────

/**
 * Parse `ss -tnpH` rows for the pid owning the socket whose LOCAL side
 * is the client's ephemeral port. The command already filters on
 * `sport`, but the parser re-pins direction anyway (defense in depth,
 * same as the lsof parser): the first address column is the local
 * side; the daemon's mirror row carries the bound port there instead.
 */
export function parseSsOwnerPid(output: string, clientPort: number, selfPid: number | undefined): number | null {
  const localSuffix = `:${clientPort}`;
  for (const line of output.split('\n')) {
    const localSide = line
      .trim()
      .split(/\s+/)
      .find((column) => /:\d+$/.test(column));
    if (localSide === undefined || !localSide.endsWith(localSuffix)) continue;
    const pidMatch = line.match(/pid=(\d+)/);
    if (!pidMatch) continue;
    const pid = Number.parseInt(pidMatch[1], 10);
    if (selfPid !== undefined && pid === selfPid) continue;
    return pid;
  }
  return null;
}

function linuxProbes(run: CommandRunner): PlatformProbes {
  return {
    ownerPid: async (clientPort, selfPid) => {
      // `sport` scopes the scan to the client's ephemeral port; `-H`
      // drops the header so every row is a socket. Same-user process
      // info is readable without root, which is the only case here —
      // browser, NM host, and daemon all run as the logged-in user.
      const ss = await run('ss', ['-tnpH', 'state', 'established', `( sport = :${clientPort} )`]);
      if (ss.code !== 0) return null;
      return parseSsOwnerPid(ss.stdout, clientPort, selfPid);
    },
    processInfo: async (pid) => {
      // `/proc/<pid>/exe` is the kernel-reported executable — `ps -o
      // comm=` truncates to 15 chars on Linux and argv is spoofable.
      const ppidResult = await run('ps', ['-p', String(pid), '-o', 'ppid=']);
      if (ppidResult.code !== 0) return null;
      const ppid = Number.parseInt(ppidResult.stdout.trim(), 10);
      if (!Number.isInteger(ppid)) return null;
      const exe = await run('readlink', ['-f', `/proc/${pid}/exe`]);
      if (exe.code !== 0) return null;
      const executablePath = exe.stdout.trim();
      if (executablePath.length === 0) return null;
      return { ppid, executablePath };
    },
    // No signing chain exists on Linux — the caller never asks
    // (requireHostSignature is wired false there); answering false
    // keeps a misconfigured true honest instead of silently passing.
    signatureValid: async () => false,
    browserSigner: async (executablePath) => findLinuxBrowserByPath(safeRealpath(executablePath)) ?? null,
    canonicalPath: safeRealpath,
  };
}

function probesForPlatform(platform: NodeJS.Platform, run: CommandRunner): PlatformProbes | null {
  if (platform === 'darwin') return macosProbes(run);
  if (platform === 'win32') return windowsProbes(run);
  if (platform === 'linux') return linuxProbes(run);
  return null;
}

export async function verifyNmCaller(options: VerifyNmCallerOptions): Promise<NmCallerVerification> {
  const platform = options.platform ?? process.platform;
  const run = options.run ?? defaultCommandRunner;
  const probes = probesForPlatform(platform, run);
  if (probes === null) {
    return { ok: false, reason: 'platform-unsupported', detail: `platform ${platform} has no verification chain yet` };
  }
  const address = normalizeAddress(options.clientAddress);

  // 1. Socket → owning pid.
  const ownerPid = await probes.ownerPid(options.clientPort, options.selfPid ?? process.pid);
  if (ownerPid === null) {
    return {
      ok: false,
      reason: 'owner-not-found',
      detail: `no established socket with local side ${address}:${options.clientPort}`,
    };
  }

  // 2. Owning process must BE the shipped NM host.
  const hostInfo = await probes.processInfo(ownerPid);
  if (!hostInfo) {
    return {
      ok: false,
      reason: 'process-info-unavailable',
      detail: `process info unavailable for socket owner pid ${ownerPid}`,
    };
  }
  const actualHostPath = probes.canonicalPath(hostInfo.executablePath);
  const expectedHostPath = probes.canonicalPath(options.expectedHostPath);
  if (actualHostPath !== expectedHostPath) {
    return {
      ok: false,
      reason: 'host-mismatch',
      detail: `socket owner pid ${ownerPid} runs ${actualHostPath}, expected ${expectedHostPath}`,
    };
  }
  if (options.requireHostSignature && !(await probes.signatureValid(hostInfo.executablePath))) {
    return {
      ok: false,
      reason: 'host-unsigned',
      detail: `NM host at ${actualHostPath} has no valid signed identity`,
    };
  }

  // 3. Parent process — the spawning browser — must carry an
  //    allowlisted signer.
  const browserInfo = await probes.processInfo(hostInfo.ppid);
  if (!browserInfo) {
    return {
      ok: false,
      reason: 'process-info-unavailable',
      detail: `process info unavailable for parent pid ${hostInfo.ppid}`,
    };
  }
  const browserPath = safeRealpath(browserInfo.executablePath);
  const signer = await probes.browserSigner(browserInfo.executablePath);
  if (signer === null) {
    return {
      ok: false,
      reason: 'browser-unverified',
      detail: `parent ${browserPath} is unsigned or signed by an unlisted vendor`,
    };
  }
  return { ok: true, browser: signer, browserPath };
}
