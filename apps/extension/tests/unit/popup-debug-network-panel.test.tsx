/**
 * Debug Network guide — Safari reads in its own terms (Web Inspector, the
 * Develop menu, no internal-page scheme, request headers only); the other
 * browsers keep the DevTools wording.
 */

import DebugNetworkPanel from '@openheaders/ui/popup/components/DebugNetworkPanel';
import { detectBrowser } from '@openheaders/ui/popup/components/debug-network-copy';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15';
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const EDGE_UA = `${CHROME_UA} Edg/150.0.0.0`;
const FIREFOX_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0';

function asBrowser(userAgent: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('detectBrowser — inspector kind', () => {
  it('Safari ships Web Inspector', () => {
    asBrowser(SAFARI_UA);
    expect(detectBrowser()).toMatchObject({ name: 'Safari', inspector: 'web-inspector' });
  });

  it.each([
    ['Chrome', CHROME_UA],
    ['Edge', EDGE_UA],
    ['Firefox', FIREFOX_UA],
  ])('%s ships DevTools', (name, userAgent) => {
    asBrowser(userAgent);
    expect(detectBrowser()).toMatchObject({ name, inspector: 'devtools' });
  });
});

describe('DebugNetworkPanel', () => {
  it('on Safari: Web Inspector wording, the Develop menu, request headers only', () => {
    asBrowser(SAFARI_UA);
    render(<DebugNetworkPanel open onClose={() => {}} />);
    expect(screen.getByText('Open Web Inspector')).toBeTruthy();
    expect(screen.getByText('Not the Start Page or an empty tab (extensions: blocked there).')).toBeTruthy();
    expect(screen.getByText('Show Web Inspector')).toBeTruthy();
    expect(screen.getByText('Modify request headers')).toBeTruthy();
    expect(screen.queryByText('Open browser DevTools')).toBeNull();
    expect(screen.queryByText('chrome://')).toBeNull();
    expect(screen.queryByText('Lighthouse')).toBeNull();
    expect(screen.queryByText('🟦')).toBeNull();
    expect(screen.queryByText('»')).toBeNull();
  });

  it('on Chrome: the DevTools wording is unchanged', () => {
    asBrowser(CHROME_UA);
    render(<DebugNetworkPanel open onClose={() => {}} />);
    expect(screen.getByText('Open browser DevTools')).toBeTruthy();
    expect(screen.getByText('chrome://')).toBeTruthy();
    expect(screen.getByText('Developer Tools')).toBeTruthy();
    expect(screen.getByText('Lighthouse')).toBeTruthy();
    expect(screen.getByText('Modify headers, requests & responses')).toBeTruthy();
    expect(screen.getByText('🟦')).toBeTruthy();
    expect(screen.getByText('»')).toBeTruthy();
    expect(screen.queryByText('Open Web Inspector')).toBeNull();
  });
});
