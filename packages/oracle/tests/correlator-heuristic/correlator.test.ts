/**
 * H1 — `HeuristicCorrelator` driven by an in-memory event source.
 *
 * Mirrors the CDP stub's tests one-for-one (attach gate, subscribe,
 * detach, dispose) — the symmetry proves the {@link RequestCorrelator}
 * contract is satisfied by both strategies.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  RequestLifecycleListener,
  RequestLifecycleUpdate,
} from '@openheaders/core/request-lifecycle';

import { HeuristicCorrelator } from '../../src/correlator-heuristic/correlator';
import type { WebRequestEvent, WebRequestEventSource } from '../../src/correlator-heuristic/events';

/** In-memory webRequest source for tests. */
class TestSource implements WebRequestEventSource {
  private readonly listeners = new Set<(event: WebRequestEvent) => void>();

  subscribe(listener: (event: WebRequestEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: WebRequestEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

const TAB = 11;

const startEvent: WebRequestEvent = {
  method_kind: 'onBeforeRequest',
  tabId: TAB,
  requestId: 'wr-1',
  url: 'https://api.openheaders.io/x',
  method: 'GET',
  type: 'xmlhttprequest',
  timeStamp: 1_700_000_000_000,
};

describe('HeuristicCorrelator — attach gate', () => {
  it('does not emit before any tab is attached', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const listener: RequestLifecycleListener = vi.fn();
    correlator.subscribe(listener);
    source.emit(startEvent);
    expect(listener).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('emits the mapped update for an attached tab', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const collected: RequestLifecycleUpdate[] = [];
    correlator.subscribe((u) => collected.push(u));
    correlator.attachTab(TAB);
    source.emit(startEvent);
    expect(collected).toHaveLength(1);
    expect(collected[0]?.kind).toBe('started');
    correlator.dispose();
  });

  it('detachTab stops further emissions for that tab', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    source.emit(startEvent);
    correlator.detachTab(TAB);
    source.emit({ ...startEvent, requestId: 'wr-2' });
    expect(fn).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });

  it('attachTab is idempotent and tab-scoped', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    correlator.attachTab(TAB);
    source.emit(startEvent);
    expect(fn).toHaveBeenCalledTimes(1);
    // A different tab is gated separately.
    source.emit({ ...startEvent, tabId: TAB + 1, requestId: 'wr-3' });
    expect(fn).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });
});

describe('HeuristicCorrelator — subscribe / dispose', () => {
  it('multiple subscribers each receive every emitted update', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const a = vi.fn();
    const b = vi.fn();
    correlator.subscribe(a);
    correlator.subscribe(b);
    correlator.attachTab(TAB);
    source.emit(startEvent);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    correlator.dispose();
  });

  it('subscribe returns an Unsubscribe that removes the listener', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const fn = vi.fn();
    const off = correlator.subscribe(fn);
    correlator.attachTab(TAB);
    off();
    source.emit(startEvent);
    expect(fn).not.toHaveBeenCalled();
    correlator.dispose();
  });

  it('dispose unsubscribes from the source and clears state', () => {
    const source = new TestSource();
    const correlator = new HeuristicCorrelator(source);
    const fn = vi.fn();
    correlator.subscribe(fn);
    correlator.attachTab(TAB);
    correlator.dispose();
    expect(source.listenerCount()).toBe(0);
    source.emit(startEvent);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('HeuristicCorrelator — exposes no chrome surface', () => {
  it('module export does not name fromChromeWebRequest (kept out of oracle)', () => {
    const ctor = HeuristicCorrelator as unknown as Record<string, unknown>;
    expect(ctor.fromChromeWebRequest).toBeUndefined();
  });
});
