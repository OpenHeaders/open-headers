/**
 * Pure mapper tests for HAR-entry / HAR-body → lifecycle updates.
 *
 * The correlator owns the join itself; these helpers exist to keep
 * update minting host-neutral and inspectable from a single call site.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import {
  bodyAttachedUpdate,
  harAttachedUpdate,
  harEntryJoinFields,
  harEntryTimestamp,
} from '../../src/correlator-heuristic/har-to-update';

const STARTED_AT_ISO = '2024-01-01T00:00:00.000Z';

const entry: InspectorHarEntry = {
  startedDateTime: STARTED_AT_ISO,
  request: {
    method: 'POST',
    url: 'https://api.openheaders.io/x',
    headers: [],
    queryString: [],
  },
  response: {
    status: 201,
    statusText: 'Created',
    headers: [],
    content: { size: 0, mimeType: 'text/plain' },
  },
};

describe('harEntryJoinFields', () => {
  it('extracts method + url, defaulting both to empty string when request is absent', () => {
    expect(harEntryJoinFields(entry)).toEqual({
      method: 'POST',
      url: 'https://api.openheaders.io/x',
    });
    expect(harEntryJoinFields({ startedDateTime: STARTED_AT_ISO })).toEqual({
      method: '',
      url: '',
    });
  });
});

describe('harEntryTimestamp', () => {
  it('parses an ISO startedDateTime into wall-clock ms', () => {
    expect(harEntryTimestamp(entry)).toBe(Date.parse(STARTED_AT_ISO));
  });

  it('returns null for a malformed startedDateTime', () => {
    expect(harEntryTimestamp({ ...entry, startedDateTime: 'not-a-date' })).toBeNull();
  });
});

describe('harAttachedUpdate', () => {
  it('stamps a wire-crossing entry effective/raw (wire request is post-rewrite, wire response pre-rewrite)', () => {
    const update = harAttachedUpdate({ tabId: 1, requestId: 'r1', hopIndex: 0, entry });
    expect(update).toEqual({
      kind: 'har-attached',
      tabId: 1,
      requestId: 'r1',
      hopIndex: 0,
      har: { ...entry, _ohHeaderCapture: { request: 'effective', response: 'raw' }, _ohEntrySource: 'devtools' },
    });
  });

  it('declares the devtools producer on every attached entry', () => {
    const update = harAttachedUpdate({ tabId: 1, requestId: 'r1', hopIndex: 0, entry });
    if (update.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(update.har._ohEntrySource).toBe('devtools');
  });

  it('stamps a cache-read entry raw/effective (cooked pre-wire request, served post-rewrite response)', () => {
    const cached: InspectorHarEntry = { ...entry, _fromCache: 'disk' };
    const update = harAttachedUpdate({ tabId: 1, requestId: 'r1', hopIndex: 0, entry: cached });
    if (update.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(update.har._ohHeaderCapture).toEqual({ request: 'raw', response: 'effective' });
  });

  it('reads the _servedFromCache boolean as the same cache-read signal', () => {
    const cached: InspectorHarEntry = { ...entry, _servedFromCache: true };
    const update = harAttachedUpdate({ tabId: 1, requestId: 'r1', hopIndex: 0, entry: cached });
    if (update.kind !== 'har-attached') throw new Error('expected har-attached');
    expect(update.har._ohHeaderCapture).toEqual({ request: 'raw', response: 'effective' });
  });
});

describe('bodyAttachedUpdate', () => {
  it('produces a well-formed body-attached update', () => {
    const update = bodyAttachedUpdate({
      tabId: 2,
      requestId: 'r2',
      hopIndex: 0,
      body: {
        method: 'GET',
        url: 'https://api.openheaders.io/y',
        startedDateTime: STARTED_AT_ISO,
        content: 'hello',
        encoding: '',
      },
    });
    expect(update.kind).toBe('body-attached');
    if (update.kind !== 'body-attached') throw new Error('expected body-attached');
    expect(update.tabId).toBe(2);
    expect(update.requestId).toBe('r2');
    expect(update.hopIndex).toBe(0);
    expect(update.body.content).toBe('hello');
  });
});
