/**
 * git-exec — the ONE seam between the engine and the user's installed
 * `git` binary (GIT_PLAN.md §7). Every git-plane invocation, on every
 * phase, goes through {@link createGitExec}:
 *
 *   - arg-vector only (`execFile`, never a shell-interpolated string);
 *   - `GIT_TERMINAL_PROMPT=0` pinned so no invocation can hang on a
 *     credential prompt (fetch/push phases inherit the discipline);
 *   - explicit repo addressing: callers pass `cwd` (the work tree) and
 *     the wrapper pins `--git-dir`/`--work-tree` derivation to it —
 *     a stray `GIT_DIR` in the host environment can never retarget a
 *     command at the wrong repo;
 *   - timeout with structured failure (no orphaned hangs);
 *   - structured result — exit code, stdout, stderr — instead of
 *     thrown strings;
 *   - one audit row per STATE-CHANGING command through the injected
 *     sink (reads are high-volume/low-signal and stay silent).
 *
 * The returned {@link GitRunner} function type is the seam the Phase 5
 * fault-injection suite mocks — modules above this one (repo, commit,
 * status) accept a runner, never spawn processes themselves.
 */

import { execFile } from 'node:child_process';
import { isStateChanging } from './audit-classify';

/** Structured outcome of one git invocation. Non-zero exit is a value, not a throw. */
export interface GitExecResult {
  /** Exit code; -1 when the process could not be spawned or timed out. */
  code: number;
  stdout: string;
  stderr: string;
  /** True when the binary was missing / not executable (ENOENT-class spawn failure). */
  spawnFailed: boolean;
  /** True when the invocation was killed by the timeout. */
  timedOut: boolean;
}

export interface GitExecOptions {
  /** Absolute path of the working tree the command addresses. */
  cwd: string;
  /** Extra environment entries layered over the pinned base (e.g. GIT_INDEX_FILE, GIT_AUTHOR_*). */
  env?: Record<string, string>;
  /** Per-invocation override of the default timeout. */
  timeoutMs?: number;
}

export type GitRunner = (args: readonly string[], options: GitExecOptions) => Promise<GitExecResult>;

/** One audit row per state-changing git command (§7). */
export interface GitAuditRow {
  /** Invocation wall-clock, strict ISO-8601. */
  at: string;
  args: readonly string[];
  cwd: string;
  code: number;
  durationMs: number;
  /** Combined stdout+stderr, trimmed and capped — the console tab's feed. */
  output: string;
}

/** Cap on the audit row's captured output (a `git fetch` can be chatty). */
const AUDIT_OUTPUT_CAP = 4000;

export interface CreateGitExecOptions {
  /** Binary to invoke; tests point this at fixtures. Default `git`. */
  gitBinary?: string;
  defaultTimeoutMs?: number;
  /** Sink for state-changing command rows; absent = drop. */
  audit?: (row: GitAuditRow) => void;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Environment the wrapper pins on every invocation. `GIT_TERMINAL_PROMPT=0`
 * turns would-be credential prompts into fast failures; the `GIT_DIR` /
 * `GIT_WORK_TREE` / `GIT_INDEX_FILE` deletions ensure ambient state from
 * the launching shell can never retarget a command (callers re-supply
 * `GIT_INDEX_FILE` deliberately via `env` for temp-index commits).
 */
function baseEnv(extra: Record<string, string> | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return extra ? { ...env, ...extra } : env;
}

export function createGitExec(options: CreateGitExecOptions = {}): GitRunner {
  const gitBinary = options.gitBinary ?? 'git';
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  return (args, invocation) =>
    new Promise<GitExecResult>((resolve) => {
      const startedAt = Date.now();
      const timeoutMs = invocation.timeoutMs ?? defaultTimeoutMs;
      execFile(
        gitBinary,
        args as string[],
        {
          cwd: invocation.cwd,
          env: baseEnv(invocation.env),
          timeout: timeoutMs,
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          const spawnFailed = error !== null && 'code' in error && error.code === 'ENOENT';
          const timedOut = error !== null && 'killed' in error && error.killed === true;
          const exitCode = error === null ? 0 : typeof error.code === 'number' ? error.code : -1;
          const result: GitExecResult = {
            code: exitCode,
            stdout: String(stdout),
            stderr: String(stderr),
            spawnFailed,
            timedOut,
          };
          if (isStateChanging(args)) {
            const output = `${result.stdout}${result.stdout !== '' && result.stderr !== '' ? '\n' : ''}${result.stderr}`;
            options.audit?.({
              at: new Date(startedAt).toISOString(),
              args,
              cwd: invocation.cwd,
              code: result.code,
              durationMs: Date.now() - startedAt,
              output: output.trim().slice(0, AUDIT_OUTPUT_CAP),
            });
          }
          resolve(result);
        },
      );
    });
}

/** Parsed `git version` probe outcome — the §7 degradation gate. */
export type GitAvailability =
  | { available: true; version: string }
  | { available: false; reason: 'missing' | 'below-floor'; version?: string };

/**
 * Minimum supported git. 2.20 (2018) predates every platform this app
 * ships on; the floor exists so truly ancient installs degrade loudly
 * instead of failing on porcelain flags mid-flight.
 */
export const GIT_VERSION_FLOOR = [2, 20, 0] as const;

function parseVersion(stdout: string): [number, number, number] | null {
  const match = stdout.match(/git version (\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? '0')];
}

/** Probe the installed git; `cwd` only anchors the spawn and needs no repo. */
export async function probeGitAvailability(run: GitRunner, cwd: string): Promise<GitAvailability> {
  const result = await run(['version'], { cwd, timeoutMs: 10_000 });
  if (result.spawnFailed || result.code !== 0) return { available: false, reason: 'missing' };
  const version = parseVersion(result.stdout);
  if (version === null) return { available: false, reason: 'missing' };
  const versionText = version.join('.');
  const [major, minor, patch] = version;
  const [floorMajor, floorMinor, floorPatch] = GIT_VERSION_FLOOR;
  const belowFloor =
    major < floorMajor ||
    (major === floorMajor && (minor < floorMinor || (minor === floorMinor && patch < floorPatch)));
  if (belowFloor) return { available: false, reason: 'below-floor', version: versionText };
  return { available: true, version: versionText };
}
