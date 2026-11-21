// @vitest-environment jsdom
/**
 * useProgressiveCount — a long list mounts one batch, then one more
 * each time its end comes near the viewport; a new list starts over;
 * a host without IntersectionObserver mounts the whole list.
 */

import { useProgressiveCount } from '@openheaders/ui/shared/hooks/dom/useProgressiveCount';
import { act, cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface ObserverRecord {
  observer: IntersectionObserver;
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[];
  disconnected: boolean;
}

let observers: ObserverRecord[] = [];

class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { observer: this, callback, options, observed: [], disconnected: false };
    observers.push(this.record);
  }
  observe(target: Element): void {
    this.record.observed.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** The observer currently watching the sentinel. */
function liveObserver(): ObserverRecord {
  const live = observers.filter((record) => !record.disconnected);
  expect(live).toHaveLength(1);
  return live[0];
}

/** Report the sentinel as in (or out of) range to the live observer. */
function reportSentinel(isIntersecting: boolean): void {
  const record = liveObserver();
  const target = record.observed[0];
  const rect = target.getBoundingClientRect();
  const entry: IntersectionObserverEntry = {
    boundingClientRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: rect,
    isIntersecting,
    rootBounds: null,
    target,
    time: 0,
  };
  act(() => {
    record.callback([entry], record.observer);
  });
}

const List: React.FC<{ items: readonly string[] }> = ({ items }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { count, sentinelRef } = useProgressiveCount<HTMLDivElement>(items.length, items, {
    batch: 10,
    lookaheadPx: 300,
    rootRef,
  });
  return (
    <div ref={rootRef} data-testid="root">
      {items.slice(0, count).map((item) => (
        <div key={item} data-testid="row">
          {item}
        </div>
      ))}
      {count < items.length && <div ref={sentinelRef} data-testid="sentinel" />}
    </div>
  );
};

const makeItems = (prefix: string, length: number): string[] => Array.from({ length }, (_, i) => `${prefix}-${i}`);

const rowCount = (): number => screen.queryAllByTestId('row').length;

afterEach(() => {
  cleanup();
  observers = [];
  vi.unstubAllGlobals();
});

describe('useProgressiveCount', () => {
  it('mounts the first batch only, watching the sentinel inside the scroll root with the lookahead', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    render(<List items={makeItems('a', 35)} />);

    expect(rowCount()).toBe(10);
    const record = liveObserver();
    expect(record.observed).toEqual([screen.getByTestId('sentinel')]);
    expect(record.options?.root).toBe(screen.getByTestId('root'));
    expect(record.options?.rootMargin).toBe('0px 0px 300px 0px');
  });

  it('mounts one more batch per report, re-arming so a sentinel still in range reports again', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    render(<List items={makeItems('a', 35)} />);

    reportSentinel(true);
    expect(rowCount()).toBe(20);
    // A fresh observer took over — the one that reported is retired.
    expect(observers.filter((record) => record.disconnected)).toHaveLength(1);

    reportSentinel(true);
    expect(rowCount()).toBe(30);

    reportSentinel(true);
    expect(rowCount()).toBe(35);
    expect(screen.queryByTestId('sentinel')).toBeNull();
    expect(observers.every((record) => record.disconnected)).toBe(true);
  });

  it('holds the batch while the sentinel is out of range', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    render(<List items={makeItems('a', 35)} />);

    reportSentinel(false);
    expect(rowCount()).toBe(10);
  });

  it('starts over from the first batch for a new list', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    const { rerender } = render(<List items={makeItems('a', 35)} />);
    reportSentinel(true);
    expect(rowCount()).toBe(20);

    rerender(<List items={makeItems('b', 50)} />);
    expect(rowCount()).toBe(10);
    expect(screen.getAllByTestId('row')[0].textContent).toBe('b-0');
  });

  it('never asks for a sentinel when the list fits the first batch', () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    render(<List items={makeItems('a', 7)} />);

    expect(rowCount()).toBe(7);
    expect(screen.queryByTestId('sentinel')).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it('mounts the whole list where IntersectionObserver does not exist', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<List items={makeItems('a', 35)} />);

    expect(rowCount()).toBe(35);
  });
});
