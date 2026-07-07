/**
 * ConsoleView — the Console tool window. Covers the rendered list (levels +
 * filters) and the never-silent empty / disabled surfaces keyed off the
 * inspected tab's CDP scope.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockScope, setCdpEnabledSpy } = vi.hoisted(() => ({
  mockScope: { hasCdpCapability: true, cdpEnabled: true, cdpOwned: true },
  setCdpEnabledSpy: vi.fn(),
}));

vi.mock('@openheaders/ui/panel/data/use-inspected-tab-cdp', () => ({
  useInspectedTabCdp: () => mockScope,
}));

vi.mock('@openheaders/ui/workbench/settings/hooks', () => ({
  useSetting: () => [false, setCdpEnabledSpy],
}));

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { ConsoleView } from '@openheaders/ui/panel/components/ConsoleView';
import type { ConsoleRequestJoin } from '@openheaders/ui/panel/data/console-request-join';

function installNavigation(openResource: HostNavigation['openResource']): void {
  setHostNavigation({
    switchViewMode: () => Promise.resolve({ opened: false }),
    currentWindowId: () => Promise.resolve(undefined),
    activeTabUrl: () => Promise.resolve(undefined),
    openUrl: () => {},
    openShortcutSettings: () => {},
    getActiveTab: () => Promise.resolve(null),
    observeActiveTabContext: () => () => {},
    inspectedTabId: () => null,
    reloadInspectedTab: () => {},
    getInspectedHar: () => Promise.resolve(null),
    openResource,
  });
}

function entry(text: string, over: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text }],
    timestamp: 1000,
    ...over,
  };
}

interface RenderOptions {
  resolveRequest?: (requestId: string) => ConsoleRequestJoin | null;
  onRequestClick?: (requestId: string) => void;
}

function renderView(entries: readonly ConsoleEntry[], options: RenderOptions = {}) {
  return render(
    <ConsoleView
      entries={entries}
      resolveRequest={options.resolveRequest ?? (() => null)}
      onRequestClick={options.onRequestClick ?? vi.fn()}
      onClear={vi.fn()}
      onHide={vi.fn()}
    />,
  );
}

beforeEach(() => {
  mockScope.hasCdpCapability = true;
  mockScope.cdpEnabled = true;
  mockScope.cdpOwned = true;
  setCdpEnabledSpy.mockClear();
});

afterEach(cleanup);

describe('ConsoleView list', () => {
  const entries = [
    entry('a plain log from openheaders.io'),
    entry('a warning', { level: 'warning' }),
    entry('boom', { level: 'error', source: 'exception', url: 'https://openheaders.io/app.js', lineNumber: 41 }),
  ];

  it('renders one row per entry with its level + message', () => {
    const { container } = renderView(entries);
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(3);
    expect(container.querySelector('.dt-console-row[data-level="error"]')?.textContent).toContain('boom');
  });

  it('renders the source location 1-based', () => {
    const { container } = renderView(entries);
    expect(container.querySelector('.dt-console-loc')?.textContent).toBe('app.js:42');
  });

  it('filters to errors only', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Errors'));
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-level')).toBe('error');
  });

  it('warnings filter keeps warnings and errors', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Warnings'));
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
  });

  it('text filter narrows by message content', () => {
    const { container } = renderView(entries);
    fireEvent.change(container.querySelector('.dt-filter-input') as HTMLInputElement, {
      target: { value: 'boom' },
    });
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('boom');
  });

  it('shows a no-match notice when the filter excludes everything', () => {
    const { container } = renderView(entries);
    fireEvent.change(container.querySelector('.dt-filter-input') as HTMLInputElement, {
      target: { value: 'nothing-matches' },
    });
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(0);
    expect(container.textContent).toContain('No console entries match your filter');
  });
});

describe('ConsoleView network join (browser-plane entries)', () => {
  const blocked = entry('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT', {
    source: 'browser',
    level: 'error',
    category: 'network',
    requestId: 'page::77.3',
    url: 'https://collector.openheaders.io/collect',
  });
  const join: ConsoleRequestJoin = {
    method: 'POST',
    url: 'https://collector.openheaders.io/collect',
    stack: [
      { functionName: 'sendEvent', url: 'https://openheaders.io/analytics.ts', lineNumber: 119, columnNumber: 6 },
      { functionName: '', url: 'https://openheaders.io/reducer.ts', lineNumber: 1151, columnNumber: 0 },
    ],
  };

  it('renders the joined entry as METHOD + url link + error text with the initiator location', () => {
    const { container } = renderView([blocked], { resolveRequest: () => join });
    const row = container.querySelector('.dt-console-row') as HTMLElement;
    expect(row.textContent).toContain('POST');
    expect(row.textContent).toContain('https://collector.openheaders.io/collect');
    expect(row.textContent).toContain('net::ERR_BLOCKED_BY_CLIENT');
    expect(row.textContent).not.toContain('Failed to load resource');
    // Location shows the initiating frame (1-based), not the request URL.
    expect(row.querySelector('.dt-console-loc')?.textContent).toBe('analytics.ts:120');
  });

  it('cross-navigates to the request when the URL is clicked', () => {
    const onRequestClick = vi.fn();
    const { container } = renderView([blocked], { resolveRequest: () => join, onRequestClick });
    fireEvent.click(container.querySelector('.dt-console-req-link') as HTMLElement);
    expect(onRequestClick).toHaveBeenCalledWith('page::77.3');
  });

  it('expands the initiator stack ladder behind the caret', () => {
    const { container } = renderView([blocked], { resolveRequest: () => join });
    expect(container.querySelector('.dt-console-stack')).toBeNull();
    fireEvent.click(container.querySelector('button.dt-console-caret') as HTMLElement);
    const frames = container.querySelectorAll('.dt-console-frame');
    expect(frames).toHaveLength(2);
    expect(frames[0].textContent).toContain('sendEvent');
    expect(frames[0].textContent).toContain('analytics.ts:120');
    expect(frames[1].textContent).toContain('(anonymous)');
    fireEvent.click(container.querySelector('button.dt-console-caret') as HTMLElement);
    expect(container.querySelector('.dt-console-stack')).toBeNull();
  });

  it('falls back to the raw text and request-url location when the join misses (pre-attach backlog)', () => {
    const { container } = renderView([blocked]);
    const row = container.querySelector('.dt-console-row') as HTMLElement;
    expect(row.textContent).toContain('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT');
    expect(row.querySelector('.dt-console-req-link')).toBeNull();
    expect(row.querySelector('.dt-console-loc')?.textContent).toBe('collect');
    // No stack from either side — the caret slot is a spacer, not a button.
    expect(container.querySelector('button.dt-console-caret')).toBeNull();
  });

  it('expands an entry-carried stack (console.* / exception) without any join', () => {
    const withStack = entry('boom', {
      level: 'error',
      source: 'exception',
      stackTrace: [{ functionName: 'f', url: 'https://openheaders.io/app.js', lineNumber: 41, columnNumber: 2 }],
    });
    const { container } = renderView([withStack]);
    fireEvent.click(container.querySelector('button.dt-console-caret') as HTMLElement);
    expect(container.querySelector('.dt-console-frame')?.textContent).toContain('app.js:42');
  });

  it('opens the Sources panel from the location column and from a stack frame', () => {
    const openResource = vi.fn();
    installNavigation(openResource);
    const { container } = renderView([blocked], { resolveRequest: () => join });

    // Row location column — the initiating frame (0-based coords on the wire).
    fireEvent.click(container.querySelector('button.dt-console-loc') as HTMLElement);
    expect(openResource).toHaveBeenCalledWith('https://openheaders.io/analytics.ts', 119, 6);

    // A frame inside the expanded ladder.
    fireEvent.click(container.querySelector('button.dt-console-caret') as HTMLElement);
    const frameLinks = container.querySelectorAll('button.dt-console-frame-loc');
    fireEvent.click(frameLinks[1] as HTMLElement);
    expect(openResource).toHaveBeenCalledWith('https://openheaders.io/reducer.ts', 1151, 0);
  });
});

describe('ConsoleView never-silent surfaces', () => {
  it('in scope but empty — capturing, waiting for output', () => {
    const { container } = renderView([]);
    expect(container.textContent).toContain('No console output yet');
  });

  it('host cannot do CDP — capture unavailable', () => {
    mockScope.hasCdpCapability = false;
    mockScope.cdpEnabled = false;
    mockScope.cdpOwned = false;
    const { container } = renderView([]);
    expect(container.textContent).toContain('Console capture needs Debug mode');
  });

  it('Debug mode off — offers to enable it', () => {
    mockScope.cdpEnabled = false;
    mockScope.cdpOwned = false;
    const { container } = renderView([]);
    expect(container.textContent).toContain('Enable Debug mode to view console logs');
    fireEvent.click(screen.getByRole('button', { name: 'Enable Debug mode' }));
    expect(setCdpEnabledSpy).toHaveBeenCalledWith(true);
  });

  it('Debug mode on but tab out of scope — steer to Debug mode', () => {
    mockScope.cdpOwned = false;
    const { container } = renderView([]);
    expect(container.textContent).toContain('This tab is outside Debug mode');
  });

  it('capture stopped mid-session — keeps the captured entries under a banner', () => {
    mockScope.cdpEnabled = false;
    mockScope.cdpOwned = false;
    const { container } = renderView([entry('captured before stop')]);
    expect(container.querySelector('.dt-console-banner')?.textContent).toContain('Debug mode is off');
    // The already-captured entry stays readable rather than vanishing.
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(1);
  });
});
