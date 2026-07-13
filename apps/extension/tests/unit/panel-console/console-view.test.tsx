/**
 * ConsoleView — the Console tool window. Covers the rendered list (levels +
 * filters) and the never-silent empty / disabled surfaces keyed off the
 * inspected tab's CDP scope.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import type { JsContext } from '@openheaders/core/js-contexts';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The context-selector popover measures itself via rc-resize-observer;
// jsdom doesn't ship a ResizeObserver.
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

const { mockScope, setCdpEnabledSpy, resolvedFramesMock } = vi.hoisted(() => ({
  mockScope: { hasCdpCapability: true, cdpEnabled: true, cdpOwned: true },
  setCdpEnabledSpy: vi.fn(),
  resolvedFramesMock: {
    map: new Map<string, { name: string | null; source: string | null; line: number | null; column: number | null }>(),
  },
}));

vi.mock('@openheaders/ui/panel/data/use-inspected-tab-cdp', () => ({
  useInspectedTabCdp: () => mockScope,
}));

// Source-map resolution is exercised through a controllable map; frameKey /
// sourceFileLabel stay real.
vi.mock('@openheaders/ui/panel/data/initiator/use-resolved-frames', async (importOriginal) => {
  const real = await importOriginal<typeof import('@openheaders/ui/panel/data/initiator/use-resolved-frames')>();
  return { ...real, useResolvedFrames: () => resolvedFramesMock.map };
});

vi.mock('@openheaders/ui/workbench/settings/hooks', () => ({
  useSetting: () => [false, setCdpEnabledSpy],
}));

const { bridgeCallSpy } = vi.hoisted(() => ({
  bridgeCallSpy: vi.fn(
    (_channel: string, _payload?: unknown): Promise<{ success: boolean; text?: string }> =>
      Promise.resolve({ success: true }),
  ),
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { ...actual.hostBridge, call: bridgeCallSpy },
  };
});

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import { ConsoleView } from '@openheaders/ui/panel/components/ConsoleView';
import { resetConsolePrefs, setConsolePrefs } from '@openheaders/ui/panel/data/console-prefs';
import type { ConsoleRequestJoin } from '@openheaders/ui/panel/data/console-request-join';
import type { XhrLogConsoleEntry } from '@openheaders/ui/panel/data/console-xhr-log';

function installNavigation(
  openResource: HostNavigation['openResource'],
  inspectedTabId: () => number | null = () => null,
): void {
  setHostNavigation({
    switchViewMode: () => Promise.resolve({ opened: false }),
    currentWindowId: () => Promise.resolve(undefined),
    activeTabUrl: () => Promise.resolve(undefined),
    openUrl: () => {},
    openShortcutSettings: () => {},
    getActiveTab: () => Promise.resolve(null),
    observeActiveTabContext: () => () => {},
    inspectedTabId,
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
  contexts?: readonly JsContext[];
  xhrLogEntries?: readonly XhrLogConsoleEntry[];
}

function renderView(entries: readonly ConsoleEntry[], options: RenderOptions = {}) {
  return render(
    <ConsoleView
      entries={entries}
      xhrLogEntries={options.xhrLogEntries ?? []}
      contexts={options.contexts ?? []}
      resolveRequest={options.resolveRequest ?? (() => null)}
      onRequestClick={options.onRequestClick ?? vi.fn()}
      onClear={vi.fn()}
      onHide={vi.fn()}
    />,
  );
}

function makeContext(over: Partial<JsContext> & Pick<JsContext, 'contextKey'>): JsContext {
  return {
    origin: 'https://app.openheaders.io',
    name: '',
    isDefault: true,
    targetKind: 'page',
    worldType: 'default',
    ...over,
  };
}

beforeEach(() => {
  mockScope.hasCdpCapability = true;
  mockScope.cdpEnabled = true;
  mockScope.cdpOwned = true;
  setCdpEnabledSpy.mockClear();
  resolvedFramesMock.map.clear();
  resetConsolePrefs();
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

  it('level mask: toggling Info off keeps warnings + errors and reads "Custom levels"', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Default levels'));
    fireEvent.click(screen.getByText('Info'));
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
    expect(screen.getByText('Custom levels')).toBeTruthy();
  });

  it('level mask: exactly one level on collapses the trigger to "{Level} only"', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Default levels'));
    fireEvent.click(screen.getByText('Info'));
    fireEvent.click(screen.getByText('Warnings'));
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-level')).toBe('error');
    expect(screen.getByText('Errors only')).toBeTruthy();
  });

  it('level mask: debug entries hide by default and show once Verbose is on ("All levels")', () => {
    const { container } = renderView([...entries, entry('a verbose line', { level: 'debug' })]);
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(3);
    fireEvent.click(screen.getByText('Default levels'));
    fireEvent.click(screen.getByText('Verbose'));
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(4);
    expect(screen.getByText('All levels')).toBeTruthy();
  });

  it('level mask: the Default row resets a custom mask', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Default levels'));
    fireEvent.click(screen.getByText('Info'));
    expect(screen.getByText('Custom levels')).toBeTruthy();
    fireEvent.click(screen.getByText('Default'));
    expect(screen.getByText('Default levels')).toBeTruthy();
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(3);
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

  it('labels locations and frames with the source-map original when resolved', () => {
    resolvedFramesMock.map.set('https://openheaders.io/analytics.ts|119|6', {
      name: 'sendEvent',
      source: 'webpack:///./src/hydro-analytics.ts',
      line: 119,
      column: 5,
    });
    const { container } = renderView([blocked], { resolveRequest: () => join });
    // Row location column reads the ORIGINAL position, extension kept.
    expect(container.querySelector('.dt-console-loc')?.textContent).toBe('hydro-analytics.ts:120');
    // The expanded ladder shows the resolved name + original file:line.
    fireEvent.click(container.querySelector('button.dt-console-caret') as HTMLElement);
    const frames = container.querySelectorAll('.dt-console-frame');
    expect(frames[0].textContent).toContain('sendEvent');
    expect(frames[0].textContent).toContain('hydro-analytics.ts:120');
    // The unresolved second frame keeps its generated label.
    expect(frames[1].textContent).toContain('reducer.ts:1152');
  });

  it('expand-all opens every stack ladder and flips to collapse-all', () => {
    const second = entry('boom', {
      level: 'error',
      source: 'exception',
      stackTrace: [{ functionName: 'f', url: 'https://openheaders.io/app.js', lineNumber: 41, columnNumber: 2 }],
    });
    const { container } = renderView([blocked, second], { resolveRequest: () => join });
    const toggle = screen.getByRole('button', { name: 'Expand all' });
    fireEvent.click(toggle);
    expect(container.querySelectorAll('.dt-console-stack')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(container.querySelectorAll('.dt-console-stack')).toHaveLength(0);
  });

  it('disables the expand-all toggle when no visible row carries a stack', () => {
    renderView([entry('plain log')]);
    const toggle = screen.getByRole('button', { name: 'Expand all' }) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
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

describe('ConsoleView context selector + "Selected context only" (JS contexts Phase C)', () => {
  const TOP = makeContext({ contextKey: 'page::1', isTopFrame: true });
  const IFRAME = makeContext({
    contextKey: 'child-iframe-1::1',
    targetKind: 'iframe',
    origin: 'https://ads.openheaders.io',
  });

  it('hides the selector while the registry is empty', () => {
    renderView([entry('hello')]);
    expect(document.querySelector('.dt-console-context')).toBeNull();
  });

  it('auto-selects top with no warning tint', () => {
    renderView([], { contexts: [TOP, IFRAME] });
    expect(screen.getByText('top')).toBeTruthy();
    expect(document.querySelector('.dt-console-context--warn')).toBeNull();
  });

  it('an explicit non-top pick warns, and the pick dying falls back to top', () => {
    const view = renderView([], { contexts: [TOP, IFRAME] });
    fireEvent.click(screen.getByText('top'));
    fireEvent.click(screen.getByText('ads.openheaders.io'));
    expect(document.querySelector('.dt-console-context--warn')).not.toBeNull();

    // The picked context dies (navigation) — selection falls back to top.
    view.rerender(
      <ConsoleView
        entries={[]}
        xhrLogEntries={[]}
        contexts={[TOP]}
        resolveRequest={() => null}
        onRequestClick={vi.fn()}
        onClear={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(document.querySelector('.dt-console-context--warn')).toBeNull();
  });

  it('"Selected context only" hides other contexts\' rows but never keyless entries', () => {
    renderView(
      [
        entry('from top', { contextKey: 'page::1' }),
        entry('from iframe', { contextKey: 'child-iframe-1::1' }),
        entry('browser plane'),
      ],
      { contexts: [TOP, IFRAME] },
    );
    expect(screen.getByText('from iframe')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Selected context only'));

    expect(screen.getByText('from top')).toBeTruthy();
    expect(screen.queryByText('from iframe')).toBeNull();
    expect(screen.getByText('browser plane')).toBeTruthy();
  });

  it('indents dropdown rows by depth with service workers at top level', () => {
    const SW = makeContext({
      contextKey: 'target:SW1::1',
      targetKind: 'service-worker',
      origin: 'https://app.openheaders.io/sw.js',
    });
    const ISOLATED = makeContext({
      contextKey: 'page::2',
      isDefault: false,
      isTopFrame: true,
      name: 'Open Headers',
      worldType: 'isolated',
    });
    renderView([], { contexts: [TOP, ISOLATED, IFRAME, SW] });
    fireEvent.click(screen.getByText('top'));
    const depths = [...document.querySelectorAll('.dt-console-context-item')].map((el) =>
      el.getAttribute('data-depth'),
    );
    expect(depths).toEqual(['0', '1', '1', '0']);
    expect(screen.getByText('Open Headers')).toBeTruthy();
  });
});

describe('ConsoleView settings pane (gear)', () => {
  it('the gear toggles the inline settings pane', () => {
    renderView([]);
    expect(screen.queryByRole('group', { name: 'Console settings' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    expect(screen.getByRole('group', { name: 'Console settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    expect(screen.queryByRole('group', { name: 'Console settings' })).toBeNull();
  });

  it('"Hide network" hides the browser network entries but never console output', () => {
    const { container } = renderView([
      entry('page log'),
      entry('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT', {
        source: 'browser',
        category: 'network',
        level: 'error',
      }),
    ]);
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Hide network'));
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('page log');
  });

  it('a navigation (recreated top context) clears the view unless "Preserve log"', () => {
    const TOP1 = makeContext({ contextKey: 'page::1', isTopFrame: true });
    const TOP2 = makeContext({ contextKey: 'page::7', isTopFrame: true });
    const before = [entry('before nav')];
    const rerenderWith = (view: ReturnType<typeof renderView>, rows: ConsoleEntry[], contexts: JsContext[]) =>
      view.rerender(
        <ConsoleView
          entries={rows}
          xhrLogEntries={[]}
          contexts={contexts}
          resolveRequest={() => null}
          onRequestClick={vi.fn()}
          onClear={vi.fn()}
          onHide={vi.fn()}
        />,
      );

    const view = renderView(before, { contexts: [TOP1] });
    // The nav signal (top recreated) lands before the new page's output.
    rerenderWith(view, before, [TOP2]);
    rerenderWith(view, [...before, entry('after nav')], [TOP2]);
    expect(screen.queryByText('before nav')).toBeNull();
    expect(screen.getByText('after nav')).toBeTruthy();
  });

  it('"Group similar" collapses identical consecutive messages behind a count badge', () => {
    const spam = [entry('poll tick'), entry('poll tick'), entry('poll tick'), entry('something else')];
    const { container } = renderView(spam);
    // Default ON — one row for the three ticks, with the browser's badge.
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
    expect(container.querySelector('.dt-console-repeat')?.textContent).toBe('3');

    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Group similar messages in console'));
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(4);
    expect(container.querySelector('.dt-console-repeat')).toBeNull();
  });

  it('command/result echo rows never group', () => {
    const transcript = [
      entry('1 + 1', { source: 'command' }),
      entry('1 + 1', { source: 'command' }),
      entry('2', { source: 'result' }),
      entry('2', { source: 'result' }),
    ];
    const { container } = renderView(transcript);
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(4);
  });

  it('"Show CORS errors in console" off hides the CORS-policy explanations only', () => {
    const { container } = renderView([
      entry('page log'),
      entry(
        "Access to fetch at 'https://api.openheaders.io/x' from origin 'https://app.openheaders.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.",
        { level: 'error' },
      ),
    ]);
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Show CORS errors in console'));
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('page log');
  });

  it('"Treat code evaluation as user action" off drops the userGesture flag', () => {
    installNavigation(vi.fn(), () => 5);
    bridgeCallSpy.mockClear();
    const TOP = makeContext({ contextKey: 'page::1', isTopFrame: true });
    renderView([], { contexts: [TOP] });
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Treat code evaluation as user action'));
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(bridgeCallSpy).toHaveBeenCalledWith('consoleEval', expect.objectContaining({ userGesture: false }));
  });

  it('"Preserve log" keeps the pre-navigation entries', () => {
    const TOP1 = makeContext({ contextKey: 'page::1', isTopFrame: true });
    const TOP2 = makeContext({ contextKey: 'page::7', isTopFrame: true });
    const before = [entry('before nav')];
    const view = renderView(before, { contexts: [TOP1] });
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Preserve log'));
    view.rerender(
      <ConsoleView
        entries={before}
        xhrLogEntries={[]}
        contexts={[TOP2]}
        resolveRequest={() => null}
        onRequestClick={vi.fn()}
        onClear={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    view.rerender(
      <ConsoleView
        entries={[...before, entry('after nav')]}
        xhrLogEntries={[]}
        contexts={[TOP2]}
        resolveRequest={() => null}
        onRequestClick={vi.fn()}
        onClear={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(screen.getByText('before nav')).toBeTruthy();
    expect(screen.getByText('after nav')).toBeTruthy();
  });
});

describe('ConsoleView REPL prompt + echo rows (JS contexts Phase D)', () => {
  const TOP = makeContext({ contextKey: 'page::1', isTopFrame: true });

  beforeEach(() => {
    bridgeCallSpy.mockClear();
    installNavigation(vi.fn(), () => 5);
  });

  it('renders the prompt while capturing and hides it when capture stops', () => {
    renderView([], { contexts: [TOP] });
    expect(screen.getByLabelText('Console prompt')).toBeTruthy();
    cleanup();
    mockScope.cdpOwned = false;
    renderView([], { contexts: [] });
    expect(screen.queryByLabelText('Console prompt')).toBeNull();
  });

  it('disables the prompt until a context exists', () => {
    renderView([]);
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toContain('Waiting for a JavaScript context');
  });

  it('Enter dispatches consoleEval against the effective context and clears the input', () => {
    renderView([], { contexts: [TOP] });
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '41 + 1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(bridgeCallSpy).toHaveBeenCalledWith('consoleEval', {
      tabId: 5,
      contextKey: 'page::1',
      expression: '41 + 1',
      userGesture: true,
    });
    expect(input.value).toBe('');
  });

  it('walks history with arrows and returns to the draft below the bottom', () => {
    renderView([], { contexts: [TOP] });
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    for (const expression of ['one', 'two']) {
      fireEvent.change(input, { target: { value: expression } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    fireEvent.change(input, { target: { value: 'draft' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('two');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('one');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('one');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('two');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.value).toBe('draft');
  });

  it('renders command/result rows with the chevron glyphs and error results with the badge', () => {
    const { container } = renderView(
      [
        entry('41 + 1', { source: 'command', contextKey: 'page::1' }),
        entry('42', { source: 'result', contextKey: 'page::1' }),
        entry('boom', { source: 'result', level: 'error', contextKey: 'page::1' }),
      ],
      { contexts: [TOP] },
    );
    const glyphs = [...container.querySelectorAll('.dt-console-glyph')].map((el) => el.textContent);
    expect(glyphs).toEqual(['›', '‹']);
    expect(container.querySelector('.dt-console-row[data-source="result"] .dt-console-dot--error')).not.toBeNull();
  });
});

describe('ConsoleView "Log XMLHttpRequests" (synthesized request rows)', () => {
  const finished: XhrLogConsoleEntry = {
    source: 'browser',
    level: 'info',
    category: 'network',
    requestId: 'page::9.1',
    args: [{ type: 'string', text: 'Fetch finished loading: GET "https://api.openheaders.io/data".' }],
    timestamp: 2000,
    xhrLog: { kindLabel: 'Fetch', failed: false },
  };
  const failed: XhrLogConsoleEntry = {
    ...finished,
    requestId: 'page::9.2',
    args: [{ type: 'string', text: 'XHR failed loading: POST "https://api.openheaders.io/save".' }],
    timestamp: 2500,
    xhrLog: { kindLabel: 'XHR', failed: true },
  };
  const join: ConsoleRequestJoin = { method: 'GET', url: 'https://api.openheaders.io/data' };

  it('renders nothing while the setting is off (the browser default)', () => {
    const { container } = renderView([], { xhrLogEntries: [finished], resolveRequest: () => join });
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(0);
  });

  it('the settings checkbox turns the rows on, phrased like the browser with the URL linkified', () => {
    const onRequestClick = vi.fn();
    const { container } = renderView([], {
      xhrLogEntries: [finished],
      resolveRequest: () => join,
      onRequestClick,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    fireEvent.click(screen.getByLabelText('Log XMLHttpRequests'));
    const row = container.querySelector('.dt-console-row') as HTMLElement;
    expect(row.textContent).toContain('Fetch finished loading: GET "');
    expect(row.getAttribute('data-level')).toBe('info');
    fireEvent.click(row.querySelector('.dt-console-req-link') as HTMLElement);
    expect(onRequestClick).toHaveBeenCalledWith('page::9.1');
  });

  it('a failure or HTTP error phrases as "failed loading" at the same Info level (browser parity)', () => {
    setConsolePrefs({ logXhr: true });
    const { container } = renderView([], {
      xhrLogEntries: [failed],
      resolveRequest: () => ({ method: 'POST', url: 'https://api.openheaders.io/save' }),
    });
    const row = container.querySelector('.dt-console-row') as HTMLElement;
    expect(row.textContent).toContain('XHR failed loading: POST "');
    expect(row.getAttribute('data-level')).toBe('info');
  });

  it('merges by timestamp into the buffered entries', () => {
    setConsolePrefs({ logXhr: true });
    const { container } = renderView([entry('before', { timestamp: 1000 }), entry('after', { timestamp: 3000 })], {
      xhrLogEntries: [finished],
      resolveRequest: () => join,
    });
    const rows = [...container.querySelectorAll('.dt-console-row')].map((el) => el.textContent ?? '');
    expect(rows[0]).toContain('before');
    expect(rows[1]).toContain('Fetch finished loading');
    expect(rows[2]).toContain('after');
  });

  it('"Hide network" hides the synthesized rows too (they are Network-source messages)', () => {
    setConsolePrefs({ logXhr: true, hideNetwork: true });
    const { container } = renderView([], { xhrLogEntries: [finished], resolveRequest: () => join });
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(0);
  });

  it('Clear cuts the derived rows even though they have no buffer index', () => {
    setConsolePrefs({ logXhr: true });
    // The buffered entry stays only because onClear is mocked here — in
    // production the client store empties the buffer; the derived cut is
    // the piece the view itself owns.
    const { container } = renderView([entry('buffered')], { xhrLogEntries: [finished], resolveRequest: () => join });
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear console' }));
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('buffered');
  });

  it('falls back to the raw text when the join misses (row cleared from the network plane)', () => {
    setConsolePrefs({ logXhr: true });
    const { container } = renderView([], { xhrLogEntries: [finished] });
    const row = container.querySelector('.dt-console-row') as HTMLElement;
    expect(row.textContent).toContain('Fetch finished loading: GET "https://api.openheaders.io/data".');
    expect(row.querySelector('.dt-console-req-link')).toBeNull();
  });
});

describe('ConsoleView eager evaluation (prompt preview)', () => {
  const TOP = makeContext({ contextKey: 'page::1', isTopFrame: true });

  beforeEach(() => {
    bridgeCallSpy.mockClear();
    installNavigation(vi.fn(), () => 5);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    bridgeCallSpy.mockImplementation(() => Promise.resolve({ success: true }));
  });

  it('previews the typed text on the grey line after the debounce', async () => {
    bridgeCallSpy.mockImplementation((channel: string) =>
      Promise.resolve(channel === 'consoleEvalPreview' ? { success: true, text: '2' } : { success: true }),
    );
    const { container } = renderView([], { contexts: [TOP] });
    fireEvent.change(screen.getByLabelText('Console prompt'), { target: { value: '1 + 1' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(bridgeCallSpy).toHaveBeenCalledWith('consoleEvalPreview', {
      tabId: 5,
      contextKey: 'page::1',
      expression: '1 + 1',
    });
    expect(container.querySelector('.dt-console-prompt-preview-text')?.textContent).toBe('2');
  });

  it('a "nothing to show" response leaves the preview line absent', async () => {
    bridgeCallSpy.mockImplementation(() => Promise.resolve({ success: true }));
    const { container } = renderView([], { contexts: [TOP] });
    fireEvent.change(screen.getByLabelText('Console prompt'), { target: { value: 'location.reload()' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(container.querySelector('.dt-console-prompt-preview')).toBeNull();
  });

  it('the setting off suppresses the preview entirely', async () => {
    setConsolePrefs({ eagerEval: false });
    const { container } = renderView([], { contexts: [TOP] });
    fireEvent.change(screen.getByLabelText('Console prompt'), { target: { value: '1 + 1' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(bridgeCallSpy).not.toHaveBeenCalledWith('consoleEvalPreview', expect.anything());
    expect(container.querySelector('.dt-console-prompt-preview')).toBeNull();
  });

  it('a stale response (text moved on) never lands', async () => {
    bridgeCallSpy.mockImplementation((channel: string) =>
      Promise.resolve(channel === 'consoleEvalPreview' ? { success: true, text: 'stale' } : { success: true }),
    );
    const { container } = renderView([], { contexts: [TOP] });
    const input = screen.getByLabelText('Console prompt');
    fireEvent.change(input, { target: { value: '1 +' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // Second keystroke before the debounce fires — the first request never
    // dispatches; then the text clears before the second one resolves.
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(container.querySelector('.dt-console-prompt-preview')).toBeNull();
  });
});

describe('ConsoleView autocomplete from history', () => {
  const TOP = makeContext({ contextKey: 'page::1', isTopFrame: true });

  beforeEach(() => {
    bridgeCallSpy.mockClear();
    installNavigation(vi.fn(), () => 5);
  });

  const submitCommand = (input: HTMLElement, expression: string): void => {
    fireEvent.change(input, { target: { value: expression } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('ghosts the most recent history entry extending the typed prefix; Tab accepts it', () => {
    const { container } = renderView([], { contexts: [TOP] });
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    submitCommand(input, 'document.title');
    fireEvent.change(input, { target: { value: 'doc' } });
    const ghost = container.querySelector('.dt-console-prompt-ghost') as HTMLElement;
    expect(ghost.textContent).toBe('document.title');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('document.title');
    expect(container.querySelector('.dt-console-prompt-ghost')).toBeNull();
  });

  it('the setting off shows no ghost', () => {
    setConsolePrefs({ autocompleteHistory: false });
    const { container } = renderView([], { contexts: [TOP] });
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    submitCommand(input, 'document.title');
    fireEvent.change(input, { target: { value: 'doc' } });
    expect(container.querySelector('.dt-console-prompt-ghost')).toBeNull();
  });

  it('the history ring survives a prompt remount (tool-window switch)', () => {
    const view = renderView([], { contexts: [TOP] });
    submitCommand(screen.getByLabelText('Console prompt'), 'one');
    view.unmount();
    renderView([], { contexts: [TOP] });
    const input = screen.getByLabelText('Console prompt') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('one');
  });
});

describe('ConsoleView settings pane order (browser parity)', () => {
  it('lists all nine settings in the browser pane order', () => {
    renderView([]);
    fireEvent.click(screen.getByRole('button', { name: 'Console settings' }));
    const pane = screen.getByRole('group', { name: 'Console settings' });
    const labels = [...pane.querySelectorAll('.dt-console-setting')].map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      'Hide network',
      'Log XMLHttpRequests',
      'Preserve log',
      'Eager evaluation',
      'Selected context only',
      'Autocomplete from history',
      'Group similar messages in console',
      'Treat code evaluation as user action',
      'Show CORS errors in console',
    ]);
  });
});
