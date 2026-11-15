/**
 * The text field asked of the whole history, the view's half: what a
 * search sends the host — the log's scope and row filters, the riders
 * the view otherwise sifts by itself, never the walk's order — and
 * whose rows the log lists once the host has answered: the window's own
 * sift until an answer reaches past the window.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import {
  type LogSearchAsk,
  logSearchFace,
  logSearchRequest,
} from '@openheaders/ui/workbench/components/panels/git/log-search';
import { describe, expect, it } from 'vitest';

function entry(sha: string): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents: [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-06T10:00:00.000Z',
    subject: `commit ${sha}`,
    coAuthors: [],
    files: [],
  };
}

const ASK: LogSearchAsk = {
  workspaceId: 'ws-1',
  key: 'log:1',
  text: 'probe',
  regex: false,
  matchCase: false,
  scope: [],
  filters: {},
  noMerges: false,
  firstParent: false,
  limit: 200,
};

describe('logSearchRequest', () => {
  it('asks every ref for an unfiltered log, the text and the tab as they stand', () => {
    expect(logSearchRequest(ASK)).toEqual({
      workspaceId: 'ws-1',
      key: 'log:1',
      text: 'probe',
      limit: 200,
      allRefs: true,
    });
  });

  it('sends the toggles only when they are on', () => {
    expect(logSearchRequest({ ...ASK, regex: true, matchCase: true })).toMatchObject({ regex: true, matchCase: true });
    const plain = logSearchRequest(ASK);
    expect('regex' in plain).toBe(false);
    expect('matchCase' in plain).toBe(false);
  });

  it('sends a scope as `refs` — one ref too — and nothing for HEAD alone', () => {
    expect(logSearchRequest({ ...ASK, scope: ['main'] })).toMatchObject({ refs: ['main'] });
    expect(logSearchRequest({ ...ASK, scope: ['HEAD', 'main'] })).toMatchObject({ refs: ['HEAD', 'main'] });
    const head = logSearchRequest({ ...ASK, scope: ['HEAD'] });
    expect('refs' in head).toBe(false);
    expect('allRefs' in head).toBe(false);
    expect('ref' in logSearchRequest({ ...ASK, scope: ['main'] })).toBe(false);
  });

  it('carries the log’s row filters and leaves the walk’s order behind', () => {
    const request = logSearchRequest({
      ...ASK,
      filters: {
        authors: ['John Doe', 'Dana Reyes'],
        since: '2026-11-01T00:00:00.000Z',
        until: '2026-11-06T23:59:59',
        paths: ['docs'],
        topoOrder: true,
      },
    });
    expect(request).toMatchObject({
      authors: ['John Doe', 'Dana Reyes'],
      since: '2026-11-01T00:00:00.000Z',
      until: '2026-11-06T23:59:59',
      paths: ['docs'],
    });
    expect('topoOrder' in request).toBe(false);
    expect(logSearchRequest({ ...ASK, filters: { authorMe: true } })).toMatchObject({ authorMe: true });
    expect(logSearchRequest({ ...ASK, filters: { author: 'John Doe' } })).toMatchObject({ author: 'John Doe' });
  });

  it('sends the riders the view sifts a window by — over a history they are the host’s', () => {
    expect(logSearchRequest({ ...ASK, noMerges: true, firstParent: true })).toMatchObject({
      noMerges: true,
      firstParent: true,
    });
    const none = logSearchRequest(ASK);
    expect('noMerges' in none).toBe(false);
    expect('firstParent' in none).toBe(false);
  });
});

describe('logSearchFace', () => {
  const window = ['w1', 'w2', 'w3'].map(entry);

  it('is the window’s sift while the host has said nothing', () => {
    expect(logSearchFace(window, null)).toEqual({ kind: 'window' });
  });

  it('stays the window’s sift for an answer wholly inside the window', () => {
    expect(logSearchFace(window, { kind: 'page', entries: [entry('w3'), entry('w1')], more: false })).toEqual({
      kind: 'window',
    });
    expect(logSearchFace(window, { kind: 'page', entries: [], more: false })).toEqual({ kind: 'window' });
  });

  it('is the host’s page once one of its commits is outside the window — in the host’s order', () => {
    const entries = [entry('w2'), entry('old1'), entry('w1')];
    expect(logSearchFace(window, { kind: 'page', entries, more: false })).toEqual({
      kind: 'page',
      entries,
      more: false,
    });
  });

  it('is the host’s page when matches exist past it, even with every listed commit in the window', () => {
    const entries = [entry('w1'), entry('w2'), entry('w3')];
    expect(logSearchFace(window, { kind: 'page', entries, more: true })).toEqual({ kind: 'page', entries, more: true });
  });

  it('says a search past the window did not finish', () => {
    expect(logSearchFace(window, { kind: 'timeout' })).toEqual({ kind: 'timeout' });
  });
});
