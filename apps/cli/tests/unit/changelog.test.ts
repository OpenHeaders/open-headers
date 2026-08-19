/**
 * `oh changelog` — this release's notes from the build-time embedded
 * entry, air-gapped. An empty entry (entry-less version or unbundled
 * dev run) reports honestly instead of inventing prose; `--json`
 * carries the raw body (or null) for scripting.
 */

import { describe, expect, it } from 'vitest';
import { commandChangelog } from '../../src/changelog';
import { UsageError } from '../../src/exit-codes';

const ENTRY = '## Streams\n\nGrouped WebSocket timelines on openheaders.com requests.';

describe('commandChangelog', () => {
  it('prints the embedded entry between the version header and the full-changelog pointer', () => {
    expect(commandChangelog([], ENTRY)).toEqual([
      'oh vdev — release notes',
      '',
      '## Streams',
      '',
      'Grouped WebSocket timelines on openheaders.com requests.',
      '',
      'full changelog: https://openheaders.com/changelog',
    ]);
  });

  it('reports an unbundled dev run honestly when nothing is embedded', () => {
    expect(commandChangelog([], '')).toEqual([
      'no release notes in an unbundled dev run',
      'full changelog: https://openheaders.com/changelog',
    ]);
  });

  it('emits the --json shape with the raw body, and null when entry-less', () => {
    expect(commandChangelog(['--json'], ENTRY)).toEqual([JSON.stringify({ version: 'dev', notes: ENTRY }, null, 2)]);
    expect(commandChangelog(['--json'], '')).toEqual([JSON.stringify({ version: 'dev', notes: null }, null, 2)]);
  });

  it('rejects positionals and unknown flags as usage errors', () => {
    expect(() => commandChangelog(['extra'], ENTRY)).toThrow(UsageError);
    expect(() => commandChangelog(['--limit', '5'], ENTRY)).toThrow(UsageError);
  });
});
