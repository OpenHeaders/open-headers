/**
 * How the app was installed on Windows, told by the one file each wrapper
 * adds around the shared tree. The trees are real ones under a temporary
 * root, so every rule runs on every platform.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLASSIC_UNINSTALLER_FILE_NAME,
  deriveInstallKind,
  type InstallKindFacts,
  PACKAGE_MANIFEST_FILE_NAME,
} from '@/main/bootstrap/install-kind';

describe('the install kind', () => {
  let root: string;
  let programDir: string;

  function makeFacts(overrides: Partial<InstallKindFacts> = {}): InstallKindFacts {
    return {
      platform: 'win32',
      isPackaged: true,
      hasPackageIdentity: false,
      executablePath: join(programDir, 'OpenHeaders.exe'),
      ...overrides,
    };
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oh-install-kind-'));
    programDir = join(root, 'app');
    mkdirSync(programDir);
    writeFileSync(join(programDir, 'OpenHeaders.exe'), '');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it.each<NodeJS.Platform>(['darwin', 'linux'])('has no kind on %s and reads nothing', (platform) => {
    writeFileSync(join(root, PACKAGE_MANIFEST_FILE_NAME), '');
    const fileExists = vi.fn(() => true);
    const reading = deriveInstallKind(makeFacts({ platform, hasPackageIdentity: true }), { fileExists });
    expect(reading).toEqual({ kind: null, lonePackageSign: null });
    expect(fileExists).not.toHaveBeenCalled();
  });

  it('is the classic installer when its uninstaller lies beside the program', () => {
    writeFileSync(join(programDir, CLASSIC_UNINSTALLER_FILE_NAME), '');
    expect(deriveInstallKind(makeFacts())).toEqual({ kind: 'nsis', lonePackageSign: null });
  });

  it('is the MSI when the tree carries neither file', () => {
    expect(deriveInstallKind(makeFacts())).toEqual({ kind: 'msi', lonePackageSign: null });
  });

  it('is a development run when the app is not packaged', () => {
    expect(deriveInstallKind(makeFacts({ isPackaged: false }))).toEqual({ kind: 'dev', lonePackageSign: null });
  });

  it('is a package when both signs agree', () => {
    writeFileSync(join(root, PACKAGE_MANIFEST_FILE_NAME), '');
    expect(deriveInstallKind(makeFacts({ hasPackageIdentity: true }))).toEqual({ kind: 'msix', lonePackageSign: null });
  });

  it('is still a package when the process lost the identity and the manifest is there', () => {
    writeFileSync(join(root, PACKAGE_MANIFEST_FILE_NAME), '');
    expect(deriveInstallKind(makeFacts())).toEqual({ kind: 'msix', lonePackageSign: 'manifest' });
  });

  it('is still a package when Windows gives the identity and no manifest is found', () => {
    expect(deriveInstallKind(makeFacts({ hasPackageIdentity: true }))).toEqual({
      kind: 'msix',
      lonePackageSign: 'identity',
    });
  });

  it('reads a package before anything else: an unpackaged program, an uninstaller beside it', () => {
    writeFileSync(join(root, PACKAGE_MANIFEST_FILE_NAME), '');
    writeFileSync(join(programDir, CLASSIC_UNINSTALLER_FILE_NAME), '');
    expect(deriveInstallKind(makeFacts({ isPackaged: false })).kind).toBe('msix');
  });

  it("does not take a manifest in the program's own folder for the package's", () => {
    writeFileSync(join(programDir, PACKAGE_MANIFEST_FILE_NAME), '');
    expect(deriveInstallKind(makeFacts()).kind).toBe('msi');
  });

  it("names the uninstaller as the builder does: after the product's file name", () => {
    const manifest: { build: { productName: string } } = JSON.parse(
      readFileSync(join(__dirname, '../../../../package.json'), 'utf8'),
    );
    expect(CLASSIC_UNINSTALLER_FILE_NAME).toBe(`Uninstall ${manifest.build.productName}.exe`);
  });
});
