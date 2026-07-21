/**
 * Telemetry console host — the extension side of the console-plane
 * stream (OBSERVABILITY_PLAN.md Phase 4). Asserts:
 *   - a forwarded subscribe attaches to the hub and streams `ready` +
 *     replay + live entries as tick-coalesced batch frames addressed to
 *     exactly that consumer's session
 *   - sessions are per `(wire, tab, consumer)`: a sibling consumer gets
 *     its own replay, a detach ends exactly one session, a wire close
 *     tears down every session it carried
 *   - non-loopback wires are claimed and dropped (privacy gate)
 *   - a re-subscribe re-attaches with a fresh `ready` + replay (the
 *     daemon's reconnect re-join)
 */

import type { ConsoleEntry, ConsoleStreamWireMessage } from '@openheaders/core/console-stream';
import {
  TELEMETRY_CONSOLE_BATCH_TYPE,
  TELEMETRY_CONSOLE_CONSUMER_TYPE,
  TELEMETRY_CONSOLE_DETACH_TYPE,
} from '@openheaders/core/protocol';
import { ConsoleStreamHub } from '@openheaders/oracle/console-stream-hub';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTelemetryConsoleHost, type TelemetryConsoleHost } from '@/background/telemetry-stream-host/console-host';

interface SentFrame {
  backendId: string;
  frame: Record<string, unknown>;
}

interface Harness {
  host: TelemetryConsoleHost;
  hub: ConsoleStreamHub;
  sent: SentFrame[];
  wire: BackendWireHandle;
  offWire: BackendWireHandle;
  deliver: (frame: unknown, wire: BackendWireHandle) => Promise<boolean>;
  closeWire: (wire: BackendWireHandle) => void;
}

function makeWire(backendId: string, loopback: boolean): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the console host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: () => true,
  };
}

function makeEntry(text: string): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text }],
    timestamp: 1000,
  };
}

/** Flatten the batch frames sent for one consumer into wire envelopes. */
function messagesFor(sent: SentFrame[], consumerId: string): ConsoleStreamWireMessage[] {
  return sent
    .filter((s) => s.frame.type === TELEMETRY_CONSOLE_BATCH_TYPE && s.frame.consumerId === consumerId)
    .flatMap((s) => s.frame.messages as ConsoleStreamWireMessage[]);
}

function makeHarness(): Harness {
  const sent: SentFrame[] = [];
  let inbound: InboundFrameHandler | null = null;
  const closeSubscribers: Array<(wire: BackendWireHandle) => void> = [];
  const wire = makeWire('b1', true);
  const offWire = makeWire('b2', false);
  const hub = new ConsoleStreamHub();
  const host = startTelemetryConsoleHost({
    hub,
    send: (backendId, frame) => {
      sent.push({ backendId, frame });
      return true;
    },
    registerInbound: (handler) => {
      inbound = handler;
      return () => {
        inbound = null;
      };
    },
    subscribeClose: (cb) => {
      closeSubscribers.push(cb);
      return () => undefined;
    },
  });
  return {
    host,
    hub,
    sent,
    wire,
    offWire,
    deliver: async (frame, w) => {
      if (!inbound) throw new Error('inbound handler not registered');
      return await inbound(frame, w);
    },
    closeWire: (w) => {
      for (const cb of closeSubscribers) cb(w);
    },
  };
}

describe('startTelemetryConsoleHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams ready + replay + live entries per consumer session', async () => {
    const h = makeHarness();
    h.hub.recordEntry(7, makeEntry('before'));

    const claimed = await h.deliver({ type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    expect(claimed).toBe(true);
    h.hub.recordEntry(7, makeEntry('after'));
    await vi.advanceTimersByTimeAsync(50);

    const messages = messagesFor(h.sent, 'c1');
    expect(messages[0]).toEqual({ kind: 'ready', tabId: 7 });
    expect(
      messages
        .slice(1)
        .map((m) => (m.kind === 'console-update' && m.update.kind === 'entry' ? m.update.entry.args[0].text : m.kind)),
    ).toEqual(['before', 'after']);
    expect(h.sent.every((s) => s.backendId === 'b1' && s.frame.tabId === 7)).toBe(true);
    h.host.dispose();
  });

  it('keeps sibling consumer sessions independent and honors detach + wire close', async () => {
    const h = makeHarness();
    await h.deliver({ type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    await vi.advanceTimersByTimeAsync(50);
    h.sent.length = 0;

    // A late-joining sibling replays on ITS stream only.
    h.hub.recordEntry(7, makeEntry('one'));
    await h.deliver({ type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: 7, consumerId: 'c2' }, h.wire);
    await vi.advanceTimersByTimeAsync(50);
    expect(messagesFor(h.sent, 'c1').some((m) => m.kind === 'ready')).toBe(false);
    expect(messagesFor(h.sent, 'c2')[0]).toEqual({ kind: 'ready', tabId: 7 });

    // Detach ends exactly the named consumer's session.
    h.sent.length = 0;
    await h.deliver({ type: TELEMETRY_CONSOLE_DETACH_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    h.hub.recordEntry(7, makeEntry('two'));
    await vi.advanceTimersByTimeAsync(50);
    expect(messagesFor(h.sent, 'c1')).toHaveLength(0);
    expect(messagesFor(h.sent, 'c2').length).toBeGreaterThan(0);

    // A closed wire tears down every session it carried.
    h.sent.length = 0;
    h.closeWire(h.wire);
    h.hub.recordEntry(7, makeEntry('three'));
    await vi.advanceTimersByTimeAsync(50);
    expect(h.sent).toHaveLength(0);
    h.host.dispose();
  });

  it('claims and drops frames from non-loopback wires (privacy gate)', async () => {
    const h = makeHarness();
    const claimed = await h.deliver({ type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.offWire);
    expect(claimed).toBe(true);
    h.hub.recordEntry(7, makeEntry('secret'));
    await vi.advanceTimersByTimeAsync(50);
    expect(h.sent).toHaveLength(0);
    h.host.dispose();
  });

  it('re-attaches with a fresh ready + replay on a re-subscribe', async () => {
    const h = makeHarness();
    h.hub.recordEntry(7, makeEntry('kept'));
    await h.deliver({ type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    await vi.advanceTimersByTimeAsync(50);
    h.sent.length = 0;

    await h.deliver({ type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: 7, consumerId: 'c1' }, h.wire);
    await vi.advanceTimersByTimeAsync(50);
    const messages = messagesFor(h.sent, 'c1');
    expect(messages[0]).toEqual({ kind: 'ready', tabId: 7 });
    expect(messages).toHaveLength(2);
    h.host.dispose();
  });
});
