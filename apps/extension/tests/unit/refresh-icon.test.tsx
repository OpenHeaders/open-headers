/**
 * `RefreshIcon` — `spin` turns the glyph in whole turns: it turns from
 * the moment a read goes out, and when the read answers it finishes
 * the turn it is in before it rests — a read of a tenth of a second is
 * one full turn, never a twitch that snaps back.
 */

import { RefreshIcon } from '@openheaders/ui/shared/icons';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React registers onAnimationIteration under a vendor-prefixed name when
// the window lacks AnimationEvent, as jsdom's does.
vi.hoisted(() => {
  const scope = globalThis as unknown as { AnimationEvent?: typeof Event };
  if (typeof scope.AnimationEvent === 'undefined') scope.AnimationEvent = Event;
});

afterEach(cleanup);

const glyph = (container: HTMLElement): HTMLElement => {
  const node = container.querySelector<HTMLElement>('.anticon');
  if (node === null) throw new Error('no glyph');
  return node;
};
const turning = (container: HTMLElement): boolean => container.querySelector('.anticon-spin') !== null;

describe('RefreshIcon', () => {
  it('rests until a read goes out', () => {
    const view = render(<RefreshIcon />);
    expect(turning(view.container)).toBe(false);
    view.rerender(<RefreshIcon spin />);
    expect(turning(view.container)).toBe(true);
  });

  it('turns its box alone — the drawing inside takes no turn of its own', () => {
    const view = render(<RefreshIcon spin />);
    expect(glyph(view.container).classList.contains('anticon-spin')).toBe(true);
    expect(view.container.querySelector('svg')?.getAttribute('class') ?? '').not.toContain('anticon-spin');
  });

  it('finishes the turn it is in when the read answers', () => {
    const view = render(<RefreshIcon spin />);
    view.rerender(<RefreshIcon spin={false} />);
    expect(turning(view.container)).toBe(true);
    fireEvent.animationIteration(glyph(view.container));
    expect(turning(view.container)).toBe(false);
  });

  it('keeps turning past the end of a turn while the read is still out', () => {
    const view = render(<RefreshIcon spin />);
    fireEvent.animationIteration(glyph(view.container));
    expect(turning(view.container)).toBe(true);
  });

  it('takes a second read that goes out before the turn ends', () => {
    const view = render(<RefreshIcon spin />);
    view.rerender(<RefreshIcon spin={false} />);
    view.rerender(<RefreshIcon spin />);
    fireEvent.animationIteration(glyph(view.container));
    expect(turning(view.container)).toBe(true);
    view.rerender(<RefreshIcon spin={false} />);
    fireEvent.animationIteration(glyph(view.container));
    expect(turning(view.container)).toBe(false);
  });
});
