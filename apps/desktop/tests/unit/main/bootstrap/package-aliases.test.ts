/**
 * The Windows package's two launch aliases: their permanent names, the
 * command an MCP client is given, and the aliases a person switched off.
 * The alias folder is a real one under a temporary root, so every rule
 * runs on every platform.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import {
  aliasSettingsLink,
  mcpClientCommand,
  missingPackageAliases,
  PACKAGE_APP_ALIAS,
  PACKAGE_APP_DISPLAY_NAME,
  PACKAGE_HOST_ALIAS,
  PACKAGE_HOST_DISPLAY_NAME,
  packageAliasPath,
  packageAliasStates,
} from '@/main/bootstrap/package-aliases';

describe('the package aliases', () => {
  let localAppDataDir: string;
  let aliasDir: string;

  beforeEach(() => {
    localAppDataDir = mkdtempSync(join(tmpdir(), 'oh-package-aliases-'));
    aliasDir = join(localAppDataDir, 'Microsoft', 'WindowsApps');
    mkdirSync(aliasDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(localAppDataDir, { recursive: true, force: true });
  });

  it('keep their names: they are written into browser manifests and client configurations', () => {
    expect(PACKAGE_APP_ALIAS).toBe('openheaders.exe');
    expect(PACKAGE_HOST_ALIAS).toBe('openheaders-nm-host.exe');
    expect(packageAliasPath(localAppDataDir, PACKAGE_APP_ALIAS)).toBe(join(aliasDir, 'openheaders.exe'));
  });

  describe('the command an MCP client is given', () => {
    const executablePath = join('C:', 'Program Files', 'OpenHeaders', 'OpenHeaders.exe');

    it.each<InstallKind>(['nsis', 'msi'])('is the program itself for a classic Windows install of kind %s', (kind) => {
      expect(mcpClientCommand({ installKind: kind, executablePath, localAppDataDir })).toBe(executablePath);
    });

    it("is the app's alias in a Windows package, never a path into the package", () => {
      expect(mcpClientCommand({ installKind: 'msix', executablePath, localAppDataDir })).toBe(
        join(aliasDir, PACKAGE_APP_ALIAS),
      );
    });

    it.each<InstallKind | null>(['dev', null])('is not given for kind %s: the standard location stays', (kind) => {
      expect(mcpClientCommand({ installKind: kind, executablePath, localAppDataDir })).toBeNull();
    });
  });

  describe('the aliases switched off', () => {
    it.each<InstallKind | null>(['nsis', 'msi', 'dev', null])('are not looked for in an install of kind %s', (kind) => {
      const aliasExists = vi.fn(() => false);
      expect(missingPackageAliases({ installKind: kind, localAppDataDir }, { aliasExists })).toEqual([]);
      expect(aliasExists).not.toHaveBeenCalled();
    });

    it('are none when Windows keeps both', () => {
      writeFileSync(join(aliasDir, PACKAGE_APP_ALIAS), '');
      writeFileSync(join(aliasDir, PACKAGE_HOST_ALIAS), '');
      expect(missingPackageAliases({ installKind: 'msix', localAppDataDir })).toEqual([]);
    });

    it('name each alias Windows no longer keeps', () => {
      writeFileSync(join(aliasDir, PACKAGE_APP_ALIAS), '');
      expect(missingPackageAliases({ installKind: 'msix', localAppDataDir })).toEqual([PACKAGE_HOST_ALIAS]);
      rmSync(join(aliasDir, PACKAGE_APP_ALIAS));
      expect(missingPackageAliases({ installKind: 'msix', localAppDataDir })).toEqual([
        PACKAGE_APP_ALIAS,
        PACKAGE_HOST_ALIAS,
      ]);
    });
  });

  describe('both aliases as Windows keeps them now', () => {
    it('are each on or off by its own file, under the name Windows Settings lists it by', () => {
      writeFileSync(join(aliasDir, PACKAGE_APP_ALIAS), '');
      expect(packageAliasStates({ localAppDataDir })).toEqual({
        app: { on: true, name: PACKAGE_APP_DISPLAY_NAME },
        helper: { on: false, name: PACKAGE_HOST_DISPLAY_NAME },
      });
    });

    it('are read again at every call: a person switches one back on while the app runs', () => {
      expect(packageAliasStates({ localAppDataDir }).helper.on).toBe(false);
      writeFileSync(join(aliasDir, PACKAGE_HOST_ALIAS), '');
      expect(packageAliasStates({ localAppDataDir }).helper.on).toBe(true);
    });

    it('are asked of the two alias paths and no other', () => {
      const aliasExists = vi.fn((_aliasPath: string) => true);
      packageAliasStates({ localAppDataDir }, { aliasExists });
      expect(aliasExists.mock.calls.map((call) => call[0])).toEqual([
        join(aliasDir, PACKAGE_APP_ALIAS),
        join(aliasDir, PACKAGE_HOST_ALIAS),
      ]);
    });
  });

  describe('the Windows Settings page that leads to the alias switches', () => {
    it.each([
      ['10.0.26200', 'ms-settings:advanced-apps'],
      ['10.0.22000', 'ms-settings:advanced-apps'],
      ['10.0.19045', 'ms-settings:appsfeatures'],
      ['10.0.19041', 'ms-settings:appsfeatures'],
    ])('on Windows %s is %s', (osRelease, link) => {
      expect(aliasSettingsLink(osRelease)).toBe(link);
    });

    it('is the page every Windows has when the version cannot be read', () => {
      expect(aliasSettingsLink('')).toBe('ms-settings:appsfeatures');
    });
  });
});
