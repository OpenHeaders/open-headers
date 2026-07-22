/**
 * NM bootstrap host install — binary path derivation (packaged
 * extraResource vs monorepo sibling), the manifest document shape, and
 * the auto-register/repair discipline over an in-memory fs: register
 * on first boot, repair a drifted manifest, leave an identical one
 * untouched, and skip browsers that aren't installed.
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildNmManifest,
  CHROME_EXTENSION_ID,
  macosNmManifestTargets,
  NM_HOST_NAME,
  type NmManifestFs,
  nmHostBinaryCandidate,
  registerNmManifests,
} from '../../../src/main/nm-host-install';

const HOST_PATH = '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host';

describe('nmHostBinaryCandidate', () => {
  it('resolves the packaged extraResource binary', () => {
    const candidate = nmHostBinaryCandidate({
      isPackaged: true,
      resourcesPath: '/Applications/OpenHeaders.app/Contents/Resources',
      appPath: '/Applications/OpenHeaders.app/Contents/Resources/app.asar',
    });
    expect(candidate).toBe(path.join('/Applications/OpenHeaders.app/Contents/Resources', 'nm-host', 'oh-nm-host'));
  });

  it('resolves the monorepo sibling pack output in dev', () => {
    const candidate = nmHostBinaryCandidate({
      isPackaged: false,
      resourcesPath: '/somewhere/electron/resources',
      appPath: '/repo/apps/desktop',
    });
    expect(candidate).toBe(path.resolve('/repo/apps/nm-host/dist-bun/oh-nm-host'));
  });
});

describe('buildNmManifest', () => {
  it('emits the stdio manifest with extension-scoped origins', () => {
    const manifest = JSON.parse(buildNmManifest(HOST_PATH, [CHROME_EXTENSION_ID])) as Record<string, unknown>;
    expect(manifest.name).toBe(NM_HOST_NAME);
    expect(manifest.type).toBe('stdio');
    expect(manifest.path).toBe(HOST_PATH);
    expect(manifest.allowed_origins).toEqual([`chrome-extension://${CHROME_EXTENSION_ID}/`]);
  });
});

interface FakeFs extends NmManifestFs {
  files: Map<string, string>;
  dirs: Set<string>;
  writes: string[];
}

function fakeFs(seed: { files?: Record<string, string>; dirs?: string[] } = {}): FakeFs {
  const files = new Map(Object.entries(seed.files ?? {}));
  const dirs = new Set(seed.dirs ?? []);
  const writes: string[] = [];
  return {
    files,
    dirs,
    writes,
    existsSync: (target) => files.has(target) || dirs.has(target),
    readFileSync: (target) => {
      const content = files.get(target);
      if (content === undefined) throw new Error(`ENOENT: ${target}`);
      return content;
    },
    writeFileSync: (target, content) => {
      files.set(target, content);
      writes.push(target);
    },
    mkdirSync: (target) => {
      dirs.add(target);
    },
  };
}

describe('registerNmManifests', () => {
  const targets = macosNmManifestTargets('/Users/casey');
  const chromeRoot = targets[0].browserRoot;
  const manifestPath = path.join(targets[0].manifestDir, `${NM_HOST_NAME}.json`);
  const expected = buildNmManifest(HOST_PATH, [CHROME_EXTENSION_ID]);

  function register(fileSystem: NmManifestFs) {
    return registerNmManifests({
      hostBinaryPath: HOST_PATH,
      targets,
      allowedExtensionIds: [CHROME_EXTENSION_ID],
      fileSystem,
    });
  }

  it('registers a fresh manifest for an installed browser', () => {
    const fs = fakeFs({ dirs: [chromeRoot] });
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'registered' }]);
    expect(fs.files.get(manifestPath)).toBe(expected);
    expect(fs.dirs.has(targets[0].manifestDir)).toBe(true);
  });

  it('repairs a drifted manifest (moved binary, stale allowlist)', () => {
    const fs = fakeFs({
      dirs: [chromeRoot, targets[0].manifestDir],
      files: { [manifestPath]: buildNmManifest('/old/location/oh-nm-host', [CHROME_EXTENSION_ID]) },
    });
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'repaired' }]);
    expect(fs.files.get(manifestPath)).toBe(expected);
  });

  it('leaves an identical manifest untouched', () => {
    const fs = fakeFs({ dirs: [chromeRoot, targets[0].manifestDir], files: { [manifestPath]: expected } });
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'unchanged' }]);
    expect(fs.writes).toEqual([]);
  });

  it('skips a browser that is not installed without creating litter', () => {
    const fs = fakeFs();
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'skipped' }]);
    expect(fs.writes).toEqual([]);
    expect(fs.dirs.size).toBe(0);
  });

  it('answers skipped instead of throwing on an unwritable profile', () => {
    const fs = fakeFs({ dirs: [chromeRoot] });
    fs.mkdirSync = () => {
      throw new Error('EACCES');
    };
    expect(register(fs)).toEqual([{ browser: 'Google Chrome', manifestPath, action: 'skipped' }]);
  });
});
