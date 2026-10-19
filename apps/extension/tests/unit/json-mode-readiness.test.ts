/**
 * json-mode-readiness — the JSON mode's readiness read at its own
 * seam: the first provider registration after the language is
 * requested, against a fake registry and a fake worker accessor. No
 * Monaco runs.
 *
 * Contract: nothing is watched before the rich-features request; the
 * mode registering a provider after it resolves the readiness and
 * drops the watch; a registration from another language while the
 * mode is still down is swallowed and the watch stays; a registration
 * before the request is never the sign.
 */

import {
  type JsonModeReadinessHost,
  type ProviderRegistry,
  whenJsonModeReady,
} from '@openheaders/ui/workbench/components/monaco/json-mode-readiness';
import { describe, expect, it, vi } from 'vitest';

class FakeRegistry implements ProviderRegistry {
  private readonly listeners = new Set<() => void>();
  onDidChange(listener: () => void) {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }
  register(): void {
    for (const listener of this.listeners) listener();
  }
  get watched(): number {
    return this.listeners.size;
  }
}

function fakeHost() {
  const registry = new FakeRegistry();
  let worker: object | null = null;
  let requested: (() => void) | null = null;
  const getWorker = vi.fn(() => (worker ? Promise.resolve(worker) : Promise.reject('JSON not registered!')));
  const host: JsonModeReadinessHost = {
    onLanguage: (callback) => {
      requested = callback;
    },
    registry: () => registry,
    getWorker,
  };
  const settled = vi.fn();
  const ready = whenJsonModeReady(host).then(settled);
  return {
    ready,
    settled,
    registry,
    getWorker,
    requestLanguage: () => requested?.(),
    /** The mode's own setup: the worker set, then a provider registered. */
    setUpMode: () => {
      worker = {};
      registry.register();
    },
  };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('whenJsonModeReady', () => {
  it('watches nothing before the language is requested, then resolves on the mode’s registration and drops the watch', async () => {
    const h = fakeHost();
    await flush();
    expect(h.registry.watched).toBe(0);
    expect(h.getWorker).not.toHaveBeenCalled();
    h.requestLanguage();
    expect(h.registry.watched).toBe(1);
    expect(h.settled).not.toHaveBeenCalled();
    h.setUpMode();
    await h.ready;
    expect(h.settled).toHaveBeenCalledTimes(1);
    expect(h.registry.watched).toBe(0);
  });

  it('swallows a registration from another language while the mode is down and keeps watching', async () => {
    const h = fakeHost();
    h.requestLanguage();
    h.registry.register();
    await flush();
    expect(h.getWorker).toHaveBeenCalledTimes(1);
    expect(h.settled).not.toHaveBeenCalled();
    expect(h.registry.watched).toBe(1);
    h.setUpMode();
    await h.ready;
    expect(h.settled).toHaveBeenCalledTimes(1);
  });

  it('a registration before the request is never the sign', async () => {
    const h = fakeHost();
    h.setUpMode();
    await flush();
    expect(h.getWorker).not.toHaveBeenCalled();
    expect(h.settled).not.toHaveBeenCalled();
    h.requestLanguage();
    h.registry.register();
    await h.ready;
    expect(h.settled).toHaveBeenCalledTimes(1);
  });
});
