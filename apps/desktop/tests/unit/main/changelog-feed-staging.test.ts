/**
 * Behavior of `scripts/generate-changelog-feed.mjs` — the release step
 * that projects the canonical changelog tree into the feed's index and
 * entry objects. Run as a child process against a fixture repo root
 * (`--repo-root`), like the other staging suites: the tree, the
 * severity file and the app package.json files are all fixtures, so
 * the rows asserted here are exactly what a tag of that shape stages.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/generate-changelog-feed.mjs');
const BASE = '2026.9.1';
const PRIOR = '2026.9.0';
const APPS = ['desktop', 'cli', 'daemon', 'web', 'extension'];

interface IndexRow {
  app: string;
  version: string;
  channel: string;
  md?: string;
}

function entry(version: string, channel: string, body: string): string {
  return [
    '---',
    `version: ${version}`,
    'date: 2026-09-04',
    `channel: ${channel}`,
    'severity: normal',
    '---',
    '',
    body,
    '',
  ].join('\n');
}

let workDir: string;

function fixture(entries: Record<string, string> = {}): { root: string; out: string } {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-changelog-feed-'));
  const root = path.join(workDir, 'repo');
  mkdirSync(path.join(root, '.github'), { recursive: true });
  mkdirSync(path.join(root, 'changelog'));
  writeFileSync(
    path.join(root, '.github/release-severity.json'),
    JSON.stringify(Object.fromEntries(APPS.map((app) => [app, { severity: 'normal' }]))),
  );
  for (const app of APPS.filter((name) => name !== 'desktop')) {
    mkdirSync(path.join(root, 'apps', app), { recursive: true });
    writeFileSync(path.join(root, 'apps', app, 'package.json'), JSON.stringify({ version: BASE }));
  }
  for (const [relative, content] of Object.entries(entries)) {
    const file = path.join(root, 'changelog', relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return { root, out: path.join(workDir, 'feed') };
}

function stage(root: string, out: string, tag: string, priorIndex?: IndexRow[]): IndexRow[] {
  const args = [SCRIPT, `--repo-root=${root}`, tag, out];
  if (priorIndex) {
    const priorPath = path.join(workDir, 'prior_index.json');
    writeFileSync(priorPath, JSON.stringify(priorIndex));
    args.push(priorPath);
  }
  execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(readFileSync(path.join(out, 'changelog/index.json'), 'utf8')) as IndexRow[];
}

const rowsAt = (index: IndexRow[], version: string) =>
  index
    .filter((row) => row.version === version)
    .map((row) => `${row.app} ${row.channel}`)
    .sort();

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('generate-changelog-feed stub rows', () => {
  it('an entry-less suite beta stubs the desktop only', () => {
    const { root, out } = fixture();

    const index = stage(root, out, `v${BASE}-beta.1`);

    expect(rowsAt(index, BASE)).toEqual(['desktop beta']);
    const betaView = JSON.parse(readFileSync(path.join(out, 'changelog/beta.json'), 'utf8')) as IndexRow[];
    expect(rowsAt(betaView, BASE)).toEqual(['desktop beta']);
  });

  it('an entry-less stable stubs every stream the suite ships', () => {
    const { root, out } = fixture();

    const index = stage(root, out, `v${BASE}`);

    expect(rowsAt(index, BASE)).toEqual([
      'cli stable',
      'daemon stable',
      'desktop stable',
      'extension stable',
      'web stable',
    ]);
  });

  it('a lane tag stubs its own stream only', () => {
    const { root, out } = fixture();

    const index = stage(root, out, `v${BASE}-cli`);

    expect(rowsAt(index, BASE)).toEqual(['cli stable']);
  });

  it('an authored beta entry on another stream still rows on a beta', () => {
    const { root, out } = fixture({ [`cli/2026/${BASE}.md`]: entry(BASE, 'beta', '## CLI\n\n- A beta change') });

    const index = stage(root, out, `v${BASE}-beta.1`);

    expect(rowsAt(index, BASE)).toEqual(['cli beta', 'desktop beta']);
    expect(index.find((row) => row.app === 'cli' && row.version === BASE)?.md).toContain(`/cli/${BASE}.md`);
  });

  it('the promotion replaces the live beta stub rows and keeps other prior rows', () => {
    const { root, out } = fixture();
    const liveBetaStubs = APPS.map((app) => ({
      app,
      version: BASE,
      date: '2026-09-05',
      channel: 'beta',
      severity: 'normal',
    }));
    const olderRow = { app: 'desktop', version: PRIOR, date: '2026-09-04', channel: 'stable', severity: 'normal' };

    const index = stage(root, out, `v${BASE}`, [...liveBetaStubs, olderRow]);

    expect(rowsAt(index, BASE)).toEqual([
      'cli stable',
      'daemon stable',
      'desktop stable',
      'extension stable',
      'web stable',
    ]);
    expect(rowsAt(index, PRIOR)).toEqual(['desktop stable']);
  });

  it('stages entry objects for the cut version only, rows for every entry', () => {
    const { root, out } = fixture({
      [`desktop/2026/${PRIOR}.md`]: entry(PRIOR, 'stable', '## Earlier\n\n- Already live'),
      [`desktop/2026/${BASE}.md`]: entry(BASE, 'stable', '## Now\n\n- Cut by this tag'),
    });

    const index = stage(root, out, `v${BASE}`);

    expect(rowsAt(index, PRIOR)).toEqual(['desktop stable']);
    expect(existsSync(path.join(out, `changelog/desktop/${BASE}.json`))).toBe(true);
    expect(existsSync(path.join(out, `changelog/desktop/${PRIOR}.json`))).toBe(false);
    expect(existsSync(path.join(out, 'llms.txt'))).toBe(true);
  });
});
