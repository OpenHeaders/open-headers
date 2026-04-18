import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetStatusForTests,
  clearStatus,
  getStatusSnapshot,
  report,
  type StatusSnapshot,
  subscribe,
  worstLevel,
} from '@/shared/status';

beforeEach(() => {
  __resetStatusForTests();
});

describe('status/report', () => {
  it('records the latest entry per subsystem', () => {
    report({ subsystem: 'rules', state: 'green', message: 'All rules compiled' });
    report({ subsystem: 'rules', state: 'red', message: 'DNR compile failed' });
    const snap = getStatusSnapshot();
    expect(snap.rules?.state).toBe('red');
    expect(snap.rules?.message).toBe('DNR compile failed');
  });

  it('keeps separate entries for different subsystems', () => {
    report({ subsystem: 'rules', state: 'green', message: 'ok' });
    report({ subsystem: 'requests', state: 'yellow', message: 'slow' });
    const snap = getStatusSnapshot();
    expect(snap.rules?.state).toBe('green');
    expect(snap.requests?.state).toBe('yellow');
  });

  it('stamps timestamp on every entry', () => {
    const before = Date.now();
    report({ subsystem: 'sync', state: 'green', message: 'connected' });
    const entry = getStatusSnapshot().sync;
    expect(entry?.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('status/subscribe', () => {
  it('fires on every state change', () => {
    const listener = vi.fn();
    subscribe(listener);
    report({ subsystem: 'rules', state: 'green', message: 'ok' });
    expect(listener).toHaveBeenCalledTimes(1);
    report({ subsystem: 'rules', state: 'red', message: 'bad' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('skips redundant emissions (same subsystem+state+message+context)', () => {
    const listener = vi.fn();
    subscribe(listener);
    report({ subsystem: 'rules', state: 'green', message: 'ok', context: { ruleCount: 3 } });
    report({ subsystem: 'rules', state: 'green', message: 'ok', context: { ruleCount: 3 } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('fires when context changes even if state+message match', () => {
    const listener = vi.fn();
    subscribe(listener);
    report({ subsystem: 'rules', state: 'green', message: 'ok', context: { ruleId: 'a' } });
    report({ subsystem: 'rules', state: 'green', message: 'ok', context: { ruleId: 'b' } });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe() stops future notifications', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    report({ subsystem: 'rules', state: 'green', message: 'a' });
    unsub();
    report({ subsystem: 'rules', state: 'red', message: 'b' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('provides a fresh snapshot copy to each listener (immutable to callers)', () => {
    let received: StatusSnapshot | null = null;
    subscribe((snap) => {
      received = snap;
    });
    report({ subsystem: 'rules', state: 'green', message: 'ok' });
    expect(received).not.toBeNull();
    (received as unknown as StatusSnapshot).rules = undefined;
    // Source of truth unchanged.
    expect(getStatusSnapshot().rules?.state).toBe('green');
  });
});

describe('status/clearStatus', () => {
  it('drops every entry and notifies subscribers', () => {
    const listener = vi.fn();
    report({ subsystem: 'rules', state: 'red', message: 'bad' });
    subscribe(listener);
    clearStatus();
    expect(getStatusSnapshot()).toEqual({});
    expect(listener).toHaveBeenCalled();
  });

  it('does not notify when the snapshot was already empty', () => {
    const listener = vi.fn();
    subscribe(listener);
    clearStatus();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('worstLevel', () => {
  it('returns "green" for an empty snapshot', () => {
    expect(worstLevel({})).toBe('green');
  });

  it('returns "green" when every subsystem is green', () => {
    report({ subsystem: 'rules', state: 'green', message: 'ok' });
    expect(worstLevel(getStatusSnapshot())).toBe('green');
  });

  it('returns "yellow" when at least one subsystem is yellow and none are red', () => {
    report({ subsystem: 'rules', state: 'green', message: 'ok' });
    report({ subsystem: 'requests', state: 'yellow', message: 'slow' });
    expect(worstLevel(getStatusSnapshot())).toBe('yellow');
  });

  it('returns "red" when any subsystem is red (even if others are yellow/green)', () => {
    report({ subsystem: 'rules', state: 'green', message: 'ok' });
    report({ subsystem: 'requests', state: 'yellow', message: 'slow' });
    report({ subsystem: 'sync', state: 'red', message: 'disconnected' });
    expect(worstLevel(getStatusSnapshot())).toBe('red');
  });
});
