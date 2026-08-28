import { describe, expect, it } from 'vitest';
import type { HLC, MutatorContext, PauseMarkerRef } from '../../src/sync';
import {
  foldPauseMarkerItems,
  isPauseMarkersRecord,
  normalizePauseMarkersSeed,
  pauseMarkersRecordFromEntries,
  seedPauseMarkers,
} from '../../src/sync-builders/projections/pause-markers-projection';

const ctx: MutatorContext = {
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'n' },
  surfaceId: 's',
  deviceId: 'd',
};

const hlc = (ms: number): HLC => ({ physicalMs: ms, logical: 0, nodeId: 'n' });

const REFS: Record<string, PauseMarkerRef> = {
  'rules/auth-col-1': { type: 'collection', uid: 'col-1' },
  'rules/auth-col-1/login-fld-1': { type: 'folder', uid: 'fld-1' },
};
const resolve = (path: string): PauseMarkerRef | null => REFS[path] ?? null;

describe('foldPauseMarkerItems', () => {
  it('takes version-2 members as is, sorted by uid', () => {
    const entries = foldPauseMarkerItems(
      [
        { itemId: 'fld-1', item: { type: 'folder', uid: 'fld-1', marker: 'unpaused' }, addHlc: hlc(2) },
        {
          itemId: 'col-1',
          item: { type: 'collection', uid: 'col-1', marker: 'paused', path: 'rules/auth-col-1' },
          addHlc: hlc(1),
        },
      ],
      resolve,
    );
    expect(entries).toEqual([
      { type: 'collection', uid: 'col-1', marker: 'paused', path: 'rules/auth-col-1' },
      { type: 'folder', uid: 'fld-1', marker: 'unpaused' },
    ]);
  });

  it('migrates version-1 path members on read through the resolver, keeping the path as the hint', () => {
    const entries = foldPauseMarkerItems(
      [
        {
          itemId: 'rules/auth-col-1/login-fld-1',
          item: { path: 'rules/auth-col-1/login-fld-1', marker: 'paused' },
          addHlc: hlc(1),
        },
      ],
      resolve,
    );
    expect(entries).toEqual([{ type: 'folder', uid: 'fld-1', marker: 'paused', path: 'rules/auth-col-1/login-fld-1' }]);
  });

  it('drops a version-1 member whose path no container answers to', () => {
    expect(
      foldPauseMarkerItems(
        [{ itemId: 'rules/gone', item: { path: 'rules/gone', marker: 'paused' }, addHlc: hlc(1) }],
        resolve,
      ),
    ).toEqual([]);
  });

  it('lets the higher add-HLC win when both shapes name one container', () => {
    const legacyNewer = foldPauseMarkerItems(
      [
        { itemId: 'col-1', item: { type: 'collection', uid: 'col-1', marker: 'paused' }, addHlc: hlc(1) },
        { itemId: 'rules/auth-col-1', item: { path: 'rules/auth-col-1', marker: 'unpaused' }, addHlc: hlc(5) },
      ],
      resolve,
    );
    expect(legacyNewer.map((e) => e.marker)).toEqual(['unpaused']);
    const uidNewer = foldPauseMarkerItems(
      [
        { itemId: 'rules/auth-col-1', item: { path: 'rules/auth-col-1', marker: 'unpaused' }, addHlc: hlc(5) },
        { itemId: 'col-1', item: { type: 'collection', uid: 'col-1', marker: 'paused' }, addHlc: hlc(9) },
      ],
      resolve,
    );
    expect(uidNewer.map((e) => e.marker)).toEqual(['paused']);
  });

  it('ignores malformed members', () => {
    expect(
      foldPauseMarkerItems(
        [
          { itemId: 'x', item: { type: 'rule', uid: 'x', marker: 'paused' }, addHlc: hlc(1) },
          { itemId: 'y', item: { uid: 'y', marker: 'nope' }, addHlc: hlc(1) },
          { itemId: 'z', item: null, addHlc: hlc(1) },
        ],
        resolve,
      ),
    ).toEqual([]);
  });
});

describe('pauseMarkersRecordFromEntries', () => {
  it('keys the map by uid beside the entries', () => {
    expect(pauseMarkersRecordFromEntries([{ type: 'folder', uid: 'f', marker: 'paused' }])).toEqual({
      markers: { f: 'paused' },
      entries: [{ type: 'folder', uid: 'f', marker: 'paused' }],
    });
  });
});

describe('seed sources', () => {
  it('recognises the current record shape', () => {
    expect(isPauseMarkersRecord({ markers: {}, entries: [] })).toBe(true);
    expect(isPauseMarkersRecord({ 'rules/a': 'paused' })).toBe(false);
    expect(isPauseMarkersRecord({ markers: { 'rules/a': 'paused' }, paths: ['rules/a'] })).toBe(false);
  });

  it('splits a version-1 post-state and a bare version-1 record into their path maps', () => {
    expect(normalizePauseMarkersSeed({ markers: { 'rules/a': 'paused' }, paths: ['rules/a'] })).toEqual({
      legacy: { 'rules/a': 'paused' },
    });
    expect(normalizePauseMarkersSeed({ 'rules/a': 'unpaused' })).toEqual({ legacy: { 'rules/a': 'unpaused' } });
  });

  it('seeds version-2 members from the current record', () => {
    const batch = seedPauseMarkers(
      { markers: { f: 'paused' }, entries: [{ type: 'folder', uid: 'f', marker: 'paused', path: 'rules/c/f' }] },
      ctx,
    );
    expect(batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: 'pause-markers', id: 'pause-markers', payload: {} },
      {
        kind: 'addToSet',
        type: 'pause-markers',
        id: 'pause-markers',
        path: 'markers',
        itemId: 'f',
        item: { type: 'folder', uid: 'f', marker: 'paused', path: 'rules/c/f' },
      },
    ]);
  });

  it('seeds version-1 members from a version-1 source so the fold is the one migration point', () => {
    const batch = seedPauseMarkers({ 'rules/a': 'paused' }, ctx);
    expect(batch.mutations[1].body).toEqual({
      kind: 'addToSet',
      type: 'pause-markers',
      id: 'pause-markers',
      path: 'markers',
      itemId: 'rules/a',
      item: { path: 'rules/a', marker: 'paused' },
    });
  });
});
