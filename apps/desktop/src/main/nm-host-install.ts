/**
 * NM bootstrap host install (OBSERVABILITY_PLAN.md §4 + §8 Phase 7):
 * where the desktop finds the shipped `oh-nm-host` binary, and the
 * per-browser native-messaging manifest registration that points a
 * browser at it.
 *
 * Registration is auto + idempotent-repair (ratified S17): the desktop
 * writes each manifest on boot when its content differs from the
 * expected shape — first boot registers, later boots repair a moved
 * binary path (auto-update relocations) or a stale allowlist, and an
 * untouched manifest costs one read. Manifests are only written for
 * browsers that are actually present (their profile root exists) so an
 * uninstalled browser never grows Open Headers litter. Enterprise
 * fleets deploy the same manifests via policy templates instead — a
 * later Phase 7 slice.
 *
 * Two registration mechanisms, one discipline:
 *
 *   - macOS: the manifest JSON lands in each browser's per-user
 *     `NativeMessagingHosts` directory.
 *   - Windows: Chromium browsers discover hosts through an
 *     `HKCU\Software\<vendor>\<browser>\NativeMessagingHosts\<name>`
 *     key whose default value points at a manifest JSON on disk — one
 *     shared manifest file under the desktop's own data dir, one
 *     registry key per installed vendor (Chrome's channels share the
 *     stable key), written via `reg.exe`.
 *
 * Pure path/shape derivation + injected fs/command seams, kept apart
 * from the Electron wiring so the whole surface is unit-testable.
 * Two manifest families ride the same discipline: Chromium browsers
 * (Chrome family, Edge, Brave) with `allowed_origins`, and Gecko
 * (Firefox) with `allowed_extensions` — Firefox reads one shared
 * per-user Mozilla dir on macOS and its own `HKCU\Software\Mozilla`
 * key on Windows (profile roots live under Roaming, not Local).
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The name extensions call `chrome.runtime.sendNativeMessage` with. */
export const NM_HOST_NAME = 'io.openheaders.nm_bootstrap';

/**
 * Whether packaged Windows builds carry an Authenticode signature on
 * the shipped binaries. Beta-channel Windows builds ship unsigned by
 * design; flips on (or becomes channel-derived) when production
 * signing starts. The daemon's verification chain fully supports host
 * signature checks on win32 — this constant is the only gate.
 */
export const WINDOWS_HOST_BINARY_SIGNED = false;

/** The published Chrome Web Store extension id. */
export const CHROME_EXTENSION_ID = 'ablaikadpbfblkmhpmbbnbbfjoibeejb';

/**
 * The published Edge Add-ons extension id. Every Chromium manifest
 * carries the union allowlist — Edge users may install from either
 * store, and a second origin in a browser that never sees it is inert.
 */
export const EDGE_EXTENSION_ID = 'gnbibobkkddlflknjkgcmokdlpddegpo';

/** The Firefox (Gecko) extension id from `browser_specific_settings.gecko.id`. */
export const FIREFOX_EXTENSION_ID = 'contact@tirzuman.com';

export interface NmHostBinaryFacts {
  /** `app.isPackaged` — extraResource vs monorepo sibling. */
  isPackaged: boolean;
  /** `process.resourcesPath` — the packaged app's resources dir. */
  resourcesPath: string;
  /** `app.getAppPath()` — `apps/desktop` in dev. */
  appPath: string;
  /** `process.platform` — picks the binary name (`.exe` on Windows). */
  platform: NodeJS.Platform;
}

/** Where the shipped NM host binary is expected to live. */
export function nmHostBinaryCandidate(facts: NmHostBinaryFacts): string {
  const binaryName = facts.platform === 'win32' ? 'oh-nm-host.exe' : 'oh-nm-host';
  if (facts.isPackaged) return path.join(facts.resourcesPath, 'nm-host', binaryName);
  return path.resolve(facts.appPath, '..', 'nm-host', 'dist-bun', binaryName);
}

/** Which manifest document a target reads — the allowlist vocabularies differ. */
export type NmManifestFamily = 'chromium' | 'gecko';

export interface NmManifestTarget {
  /** Display name for the boot log. */
  readonly browser: string;
  /** Selects the manifest document (`allowed_origins` vs `allowed_extensions`). */
  readonly family: NmManifestFamily;
  /**
   * The browser's per-user profile root — registration is skipped
   * entirely when this doesn't exist (browser not installed).
   */
  readonly browserRoot: string;
  /** The NativeMessagingHosts dir the manifest lands in. */
  readonly manifestDir: string;
}

/** macOS per-user manifest locations. Each Chromium browser reads its
 *  own NativeMessagingHosts dir under its profile root; Firefox reads
 *  the shared Mozilla dir, distinct from its profile root. */
export function macosNmManifestTargets(homeDir: string): NmManifestTarget[] {
  const appSupport = path.join(homeDir, 'Library', 'Application Support');
  const chromiumTarget = (browser: string, ...rootSegments: string[]): NmManifestTarget => {
    const browserRoot = path.join(appSupport, ...rootSegments);
    return { browser, family: 'chromium', browserRoot, manifestDir: path.join(browserRoot, 'NativeMessagingHosts') };
  };
  return [
    chromiumTarget('Google Chrome', 'Google', 'Chrome'),
    chromiumTarget('Google Chrome Beta', 'Google', 'Chrome Beta'),
    chromiumTarget('Microsoft Edge', 'Microsoft Edge'),
    chromiumTarget('Brave Browser', 'BraveSoftware', 'Brave-Browser'),
    {
      browser: 'Firefox',
      family: 'gecko',
      browserRoot: path.join(appSupport, 'Firefox'),
      manifestDir: path.join(appSupport, 'Mozilla', 'NativeMessagingHosts'),
    },
  ];
}

const NM_MANIFEST_DESCRIPTION = 'Open Headers native-messaging bootstrap (token handoff only)';

/** The manifest document a Chromium browser reads to spawn the host. */
export function buildNmManifest(hostBinaryPath: string, allowedExtensionIds: readonly string[]): string {
  const manifest = {
    name: NM_HOST_NAME,
    description: NM_MANIFEST_DESCRIPTION,
    path: hostBinaryPath,
    type: 'stdio',
    allowed_origins: allowedExtensionIds.map((id) => `chrome-extension://${id}/`),
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** The Gecko variant — Firefox allowlists bare extension ids, not origins. */
export function buildGeckoNmManifest(hostBinaryPath: string, allowedGeckoIds: readonly string[]): string {
  const manifest = {
    name: NM_HOST_NAME,
    description: NM_MANIFEST_DESCRIPTION,
    path: hostBinaryPath,
    type: 'stdio',
    allowed_extensions: [...allowedGeckoIds],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export interface NmManifestFs {
  existsSync(target: string): boolean;
  readFileSync(target: string): string;
  writeFileSync(target: string, content: string): void;
  mkdirSync(target: string): void;
}

const realFs: NmManifestFs = {
  existsSync: (target) => fs.existsSync(target),
  readFileSync: (target) => fs.readFileSync(target, 'utf-8'),
  writeFileSync: (target, content) => fs.writeFileSync(target, content, 'utf-8'),
  mkdirSync: (target) => {
    fs.mkdirSync(target, { recursive: true });
  },
};

export interface RegisterNmManifestsOptions {
  readonly hostBinaryPath: string;
  readonly targets: readonly NmManifestTarget[];
  readonly allowedExtensionIds: readonly string[];
  /** Gecko-family allowlist (Firefox extension ids). */
  readonly allowedGeckoIds: readonly string[];
  /** Test seam — defaults to the real filesystem. */
  readonly fileSystem?: NmManifestFs;
}

export interface NmManifestRegistration {
  readonly browser: string;
  readonly manifestPath: string;
  readonly action: 'registered' | 'repaired' | 'unchanged' | 'skipped';
}

/**
 * Write/repair the NM manifest for every installed browser target.
 * Never throws — a single unwritable profile dir must not break boot;
 * the caller logs the per-target outcome.
 */
export function registerNmManifests(options: RegisterNmManifestsOptions): NmManifestRegistration[] {
  const fileSystem = options.fileSystem ?? realFs;
  const contentByFamily: Record<NmManifestFamily, string> = {
    chromium: buildNmManifest(options.hostBinaryPath, options.allowedExtensionIds),
    gecko: buildGeckoNmManifest(options.hostBinaryPath, options.allowedGeckoIds),
  };
  const results: NmManifestRegistration[] = [];
  for (const target of options.targets) {
    const content = contentByFamily[target.family];
    const manifestPath = path.join(target.manifestDir, `${NM_HOST_NAME}.json`);
    try {
      if (!fileSystem.existsSync(target.browserRoot)) {
        results.push({ browser: target.browser, manifestPath, action: 'skipped' });
        continue;
      }
      if (fileSystem.existsSync(manifestPath)) {
        const current = fileSystem.readFileSync(manifestPath);
        if (current === content) {
          results.push({ browser: target.browser, manifestPath, action: 'unchanged' });
          continue;
        }
        fileSystem.writeFileSync(manifestPath, content);
        results.push({ browser: target.browser, manifestPath, action: 'repaired' });
        continue;
      }
      fileSystem.mkdirSync(target.manifestDir);
      fileSystem.writeFileSync(manifestPath, content);
      results.push({ browser: target.browser, manifestPath, action: 'registered' });
    } catch {
      results.push({ browser: target.browser, manifestPath, action: 'skipped' });
    }
  }
  return results;
}

// ── Windows: registry-keyed manifests ────────────────────────────────

export interface NmRegistryTarget {
  /** Display name for the boot log. */
  readonly browser: string;
  /** Selects the manifest document (`allowed_origins` vs `allowed_extensions`). */
  readonly family: NmManifestFamily;
  /**
   * Per-user profile roots that mark the browser as installed —
   * registration is skipped when none exists. A vendor whose channels
   * share one registry key lists every channel's root here.
   */
  readonly presenceRoots: readonly string[];
  /** The HKCU NativeMessagingHosts key whose default value is the manifest path. */
  readonly registryKey: string;
}

/**
 * Windows per-user registry targets. Chrome's channels
 * (stable/beta/dev/canary) all read the stable `Software\Google\Chrome`
 * key, so the family is one target with every channel's profile root as
 * a presence marker. Firefox reads the vendor-shared
 * `Software\Mozilla\NativeMessagingHosts` key, and its profile roots
 * live under Roaming AppData while the Chromium family's live under
 * Local — hence the two directory inputs.
 */
export function windowsNmManifestTargets(localAppDataDir: string, roamingAppDataDir: string): NmRegistryTarget[] {
  const hostKey = (...vendorSegments: string[]): string =>
    ['HKCU\\Software', ...vendorSegments, 'NativeMessagingHosts', NM_HOST_NAME].join('\\');
  return [
    {
      browser: 'Google Chrome',
      family: 'chromium',
      presenceRoots: [
        path.join(localAppDataDir, 'Google', 'Chrome', 'User Data'),
        path.join(localAppDataDir, 'Google', 'Chrome Beta', 'User Data'),
      ],
      registryKey: hostKey('Google', 'Chrome'),
    },
    {
      browser: 'Microsoft Edge',
      family: 'chromium',
      presenceRoots: [path.join(localAppDataDir, 'Microsoft', 'Edge', 'User Data')],
      registryKey: hostKey('Microsoft', 'Edge'),
    },
    {
      browser: 'Brave Browser',
      family: 'chromium',
      presenceRoots: [path.join(localAppDataDir, 'BraveSoftware', 'Brave-Browser', 'User Data')],
      registryKey: hostKey('BraveSoftware', 'Brave-Browser'),
    },
    {
      browser: 'Firefox',
      family: 'gecko',
      presenceRoots: [path.join(roamingAppDataDir, 'Mozilla', 'Firefox')],
      registryKey: hostKey('Mozilla'),
    },
  ];
}

export interface RegistryCommandResult {
  readonly stdout: string;
  readonly code: number;
}

/** `reg.exe` seam — query/add against the per-user hive. */
export type RegistryRunner = (args: readonly string[]) => Promise<RegistryCommandResult>;

const REG_COMMAND_TIMEOUT_MS = 10_000;

const defaultRegistryRunner: RegistryRunner = (args) =>
  new Promise((resolve) => {
    execFile('reg.exe', [...args], { timeout: REG_COMMAND_TIMEOUT_MS }, (err, stdout) => {
      resolve({ stdout: String(stdout), code: err === null ? 0 : typeof err.code === 'number' ? err.code : 1 });
    });
  });

/** Extract the default value from `reg query <key> /ve` output. */
export function parseRegQueryDefaultValue(output: string): string | null {
  const match = output.match(/\(Default\)\s+REG_SZ\s+(.+)/);
  if (!match) return null;
  const value = match[1].trim();
  return value.length > 0 ? value : null;
}

export interface RegisterWindowsNmManifestsOptions {
  readonly hostBinaryPath: string;
  /** Where the shared manifest JSONs land (the desktop's own data dir). */
  readonly manifestDir: string;
  readonly targets: readonly NmRegistryTarget[];
  readonly allowedExtensionIds: readonly string[];
  /** Gecko-family allowlist (Firefox extension ids). */
  readonly allowedGeckoIds: readonly string[];
  /** Test seam — defaults to the real filesystem. */
  readonly fileSystem?: NmManifestFs;
  /** Test seam — defaults to real `reg.exe`. */
  readonly runRegistry?: RegistryRunner;
}

export interface NmRegistryRegistration {
  readonly browser: string;
  readonly registryKey: string;
  readonly action: 'registered' | 'repaired' | 'unchanged' | 'skipped';
}

/**
 * Write/repair the shared manifest files + per-vendor registry keys for
 * every installed browser target. Same discipline as the macOS dirs:
 * register on first boot, repair a drifted key or manifest, leave a
 * settled pair untouched, skip absent browsers, and never throw — a
 * broken vendor entry must not break boot.
 */
export async function registerWindowsNmManifests(
  options: RegisterWindowsNmManifestsOptions,
): Promise<NmRegistryRegistration[]> {
  const fileSystem = options.fileSystem ?? realFs;
  const runRegistry = options.runRegistry ?? defaultRegistryRunner;
  // One manifest file per family under the desktop's data dir — the
  // registry key name carries the host identity, so the Gecko file's
  // suffix only keeps the two documents apart on disk.
  const families: Record<NmManifestFamily, { content: string; manifestPath: string }> = {
    chromium: {
      content: buildNmManifest(options.hostBinaryPath, options.allowedExtensionIds),
      manifestPath: path.join(options.manifestDir, `${NM_HOST_NAME}.json`),
    },
    gecko: {
      content: buildGeckoNmManifest(options.hostBinaryPath, options.allowedGeckoIds),
      manifestPath: path.join(options.manifestDir, `${NM_HOST_NAME}.firefox.json`),
    },
  };
  const results: NmRegistryRegistration[] = [];
  const installedTargets = options.targets.filter((target) =>
    target.presenceRoots.some((root) => fileSystem.existsSync(root)),
  );

  // Each family's manifest file is shared across its vendors — settle
  // it once, and only when at least one browser will point at it (no
  // litter on a browserless machine). A repaired file marks every
  // settled key of that family repaired too: the registry value is
  // unchanged but what the browser reads through it isn't.
  const manifestChanged: Record<NmManifestFamily, boolean> = { chromium: false, gecko: false };
  for (const family of ['chromium', 'gecko'] as const) {
    if (!installedTargets.some((target) => target.family === family)) continue;
    const { content, manifestPath } = families[family];
    try {
      const current = fileSystem.existsSync(manifestPath) ? fileSystem.readFileSync(manifestPath) : null;
      if (current !== content) {
        fileSystem.mkdirSync(options.manifestDir);
        fileSystem.writeFileSync(manifestPath, content);
        manifestChanged[family] = current !== null;
      }
    } catch {
      // An unwritable data dir fails every target below via the
      // registry value pointing at a stale/absent manifest; per-target
      // reg failures already fold to 'skipped'.
    }
  }

  for (const target of options.targets) {
    if (!installedTargets.includes(target)) {
      results.push({ browser: target.browser, registryKey: target.registryKey, action: 'skipped' });
      continue;
    }
    const { manifestPath } = families[target.family];
    try {
      const query = await runRegistry(['query', target.registryKey, '/ve']);
      const currentValue = query.code === 0 ? parseRegQueryDefaultValue(query.stdout) : null;
      const settled = currentValue !== null && currentValue.toLowerCase() === manifestPath.toLowerCase();
      if (settled) {
        results.push({
          browser: target.browser,
          registryKey: target.registryKey,
          action: manifestChanged[target.family] ? 'repaired' : 'unchanged',
        });
        continue;
      }
      const add = await runRegistry(['add', target.registryKey, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f']);
      if (add.code !== 0) {
        results.push({ browser: target.browser, registryKey: target.registryKey, action: 'skipped' });
        continue;
      }
      results.push({
        browser: target.browser,
        registryKey: target.registryKey,
        action: currentValue === null ? 'registered' : 'repaired',
      });
    } catch {
      results.push({ browser: target.browser, registryKey: target.registryKey, action: 'skipped' });
    }
  }
  return results;
}
