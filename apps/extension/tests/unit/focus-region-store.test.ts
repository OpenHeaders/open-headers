import { afterEach, describe, expect, it } from 'vitest';
import {
  getFocusedDock,
  getFocusedRegion,
  setFocusedDock,
  setFocusedRegion,
} from '@/rules/stores/focus-region-store';

afterEach(() => {
  setFocusedRegion(null);
  setFocusedDock(null);
});

describe('focus-region-store', () => {
  it('tracks region and dock independently', () => {
    setFocusedRegion('left');
    setFocusedDock('left-top');
    expect(getFocusedRegion()).toBe('left');
    expect(getFocusedDock()).toBe('left-top');
  });

  it('clears dock when region goes to editor', () => {
    setFocusedDock('right-top');
    setFocusedRegion('right');
    expect(getFocusedDock()).toBe('right-top');
    setFocusedRegion('editor');
    expect(getFocusedDock()).toBeNull();
    expect(getFocusedRegion()).toBe('editor');
  });

  it('clears dock when region goes null', () => {
    setFocusedDock('bottom-left');
    setFocusedRegion('bottom');
    setFocusedRegion(null);
    expect(getFocusedRegion()).toBeNull();
    expect(getFocusedDock()).toBeNull();
  });

  it('preserves dock across same-region writes', () => {
    setFocusedRegion('left');
    setFocusedDock('left-bottom');
    setFocusedRegion('left');
    expect(getFocusedDock()).toBe('left-bottom');
  });

  it('is idempotent on repeated setters', () => {
    setFocusedRegion('right');
    setFocusedRegion('right');
    setFocusedDock('right-top');
    setFocusedDock('right-top');
    expect(getFocusedRegion()).toBe('right');
    expect(getFocusedDock()).toBe('right-top');
  });
});
