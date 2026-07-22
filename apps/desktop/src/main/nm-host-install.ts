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
 * Pure path/shape derivation + injected fs seams, kept apart from the
 * Electron wiring so the whole surface is unit-testable. macOS + Chrome
 * in this slice; the target table is the extension point.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** The name extensions call `chrome.runtime.sendNativeMessage` with. */
export const NM_HOST_NAME = 'io.openheaders.nm_bootstrap';

/** The published Chrome Web Store extension id. */
export const CHROME_EXTENSION_ID = 'ablaikadpbfblkmhpmbbnbbfjoibeejb';

export interface NmHostBinaryFacts {
  /** `app.isPackaged` — extraResource vs monorepo sibling. */
  isPackaged: boolean;
  /** `process.resourcesPath` — the packaged app's resources dir. */
  resourcesPath: string;
  /** `app.getAppPath()` — `apps/desktop` in dev. */
  appPath: string;
}

/** Where the shipped NM host binary is expected to live. */
export function nmHostBinaryCandidate(facts: NmHostBinaryFacts): string {
  if (facts.isPackaged) return path.join(facts.resourcesPath, 'nm-host', 'oh-nm-host');
  return path.resolve(facts.appPath, '..', 'nm-host', 'dist-bun', 'oh-nm-host');
}

export interface NmManifestTarget {
  /** Display name for the boot log. */
  readonly browser: string;
  /**
   * The browser's per-user profile root — registration is skipped
   * entirely when this doesn't exist (browser not installed).
   */
  readonly browserRoot: string;
  /** The NativeMessagingHosts dir the manifest lands in. */
  readonly manifestDir: string;
}

/** macOS per-user manifest locations. Chrome in this slice. */
export function macosNmManifestTargets(homeDir: string): NmManifestTarget[] {
  const chromeRoot = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
  return [
    {
      browser: 'Google Chrome',
      browserRoot: chromeRoot,
      manifestDir: path.join(chromeRoot, 'NativeMessagingHosts'),
    },
  ];
}

/** The manifest document a browser reads to spawn the host. */
export function buildNmManifest(hostBinaryPath: string, allowedExtensionIds: readonly string[]): string {
  const manifest = {
    name: NM_HOST_NAME,
    description: 'Open Headers native-messaging bootstrap (token handoff only)',
    path: hostBinaryPath,
    type: 'stdio',
    allowed_origins: allowedExtensionIds.map((id) => `chrome-extension://${id}/`),
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
  const content = buildNmManifest(options.hostBinaryPath, options.allowedExtensionIds);
  const results: NmManifestRegistration[] = [];
  for (const target of options.targets) {
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
