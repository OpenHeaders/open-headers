/**
 * `BodyJoinMap` — covers consume-on-lookup, per-tab isolation, LRU cap,
 * and `forgetTab` cleanup.
 */

import { describe, expect, it } from 'vitest';

import { BodyJoinMap, MAX_BODY_JOIN_KEYS_PER_TAB } from '../../src/correlator-heuristic/body-join-map';

const TAB = 7;
const ISO = '2024-01-01T00:00:00.000Z';

describe('BodyJoinMap — remember + consume', () => {
  it('remembers a target and consumes it on lookup', () => {
    const m = new BodyJoinMap();
    m.remember(TAB, 'GET', 'https://api.openheaders.io/x', ISO, { requestId: 'r1', hopIndex: 0 });
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/x', ISO)).toEqual({
      requestId: 'r1',
      hopIndex: 0,
    });
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/x', ISO)).toBeUndefined();
  });

  it('returns undefined for a key never remembered', () => {
    const m = new BodyJoinMap();
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/x', ISO)).toBeUndefined();
  });

  it('per-tab isolation — TAB+1 does not see TAB’s target', () => {
    const m = new BodyJoinMap();
    m.remember(TAB, 'GET', 'https://api.openheaders.io/x', ISO, { requestId: 'r1', hopIndex: 0 });
    expect(m.consume(TAB + 1, 'GET', 'https://api.openheaders.io/x', ISO)).toBeUndefined();
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/x', ISO)).toEqual({
      requestId: 'r1',
      hopIndex: 0,
    });
  });

  it('remember overwrites an existing target for the same key', () => {
    const m = new BodyJoinMap();
    m.remember(TAB, 'GET', 'https://api.openheaders.io/x', ISO, { requestId: 'r1', hopIndex: 0 });
    m.remember(TAB, 'GET', 'https://api.openheaders.io/x', ISO, { requestId: 'r2', hopIndex: 1 });
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/x', ISO)).toEqual({
      requestId: 'r2',
      hopIndex: 1,
    });
  });
});

describe('BodyJoinMap — LRU cap at MAX_BODY_JOIN_KEYS_PER_TAB', () => {
  it('drops the oldest entry when the per-tab cap is exceeded', () => {
    const m = new BodyJoinMap();
    for (let i = 0; i < MAX_BODY_JOIN_KEYS_PER_TAB; i++) {
      m.remember(TAB, 'GET', `https://api.openheaders.io/r${i}`, ISO, {
        requestId: `req-${i}`,
        hopIndex: 0,
      });
    }
    expect(m.size()).toBe(MAX_BODY_JOIN_KEYS_PER_TAB);
    m.remember(TAB, 'GET', 'https://api.openheaders.io/extra', ISO, {
      requestId: 'req-extra',
      hopIndex: 0,
    });
    expect(m.size()).toBe(MAX_BODY_JOIN_KEYS_PER_TAB);
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/r0', ISO)).toBeUndefined();
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/extra', ISO)).toEqual({
      requestId: 'req-extra',
      hopIndex: 0,
    });
  });
});

describe('BodyJoinMap — forgetTab', () => {
  it('drops the entire tab partition', () => {
    const m = new BodyJoinMap();
    m.remember(TAB, 'GET', 'https://api.openheaders.io/x', ISO, { requestId: 'r1', hopIndex: 0 });
    m.remember(TAB + 1, 'GET', 'https://api.openheaders.io/x', ISO, { requestId: 'r2', hopIndex: 0 });
    m.forgetTab(TAB);
    expect(m.consume(TAB, 'GET', 'https://api.openheaders.io/x', ISO)).toBeUndefined();
    expect(m.consume(TAB + 1, 'GET', 'https://api.openheaders.io/x', ISO)).toEqual({
      requestId: 'r2',
      hopIndex: 0,
    });
  });
});
