// @vitest-environment jsdom
/**
 * InspectorTabBar over the tab-kind union — request pills keep their
 * method badge/status, storage-record pills carry the IDB chip, and the
 * active-tab auto-scroll survives an id embedding the JSON key wire
 * (quotes + backslashes): the raw interpolation was an invalid
 * `querySelector` and crashed the whole panel on tab switch.
 */

import { DndContext } from '@dnd-kit/core';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import InspectorTabBar from '@openheaders/ui/panel/components/InspectorTabBar';
import {
  buildCacheEntryTab,
  buildDomStorageEntryTab,
  buildIdbRecordTab,
  buildInspectorTab,
  type InspectorTab,
} from '@openheaders/ui/panel/data/inspector-tab';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  // jsdom implements neither scroll API the auto-scroll effect uses,
  // nor `window.CSS`; the escape polyfill mirrors the platform's
  // backslash-escaping closely enough for the selector round-trip.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as Element['scrollTo'];
  if (typeof window.CSS === 'undefined') {
    Object.defineProperty(window, 'CSS', {
      configurable: true,
      value: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) },
    });
  }
});

afterEach(() => {
  cleanup();
});

const REQUEST_TAB = buildInspectorTab({
  lifecycle: {
    requestId: 'req-1',
    url: 'https://openheaders.io/api/data',
    method: 'GET',
    statusCode: 200,
    startedAtMs: 1_770_000_000_000,
  } as unknown as RequestLifecycle,
  displayId: 1,
});

// The wire embeds quotes and backslash escapes — exactly the ids that
// blew up the attribute selector.
const IDB_TAB = buildIdbRecordTab({
  frameId: 0,
  database: 'offline_cache::john-doe',
  store: 'queries',
  primaryKeyWire: '{"s":"global-nav-[\\"deferred\\"]"}',
  keyPreview: '"global-nav-[\\"deferred\\"]"',
  timestamp: 1_770_000_000_000,
});

const DOM_TAB = buildDomStorageEntryTab({
  frameId: 0,
  area: 'session',
  entryKey: 'oh-session-state',
  timestamp: 1_770_000_000_000,
});

function renderBar(tabs: InspectorTab[], activeTabId: string) {
  return render(
    <DndContext>
      <InspectorTabBar
        leafId="leaf-root"
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitch={vi.fn()}
        onClose={vi.fn()}
        onCloseOther={vi.fn()}
        onCloseAll={vi.fn()}
        onCloseToLeft={vi.fn()}
        onCloseToRight={vi.fn()}
        recentlyClosed={[]}
        onReopenTab={vi.fn()}
      />
    </DndContext>,
  );
}

describe('InspectorTabBar tab kinds', () => {
  it('renders both pill kinds: method badge + status for requests, IDB chip for records', () => {
    renderBar([REQUEST_TAB, IDB_TAB], REQUEST_TAB.id);
    expect(screen.getByText('GET')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('IDB')).toBeTruthy();
  });

  it('leads every pill with its source tool-window icon: network globe vs storage database', () => {
    renderBar([REQUEST_TAB, IDB_TAB, DOM_TAB], REQUEST_TAB.id);
    expect(screen.getAllByRole('img', { name: 'global' })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: 'database' })).toHaveLength(2);
  });

  it('swaps the globe for the network row icon on a websocket pill', () => {
    const wsTab = buildInspectorTab({
      lifecycle: {
        requestId: 'req-ws',
        url: 'wss://openheaders.io/socket',
        method: 'GET',
        statusCode: 101,
        resourceType: 'websocket',
        startedAtMs: 1_770_000_000_000,
      } as unknown as RequestLifecycle,
      displayId: 2,
    });
    const { container } = renderBar([wsTab], wsTab.id);
    expect(container.querySelector('.dt-resource-icon--websocket')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'global' })).toBeNull();
  });

  it('survives activating a record tab whose id embeds the JSON key wire (auto-scroll selector)', () => {
    // The IDB tab must NOT be last — the last-tab branch skips the
    // querySelector this regression guards.
    expect(() => renderBar([IDB_TAB, REQUEST_TAB], IDB_TAB.id)).not.toThrow();
    expect(screen.getByText('IDB')).toBeTruthy();
  });

  it('reveals the active tab instantly — no smooth rubber-band across the strip (workbench parity)', () => {
    const scrollIntoView = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    const scrollTo = Element.prototype.scrollTo as unknown as ReturnType<typeof vi.fn>;

    // Active tab not last → the querySelector + scrollIntoView branch.
    scrollIntoView.mockClear();
    renderBar([REQUEST_TAB, IDB_TAB], REQUEST_TAB.id);
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));

    // Active tab last → the scroll-to-end branch.
    cleanup();
    scrollTo.mockClear();
    renderBar([IDB_TAB, REQUEST_TAB], REQUEST_TAB.id);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }));
  });

  it('shows the unsaved dot only on a dirty record tab', () => {
    renderBar([{ ...IDB_TAB, dirty: true }, REQUEST_TAB], REQUEST_TAB.id);
    expect(screen.getByLabelText('Unsaved changes')).toBeTruthy();

    cleanup();
    renderBar([IDB_TAB, REQUEST_TAB], REQUEST_TAB.id);
    expect(screen.queryByLabelText('Unsaved changes')).toBeNull();
  });

  it('renders the DOM-storage pill with its area chip, key label and dirty dot', () => {
    renderBar([{ ...DOM_TAB, dirty: true }, REQUEST_TAB], REQUEST_TAB.id);
    expect(screen.getByText('SS')).toBeTruthy();
    expect(screen.getByText('oh-session-state')).toBeTruthy();
    expect(screen.getByLabelText('Unsaved changes')).toBeTruthy();
  });

  it('renders the cache-entry pill with its CS chip and URL-tail label, never a dirty dot', () => {
    const cacheTab = buildCacheEntryTab({
      frameId: 0,
      cache: 'oh-assets-v1',
      url: 'https://openheaders.io/assets/logo.gif',
      method: 'GET',
      timestamp: 1_770_000_000_000,
    });
    renderBar([cacheTab, REQUEST_TAB], REQUEST_TAB.id);
    expect(screen.getByText('CS')).toBeTruthy();
    expect(screen.getByText('logo.gif')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'database' })).toBeTruthy();
    expect(screen.queryByLabelText('Unsaved changes')).toBeNull();
  });
});
