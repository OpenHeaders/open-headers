/**
 * The check a move to the Windows package makes before the classic
 * install is removed, and the scratch profile a start uses when it must
 * leave both data folders alone.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import {
  CHECK_PACKAGE_START_SWITCH,
  checkPackageStart,
  PACKAGE_START_CHECK_EXIT,
  type PackageStartCheckFacts,
} from '@/main/bootstrap/package-start-check';
import { clearStaleScratchProfiles, makeScratchProfile } from '@/main/bootstrap/scratch-profile';

describe('the package start check', () => {
  const openDataEngine = vi.fn<() => void>();

  function makeFacts(overrides: Partial<PackageStartCheckFacts> = {}): PackageStartCheckFacts {
    return { installKind: 'msix', helperPresent: true, missingAliases: [], ...overrides };
  }

  beforeEach(() => {
    openDataEngine.mockReset();
  });

  it('answers 0 when the package starts with every part', () => {
    expect(checkPackageStart(makeFacts(), { openDataEngine })).toEqual({ exitCode: 0, why: null });
    expect(openDataEngine).toHaveBeenCalledOnce();
  });

  it.each<InstallKind | null>(['nsis', 'msi', 'dev', null])(
    'answers 3 when what started is of kind %s, and loads nothing',
    (installKind) => {
      const check = checkPackageStart(makeFacts({ installKind }), { openDataEngine });
      expect(check.exitCode).toBe(3);
      expect(openDataEngine).not.toHaveBeenCalled();
    },
  );

  it('answers 4 when the browser helper is not in the package', () => {
    expect(checkPackageStart(makeFacts({ helperPresent: false }), { openDataEngine }).exitCode).toBe(4);
  });

  it('answers 4 and names the alias Windows does not keep', () => {
    const check = checkPackageStart(makeFacts({ missingAliases: ['openheaders-nm-host.exe'] }), { openDataEngine });
    expect(check).toEqual({ exitCode: 4, why: 'Windows keeps no launch alias openheaders-nm-host.exe' });
  });

  it('answers 4 when the data engine does not load', () => {
    openDataEngine.mockImplementation(() => {
      throw new Error('The specified module could not be found.');
    });
    expect(checkPackageStart(makeFacts(), { openDataEngine })).toEqual({
      exitCode: 4,
      why: 'the data engine did not load: The specified module could not be found.',
    });
  });

  it('keeps its permanent names', () => {
    expect(CHECK_PACKAGE_START_SWITCH).toBe('--check-package-start');
    expect(PACKAGE_START_CHECK_EXIT).toEqual({ starts: 0, notAPackage: 3, partDidNotLoad: 4, timedOut: 5 });
  });
});

describe('the scratch profile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'oh-scratch-profile-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('is a fresh folder under the temporary folder, one per start', () => {
    const first = makeScratchProfile(tempDir);
    const second = makeScratchProfile(tempDir);
    expect(first).not.toBe(second);
    expect(existsSync(first)).toBe(true);
    expect(existsSync(second)).toBe(true);
    expect(readdirSync(tempDir)).toHaveLength(2);
  });

  it('clears the ones earlier starts left, once they are old, and nothing else', () => {
    const old = makeScratchProfile(tempDir);
    const young = makeScratchProfile(tempDir);
    const other = join(tempDir, 'another-program');
    mkdirSync(other);
    const hourAgo = new Date(Date.now() - 60 * 60_000);
    utimesSync(old, hourAgo, hourAgo);
    utimesSync(other, hourAgo, hourAgo);
    clearStaleScratchProfiles(tempDir);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(young)).toBe(true);
    expect(existsSync(other)).toBe(true);
  });
});
