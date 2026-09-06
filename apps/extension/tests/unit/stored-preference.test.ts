/**
 * `createStoredPreference` — the browser-local UI preference store the
 * split orientations and the GraphQL explorer's descriptions toggle
 * ride: the stored value read at creation, an unknown or missing one
 * falling back, a set written through and fanned out to every mounted
 * consumer.
 */

import { createStoredPreference } from '@openheaders/ui/shared/hooks/useStoredPreference';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

const MODES = ['shown', 'hidden'] as const;
const KEY = 'oh.test.preference';

describe('createStoredPreference', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it('falls back when nothing or something off-list is stored', () => {
    expect(renderHook(createStoredPreference(KEY, MODES, 'shown')).result.current[0]).toBe('shown');
    localStorage.setItem(KEY, 'sideways');
    expect(renderHook(createStoredPreference(KEY, MODES, 'hidden')).result.current[0]).toBe('hidden');
  });

  it('reads the stored value at creation', () => {
    localStorage.setItem(KEY, 'hidden');
    expect(renderHook(createStoredPreference(KEY, MODES, 'shown')).result.current[0]).toBe('hidden');
  });

  it('writes a set through and fans it out to every mounted consumer', () => {
    const usePreference = createStoredPreference(KEY, MODES, 'shown');
    const first = renderHook(usePreference);
    const second = renderHook(usePreference);
    act(() => first.result.current[1]('hidden'));
    expect(first.result.current[0]).toBe('hidden');
    expect(second.result.current[0]).toBe('hidden');
    expect(localStorage.getItem(KEY)).toBe('hidden');
  });
});
