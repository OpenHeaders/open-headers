/**
 * Focus ring — pane cycling, digit jumps, and the modal stack that
 * captures focus wholesale while overlays are open.
 */

import { describe, expect, it } from 'vitest';
import { createFocusRing } from '../../../src/tui/focus';

const PANES = ['workspaces', 'environments', 'rules'] as const;

describe('createFocusRing', () => {
  it('starts on the first pane', () => {
    const ring = createFocusRing(PANES);
    expect(ring.focusedPane).toBe('workspaces');
    expect(ring.active).toBe('workspaces');
    expect(ring.modal).toBeNull();
  });

  it('refuses an empty pane list', () => {
    expect(() => createFocusRing([])).toThrow();
  });

  it('next and previous cycle with wrap-around', () => {
    const ring = createFocusRing(PANES);
    ring.next();
    expect(ring.focusedPane).toBe('environments');
    ring.next();
    ring.next();
    expect(ring.focusedPane).toBe('workspaces');
    ring.previous();
    expect(ring.focusedPane).toBe('rules');
  });

  it('digits jump 1-based; out-of-range digits are inert', () => {
    const ring = createFocusRing(PANES);
    expect(ring.focusDigit(3)).toBe(true);
    expect(ring.focusedPane).toBe('rules');
    expect(ring.focusDigit(4)).toBe(false);
    expect(ring.focusDigit(0)).toBe(false);
    expect(ring.focusedPane).toBe('rules');
  });

  it('focusPane targets a known pane and rejects unknown ids', () => {
    const ring = createFocusRing<string>(PANES);
    expect(ring.focusPane('environments')).toBe(true);
    expect(ring.focusedPane).toBe('environments');
    expect(ring.focusPane('nope')).toBe(false);
    expect(ring.focusedPane).toBe('environments');
  });

  it('a modal captures focus: movement is inert and active answers the modal', () => {
    const ring = createFocusRing(PANES);
    ring.pushModal('help');
    expect(ring.active).toBe('help');
    expect(ring.modal).toBe('help');
    ring.next();
    expect(ring.focusPane('rules')).toBe(false);
    expect(ring.focusDigit(2)).toBe(false);
    expect(ring.focusedPane).toBe('workspaces');
  });

  it('modals stack and pop innermost-first', () => {
    const ring = createFocusRing(PANES);
    ring.pushModal('palette');
    ring.pushModal('help');
    expect(ring.active).toBe('help');
    expect(ring.popModal()).toBe('help');
    expect(ring.active).toBe('palette');
    expect(ring.popModal()).toBe('palette');
    expect(ring.popModal()).toBeNull();
    expect(ring.active).toBe('workspaces');
  });

  it('setPanes keeps focus when the pane survives and resets it when it does not', () => {
    const ring = createFocusRing(PANES);
    ring.focusPane('rules');
    ring.setPanes(['rules']);
    expect(ring.focusedPane).toBe('rules');
    ring.setPanes(['workspaces', 'environments']);
    expect(ring.focusedPane).toBe('workspaces');
    expect(() => ring.setPanes([])).toThrow();
  });
});
