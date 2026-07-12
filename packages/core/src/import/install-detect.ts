/**
 * Install detection — migration ladder rung 1 (MIGRATION_PLAN.md §3.1).
 *
 * Pure allowlist + interpretation: this module lists the exact per-OS
 * filesystem probes that decide whether a known API tool is present, and
 * turns probe results back into per-tool findings. It never touches the
 * filesystem — the host adapter runs the probes and hands the results
 * back, so the allowlist stays testable and platform-free.
 *
 * Two probe shapes only:
 *
 *   - `path` — does this exact absolute path exist (file or directory)?
 *   - `dir-entry-prefix` — does this exact directory contain an entry
 *     whose name starts with the prefix (versioned editor-extension
 *     directories)? The host reads entry NAMES of that one directory,
 *     nothing below it.
 *
 * Neither shape walks a tree or opens file contents; credential/session
 * files are unreachable by construction (plan §7).
 */

export const MIGRATION_TOOLS = ['postman', 'insomnia', 'thunder-client', 'bruno'] as const;

export type MigrationTool = (typeof MIGRATION_TOOLS)[number];

export const MIGRATION_TOOL_NAMES: Record<MigrationTool, string> = {
  postman: 'Postman',
  insomnia: 'Insomnia',
  'thunder-client': 'Thunder Client',
  bruno: 'Bruno',
};

export type InstallProbePlatform = 'darwin' | 'win32' | 'linux';

/** Absolute roots the probe paths hang off — resolved host-side. */
export interface InstallProbeRoots {
  /** User home directory. */
  home: string;
  /** win32 `%APPDATA%` (roaming); win32 probes needing it are skipped when absent. */
  appData?: string;
  /** win32 `%LOCALAPPDATA%`; win32 probes needing it are skipped when absent. */
  localAppData?: string;
}

export type InstallProbe =
  | { tool: MigrationTool; kind: 'path'; path: string }
  | { tool: MigrationTool; kind: 'dir-entry-prefix'; dir: string; namePrefix: string };

export interface InstallProbeResult {
  probe: InstallProbe;
  /** The absolute path that satisfied the probe, or null on a miss. */
  matchedPath: string | null;
}

export interface ToolInstallFinding {
  tool: MigrationTool;
  displayName: string;
  detected: boolean;
  /** Matched marker paths, in probe-table order. */
  markers: string[];
}

const VSCODE_THUNDER_EXTENSION_PREFIX = 'rangav.vscode-thunder-client-';
const VSCODE_THUNDER_GLOBAL_STORAGE = 'rangav.vscode-thunder-client';

function darwinProbes(roots: InstallProbeRoots): InstallProbe[] {
  const home = roots.home;
  const support = `${home}/Library/Application Support`;
  return [
    // Verified on a live macOS install (MIGRATION_STATUS.md S1).
    { tool: 'postman', kind: 'path', path: '/Applications/Postman.app' },
    { tool: 'postman', kind: 'path', path: `${home}/Applications/Postman.app` },
    { tool: 'postman', kind: 'path', path: `${support}/Postman` },
    { tool: 'insomnia', kind: 'path', path: '/Applications/Insomnia.app' },
    { tool: 'insomnia', kind: 'path', path: `${home}/Applications/Insomnia.app` },
    { tool: 'insomnia', kind: 'path', path: `${support}/Insomnia` },
    {
      tool: 'thunder-client',
      kind: 'dir-entry-prefix',
      dir: `${home}/.vscode/extensions`,
      namePrefix: VSCODE_THUNDER_EXTENSION_PREFIX,
    },
    {
      tool: 'thunder-client',
      kind: 'path',
      path: `${support}/Code/User/globalStorage/${VSCODE_THUNDER_GLOBAL_STORAGE}`,
    },
    { tool: 'bruno', kind: 'path', path: '/Applications/Bruno.app' },
    { tool: 'bruno', kind: 'path', path: `${home}/Applications/Bruno.app` },
    { tool: 'bruno', kind: 'path', path: `${support}/bruno` },
  ];
}

function win32Probes(roots: InstallProbeRoots): InstallProbe[] {
  const { home, appData, localAppData } = roots;
  const probes: InstallProbe[] = [];
  if (localAppData !== undefined) {
    probes.push(
      { tool: 'postman', kind: 'path', path: `${localAppData}\\Postman` },
      { tool: 'insomnia', kind: 'path', path: `${localAppData}\\insomnia` },
      { tool: 'bruno', kind: 'path', path: `${localAppData}\\Programs\\bruno` },
    );
  }
  if (appData !== undefined) {
    probes.push(
      { tool: 'postman', kind: 'path', path: `${appData}\\Postman` },
      { tool: 'insomnia', kind: 'path', path: `${appData}\\Insomnia` },
      { tool: 'bruno', kind: 'path', path: `${appData}\\bruno` },
      {
        tool: 'thunder-client',
        kind: 'path',
        path: `${appData}\\Code\\User\\globalStorage\\${VSCODE_THUNDER_GLOBAL_STORAGE}`,
      },
    );
  }
  probes.push({
    tool: 'thunder-client',
    kind: 'dir-entry-prefix',
    dir: `${home}\\.vscode\\extensions`,
    namePrefix: VSCODE_THUNDER_EXTENSION_PREFIX,
  });
  return probes;
}

function linuxProbes(roots: InstallProbeRoots): InstallProbe[] {
  const home = roots.home;
  return [
    { tool: 'postman', kind: 'path', path: `${home}/.config/Postman` },
    { tool: 'insomnia', kind: 'path', path: `${home}/.config/Insomnia` },
    {
      tool: 'thunder-client',
      kind: 'dir-entry-prefix',
      dir: `${home}/.vscode/extensions`,
      namePrefix: VSCODE_THUNDER_EXTENSION_PREFIX,
    },
    {
      tool: 'thunder-client',
      kind: 'path',
      path: `${home}/.config/Code/User/globalStorage/${VSCODE_THUNDER_GLOBAL_STORAGE}`,
    },
    { tool: 'bruno', kind: 'path', path: `${home}/.config/bruno` },
  ];
}

/**
 * The complete probe allowlist for one platform. Unknown platforms get an
 * empty list — findings then report every tool as not detected rather
 * than failing.
 */
export function listInstallProbes(platform: string, roots: InstallProbeRoots): InstallProbe[] {
  switch (platform) {
    case 'darwin':
      return darwinProbes(roots);
    case 'win32':
      return win32Probes(roots);
    case 'linux':
      return linuxProbes(roots);
    default:
      return [];
  }
}

/**
 * Fold probe results into one finding per tool, in `MIGRATION_TOOLS`
 * order. Every tool is always present so surfaces can render a stable
 * list; `detected` is true when any of its probes matched.
 */
export function resolveInstallFindings(results: readonly InstallProbeResult[]): ToolInstallFinding[] {
  return MIGRATION_TOOLS.map((tool) => {
    const markers = results.flatMap((result) =>
      result.probe.tool === tool && result.matchedPath !== null ? [result.matchedPath] : [],
    );
    return {
      tool,
      displayName: MIGRATION_TOOL_NAMES[tool],
      detected: markers.length > 0,
      markers,
    };
  });
}
