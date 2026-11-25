/**
 * `packageVersion` of `scripts/lib/versions.mjs` — the one rule that
 * turns a release version into a Windows package's four numbers. The
 * pack script stamps it into the package and the feed compares by it,
 * so its order must be the releases' own. Run as a child process, like
 * the other release script suites.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const LIBRARY = pathToFileURL(path.resolve(__dirname, '../../../../../scripts/lib/versions.mjs')).href;

/** Maps every argument: the package version, or why it was refused. */
const MAP = `
const [library, ...versions] = process.argv.slice(1);
import(library).then(({ packageVersion }) => {
  const mapped = versions.map((version) => {
    try {
      return { packageVersion: packageVersion(version) };
    } catch (error) {
      return { refused: error.message };
    }
  });
  console.log(JSON.stringify(mapped));
});
`;

interface Mapped {
  packageVersion?: string;
  refused?: string;
}

function map(versions: string[]): Mapped[] {
  const result = spawnSync(process.execPath, ['-e', MAP, LIBRARY, ...versions], { encoding: 'utf8' });
  expect(result.stderr).toBe('');
  return JSON.parse(result.stdout);
}

/** Windows' own order: four numbers, compared left to right. */
function comparePackageVersions(a: string, b: string): number {
  const [partsA, partsB] = [a, b].map((version) => version.split('.').map(Number));
  for (let i = 0; i < 4; i++) {
    if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i];
  }
  return 0;
}

describe('packageVersion — the mapping', () => {
  it('gives a beta its own number and the stable 1000', () => {
    const versions = ['2026.11.2-beta.7', '2026.11.2', '2026.12.0-beta.1', '2027.1.0', '2026.11.3-beta.999'];

    expect(map(versions).map((mapped) => mapped.packageVersion)).toEqual([
      '2026.11.2.7',
      '2026.11.2.1000',
      '2026.12.0.1',
      '2027.1.0.1000',
      '2026.11.3.999',
    ]);
  });

  it('keeps every part within what Windows takes', () => {
    expect(map(['9999.12.65535'])).toEqual([{ packageVersion: '9999.12.65535.1000' }]);
  });
});

describe('packageVersion — the order', () => {
  it('sorts the packages as the releases sort', () => {
    const releases = [
      '2026.11.2-beta.1',
      '2026.11.2-beta.7',
      '2026.11.2-beta.999',
      '2026.11.2',
      '2026.11.3-beta.1',
      '2026.11.3',
      '2026.12.0-beta.1',
      '2026.12.0',
      '2027.1.0-beta.1',
    ];

    const packages = map(releases).map((mapped) => mapped.packageVersion ?? '');

    expect([...packages].reverse().sort(comparePackageVersions)).toEqual(packages);
    expect(new Set(packages).size).toBe(releases.length);
  });
});

describe('packageVersion — what it refuses', () => {
  it.each([
    ['a tag', 'v2026.11.2'],
    ['a version of three free numbers', '1.2.3'],
    ['a fourth number', '2026.11.2.1'],
    ['two numbers', '2026.11'],
    ['another prerelease word', '2026.11.2-rc.1'],
    ['a beta without a number', '2026.11.2-beta'],
    ['build metadata', '2026.11.2+build.5'],
    ['a zero before the month', '2026.011.2'],
    ['a zero before the patch', '2026.11.02'],
    ['a zero before the beta number', '2026.11.2-beta.07'],
    ['space around it', ' 2026.11.2'],
    ['nothing', ''],
  ])('refuses %s', (_what, version) => {
    expect(map([version])[0].refused).toContain('is not a release version');
  });

  it('refuses a month that is none', () => {
    expect(map(['2026.13.0', '2026.0.1']).map((mapped) => mapped.refused)).toEqual([
      "'2026.13.0' names month 13",
      "'2026.0.1' is not a release version (YYYY.M.PATCH or YYYY.M.PATCH-beta.N)",
    ]);
  });

  it('refuses a patch above what Windows takes', () => {
    expect(map(['2026.11.65536'])[0].refused).toContain('no package version part above 65535');
  });

  it('refuses a beta that would reach the stable, and a beta 0', () => {
    expect(map(['2026.11.2-beta.1000', '2026.11.2-beta.0']).map((mapped) => mapped.refused)).toEqual([
      "'2026.11.2-beta.1000': a beta is numbered 1 to 999",
      "'2026.11.2-beta.0': a beta is numbered 1 to 999",
    ]);
  });
});
