/**
 * The sandbox iframe transport — the broker's seam over a hidden
 * sandboxed iframe of the page's sandbox page: mounted once on the
 * first `ensureReady` with the `allow-scripts` sandbox attribute and
 * the shared test id, ready on the realm's `sandbox.ready` and only
 * from the mounted frame's window, up messages forwarded from that
 * window alone, `post` delivered into the frame, `close` removing the
 * element so the next run mounts afresh. The DOM is a minimal fake —
 * the package runs no jsdom — so the pins stop at the transport's own
 * contract (the broker ⇄ runtime round trip is core's).
 */

import type { ScriptWireMessage } from '@openheaders/core/scripts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIframeSandboxTransport,
  SANDBOX_IFRAME_TEST_ID,
  SANDBOX_NOT_READY_MESSAGE,
  SANDBOX_READY_GRACE_MS,
} from '../../src/live/iframe-sandbox-transport';

interface FakeIframe {
  tagName: string;
  src: string;
  srcdoc: string;
  hidden: boolean;
  attributes: Record<string, string>;
  contentWindow: { postMessage: (message: unknown, target: string) => void; posted: unknown[] };
  removed: boolean;
  loadListeners: Array<() => void>;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: () => void): void;
  remove(): void;
  /** The frame settled on a document — the browser's `load`. */
  load(): void;
}

function makeIframe(): FakeIframe {
  const posted: unknown[] = [];
  return {
    tagName: 'IFRAME',
    src: '',
    srcdoc: '',
    hidden: false,
    attributes: {},
    contentWindow: { posted, postMessage: (message) => posted.push(message) },
    removed: false,
    loadListeners: [],
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, listener) {
      if (type === 'load') this.loadListeners.push(listener);
    },
    remove() {
      this.removed = true;
    },
    load() {
      for (const listener of this.loadListeners) listener();
    },
  };
}

const created: FakeIframe[] = [];
const appended: FakeIframe[] = [];
const listeners = new Set<(event: { source: unknown; data: unknown }) => void>();

function dispatch(source: unknown, data: unknown): void {
  for (const listener of [...listeners]) listener({ source, data });
}

beforeEach(() => {
  created.length = 0;
  appended.length = 0;
  listeners.clear();
  Object.assign(globalThis, {
    document: {
      createElement: (tag: string) => {
        if (tag !== 'iframe') throw new Error(`unexpected element ${tag}`);
        const el = makeIframe();
        created.push(el);
        return el;
      },
      body: { appendChild: (el: FakeIframe) => appended.push(el) },
    },
    window: {
      addEventListener: (type: string, listener: (event: { source: unknown; data: unknown }) => void) => {
        if (type === 'message') listeners.add(listener);
      },
      removeEventListener: (type: string, listener: (event: { source: unknown; data: unknown }) => void) => {
        if (type === 'message') listeners.delete(listener);
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document');
  Reflect.deleteProperty(globalThis, 'window');
});

describe('createIframeSandboxTransport', () => {
  it('mounts the sandbox page once, hidden and sandboxed, and resolves ready on the realm announcement', async () => {
    const up: unknown[] = [];
    const transport = createIframeSandboxTransport({ src: 'https://app.openheaders.io/sandbox.html' })((m) =>
      up.push(m),
    );
    const first = transport.ensureReady();
    const again = transport.ensureReady();
    expect(again).toBe(first);
    expect(created).toHaveLength(1);
    expect(appended).toEqual(created);
    const frame = created[0];
    expect(frame.src).toBe('https://app.openheaders.io/sandbox.html');
    expect(frame.hidden).toBe(true);
    expect(frame.attributes).toEqual({
      sandbox: 'allow-scripts',
      'aria-hidden': 'true',
      'data-testid': SANDBOX_IFRAME_TEST_ID,
    });

    let settled = false;
    void first.then(() => {
      settled = true;
    });
    // Another window's announcement never counts.
    dispatch({}, { type: 'sandbox.ready' });
    await Promise.resolve();
    expect(settled).toBe(false);
    dispatch(frame.contentWindow, { type: 'sandbox.ready' });
    await first;
    expect(up).toEqual([]);
  });

  it('mounts a self-contained document as srcdoc, no URL at all', async () => {
    const transport = createIframeSandboxTransport({ srcdoc: '<!DOCTYPE html><script>1</script>' })(() => {});
    const ready = transport.ensureReady();
    const frame = created[0];
    expect(frame.srcdoc).toBe('<!DOCTYPE html><script>1</script>');
    expect(frame.src).toBe('');
    expect(frame.attributes.sandbox).toBe('allow-scripts');
    dispatch(frame.contentWindow, { type: 'sandbox.ready' });
    await ready;
  });

  it('forwards up messages from the mounted frame alone and posts down into it', async () => {
    const up: unknown[] = [];
    const transport = createIframeSandboxTransport({ src: '/sandbox.html' })((m) => up.push(m));
    const ready = transport.ensureReady();
    const frame = created[0];
    dispatch(frame.contentWindow, { type: 'sandbox.ready' });
    await ready;
    const result = { type: 'script.result', result: { executionId: 'e1' } };
    dispatch(frame.contentWindow, result);
    dispatch({}, { type: 'script.result', result: { executionId: 'stranger' } });
    dispatch(frame.contentWindow, 'not an object');
    expect(up).toEqual([result]);
    const down: ScriptWireMessage = { type: 'script.session-end', sessionId: 's-1' };
    transport.post(down);
    expect(frame.contentWindow.posted).toEqual([down]);
  });

  it('a frame that loaded without announcing its runtime rejects after the grace and unmounts', async () => {
    vi.useFakeTimers();
    try {
      const transport = createIframeSandboxTransport({ src: '/sandbox.html' })(() => {});
      const ready = transport.ensureReady();
      const frame = created[0];
      let outcome: string | null = null;
      ready.then(
        () => {
          outcome = 'ready';
        },
        (err: Error) => {
          outcome = err.message;
        },
      );
      // Silence before load is not a verdict — the document is still coming.
      await vi.advanceTimersByTimeAsync(SANDBOX_READY_GRACE_MS * 2);
      expect(outcome).toBeNull();
      frame.load();
      await vi.advanceTimersByTimeAsync(SANDBOX_READY_GRACE_MS - 1);
      expect(outcome).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(outcome).toBe(SANDBOX_NOT_READY_MESSAGE);
      expect(frame.removed).toBe(true);
      expect(listeners.size).toBe(0);
      // The next run mounts afresh — a later announcement from the dead
      // frame's window is nobody's.
      const next = transport.ensureReady();
      expect(next).not.toBe(ready);
      expect(created).toHaveLength(2);
      dispatch(frame.contentWindow, { type: 'sandbox.ready' });
      dispatch(created[1].contentWindow, { type: 'sandbox.ready' });
      await next;
    } finally {
      vi.useRealTimers();
    }
  });

  it('the announcement clears the grace whether it comes before or after load', async () => {
    vi.useFakeTimers();
    try {
      const early = createIframeSandboxTransport({ src: '/sandbox.html' })(() => {});
      const earlyReady = early.ensureReady();
      dispatch(created[0].contentWindow, { type: 'sandbox.ready' });
      created[0].load();
      await vi.advanceTimersByTimeAsync(SANDBOX_READY_GRACE_MS + 1);
      await earlyReady;
      expect(created[0].removed).toBe(false);

      const late = createIframeSandboxTransport({ src: '/sandbox.html' })(() => {});
      const lateReady = late.ensureReady();
      created[1].load();
      await vi.advanceTimersByTimeAsync(SANDBOX_READY_GRACE_MS - 1);
      dispatch(created[1].contentWindow, { type: 'sandbox.ready' });
      await vi.advanceTimersByTimeAsync(SANDBOX_READY_GRACE_MS);
      await lateReady;
      expect(created[1].removed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('close removes the frame and the listener; the next ensureReady mounts afresh', async () => {
    const transport = createIframeSandboxTransport({ src: '/sandbox.html' })(() => {});
    const ready = transport.ensureReady();
    dispatch(created[0].contentWindow, { type: 'sandbox.ready' });
    await ready;
    transport.close('idle');
    expect(created[0].removed).toBe(true);
    expect(listeners.size).toBe(0);
    // A post with no frame is dropped, never thrown.
    transport.post({ type: 'script.session-end', sessionId: 's' });
    const next = transport.ensureReady();
    expect(next).not.toBe(ready);
    expect(created).toHaveLength(2);
    dispatch(created[1].contentWindow, { type: 'sandbox.ready' });
    await next;
  });
});
