/**
 * Install-detection probe runner — the fs half of migration ladder rung 1
 * (the migration plan §3.1). Core owns the per-OS probe allowlist and the
 * findings interpretation; this module only answers the probes:
 *
 *   - `path`             → one lstat, existence only.
 *   - `dir-entry-prefix` → entry names of that one directory, matched
 *                          against the prefix. Nothing below it is
 *                          listed and no file content is ever read.
 *
 * Every fs error (missing path, permission, non-directory) is a probe
 * miss — detection is best-effort by design and never throws.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import {
  type InstallProbe,
  type InstallProbeResult,
  type InstallProbeRoots,
  listInstallProbes,
  resolveInstallFindings,
  type ToolInstallFinding,
} from '@openheaders/core/import';

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function runProbe(probe: InstallProbe): Promise<InstallProbeResult> {
  if (probe.kind === 'path') {
    return { probe, matchedPath: (await pathExists(probe.path)) ? probe.path : null };
  }
  try {
    const entries = await fs.readdir(probe.dir);
    const separator = probe.dir.includes('\\') ? '\\' : '/';
    const match = entries.find((name) => name.startsWith(probe.namePrefix));
    return { probe, matchedPath: match !== undefined ? `${probe.dir}${separator}${match}` : null };
  } catch {
    return { probe, matchedPath: null };
  }
}

/** Answer a probe list against the real filesystem, preserving order. */
export async function runInstallProbes(probes: readonly InstallProbe[]): Promise<InstallProbeResult[]> {
  return Promise.all(probes.map(runProbe));
}

export interface DetectInstalledToolsOptions {
  /** Defaults to `process.platform`. */
  platform?: string;
  /** Defaults to `os.homedir()` + the win32 app-data env vars. */
  roots?: InstallProbeRoots;
}

function defaultRoots(): InstallProbeRoots {
  return {
    home: os.homedir(),
    appData: process.env.APPDATA,
    localAppData: process.env.LOCALAPPDATA,
  };
}

/**
 * Migration rung 1 end-to-end: allowlisted probes for this machine →
 * one finding per known tool. Read-only and content-blind; runs only
 * behind the explicit user consent click (plan §5.1).
 */
export async function detectInstalledTools(options: DetectInstalledToolsOptions = {}): Promise<ToolInstallFinding[]> {
  const probes = listInstallProbes(options.platform ?? process.platform, options.roots ?? defaultRoots());
  return resolveInstallFindings(await runInstallProbes(probes));
}
