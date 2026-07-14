/**
 * TrafficList keyboard navigation — the scroller is a focusable listbox:
 * ArrowUp/ArrowDown walk the selection through the sorted display order
 * (the detail tab follows via onSelect, same as clicking), PageUp/PageDown
 * step by a viewport of pinned 20px rows, Home/End jump to the ends, and a
 * move outside the mounted window scrolls the target row into the slice.
 *
 * jsdom computes no layout, so the scroller's geometry is mocked the same
 * way as in use-row-window.test.tsx (clamped scrollTop cell, content height
 * = rows x 20px) and a scroll event seeds the mounted window.
 */

import '@openheaders/ui/workbench/settings/schema';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { TrafficList } from '@openheaders/ui/panel/components/TrafficList';
import { DEFAULT_VISIBLE_COLUMNS } from '@openheaders/ui/panel/components/traffic/columns';
import { DEFAULT_FILTER_CONFIG } from '@openheaders/ui/panel/data/filter-engine';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { projectPanelData } from '@openheaders/ui/panel/data/panel-data-projection';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ROW_HEIGHT_PX = 20;
const VIEWPORT_PX = 400;

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

afterEach(cleanup);

function makeLifecycle(index: number): RequestLifecycle {
  return {
    tabId: 1,
    requestId: `r${index}`,
    url: `https://openheaders.io/${index}`,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100 + index,
    hopStartedAtMs: 100 + index,
    har: [],
    harBodyByHop: [],
  };
}

/** `n` rows via the production projection — display order is start-time
 *  ascending under the default sort (Waterfall / Start time, asc). */
function makeRows(n: number): readonly InspectorRowWithFires[] {
  const byRequestId = new Map<string, RequestLifecycle>();
  const ordered: RequestLifecycle[] = [];
  for (let i = 0; i < n; i++) {
    const lc = makeLifecycle(i);
    byRequestId.set(lc.requestId, lc);
    ordered.push(lc);
  }
  return projectPanelData({
    lifecycle: { byRequestId, ordered },
    page: { pages: [] },
    fire: { fires: [] },
    opts: { consolidateRetries: false },
  }).rows;
}

function Harness({ rows, onSelectSpy }: { rows: readonly InspectorRowWithFires[]; onSelectSpy: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <TrafficList
      rows={rows}
      filteredRows={rows}
      pages={[]}
      cdpEnhanced={false}
      selectedId={selectedId}
      onSelect={(id) => {
        onSelectSpy(id);
        setSelectedId(id);
      }}
      filter={new Set()}
      onFilterChange={() => {}}
      filterConfig={DEFAULT_FILTER_CONFIG}
      onFilterConfigChange={() => {}}
      urlFilter=""
      onUrlFilterChange={() => {}}
      filterError={false}
      onToggleDocs={() => {}}
      docsActive={false}
      showFilter={true}
      recording={true}
      onStartRecording={() => {}}
      onReloadPage={() => {}}
      visibleColumns={new Set(DEFAULT_VISIBLE_COLUMNS)}
      onVisibleColumnsChange={() => {}}
      onCopyAsHar={() => {}}
      onSaveAsHar={() => {}}
      onSaveAllAsHar={() => {}}
      onCopyAllAsHar={() => {}}
      onHide={() => {}}
      onAnnotationJump={() => {}}
      filterHiddenHint={null}
      onFilterHintClear={() => {}}
      onFilterHintDismiss={() => {}}
    />
  );
}

/** Render the table, then give its scroller browser-like scroll geometry
 *  (clamped scrollTop, content height = rows x 20px) and seed the mounted
 *  window with a scroll event. */
function renderTable(rowCount: number) {
  const onSelectSpy = vi.fn();
  const rows = makeRows(rowCount);
  const { container } = render(<Harness rows={rows} onSelectSpy={onSelectSpy} />);
  const list = screen.getByRole('listbox', { name: 'Network requests' }) as HTMLDivElement;
  const contentHeight = rowCount * ROW_HEIGHT_PX;
  let scrollTopValue = 0;
  const maxScroll = Math.max(0, contentHeight - VIEWPORT_PX);
  Object.defineProperty(list, 'clientHeight', { configurable: true, get: () => VIEWPORT_PX });
  Object.defineProperty(list, 'scrollHeight', { configurable: true, get: () => contentHeight });
  Object.defineProperty(list, 'scrollTop', {
    configurable: true,
    get: () => scrollTopValue,
    set: (v: number) => {
      scrollTopValue = Math.max(0, Math.min(v, maxScroll));
    },
  });
  fireEvent.scroll(list);
  return { container, list, onSelectSpy };
}

function selectedRowId(container: HTMLElement): string | null {
  const row = container.querySelector('.dt-row[aria-selected="true"]');
  return row?.getAttribute('data-row-id') ?? null;
}

describe('TrafficList — keyboard navigation', () => {
  it('exposes the listbox/option anatomy on the scroller and rows', () => {
    const { container, list } = renderTable(3);
    expect(list.getAttribute('tabindex')).toBe('0');
    const options = container.querySelectorAll('.dt-row[role="option"]');
    expect(options.length).toBe(3);
    for (const opt of options) expect(opt.getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowDown walks the selection from the first row, opening the detail tab per move, and clamps at the end', () => {
    const { container, list, onSelectSpy } = renderTable(3);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRowId(container)).toBe('r0');
    expect(onSelectSpy).toHaveBeenLastCalledWith('r0');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRowId(container)).toBe('r1');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRowId(container)).toBe('r2');
    // Clamped at the end: no re-select of the same row.
    expect(onSelectSpy).toHaveBeenCalledTimes(3);
  });

  it('ArrowUp with no selection starts from the last row', () => {
    const { container, list } = renderTable(3);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectedRowId(container)).toBe('r2');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectedRowId(container)).toBe('r1');
  });

  it('Home and End jump to the first and last row', () => {
    const { container, list } = renderTable(5);
    fireEvent.keyDown(list, { key: 'End' });
    expect(selectedRowId(container)).toBe('r4');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selectedRowId(container)).toBe('r0');
  });

  it('PageDown/PageUp step by a viewport of rows', () => {
    // 400px viewport / 20px rows = 20 rows in view -> a page step of 19.
    const { container, list } = renderTable(100);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRowId(container)).toBe('r0');
    fireEvent.keyDown(list, { key: 'PageDown' });
    expect(selectedRowId(container)).toBe('r19');
    fireEvent.keyDown(list, { key: 'PageUp' });
    expect(selectedRowId(container)).toBe('r0');
  });

  it('a move outside the mounted window scrolls the target row into the slice', () => {
    const { container, list } = renderTable(100);
    // Window at the top covers rows 0..50 — the tail is unmounted.
    expect(container.querySelector('[data-row-id="r99"]')).toBeNull();
    fireEvent.keyDown(list, { key: 'End' });
    expect(list.scrollTop).toBeGreaterThan(0);
    expect(selectedRowId(container)).toBe('r99');
    // The window followed the scroll: the head is unmounted now.
    expect(container.querySelector('[data-row-id="r0"]')).toBeNull();
  });

  it('keyboard moves select without the cross-surface flash', () => {
    const { container, list } = renderTable(3);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(container.querySelector('.dt-row--flash')).toBeNull();
  });

  it('keydown on a row button bubbles to the scroller — click-then-arrow works', () => {
    const { container, list, onSelectSpy } = renderTable(3);
    const row = container.querySelector('[data-row-id="r1"]') as HTMLElement;
    fireEvent.click(row);
    expect(onSelectSpy).toHaveBeenLastCalledWith('r1');
    fireEvent.keyDown(row, { key: 'ArrowDown' });
    expect(selectedRowId(container)).toBe('r2');
    // The handled press parked focus on the scroller, immune to row unmounts.
    expect(document.activeElement).toBe(list);
  });

  it('ignores non-navigation keys and modified presses', () => {
    const { container, list, onSelectSpy } = renderTable(3);
    fireEvent.keyDown(list, { key: 'a' });
    fireEvent.keyDown(list, { key: 'ArrowDown', ctrlKey: true });
    expect(onSelectSpy).not.toHaveBeenCalled();
    expect(selectedRowId(container)).toBeNull();
  });

  it('typing in the filter input never moves the selection', () => {
    const { container, onSelectSpy } = renderTable(3);
    const filter = screen.getByPlaceholderText('Filter');
    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    expect(onSelectSpy).not.toHaveBeenCalled();
    expect(selectedRowId(container)).toBeNull();
  });
});
