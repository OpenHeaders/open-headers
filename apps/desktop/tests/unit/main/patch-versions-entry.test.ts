/**
 * Behavior of `scripts/patch-versions-entry.mjs` — the per-app-leg
 * manifest patcher used by the extension-only release lane and the
 * store-version cron. Run as a child process against fixture inputs.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(__dirname, '../../../../../scripts/patch-versions-entry.mjs');

const MANIFEST = {
  desktop: { latest: '2026.7.15', tag: 'v2026.7.15', severity: 'normal' },
  extension: {
    latest: '4.2.0',
    tag: 'v4.2.0',
    severity: 'normal',
    stores: { chrome: '4.1.9', edge: '4.1.9', firefox: '4.2.0' },
  },
};

let workDir: string;

function run(manifest: unknown, app: string, patch: string): Record<string, unknown> {
  workDir = mkdtempSync(path.join(tmpdir(), 'oh-patch-versions-'));
  const file = path.join(workDir, 'versions.json');
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  return JSON.parse(execFileSync(process.execPath, [SCRIPT, file, app, patch], { encoding: 'utf8' }));
}

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('patch-versions-entry', () => {
  it('replaces top-level fields of one entry and leaves every other entry untouched', () => {
    const out = run(MANIFEST, 'extension', '{"latest":"4.3.0","tag":"v4.3.0"}');
    expect(out.extension).toMatchObject({ latest: '4.3.0', tag: 'v4.3.0', severity: 'normal' });
    expect((out.extension as Record<string, unknown>).stores).toEqual(MANIFEST.extension.stores);
    expect(out.desktop).toEqual(MANIFEST.desktop);
  });

  it('merges object fields key-wise so a failed store lookup keeps its previous value', () => {
    const out = run(MANIFEST, 'extension', '{"stores":{"chrome":"4.2.0"}}');
    expect((out.extension as Record<string, unknown>).stores).toEqual({
      chrome: '4.2.0',
      edge: '4.1.9',
      firefox: '4.2.0',
    });
    expect(out.extension).toMatchObject({ latest: '4.2.0', tag: 'v4.2.0' });
  });

  it('creates the entry when patching an empty manifest', () => {
    const out = run({}, 'extension', '{"latest":"4.3.0","tag":"v4.3.0","severity":"normal"}');
    expect(out).toEqual({ extension: { latest: '4.3.0', tag: 'v4.3.0', severity: 'normal' } });
  });

  it('fails on invalid patch JSON and on a non-object manifest', () => {
    expect(() => run(MANIFEST, 'extension', 'not-json')).toThrow();
    expect(() => run([1, 2], 'extension', '{}')).toThrow();
  });
});
