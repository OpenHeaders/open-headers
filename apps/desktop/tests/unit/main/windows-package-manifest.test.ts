/**
 * The Windows package's manifest and logo set, held to what the app
 * already knows of itself. The app finds its package by the manifest's
 * name and place, hands browsers and clients the two launch aliases,
 * asks Windows for the package by its identity name and leaves the
 * link scheme to the manifest — a manifest that says otherwise is a
 * package the app does not recognise. What Windows makes of the file is
 * seen on a Windows machine; this holds the file to the rule.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_IDENTITY_NAME } from '../../../src/main/bootstrap/data-folder-return';
import { PACKAGE_MANIFEST_FILE_NAME } from '../../../src/main/bootstrap/install-kind';
import { PACKAGE_APP_ALIAS, PACKAGE_HOST_ALIAS } from '../../../src/main/bootstrap/package-aliases';
import { PROTOCOL_SCHEME } from '../../../src/main/bootstrap/protocol';
import { nmHostBinaryCandidate } from '../../../src/main/nm-host-install';

const APP_DIR = path.resolve(__dirname, '../../..');
const WINDOWS_BUILD_DIR = path.join(APP_DIR, 'build/windows');
const LOGO_SET_DIR = path.join(WINDOWS_BUILD_DIR, 'package-assets');
const LOGO_SCRIPT = path.join(APP_DIR, 'scripts/build/generate-package-logos.mjs');

const MANIFEST = readFileSync(path.join(WINDOWS_BUILD_DIR, PACKAGE_MANIFEST_FILE_NAME), 'utf8');
const BUILD_CONFIG = JSON.parse(readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')).build;
const PRODUCT_NAME: string = BUILD_CONFIG.productName;

/** The folder of the package the app's tree lies in: the manifest is looked for one folder above the program. */
const TREE_DIR = 'app';

const APP_PROGRAM = `${TREE_DIR}\\${PRODUCT_NAME}.exe`;
const HELPER_PROGRAM = nmHostBinaryCandidate({
  isPackaged: true,
  resourcesPath: `${TREE_DIR}/resources`,
  appPath: '',
  platform: 'win32',
}).replace(/\//g, '\\');

interface ManifestApplication {
  program: string;
  body: string;
}

const APPLICATIONS: ManifestApplication[] = [
  ...MANIFEST.matchAll(/<Application\b[^>]*?\bExecutable="([^"]+)"[^>]*>([\s\S]*?)<\/Application>/g),
].map((match) => ({ program: match[1], body: match[2] }));

function application(program: string): string {
  return APPLICATIONS.find((candidate) => candidate.program === program)?.body ?? '';
}

function aliasesOf(body: string): Array<{ program: string; alias: string }> {
  return [
    ...body.matchAll(
      /<uap5:Extension\b[^>]*?Category="windows\.appExecutionAlias"[^>]*?Executable="([^"]+)"[^>]*>[\s\S]*?<uap5:ExecutionAlias Alias="([^"]+)" \/>/g,
    ),
  ].map((match) => ({ program: match[1], alias: match[2] }));
}

describe("the Windows package's manifest — the names the app knows", () => {
  it('carries the identity name the app asks Windows for', () => {
    expect(/<Identity\b[^>]*?\bName="([^"]+)"/.exec(MANIFEST)?.[1]).toBe(PACKAGE_IDENTITY_NAME);
  });

  it('starts two programs, both inside the tree: the app and the browser helper', () => {
    expect(APPLICATIONS.map((candidate) => candidate.program)).toEqual([APP_PROGRAM, HELPER_PROGRAM]);
  });

  it("gives the app its alias, on the app's own program", () => {
    expect(aliasesOf(application(APP_PROGRAM))).toEqual([{ program: APP_PROGRAM, alias: PACKAGE_APP_ALIAS }]);
  });

  it("gives the helper its alias, on the helper's own program, and no entry in the app list", () => {
    const helper = application(HELPER_PROGRAM);

    expect(aliasesOf(helper)).toEqual([{ program: HELPER_PROGRAM, alias: PACKAGE_HOST_ALIAS }]);
    expect(helper).toMatch(/<uap:VisualElements\b[^>]*\bAppListEntry="none"/);
    expect(application(APP_PROGRAM)).not.toMatch(/AppListEntry/);
  });

  it("declares the app's link scheme, once, on the app", () => {
    const schemes = [...MANIFEST.matchAll(/<uap:Protocol Name="([^"]+)"/g)].map((match) => match[1]);

    expect(schemes).toEqual([PROTOCOL_SCHEME]);
    expect(BUILD_CONFIG.protocols).toEqual([expect.objectContaining({ schemes: [PROTOCOL_SCHEME] })]);
    expect(application(APP_PROGRAM)).toContain(`<uap:Protocol Name="${PROTOCOL_SCHEME}"`);
  });
});

describe("the Windows package's manifest — one form", () => {
  it('switches both write redirections off, with the capability that takes', () => {
    expect(MANIFEST).toContain(
      '<desktop6:FileSystemWriteVirtualization>disabled</desktop6:FileSystemWriteVirtualization>',
    );
    expect(MANIFEST).toContain('<desktop6:RegistryWriteVirtualization>disabled</desktop6:RegistryWriteVirtualization>');
    expect(MANIFEST).toContain('<rescap:Capability Name="unvirtualizedResources" />');
    expect(MANIFEST).toContain('<rescap:Capability Name="runFullTrust" />');
  });

  it('lists no location to exempt: Windows 10 ignores such lists', () => {
    expect(MANIFEST).not.toMatch(/Excluded(Key|Director)/);
  });

  it('starts every program with full trust', () => {
    const entries = [...MANIFEST.matchAll(/\bExecutable="[^"]+"\s+EntryPoint="([^"]+)"/g)].map((match) => match[1]);

    expect(entries).toHaveLength(4);
    expect(new Set(entries)).toEqual(new Set(['Windows.FullTrustApplication']));
  });

  it('has Windows 10 2004 for its floor', () => {
    expect(MANIFEST).toMatch(/<TargetDeviceFamily Name="Windows\.Desktop" MinVersion="10\.0\.19041\.0"/);
  });

  it('declares no task at sign-in', () => {
    expect(MANIFEST).not.toContain('windows.startupTask');
  });

  it('leaves three values to the pack script', () => {
    expect([...MANIFEST.matchAll(/\$\{(\w+)\}/g)].map((match) => match[1]).sort()).toEqual([
      'arch',
      'publisher',
      'version',
    ]);
  });
});

describe("the Windows package's logo set", () => {
  const listed = spawnSync(process.execPath, [LOGO_SCRIPT, '--list'], { encoding: 'utf8' })
    .stdout.split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const [file, pixels] = line.split(' ');
      return { file, pixels: Number(pixels) };
    });

  it("holds exactly the images the generator's table names", () => {
    expect(listed.length).toBeGreaterThan(0);
    expect(readdirSync(LOGO_SET_DIR).sort()).toEqual(listed.map(({ file }) => file).sort());
  });

  it('holds every image at the size its name promises', () => {
    const sizes = listed.map(({ file }) => {
      const header = readFileSync(path.join(LOGO_SET_DIR, file)).subarray(0, 24);
      // A PNG opens with its signature, then the header chunk: width and height at bytes 16 and 20.
      return {
        file,
        isPng: header.subarray(1, 4).toString('latin1') === 'PNG',
        width: header.readUInt32BE(16),
        height: header.readUInt32BE(20),
      };
    });

    expect(sizes).toEqual(listed.map(({ file, pixels }) => ({ file, isPng: true, width: pixels, height: pixels })));
  });

  it('has an image for every logo the manifest names', () => {
    const named = [
      ...MANIFEST.matchAll(/(?:<Logo>|Square44x44Logo="|Square150x150Logo=")assets\\([A-Za-z0-9]+)\.png/g),
    ].map((match) => match[1]);

    expect(new Set(named)).toEqual(new Set(['StoreLogo', 'Square44x44Logo', 'Square150x150Logo']));
    for (const name of new Set(named)) {
      expect(listed.some(({ file }) => file === `${name}.scale-100.png`)).toBe(true);
    }
  });

  it('carries the app-list icon bare for both themes at every exact size', () => {
    const plain = listed.filter(({ file }) => /^Square44x44Logo\.targetsize-\d+\.png$/.test(file));

    expect(plain.length).toBeGreaterThan(0);
    for (const { file } of plain) {
      const stem = file.replace(/\.png$/, '');
      expect(listed.map((entry) => entry.file)).toEqual(
        expect.arrayContaining([`${stem}_altform-unplated.png`, `${stem}_altform-lightunplated.png`]),
      );
    }
  });
});
