/**
 * Connection-opener index — attributes a reused socket to the request that
 * opened it (paid DNS / TCP / TLS). Best-effort: rows with no connection id or
 * whose opener is outside the capture resolve to `undefined`.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { buildConnectionOpenerIndex, connectionOpenerFor } from '@openheaders/ui/panel/data/connection-openers';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { describe, expect, it } from 'vitest';
import { makeHar, makeRow } from '../../__factories__/lifecycle';

/** A row carrying a HAR entry with a connection id + the given setup timings. */
function row(
  displayId: number,
  url: string,
  connId: string | undefined,
  timings: NonNullable<InspectorHarEntry['timings']>,
): InspectorRowWithFires {
  const entry: InspectorHarEntry = { ...makeHar(url, { timings }), ...(connId ? { _connectionId: connId } : {}) };
  return makeRow({ displayId, url, completedAtMs: 1000, har: [entry] });
}

/** Opener: paid DNS + connect + TLS. */
const SETUP = { blocked: 1, dns: 20, connect: 30, ssl: 40, send: 1, wait: 100, receive: 10 };
/** Reused: no setup phases, but a real response. */
const REUSED = { blocked: 0.3, dns: -1, connect: -1, ssl: -1, send: 0.3, wait: 100, receive: 10 };

describe('buildConnectionOpenerIndex / connectionOpenerFor', () => {
  it('attributes a reused row to the earliest setup-paying request on its connection', () => {
    const opener = row(1, 'https://openheaders.io/', 'c100', SETUP);
    const reused = row(2, 'https://openheaders.io/app.js', 'c100', REUSED);
    const index = buildConnectionOpenerIndex([opener, reused]);
    expect(connectionOpenerFor(reused, index)).toEqual({ displayId: 1, url: 'https://openheaders.io/' });
  });

  it('returns undefined for the opener itself (never attributes a row to itself)', () => {
    const opener = row(1, 'https://openheaders.io/', 'c100', SETUP);
    const index = buildConnectionOpenerIndex([opener]);
    expect(connectionOpenerFor(opener, index)).toBeUndefined();
  });

  it('returns undefined when the opener is not in the capture (pre-warmed / coalesced)', () => {
    // A reused row whose connection was opened before recording — no opener row.
    const reused = row(2, 'https://openheaders.io/app.js', 'c999', REUSED);
    const index = buildConnectionOpenerIndex([reused]);
    expect(connectionOpenerFor(reused, index)).toBeUndefined();
  });

  it('skips rows with no connection id (cache hits / id 0)', () => {
    const reused = row(2, 'https://openheaders.io/app.js', undefined, REUSED);
    const zero = row(3, 'https://openheaders.io/x.js', '0', REUSED);
    const index = buildConnectionOpenerIndex([reused, zero]);
    expect(index.size).toBe(0);
    expect(connectionOpenerFor(reused, index)).toBeUndefined();
  });

  it('keeps the earliest opener when several requests paid setup on one id', () => {
    const later = row(5, 'https://openheaders.io/a', 'c100', SETUP);
    const earlier = row(2, 'https://openheaders.io/b', 'c100', SETUP);
    const index = buildConnectionOpenerIndex([later, earlier]);
    expect(index.get('c100')?.displayId).toBe(2);
  });
});
