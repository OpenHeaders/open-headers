/**
 * `GitWorkingLine` — the Git window's one sign of work is the pulse a
 * request's Send plays: the sweep while a verb is at the host or the
 * log is read again, the pass it is on finished when the work ends,
 * and no line after it — the window lands on no state of its own.
 */

import GitWorkingLine from '@openheaders/ui/workbench/components/panels/git/GitWorkingLine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React registers onAnimationIteration under a vendor-prefixed name when
// the window lacks AnimationEvent, as jsdom's does.
vi.hoisted(() => {
  const scope = globalThis as unknown as { AnimationEvent?: typeof Event };
  if (typeof scope.AnimationEvent === 'undefined') scope.AnimationEvent = Event;
});

afterEach(cleanup);

const phase = (): string | null => screen.queryByTestId('oh-send-pulse')?.getAttribute('data-phase') ?? null;

describe('GitWorkingLine', () => {
  it('shows nothing at rest', () => {
    render(<GitWorkingLine active={false} />);
    expect(phase()).toBeNull();
  });

  it('plays the sweep along the top edge while work is out', () => {
    render(<GitWorkingLine active />);
    expect(phase()).toBe('inflight');
    expect(screen.getByTestId('oh-send-pulse').getAttribute('data-axis')).toBe('x');
  });

  it('finishes the pass it is on when the work ends, then goes dark with no line', () => {
    const view = render(<GitWorkingLine active />);
    view.rerender(<GitWorkingLine active={false} />);
    expect(phase()).toBe('inflight');
    fireEvent.animationIteration(screen.getByTestId('oh-send-pulse'));
    expect(phase()).toBeNull();
  });

  it('keeps sweeping past the end of a pass while the work is still out', () => {
    render(<GitWorkingLine active />);
    fireEvent.animationIteration(screen.getByTestId('oh-send-pulse'));
    expect(phase()).toBe('inflight');
  });
});
