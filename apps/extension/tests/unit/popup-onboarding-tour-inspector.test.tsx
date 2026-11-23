/**
 * Popup onboarding tour — the inspector step names Web Inspector on Safari
 * and keeps the DevTools wording everywhere else.
 */

import OnboardingTour from '@openheaders/ui/popup/components/OnboardingTour';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// antd Tour measures its target via rc-resize-observer; jsdom has no
// ResizeObserver.
beforeAll(() => {
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

const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15';
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

vi.mock('@openheaders/ui/popup/shortcuts/KeyboardNavContext', () => ({
  useKeyboardNav: () => ({ setIsTourOpen: () => {} }),
}));

/** Open the tour as `userAgent` and step forward until `title` shows. */
function walkTo(userAgent: string, title: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  render(
    <SurfaceProvider mode="popup">
      <OnboardingTour open onClose={() => {}} />
    </SurfaceProvider>,
  );
  for (let step = 0; step < 12 && screen.queryByText(title) === null; step++) {
    fireEvent.click(screen.getByText('Next'));
  }
  expect(screen.getByText(title)).toBeTruthy();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OnboardingTour — the inspector step', () => {
  it('on Safari: Web Inspector, no tab marker, request headers only', () => {
    walkTo(SAFARI_UA, 'Debug Network in Web Inspector');
    expect(screen.getByText(/tab in Web Inspector:/)).toBeTruthy();
    expect(screen.getByText('Modify request headers')).toBeTruthy();
    expect(screen.queryByText('🟦')).toBeNull();
    expect(screen.queryByText('Modify headers, requests & responses')).toBeNull();
  });

  it('on Chrome: the DevTools wording is unchanged', () => {
    walkTo(CHROME_UA, 'Debug Network in DevTools');
    expect(screen.getByText(/tab in DevTools:/)).toBeTruthy();
    expect(screen.getByText('Modify headers, requests & responses')).toBeTruthy();
    expect(screen.getByText('🟦')).toBeTruthy();
  });
});
