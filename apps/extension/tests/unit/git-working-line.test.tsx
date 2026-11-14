/**
 * `GitWorkingLine` — the Git window's line of work: bright while one of
 * its verbs is at the host and gone the moment the host answers; dim
 * while the log is read again, in whole passes — a pass once begun is
 * finished; a verb outranks a read.
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

const tone = (): string | null => screen.queryByTestId('git-tool-working')?.getAttribute('data-tone') ?? null;

describe('GitWorkingLine', () => {
  it('shows nothing at rest', () => {
    render(<GitWorkingLine working={false} reading={false} />);
    expect(tone()).toBeNull();
  });

  it('is the bright line while a verb is at the host, and gone when it answers', () => {
    const view = render(<GitWorkingLine working reading={false} />);
    expect(tone()).toBe('work');
    view.rerender(<GitWorkingLine working={false} reading={false} />);
    expect(tone()).toBeNull();
  });

  it('is the dim line for a read, and finishes the pass it is in', () => {
    const view = render(<GitWorkingLine working={false} reading />);
    expect(tone()).toBe('read');
    view.rerender(<GitWorkingLine working={false} reading={false} />);
    expect(tone()).toBe('read');
    fireEvent.animationIteration(screen.getByTestId('git-tool-working'));
    expect(tone()).toBeNull();
  });

  it('lets a verb outrank a read', () => {
    const view = render(<GitWorkingLine working reading />);
    expect(tone()).toBe('work');
    view.rerender(<GitWorkingLine working={false} reading />);
    expect(tone()).toBe('read');
  });
});
