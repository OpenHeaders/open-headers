/**
 * `<ConflictDiffChip>` Phase-1 copy refresh.
 *
 * Pins the user-visible language: "Saved value" / "Your edit", optional
 * subtitle for awareness attribution, "Last synced value" hidden until
 * the disclosure is toggled. Asserts the §6.3 LWW citation + raw
 * "base"/"theirs" tokens are not present in the default popover content.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ConflictDiffChip from '@openheaders/ui/shared/awareness/ConflictDiffChip';

beforeAll(() => {
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

function open() {
  // antd Popover renders content into a portal on click. The chip's
  // trigger is a `<span role="button" title="...">`; antd renders the
  // popover into a portal so screen queries work after click.
  const trigger = screen.getByTitle('External change available — click to resolve');
  act(() => {
    trigger.click();
  });
}

describe('ConflictDiffChip', () => {
  it('shows Saved value + Your edit + collapsed Last synced value (no remote)', () => {
    render(
      <ConflictDiffChip
        theirs="x-debug-true"
        base="(prev)"
        local="x-debug-mine"
        onTakeTheirs={() => {}}
        onKeepMine={() => {}}
      />,
    );
    open();

    expect(screen.getByText('External change')).toBeTruthy();
    expect(screen.getByText('Saved value')).toBeTruthy();
    expect(screen.getByText('x-debug-true')).toBeTruthy();
    expect(screen.getByText('Your edit')).toBeTruthy();
    expect(screen.getByText('x-debug-mine')).toBeTruthy();

    // Disclosure label visible, the base value itself hidden.
    expect(screen.getByText(/Last synced value/)).toBeTruthy();
    expect(screen.queryByText('(prev)')).toBeNull();
  });

  it('renders SurfaceChip attribution when remote info is provided', () => {
    render(
      <ConflictDiffChip
        theirs="42"
        base="0"
        local="7"
        remote={{
          surfaceKind: 'devpanel',
          surfaceLabel: 'DevTools on staging',
          instanceId: 'peer-instance',
          agoMs: 4_000,
        }}
        onTakeTheirs={() => {}}
        onKeepMine={() => {}}
      />,
    );
    open();

    // Canonical short label drives display; verbose tab title moves to tooltip.
    expect(screen.getByText('DevTools panel')).toBeTruthy();
    expect(screen.getByText(/4s ago/)).toBeTruthy();
  });

  it('omits jargon "base" / "theirs" / §6.3 LWW from default copy', () => {
    render(
      <ConflictDiffChip theirs="t" base="b" local="l" onTakeTheirs={() => {}} onKeepMine={() => {}} />,
    );
    open();
    const popover = screen.getByText('External change').closest('div');
    expect(popover).toBeTruthy();
    const text = popover?.textContent ?? '';
    expect(text).not.toMatch(/§6\.3/);
    expect(text).not.toMatch(/\bbase:\s/i);
    expect(text).not.toMatch(/\btheirs:\s/i);
  });

  it('button labels follow outcome-named convention', () => {
    render(
      <ConflictDiffChip theirs="t" base="b" local="l" onTakeTheirs={() => {}} onKeepMine={() => {}} />,
    );
    open();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use saved' })).toBeTruthy();
  });
});
