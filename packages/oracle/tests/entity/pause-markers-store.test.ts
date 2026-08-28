/**
 * The DNR-side read seam over the pause markers: the uid-keyed mirror
 * and `getPausedUids()`, resolved over the rules tree and memoized
 * until the markers or the tree change. A marker follows its folder
 * across a move because the key is the folder uid, not its path.
 */

import type { Collection, Rule } from '@openheaders/core/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/oracle/sync/service/accessors', () => ({
  getCacheForWorkspace: () => null,
  getActiveCacheForRegistration: () => null,
  getOracleForCurrentWorkspace: () => null,
}));

import { __resetForTests, __setMarkersForTests, getPausedUids } from '../../src/entity/pause-markers-store';
import { __resetForTests as resetRuleStore } from '../../src/entity/rule-store';
import { notifyChange, setCollections, setFolders, setRules } from '../../src/entity/rule-store/state';

function collection(uid: string, path: string): Collection {
  return {
    schemaVersion: 5,
    uid,
    name: uid,
    path,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

function rule(uid: string, path: string): Rule {
  return {
    uid,
    path,
    name: uid,
    type: 'block',
    enabled: true,
    published: true,
    conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['api.openheaders.io'] }],
    action: {},
  } as Rule;
}

afterEach(() => {
  __resetForTests();
  resetRuleStore();
});

describe('pause-markers-store getPausedUids', () => {
  it('resolves the marker over the tree and keeps following the folder after it moves', () => {
    setCollections([collection('col00001', 'rules/a-col00001'), collection('col00002', 'rules/b-col00002')]);
    setFolders([{ uid: 'fld00001', name: 'Login', path: 'rules/a-col00001/login-fld00001' }]);
    setRules([
      rule('rul00001', 'rules/a-col00001/login-fld00001/r1-rul00001'),
      rule('rul00002', 'rules/a-col00001/r2-rul00002'),
    ]);
    notifyChange();
    __setMarkersForTests({ fld00001: 'paused' });

    expect(getPausedUids()).toEqual(new Set(['fld00001', 'rul00001']));

    // The folder moves to the other collection: its path and its
    // rule's path re-project, the marker's key does not.
    setFolders([{ uid: 'fld00001', name: 'Login', path: 'rules/b-col00002/login-fld00001' }]);
    setRules([
      rule('rul00001', 'rules/b-col00002/login-fld00001/r1-rul00001'),
      rule('rul00002', 'rules/a-col00001/r2-rul00002'),
    ]);
    notifyChange();

    expect(getPausedUids()).toEqual(new Set(['fld00001', 'rul00001']));
  });

  it('honours an unpaused folder override under a paused collection and memoizes between changes', () => {
    setCollections([collection('col00001', 'rules/a-col00001')]);
    setFolders([{ uid: 'fld00001', name: 'Login', path: 'rules/a-col00001/login-fld00001' }]);
    setRules([
      rule('rul00001', 'rules/a-col00001/login-fld00001/r1-rul00001'),
      rule('rul00002', 'rules/a-col00001/r2-rul00002'),
    ]);
    notifyChange();
    __setMarkersForTests({ col00001: 'paused', fld00001: 'unpaused' });

    const first = getPausedUids();
    expect(first).toEqual(new Set(['col00001', 'rul00002']));
    expect(getPausedUids()).toBe(first);

    __setMarkersForTests({ col00001: 'paused' });
    expect(getPausedUids()).toEqual(new Set(['col00001', 'fld00001', 'rul00001', 'rul00002']));
  });

  it('is empty with no markers', () => {
    setCollections([collection('col00001', 'rules/a-col00001')]);
    setRules([rule('rul00001', 'rules/a-col00001/r1-rul00001')]);
    notifyChange();
    expect(getPausedUids().size).toBe(0);
  });
});
