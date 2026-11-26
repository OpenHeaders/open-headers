/**
 * The classic app takes its data back from the Windows package's folder:
 * once, by one rename, and only when nothing says a package may still be
 * using it. With no folder of its own it hands the start over to an
 * installed package, and says why a folder left behind stayed where it
 * is. The folders are real ones under a temporary root; what Windows
 * answers (the installed-package query, a refused rename) is injected, so
 * every rule runs on every platform.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type DataFolderReturnFacts,
  PACKAGE_DATA_DIR_NAME,
  PACKAGE_IDENTITY_NAME,
  returnDataFolderFromPackage,
} from '@/main/bootstrap/data-folder-return';

describe('the data folder taken back from the Windows package', () => {
  let root: string;
  let ownDir: string;
  let localAppDataDir: string;
  let packageDir: string;

  const noPackage = vi.fn<() => boolean | null>();

  function makeFacts(overrides: Partial<DataFolderReturnFacts> = {}): DataFolderReturnFacts {
    return {
      installKind: 'nsis',
      ownDir,
      localAppDataDir,
      ...overrides,
    };
  }

  function seedPackageData(): void {
    mkdirSync(join(packageDir, 'data'), { recursive: true });
    writeFileSync(join(packageDir, 'data', 'settings.json'), '{"owner":"John Doe"}');
  }

  function fileError(code: string): Error {
    return Object.assign(new Error(code), { code });
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oh-data-return-'));
    ownDir = join(root, 'Roaming', 'OpenHeaders');
    localAppDataDir = join(root, 'Local');
    packageDir = join(localAppDataDir, PACKAGE_DATA_DIR_NAME);
    mkdirSync(join(root, 'Roaming'), { recursive: true });
    mkdirSync(join(localAppDataDir, 'Packages'), { recursive: true });
    noPackage.mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('renames the package folder into the classic one when no package is installed', () => {
    seedPackageData();
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(result).toEqual({ outcome: 'returned', from: packageDir });
    expect(readFileSync(join(ownDir, 'data', 'settings.json'), 'utf8')).toBe('{"owner":"John Doe"}');
    expect(existsSync(packageDir)).toBe(false);
  });

  it('takes the folder back for an MSI install as for the classic installer', () => {
    seedPackageData();
    const result = returnDataFolderFromPackage(makeFacts({ installKind: 'msi' }), { isPackageInstalled: noPackage });
    expect(result).toEqual({ outcome: 'returned', from: packageDir });
  });

  it.each<[string, Partial<DataFolderReturnFacts>]>([
    ['off Windows', { installKind: null }],
    ['in a development run', { installKind: 'dev' }],
    ['inside a Windows package', { installKind: 'msix' }],
    ['without a local AppData folder', { localAppDataDir: undefined }],
  ])('does nothing %s', (_case, overrides) => {
    seedPackageData();
    const rename = vi.fn();
    const result = returnDataFolderFromPackage(makeFacts(overrides), { isPackageInstalled: noPackage, rename });
    expect(result).toEqual({ outcome: 'nothing-to-return' });
    expect(noPackage).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('never touches either folder once the classic one exists, even empty', () => {
    seedPackageData();
    mkdirSync(ownDir);
    const rename = vi.fn();
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage, rename });
    expect(result).toEqual({ outcome: 'nothing-to-return' });
    expect(noPackage).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    expect(existsSync(join(packageDir, 'data', 'settings.json'))).toBe(true);
  });

  it('reads nothing of a package once the classic folder exists', () => {
    mkdirSync(ownDir);
    mkdirSync(join(localAppDataDir, 'Packages', `${PACKAGE_IDENTITY_NAME}_8wekyb3d8bbwe`));
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(result).toEqual({ outcome: 'nothing-to-return' });
    expect(noPackage).not.toHaveBeenCalled();
  });

  it('asks Windows nothing when no package folder was left', () => {
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(result).toEqual({ outcome: 'nothing-to-return' });
    expect(noPackage).not.toHaveBeenCalled();
    expect(existsSync(ownDir)).toBe(false);
  });

  it.each([`${PACKAGE_IDENTITY_NAME}_8wekyb3d8bbwe`, `${PACKAGE_IDENTITY_NAME.toLowerCase()}_8wekyb3d8bbwe`])(
    'hands the start over while Windows keeps a folder for the package (%s), without asking further',
    (familyFolder) => {
      seedPackageData();
      mkdirSync(join(localAppDataDir, 'Packages', familyFolder));
      const rename = vi.fn();
      const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage, rename });
      expect(result).toEqual({ outcome: 'package-installed' });
      expect(noPackage).not.toHaveBeenCalled();
      expect(rename).not.toHaveBeenCalled();
      expect(existsSync(ownDir)).toBe(false);
    },
  );

  it('hands the start over to an installed package that has made no data folder yet', () => {
    mkdirSync(join(localAppDataDir, 'Packages', `${PACKAGE_IDENTITY_NAME}_8wekyb3d8bbwe`));
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(result).toEqual({ outcome: 'package-installed' });
    expect(noPackage).not.toHaveBeenCalled();
    expect(existsSync(ownDir)).toBe(false);
  });

  it("does not read another package's folder as ours", () => {
    seedPackageData();
    mkdirSync(join(localAppDataDir, 'Packages', `${PACKAGE_IDENTITY_NAME}Beta_8wekyb3d8bbwe`));
    mkdirSync(join(localAppDataDir, 'Packages', 'Example.Tool_8wekyb3d8bbwe'));
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(result.outcome).toBe('returned');
  });

  it('still asks Windows when the user has no Packages folder at all', () => {
    seedPackageData();
    rmSync(join(localAppDataDir, 'Packages'), { recursive: true });
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(noPackage).toHaveBeenCalledOnce();
    expect(result.outcome).toBe('returned');
  });

  it('hands the start over when Windows lists a package of ours', () => {
    seedPackageData();
    const rename = vi.fn();
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: () => true, rename });
    expect(result).toEqual({ outcome: 'package-installed' });
    expect(rename).not.toHaveBeenCalled();
  });

  it('leaves the data when Windows does not say', () => {
    seedPackageData();
    const rename = vi.fn();
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: () => null, rename });
    expect(result).toEqual({
      outcome: 'left',
      from: packageDir,
      why: 'Windows did not say whether a package is installed',
      reason: 'no-answer',
    });
    expect(rename).not.toHaveBeenCalled();
  });

  it.each([
    ['a process holds a file inside', 'EPERM'],
    ['a file inside is locked', 'EBUSY'],
    ['the two folders are on different volumes', 'EXDEV'],
  ])('leaves the data and names the refusal when Windows refuses the rename: %s', (_case, code) => {
    seedPackageData();
    const rename = vi.fn(() => {
      throw fileError(code);
    });
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage, rename });
    expect(result).toEqual({
      outcome: 'left',
      from: packageDir,
      why: `Windows refused the rename (${code})`,
      reason: code,
    });
    expect(rename).toHaveBeenCalledExactlyOnceWith(packageDir, ownDir);
    expect(existsSync(join(packageDir, 'data', 'settings.json'))).toBe(true);
    expect(existsSync(ownDir)).toBe(false);
  });

  it('does not follow a link standing where the package folder would be', () => {
    const elsewhere = join(root, 'Elsewhere');
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, packageDir, 'junction');
    const rename = vi.fn();
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage, rename });
    expect(result).toEqual({
      outcome: 'left',
      from: packageDir,
      why: 'it is not a plain folder',
      reason: 'not-a-folder',
    });
    expect(noPackage).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('does not take a file of that name for the folder', () => {
    writeFileSync(packageDir, '');
    const result = returnDataFolderFromPackage(makeFacts(), { isPackageInstalled: noPackage });
    expect(result).toEqual({
      outcome: 'left',
      from: packageDir,
      why: 'it is not a plain folder',
      reason: 'not-a-folder',
    });
    expect(existsSync(ownDir)).toBe(false);
  });
});
