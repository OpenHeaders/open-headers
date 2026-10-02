/**
 * The secret-value registry: the resolved non-empty values a manager
 * answered with, add-only for the worker's lifetime — the set the
 * capture planes scrub by. (The loopback broker's feed is pinned in
 * the broker's own spec.)
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetSecretValueRegistryForTests,
  knownSecretValues,
  noteSecretResolutions,
} from '@/background/modules/secret-manager/secret-value-registry';

beforeEach(() => {
  __resetSecretValueRegistryForTests();
});

describe('noteSecretResolutions', () => {
  it('keeps the resolved non-empty values only', () => {
    expect(knownSecretValues().size).toBe(0);
    noteSecretResolutions(
      new Map([
        ['ApiToken', { ok: true, value: 'tok_1' }],
        ['Empty', { ok: true, value: '' }],
        ['Locked', { ok: false, reason: 'authorization-required' }],
      ]),
    );
    expect([...knownSecretValues()]).toEqual(['tok_1']);
  });

  it('is add-only — a rotated value keeps its predecessor scrubbed', () => {
    noteSecretResolutions(new Map([['ApiToken', { ok: true, value: 'tok_1' }]]));
    noteSecretResolutions(new Map([['ApiToken', { ok: true, value: 'tok_2' }]]));
    expect([...knownSecretValues()].sort()).toEqual(['tok_1', 'tok_2']);
  });
});
