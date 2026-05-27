import { describe, expect, it, vi } from 'vitest';

import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import type { TabLifecycleEvent } from '@openheaders/oracle/tab-lifecycle-bus';

describe('TabLifecycleBus', () => {
  it('notifies subscribers of tab-forgotten with the right tabId', () => {
    const bus = new TabLifecycleBus();
    const events: TabLifecycleEvent[] = [];
    bus.subscribe((event) => events.push(event));

    bus.notifyTabForgotten(42);

    expect(events).toEqual([{ kind: 'tab-forgotten', tabId: 42 }]);
  });

  it('fans out a single event to every active subscriber', () => {
    const bus = new TabLifecycleBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe(a);
    bus.subscribe(b);

    bus.notifyTabForgotten(7);

    expect(a).toHaveBeenCalledWith({ kind: 'tab-forgotten', tabId: 7 });
    expect(b).toHaveBeenCalledWith({ kind: 'tab-forgotten', tabId: 7 });
  });

  it('unsubscribe stops delivery to that listener only', () => {
    const bus = new TabLifecycleBus();
    const a = vi.fn();
    const b = vi.fn();
    const offA = bus.subscribe(a);
    bus.subscribe(b);

    offA();
    bus.notifyTabForgotten(3);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('repeated unsubscribe is a no-op', () => {
    const bus = new TabLifecycleBus();
    const listener = vi.fn();
    const off = bus.subscribe(listener);
    off();
    off();
    bus.notifyTabForgotten(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates throwing subscribers so siblings still fire', () => {
    const bus = new TabLifecycleBus();
    const thrower = vi.fn(() => {
      throw new Error('boom');
    });
    const survivor = vi.fn();
    bus.subscribe(thrower);
    bus.subscribe(survivor);

    expect(() => bus.notifyTabForgotten(5)).not.toThrow();
    expect(thrower).toHaveBeenCalledTimes(1);
    expect(survivor).toHaveBeenCalledTimes(1);
  });

  it('dispose clears listeners and flips isDisposed', () => {
    const bus = new TabLifecycleBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    expect(bus.isDisposed).toBe(false);
    bus.dispose();
    expect(bus.isDisposed).toBe(true);

    bus.notifyTabForgotten(9);
    expect(listener).not.toHaveBeenCalled();
  });

  it('dispose is idempotent', () => {
    const bus = new TabLifecycleBus();
    bus.dispose();
    expect(() => bus.dispose()).not.toThrow();
    expect(bus.isDisposed).toBe(true);
  });

  it('subscribe after dispose throws', () => {
    const bus = new TabLifecycleBus();
    bus.dispose();
    expect(() => bus.subscribe(() => {})).toThrow(/after dispose/);
  });
});
