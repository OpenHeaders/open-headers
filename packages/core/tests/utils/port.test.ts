/**
 * Port validation — the shared verdict every port-picking surface reads
 * (daemon bind-port setting, client backend-URL port field).
 *
 * The boundaries are the contract: the three ranges and their two edges
 * (1024 and 49152) are what the UI keys its block/warn/allow behavior on,
 * so they're pinned explicitly rather than spot-checked.
 */
import { describe, expect, it } from 'vitest';

import { EPHEMERAL_PORT_START, MAX_PORT, MIN_UNPRIVILEGED_PORT, validatePort } from '../../src/utils/port';

describe('validatePort', () => {
  it('rejects non-integers', () => {
    expect(validatePort(8137.5).level).toBe('reject');
    expect(validatePort(Number.NaN).level).toBe('reject');
    expect(validatePort(Number.POSITIVE_INFINITY).level).toBe('reject');
  });

  it('rejects privileged ports below 1024', () => {
    expect(validatePort(0).level).toBe('reject');
    expect(validatePort(80).level).toBe('reject');
    expect(validatePort(MIN_UNPRIVILEGED_PORT - 1).level).toBe('reject');
  });

  it('rejects negative ports', () => {
    expect(validatePort(-1).level).toBe('reject');
  });

  it('rejects ports above 65535', () => {
    expect(validatePort(MAX_PORT + 1).level).toBe('reject');
    expect(validatePort(70000).level).toBe('reject');
  });

  it('accepts the registered/user range without a message', () => {
    expect(validatePort(MIN_UNPRIVILEGED_PORT)).toEqual({ level: 'ok' });
    expect(validatePort(8137)).toEqual({ level: 'ok' });
    expect(validatePort(EPHEMERAL_PORT_START - 1)).toEqual({ level: 'ok' });
  });

  it('warns on the ephemeral range but still allows it', () => {
    expect(validatePort(EPHEMERAL_PORT_START).level).toBe('warn');
    expect(validatePort(55000).level).toBe('warn');
    expect(validatePort(MAX_PORT).level).toBe('warn');
  });

  it('attaches a semantic reason to non-ok verdicts', () => {
    expect(validatePort(8137.5)).toEqual({ level: 'reject', reason: 'not-integer' });
    expect(validatePort(80)).toEqual({ level: 'reject', reason: 'privileged' });
    expect(validatePort(70000)).toEqual({ level: 'reject', reason: 'above-max' });
    expect(validatePort(55000)).toEqual({ level: 'warn', reason: 'ephemeral' });
  });
});
