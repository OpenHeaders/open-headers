/**
 * Behavior of `scripts/prune-feed.mjs` — the retention planner the
 * feed sweep runs against a bucket listing and a mirror of the live
 * pointer files. Run as a child process against fixtures, like the
 * feed staging suites.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/prune-feed.mjs');
const NOW = '2026-10-04T12:00:00.000Z';
const PRIMARY = 'repodata/abc123-primary.xml.gz';

type Listed = { key: string; size?: number; modified?: string };

function object(key: string, modified: string, size = 100): Listed {
  return { key, size, modified };
}

const RECENT = '2026-10-01T10:00:00+00:00';
const OLD = '2026-07-18T10:00:00+00:00';

const LISTING: Listed[] = [
  object('dl/v2026.10.0/OpenHeaders-2026.10.0-mac-arm64.dmg', RECENT, 1000),
  object('dl/v2026.10.0/OpenHeaders-2026.10.0-mac-arm64.zip.blockmap', RECENT, 10),
  object('dl/v2026.10.0/open-headers_2026.10.0_amd64.deb', RECENT, 500),
  object('dl/v2026.9.1-beta.1/OpenHeaders-2026.9.1-beta.1-mac-arm64.dmg', '2026-09-05T10:00:00+00:00', 900),
  object('dl/v2026.9.0/oh-2026.9.0-mac-arm64', '2026-09-04T10:00:00+00:00', 300),
  object('dl/v2026.10.1/OpenHeaders-2026.10.1-mac-arm64.dmg', '2026-09-30T10:00:00+00:00', 950),
  object('dl/v2026.9.2/OpenHeaders-2026.9.2-mac-arm64.dmg', '2026-09-14T10:00:00+00:00', 600),
  object('dl/v2026.8.2/OpenHeaders-2026.8.2-mac-arm64.dmg', '2026-07-30T10:00:00+00:00', 800),
  object('dl/v2026.8.2/SHA256SUMS.txt', '2026-07-30T10:00:00+00:00', 1),
  object('dl/v2026.7.17/OpenHeaders-2026.7.17-mac-arm64.dmg', OLD, 700),
  object('apt/stable/pool/main/o/open-headers/open-headers_2026.10.0_amd64.deb', RECENT, 500),
  object('apt/stable/pool/main/o/open-headers/open-headers_2026.9.2_amd64.deb', '2026-09-14T10:00:00+00:00', 480),
  object('apt/stable/dists/stable/InRelease', RECENT, 2),
  object('apt/beta/pool/main/o/open-headers/open-headers_2026.9.1~beta.1_amd64.deb', '2026-09-05T10:00:00+00:00', 470),
  object('rpm/stable/Packages/open-headers-2026.10.0.x86_64.rpm', RECENT, 400),
  object('rpm/stable/Packages/open-headers-2026.9.2.x86_64.rpm', '2026-09-14T10:00:00+00:00', 390),
  object(`rpm/stable/${PRIMARY}`, RECENT, 5),
  object('rpm/stable/repodata/old999-primary.xml.gz', '2026-09-14T10:00:00+00:00', 5),
  object('rpm/stable/repodata/repomd.xml', RECENT, 3),
  object('rpm/stable/repodata/repomd.xml.asc', RECENT, 3),
  object('versions/stable.json', RECENT, 1),
  object('desktop/stable/latest.yml', RECENT, 1),
];

const POINTERS: Record<string, string | Buffer> = {
  'versions/stable.json': JSON.stringify({
    desktop: { latest: '2026.10.0', tag: 'v2026.10.0' },
    cli: { latest: '2026.10.0', tag: 'v2026.10.0' },
    extension: { latest: '2026.10.0', tag: 'v2026.10.0', stores: { chrome: '2026.9.2' } },
  }),
  'versions/beta.json': JSON.stringify({
    desktop: { latest: '2026.9.1-beta.1', tag: 'v2026.9.1-beta.1' },
    cli: { latest: '2026.9.0', tag: 'v2026.9.0' },
  }),
  'desktop/stable/latest.yml': [
    'version: 2026.10.0',
    'files:',
    '  - url: https://updates.openheaders.com/dl/v2026.10.0/OpenHeaders-2026.10.0-Setup.exe',
    '',
  ].join('\n'),
  'desktop/beta/latest-mac.yml': [
    'version: 2026.9.1-beta.1',
    'files:',
    '  - url: https://updates.openheaders.com/dl/v2026.9.1-beta.1/OpenHeaders-2026.9.1-beta.1-mac-arm64.zip',
    '',
  ].join('\n'),
  'apt/stable/dists/stable/main/binary-amd64/Packages': [
    'Package: open-headers',
    'Version: 2026.10.0',
    'Filename: pool/main/o/open-headers/open-headers_2026.10.0_amd64.deb',
    '',
  ].join('\n'),
  'rpm/stable/repodata/repomd.xml': [
    '<repomd>',
    '  <data type="primary">',
    `    <location href="${PRIMARY}"/>`,
    '  </data>',
    '</repomd>',
    '',
  ].join('\n'),
  [`rpm/stable/${PRIMARY}`]: gzipSync(
    '<metadata><package><location href="Packages/open-headers-2026.10.0.x86_64.rpm"/></package></metadata>',
  ),
};

let workDir: string;

function setUp(
  listing: Listed[],
  pointers: Record<string, string | Buffer>,
): { listing: string; pointers: string; out: string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-feed-prune-'));
  const listingFile = path.join(workDir, 'listing.json');
  writeFileSync(
    listingFile,
    JSON.stringify({
      Contents: listing.map((entry) => ({
        Key: entry.key,
        Size: entry.size ?? 100,
        LastModified: entry.modified ?? RECENT,
      })),
    }),
  );
  const pointersDir = path.join(workDir, 'pointers');
  for (const [key, content] of Object.entries(pointers)) {
    mkdirSync(path.dirname(path.join(pointersDir, key)), { recursive: true });
    writeFileSync(path.join(pointersDir, key), content);
  }
  return { listing: listingFile, pointers: pointersDir, out: path.join(workDir, 'plan') };
}

function run(paths: { listing: string; pointers: string; out: string }, flags: string[] = []): string {
  return execFileSync(
    process.execPath,
    [SCRIPT, '--listing', paths.listing, '--pointers', paths.pointers, '--out', paths.out, `--now=${NOW}`, ...flags],
    { encoding: 'utf8' },
  );
}

function runFailing(paths: { listing: string; pointers: string; out: string }, flags: string[] = []): string {
  try {
    run(paths, flags);
  } catch (error) {
    return String((error as { stderr?: string }).stderr);
  }
  throw new Error('expected the planner to fail');
}

function readPlan(out: string) {
  return JSON.parse(readFileSync(path.join(out, 'plan.json'), 'utf8'));
}

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('prune-feed', () => {
  it('keeps referenced and in-grace tags and drops the rest', () => {
    const paths = setUp(LISTING, POINTERS);
    const report = run(paths);
    const plan = readPlan(paths.out);

    expect(plan.keptTags).toEqual([
      { tag: 'v2026.10.0', reason: 'referenced', objects: 3, bytes: 1510 },
      { tag: 'v2026.10.1', reason: 'grace', objects: 1, bytes: 950 },
      { tag: 'v2026.9.0', reason: 'referenced', objects: 1, bytes: 300 },
      { tag: 'v2026.9.1-beta.1', reason: 'referenced', objects: 1, bytes: 900 },
      { tag: 'v2026.9.2', reason: 'previous-stable', objects: 1, bytes: 600 },
    ]);
    // 8.2 is the stable BEFORE the previous one: nothing needs it.
    expect(plan.droppedTags.map((entry: { tag: string }) => entry.tag)).toEqual(['v2026.7.17', 'v2026.8.2']);
    expect(report).toContain('v2026.10.1  grace');
    expect(report).toContain('v2026.8.2  newest 2026-07-30');
  });

  it('plans deletes only inside dl/, the apt pool and the rpm directories', () => {
    const paths = setUp(LISTING, POINTERS);
    run(paths);
    const plan = readPlan(paths.out);

    expect(plan.deleteKeys).toEqual([
      'dl/v2026.7.17/OpenHeaders-2026.7.17-mac-arm64.dmg',
      'dl/v2026.8.2/OpenHeaders-2026.8.2-mac-arm64.dmg',
      'dl/v2026.8.2/SHA256SUMS.txt',
      'apt/stable/pool/main/o/open-headers/open-headers_2026.9.2_amd64.deb',
      'rpm/stable/Packages/open-headers-2026.9.2.x86_64.rpm',
      'rpm/stable/repodata/old999-primary.xml.gz',
    ]);
    expect(plan.freedBytes).toBe(700 + 800 + 1 + 480 + 390 + 5);
    expect(plan.warnings).toEqual(['apt/beta: no Packages index among the pointers — its pool is left untouched']);

    const batch = JSON.parse(readFileSync(path.join(paths.out, 'delete-000.json'), 'utf8'));
    expect(batch.Quiet).toBe(true);
    expect(batch.Objects.map((entry: { Key: string }) => entry.Key)).toEqual(plan.deleteKeys);
  });

  it('builds the redirect from the kept tags and excludes blockmaps', () => {
    const paths = setUp(LISTING, POINTERS);
    run(paths, ['--release-repo=OpenHeaders/open-headers']);
    const { redirect } = readPlan(paths.out);

    expect(redirect.statusCode).toBe(302);
    expect(redirect.expression).toBe(
      [
        'starts_with(http.request.uri.path, "/dl/")',
        'not ends_with(http.request.uri.path, ".blockmap")',
        'not starts_with(http.request.uri.path, "/dl/v2026.10.0/")',
        'not starts_with(http.request.uri.path, "/dl/v2026.10.1/")',
        'not starts_with(http.request.uri.path, "/dl/v2026.9.0/")',
        'not starts_with(http.request.uri.path, "/dl/v2026.9.1-beta.1/")',
        'not starts_with(http.request.uri.path, "/dl/v2026.9.2/")',
      ].join(' and '),
    );
    expect(redirect.targetExpression).toBe(
      `wildcard_replace(http.request.uri.path, "/dl/*", "https://github.com/OpenHeaders/open-headers/releases/download/\${1}")`,
    );
  });

  it('honors --keep for the tag the running release just cut and warns when it has no bytes yet', () => {
    const paths = setUp(LISTING, POINTERS);
    const report = run(paths, ['--keep=v2026.8.2', '--keep=v2026.11.0']);
    const plan = readPlan(paths.out);

    expect(plan.keptTags.map((entry: { tag: string }) => entry.tag)).toContain('v2026.8.2');
    expect(plan.droppedTags.map((entry: { tag: string }) => entry.tag)).toEqual(['v2026.7.17']);
    expect(report).toContain('::warning::v2026.11.0 is referenced but has no dl/v2026.11.0/ objects');
  });

  it('drops every unreferenced tag but the previous stable with a zero grace window', () => {
    const paths = setUp(LISTING, POINTERS);
    run(paths, ['--grace-days=0']);
    const plan = readPlan(paths.out);

    expect(plan.droppedTags.map((entry: { tag: string }) => entry.tag)).toEqual([
      'v2026.10.1',
      'v2026.7.17',
      'v2026.8.2',
    ]);
    expect(plan.keptTags.map((entry: { tag: string }) => entry.tag)).toContain('v2026.9.2');
  });

  it('counts the previous stable from the stable manifest, skipping betas and lane tags', () => {
    const listing = [
      ...LISTING,
      object('dl/v2026.9.3-beta.2/OpenHeaders-2026.9.3-beta.2-mac-arm64.dmg', '2026-09-20T10:00:00+00:00', 10),
      object('dl/v2026.9.4-cli/oh-2026.9.4-mac-arm64', '2026-09-21T10:00:00+00:00', 10),
    ];
    const paths = setUp(listing, POINTERS);
    run(paths);
    const plan = readPlan(paths.out);

    expect(plan.keptTags.find((entry: { tag: string }) => entry.tag === 'v2026.9.2').reason).toBe('previous-stable');
    expect(plan.droppedTags.map((entry: { tag: string }) => entry.tag)).toEqual([
      'v2026.7.17',
      'v2026.8.2',
      'v2026.9.3-beta.2',
      'v2026.9.4-cli',
    ]);
  });

  it('keeps no previous stable when the stable manifest is absent', () => {
    const pointers = { ...POINTERS };
    delete pointers['versions/stable.json'];
    const paths = setUp(LISTING, pointers);
    run(paths);
    const plan = readPlan(paths.out);

    expect(plan.droppedTags.map((entry: { tag: string }) => entry.tag)).toContain('v2026.9.2');
  });

  it('refuses to plan when the pointers name no tag', () => {
    const paths = setUp(LISTING, { 'versions/stable.json': '{}' });
    expect(runFailing(paths)).toContain('no release tag is referenced');
  });

  it('refuses the rpm leg when repomd.xml names a primary index that is not among the pointers', () => {
    const pointers = { ...POINTERS };
    delete pointers[`rpm/stable/${PRIMARY}`];
    const paths = setUp(LISTING, pointers);
    expect(runFailing(paths)).toContain(`${PRIMARY} is not among the pointers`);
  });

  it('leaves an rpm channel whole when its repomd.xml is absent', () => {
    const pointers = { ...POINTERS };
    delete pointers['rpm/stable/repodata/repomd.xml'];
    delete pointers[`rpm/stable/${PRIMARY}`];
    const paths = setUp(LISTING, pointers);
    run(paths);
    const plan = readPlan(paths.out);

    expect(plan.deleteKeys.some((key: string) => key.startsWith('rpm/'))).toBe(false);
    expect(plan.warnings).toContain('rpm/stable: no repomd.xml among the pointers — its objects are left untouched');
  });

  it('splits the delete request into batches of a thousand keys', () => {
    const many = Array.from({ length: 1001 }, (_, i) => object(`dl/v2026.7.17/asset-${i}`, OLD, 1));
    const paths = setUp([...LISTING, ...many], POINTERS);
    run(paths);

    const batches = readdirSync(paths.out)
      .filter((name) => name.startsWith('delete-'))
      .sort();
    expect(batches).toEqual(['delete-000.json', 'delete-001.json']);
    const first = JSON.parse(readFileSync(path.join(paths.out, batches[0]), 'utf8'));
    expect(first.Objects).toHaveLength(1000);
  });
});
