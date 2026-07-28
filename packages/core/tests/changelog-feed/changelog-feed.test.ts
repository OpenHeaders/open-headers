import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_FEED_BASE,
  changelogEntryUrl,
  changelogStreamUrl,
  compareChangelogVersions,
  isChangelogVersion,
  parseChangelogEntryBody,
  parseChangelogIndexRows,
} from '../../src/changelog-feed';

describe('compareChangelogVersions', () => {
  it('orders segment-wise numerically, missing segments as zero', () => {
    expect(compareChangelogVersions('2026.7.23', '2026.7.27')).toBeLessThan(0);
    expect(compareChangelogVersions('2026.10.0', '2026.9.9')).toBeGreaterThan(0);
    expect(compareChangelogVersions('2026.7', '2026.7.0')).toBe(0);
  });

  it('orders betas below their base and numerically among themselves', () => {
    expect(compareChangelogVersions('2026.7.27-beta.3', '2026.7.27')).toBeLessThan(0);
    expect(compareChangelogVersions('2026.7.27-beta.2', '2026.7.27-beta.10')).toBeLessThan(0);
    expect(compareChangelogVersions('2026.7.27', '2026.7.27-beta.9')).toBeGreaterThan(0);
  });
});

describe('isChangelogVersion', () => {
  it('accepts CalVer with an optional beta suffix, rejects everything else', () => {
    expect(isChangelogVersion('2026.7.27')).toBe(true);
    expect(isChangelogVersion('2026.7.27-beta.3')).toBe(true);
    expect(isChangelogVersion('latest')).toBe(false);
    expect(isChangelogVersion('../../../etc/passwd')).toBe(false);
    expect(isChangelogVersion(42)).toBe(false);
  });
});

describe('feed URLs', () => {
  it('builds the stream view and entry object URLs', () => {
    expect(changelogStreamUrl('desktop')).toBe(`${CHANGELOG_FEED_BASE}/desktop.json`);
    expect(changelogEntryUrl('extension', '2026.7.27')).toBe(`${CHANGELOG_FEED_BASE}/extension/2026.7.27.json`);
  });
});

describe('parseChangelogIndexRows', () => {
  const proseRow = {
    app: 'desktop',
    version: '2026.7.27',
    date: '2026-07-28',
    channel: 'beta',
    severity: 'normal',
    highlights: ['Grouped WebSocket timelines', 'Per-pane wrap'],
    md: `${CHANGELOG_FEED_BASE}/desktop/2026.7.27.md`,
    json: `${CHANGELOG_FEED_BASE}/desktop/2026.7.27.json`,
  };
  const stubRow = { app: 'desktop', version: '2026.7.23', date: '2026-07-20', channel: 'stable', severity: 'security' };

  it('maps generator rows, collapsing the notes links into hasNotes', () => {
    expect(parseChangelogIndexRows([proseRow, stubRow])).toEqual([
      {
        version: '2026.7.27',
        date: '2026-07-28',
        channel: 'beta',
        severity: 'normal',
        highlights: ['Grouped WebSocket timelines', 'Per-pane wrap'],
        hasNotes: true,
      },
      { version: '2026.7.23', date: '2026-07-20', channel: 'stable', severity: 'security', hasNotes: false },
    ]);
  });

  it('drops rows the generator could not have produced without blanking the rest', () => {
    expect(
      parseChangelogIndexRows([{ version: 'nope', date: '2026-07-28' }, null, { version: '2026.7.23' }, stubRow]),
    ).toEqual([{ version: '2026.7.23', date: '2026-07-20', channel: 'stable', severity: 'security', hasNotes: false }]);
  });

  it('defaults unknown channel/severity values instead of dropping the row', () => {
    expect(
      parseChangelogIndexRows([{ version: '2026.7.23', date: '2026-07-20', channel: 'rc', severity: 'high' }]),
    ).toEqual([{ version: '2026.7.23', date: '2026-07-20', channel: 'stable', severity: 'normal', hasNotes: false }]);
  });

  it('answers null on a body that is not an array', () => {
    expect(parseChangelogIndexRows(null)).toBeNull();
    expect(parseChangelogIndexRows({ rows: [] })).toBeNull();
  });
});

describe('parseChangelogEntryBody', () => {
  it('extracts a non-empty body_markdown', () => {
    expect(parseChangelogEntryBody({ version: '2026.7.27', body_markdown: '## Streams\n…' })).toBe('## Streams\n…');
  });

  it('answers null on empty bodies and foreign shapes', () => {
    expect(parseChangelogEntryBody({ body_markdown: '   ' })).toBeNull();
    expect(parseChangelogEntryBody({ body_markdown: 42 })).toBeNull();
    expect(parseChangelogEntryBody('## Streams')).toBeNull();
    expect(parseChangelogEntryBody(null)).toBeNull();
  });
});
