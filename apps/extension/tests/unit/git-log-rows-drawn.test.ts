/**
 * The rows a log's list draws for where its scroller stands
 * (`panels/git/log-rows-drawn`): the position's own where every row the
 * viewport shows is held, else rows of the held page nearest them
 * standing in — as many as the viewport shows, never one that is not
 * read.
 */

import type { WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import {
  type LogRowPages,
  type LogRowsAsk,
  NO_LOG_ROW_RANGE,
  NO_LOG_ROWS,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import { logRowsDrawn } from '@openheaders/ui/workbench/components/panels/git/log-rows-drawn';
import { describe, expect, it } from 'vitest';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };

const sha = (row: number): string => row.toString(16).padStart(40, '0');

function row(at: number): WorkspaceTreeLogRowWire {
  return {
    entry: {
      sha: sha(at),
      parents: [sha(at + 1)],
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `commit ${at}`,
      coAuthors: [],
      files: [],
      onHead: true,
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: [at + 1],
    child: at - 1,
  };
}

/** A list of `total` rows with the named pages held. */
function holding(total: number, pages: number[]): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    const rows: WorkspaceTreeLogRowWire[] = [];
    for (let at = page * 200; at < Math.min(total, page * 200 + 200); at += 1) rows.push(row(at));
    held = takeLogRows(
      held,
      ASK,
      page * 200,
      { ok: true, list: 'g1', total, widest: 1, rows, runs: [] },
      NO_LOG_ROW_RANGE,
    );
  }
  return held;
}

const AT_THE_POSITION = { standing: false };

describe('logRowsDrawn — the position’s own rows', () => {
  it('draws them where every row the viewport shows is held', () => {
    expect(logRowsDrawn(holding(10_000, [0]), { first: 0, last: 24 })).toEqual(AT_THE_POSITION);
    expect(logRowsDrawn(holding(10_000, [2]), { first: 400, last: 599 })).toEqual(AT_THE_POSITION);
    // Across two pages, both held.
    expect(logRowsDrawn(holding(10_000, [0, 1]), { first: 190, last: 214 })).toEqual(AT_THE_POSITION);
  });

  it('draws them where no row is held at all — there is nothing to stand in', () => {
    expect(logRowsDrawn(NO_LOG_ROWS, { first: 0, last: 24 })).toEqual(AT_THE_POSITION);
    expect(logRowsDrawn({ ...holding(10_000, [0]), pages: new Map() }, { first: 500, last: 524 })).toEqual(
      AT_THE_POSITION,
    );
  });

  it('holds the viewport’s rows to the list: a viewport taller than a short list is all held', () => {
    expect(logRowsDrawn(holding(5, [0]), { first: 0, last: 24 })).toEqual(AT_THE_POSITION);
    expect(logRowsDrawn(holding(10_000, [0]), { first: 0, last: -1 })).toEqual(AT_THE_POSITION);
    // Measured over a longer list: rows 250–449 are no rows of this one.
    expect(logRowsDrawn(holding(250, [0, 1]), { first: 0, last: 449 })).toEqual(AT_THE_POSITION);
  });
});

describe('logRowsDrawn — rows standing in', () => {
  it('stands the last rows of the page above where the position is past it', () => {
    // Rows 5,000–5,024 show; page 0 is all that is held: its last 25 rows.
    expect(logRowsDrawn(holding(10_000, [0]), { first: 5_000, last: 5_024 })).toEqual({
      standing: true,
      first: 175,
      last: 199,
    });
  });

  it('stands the first rows of the page below where the position is before it', () => {
    expect(logRowsDrawn(holding(10_000, [25]), { first: 100, last: 124 })).toEqual({
      standing: true,
      first: 5_000,
      last: 5_024,
    });
  });

  it('stands the nearest page’s rows, of several', () => {
    const held = holding(100_000, [0, 100, 400]);
    // Page 150 shows: page 100 is 50 pages above, page 400 is 250 below.
    expect(logRowsDrawn(held, { first: 30_000, last: 30_024 })).toEqual({
      standing: true,
      first: 20_175,
      last: 20_199,
    });
    // Page 300 shows: page 400 is nearer.
    expect(logRowsDrawn(held, { first: 60_000, last: 60_024 })).toEqual({
      standing: true,
      first: 80_000,
      last: 80_024,
    });
  });

  it('measures a page below from the last page the viewport shows', () => {
    // Rows 790–814 show, on pages 3 and 4: page 5 is one page under them, page 1 two above.
    expect(logRowsDrawn(holding(10_000, [1, 5]), { first: 790, last: 814 })).toEqual({
      standing: true,
      first: 1_000,
      last: 1_024,
    });
  });

  it('stands the earlier rows where a page above and one below are as near', () => {
    expect(logRowsDrawn(holding(10_000, [1, 5]), { first: 600, last: 624 })).toEqual({
      standing: true,
      first: 375,
      last: 399,
    });
  });

  it('stops on the last row held where the position’s bottom rows are not read', () => {
    // Rows 190–214 show and page 1 is not held: the 25 rows that end on row 199.
    expect(logRowsDrawn(holding(10_000, [0]), { first: 190, last: 214 })).toEqual({
      standing: true,
      first: 175,
      last: 199,
    });
  });

  it('stops on the first row held where the position’s top rows are not read', () => {
    expect(logRowsDrawn(holding(10_000, [1]), { first: 190, last: 214 })).toEqual({
      standing: true,
      first: 200,
      last: 224,
    });
  });

  it('stands no more rows than its page holds', () => {
    // A page of 200 and a viewport of 250 rows, above the position and below it.
    expect(logRowsDrawn(holding(10_000, [3]), { first: 5_000, last: 5_249 })).toEqual({
      standing: true,
      first: 600,
      last: 799,
    });
    expect(logRowsDrawn(holding(10_000, [30]), { first: 5_000, last: 5_249 })).toEqual({
      standing: true,
      first: 6_000,
      last: 6_199,
    });
    // The list's last page, 37 rows long, under a position above it.
    expect(logRowsDrawn(holding(10_037, [50]), { first: 100, last: 149 })).toEqual({
      standing: true,
      first: 10_000,
      last: 10_036,
    });
  });
});
