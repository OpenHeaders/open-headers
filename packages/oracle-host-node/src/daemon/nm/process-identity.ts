/**
 * NM caller verification — the OS-truth identity chain behind the
 * `/nm/bootstrap` handoff (OBSERVABILITY_PLAN.md §4 + §8 Phase 7).
 *
 * Nothing on the wire is trusted. Given the connecting socket's remote
 * endpoint, the chain reads three facts from the operating system:
 *
 *   1. which local process OWNS that socket (`lsof` on macOS) — the
 *      request's true author, whatever its body claims;
 *   2. that process's executable must be the shipped NM host binary
 *      (realpath-compared, optionally signature-verified on packaged
 *      builds — the path sits in the app bundle, so writing it means
 *      the machine is already lost);
 *   3. its PARENT process — the browser that spawned the host per the
 *      NM manifest — must carry an allowlisted code-signing identity
 *      (`codesign` team id on macOS).
 *
 * Only then does the caller earn a token. Every refusal is typed and
 * coarse on the wire (the handler answers a bare reason) with the
 * specific detail kept to the daemon's own log — a probing local
 * process learns nothing about which link of the chain broke.
 *
 * macOS only in this slice; other platforms answer
 * `platform-unsupported` and the extension degrades to the device-flow
 * pairing gesture. The command runner is injected so the chain is
 * unit-testable without real processes.
 */

import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { type BrowserSignerEntry, findMacosBrowserSigner } from './browser-allowlist';

const COMMAND_TIMEOUT_MS = 5_000;
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
      readonly browser: BrowserSignerEntry;
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
   * Packaged builds pass true; dev builds run an unsigned local
   * artifact and rely on the path check alone.
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
 * dual-stack bind so the address matches lsof's numeric output.
 */
function normalizeAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

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

export interface ProcessInfo {
  readonly ppid: number;
  readonly executablePath: string;
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

async function readProcessInfo(pid: number, run: CommandRunner): Promise<ProcessInfo | null> {
  const result = await run('ps', ['-p', String(pid), '-o', 'ppid=,comm=']);
  if (result.code !== 0) return null;
  return parsePsProcessInfo(result.stdout);
}

/** Valid signature + team id for one binary, or null when either is absent. */
async function readSignatureTeamId(executablePath: string, run: CommandRunner): Promise<string | null> {
  const verify = await run('codesign', ['--verify', executablePath]);
  if (verify.code !== 0) return null;
  const detail = await run('codesign', ['-dv', '--verbose=2', executablePath]);
  if (detail.code !== 0) return null;
  // codesign writes its detail report to stderr.
  return parseCodesignTeamId(`${detail.stderr}\n${detail.stdout}`);
}

function safeRealpath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
}

export async function verifyNmCaller(options: VerifyNmCallerOptions): Promise<NmCallerVerification> {
  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin') {
    return { ok: false, reason: 'platform-unsupported', detail: `platform ${platform} has no verification chain yet` };
  }
  const run = options.run ?? defaultCommandRunner;
  const address = normalizeAddress(options.clientAddress);

  // 1. Socket → owning pid. Scoped to the client's ephemeral port so
  //    lsof scans one port's rows, not the whole TCP table.
  const lsof = await run('lsof', ['-nP', `-iTCP:${options.clientPort}`, '-sTCP:ESTABLISHED', '-Fpn']);
  if (lsof.code !== 0 && lsof.stdout.trim().length === 0) {
    return {
      ok: false,
      reason: 'owner-not-found',
      detail: `lsof exited ${lsof.code} for ${address}:${options.clientPort}`,
    };
  }
  const ownerPid = parseLsofOwnerPid(lsof.stdout, options.clientPort, options.selfPid ?? process.pid);
  if (ownerPid === null) {
    return {
      ok: false,
      reason: 'owner-not-found',
      detail: `no established socket with local side :${options.clientPort}`,
    };
  }

  // 2. Owning process must BE the shipped NM host.
  const hostInfo = await readProcessInfo(ownerPid, run);
  if (!hostInfo) {
    return { ok: false, reason: 'process-info-unavailable', detail: `ps failed for socket owner pid ${ownerPid}` };
  }
  const actualHostPath = safeRealpath(hostInfo.executablePath);
  const expectedHostPath = safeRealpath(options.expectedHostPath);
  if (actualHostPath !== expectedHostPath) {
    return {
      ok: false,
      reason: 'host-mismatch',
      detail: `socket owner pid ${ownerPid} runs ${actualHostPath}, expected ${expectedHostPath}`,
    };
  }
  if (options.requireHostSignature) {
    const hostTeamId = await readSignatureTeamId(actualHostPath, run);
    if (hostTeamId === null) {
      return {
        ok: false,
        reason: 'host-unsigned',
        detail: `NM host at ${actualHostPath} has no valid signed identity`,
      };
    }
  }

  // 3. Parent process — the spawning browser — must carry an
  //    allowlisted signer.
  const browserInfo = await readProcessInfo(hostInfo.ppid, run);
  if (!browserInfo) {
    return { ok: false, reason: 'process-info-unavailable', detail: `ps failed for parent pid ${hostInfo.ppid}` };
  }
  const browserPath = safeRealpath(browserInfo.executablePath);
  const teamId = await readSignatureTeamId(browserPath, run);
  if (teamId === null) {
    return { ok: false, reason: 'browser-unverified', detail: `parent ${browserPath} is unsigned or ad-hoc signed` };
  }
  const signer = findMacosBrowserSigner(teamId);
  if (!signer) {
    return {
      ok: false,
      reason: 'browser-unverified',
      detail: `parent ${browserPath} signed by unlisted team ${teamId}`,
    };
  }
  return { ok: true, browser: signer, browserPath };
}
