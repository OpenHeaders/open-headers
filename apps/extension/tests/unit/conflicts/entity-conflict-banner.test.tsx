/**
 * `<EntityConflictBanner>` — count gate + click-handler dispatch.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import EntityConflictBanner from '@openheaders/ui/shared/conflicts/EntityConflictBanner';

beforeAll(() => {
  // antd Alert pulls in Typography helpers that probe these jsdom-missing APIs.
  if (typeof document.queryCommandSupported !== 'function') {
    document.queryCommandSupported = (() => false) as typeof document.queryCommandSupported;
  }
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(() => cleanup());

describe('EntityConflictBanner', () => {
  it('renders nothing when count < 2', () => {
    const { container } = render(
      <EntityConflictBanner count={1} onReview={vi.fn()} onKeepAllMine={vi.fn()} onUseAllSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders count + three actions when count >= 2', () => {
    render(
      <EntityConflictBanner count={5} onReview={vi.fn()} onKeepAllMine={vi.fn()} onUseAllSaved={vi.fn()} />,
    );
    expect(screen.getByText(/5/)).toBeTruthy();
    expect(screen.getByText(/changed externally/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review changes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep all mine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use all saved' })).toBeTruthy();
  });

  it('dispatches the right callback per button', () => {
    const onReview = vi.fn();
    const onKeepAllMine = vi.fn();
    const onUseAllSaved = vi.fn();
    render(
      <EntityConflictBanner count={3} onReview={onReview} onKeepAllMine={onKeepAllMine} onUseAllSaved={onUseAllSaved} />,
    );
    screen.getByRole('button', { name: 'Review changes' }).click();
    screen.getByRole('button', { name: 'Keep all mine' }).click();
    screen.getByRole('button', { name: 'Use all saved' }).click();
    expect(onReview).toHaveBeenCalledOnce();
    expect(onKeepAllMine).toHaveBeenCalledOnce();
    expect(onUseAllSaved).toHaveBeenCalledOnce();
  });

  it('honors fieldNoun override', () => {
    render(
      <EntityConflictBanner
        count={4}
        fieldNoun="headers"
        onReview={vi.fn()}
        onKeepAllMine={vi.fn()}
        onUseAllSaved={vi.fn()}
      />,
    );
    expect(screen.getByText(/headers changed externally/)).toBeTruthy();
  });
});
