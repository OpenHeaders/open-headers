/**
 * WS executor — the TOTP cooldown plane over an injected resolution and
 * an injected plane: Connect's codes are ONE batch gated before the
 * dial (a refusal is the session's failed outcome in the HTTP send's
 * wording, nothing dialed) and recorded on OPEN alone (a dial that
 * never opened burned nothing); every rider is its OWN batch — Connect's
 * codes are never re-gated, the rider's refusal answers that rider like
 * a dropped Before send, the record follows the write; a Before send
 * level's `oh.vault.get` lands on the rider's tracker; a Before connect
 * level's on Connect's; a reconnect dial gates and records nothing new.
 */

import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import { createTotpUsageTracker, type TotpCooldownPlane, type TotpUsage } from '@openheaders/core/totp';
import type { Vault, WebSocketRequest } from '@openheaders/core/types';
import type { SessionScriptHost, SessionScriptInput } from '@openheaders/oracle/live/request-exec/script-hooks';
import type { SessionResolve } from '@openheaders/oracle/live/request-exec/session-resolution';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { closeActiveWsSession, sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import {
  type WsSessionCallbacks,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it, vi } from 'vitest';

const vault: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'totp0001', kind: 'totp', name: 'otp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
  ],
};

const REFUSAL = "TOTP 'otp' code can't be reused — wait 12s for the next window.";

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-totp-1',
    path: 'requests/suite-col1/probe-totp',
    name: 'Probe TOTP',
    flavor: 'raw',
    url: 'wss://events.openheaders.io/live',
    subprotocols: [],
    headers: [{ uid: 'h1', key: 'X-OTP', value: '{{vault.otp}}', enabled: true }],
    params: [],
    message: '',
    ...overrides,
  };
}

/** The injected closure: `{{vault.otp}}` answers the current code and
 *  reports it to the batch's tracker the way the real resolution does. */
function resolutionAnsweringCode(code: () => string): SessionResolve {
  return (template, _unresolved, totp) =>
    template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
      if (name.trim() !== 'vault.otp') return whole;
      const value = code();
      totp?.observe([{ name: 'vault.otp', resolved: true, value, scope: 'vault' }]);
      return value;
    });
}

/** A scripted plane: the real tracker, a spied gate and record. */
function scriptedPlane(refusals: Record<string, string | null> = {}) {
  const gated: TotpUsage[][] = [];
  const recorded: TotpUsage[][] = [];
  const plane: TotpCooldownPlane = {
    tracker: () => createTotpUsageTracker(vault),
    refusal: async (usages) => {
      // An empty batch never reaches a store — the plane's own fast path.
      if (usages.length === 0) return null;
      gated.push([...usages]);
      for (const usage of usages) {
        const refusal = refusals[usage.code];
        if (refusal !== undefined && refusal !== null) return refusal;
      }
      return null;
    },
    record: (usages) => {
      if (usages.length === 0) return;
      recorded.push([...usages]);
    },
  };
  return { plane, gated, recorded };
}

function rig() {
  const dials: Array<{ request: WsTransportRequest; callbacks: WsSessionCallbacks; sent: string[]; ended: boolean }> =
    [];
  const transport: WsTransport = {
    connect(request, callbacks, signal) {
      const dial = { request, callbacks, sent: [] as string[], ended: false };
      dials.push(dial);
      const finish = (): void => {
        if (dial.ended) return;
        dial.ended = true;
        queueMicrotask(() => callbacks.onEnd());
      };
      signal?.addEventListener('abort', finish);
      return {
        send: (text) => dial.sent.push(text),
        close: (code, reason) => {
          if (dial.ended) return;
          dial.ended = true;
          callbacks.onClose({ code, reason, wasClean: true });
          queueMicrotask(() => callbacks.onEnd());
        },
      };
    },
  };
  const at = (n: number) => {
    const dial = dials[n];
    if (dial === undefined) throw new Error(`dial ${n} never happened`);
    return dial;
  };
  return {
    transport,
    dials: () => dials.length,
    request: (n: number) => at(n).request,
    sent: (n: number) => at(n).sent,
    open: (n: number) => at(n).callbacks.onOpen('', ''),
    fail: (n: number) => {
      const dial = at(n);
      dial.ended = true;
      queueMicrotask(() => dial.callbacks.onEnd(new WsTransportError('ECONNREFUSED')));
    },
    sever: (n: number) => {
      const dial = at(n);
      dial.ended = true;
      dial.callbacks.onClose({ code: 1006, reason: '', wasClean: false });
      queueMicrotask(() => dial.callbacks.onEnd());
    },
    closeClean: (n: number) => {
      const dial = at(n);
      dial.ended = true;
      dial.callbacks.onClose({ code: 1000, reason: 'bye', wasClean: true });
      queueMicrotask(() => dial.callbacks.onEnd());
    },
  };
}

const ok = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
  executionId: 'e',
  succeeded: true,
  assertions: [],
  consoleLog: [],
  durationMs: 1,
  ...over,
});

/** A host whose one script reads `vault.otp` through the hook's scope. */
function readingHost() {
  const ran: SessionScriptInput[] = [];
  const host: SessionScriptHost = {
    mode: 'safe',
    run: async (input) => {
      ran.push(input);
      await input.scope?.readVariable('vault.otp');
      return ok();
    },
    endSession: () => undefined,
  };
  return { host, ran };
}

const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('executeWsSession — TOTP cooldown, Connect', () => {
  it('gates Connect before the dial: a code in cooldown fails the session in the HTTP wording and nothing dials', async () => {
    const t = rig();
    const { plane, gated, recorded } = scriptedPlane({ '111111': REFUSAL });
    const snapshot = await executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-totp-gate',
      resolution: resolutionAnsweringCode(() => '111111'),
      totp: plane,
    });
    expect(snapshot.outcome).toEqual({ kind: 'failed', error: REFUSAL });
    expect(t.dials()).toBe(0);
    expect(gated).toEqual([[{ name: 'otp', code: '111111', period: 30 }]]);
    expect(recorded).toEqual([]);
  });

  it("records Connect's codes on OPEN, never on a dial that failed", async () => {
    const t = rig();
    const { plane, recorded } = scriptedPlane();
    const failed = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-totp-fail',
      resolution: resolutionAnsweringCode(() => '222222'),
      totp: plane,
    });
    await settleTick();
    expect(t.request(0).headers).toEqual([{ key: 'X-OTP', value: '222222' }]);
    t.fail(0);
    await failed;
    expect(recorded).toEqual([]);

    const opened = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-totp-open',
      resolution: resolutionAnsweringCode(() => '333333'),
      totp: plane,
    });
    await settleTick();
    t.open(1);
    expect(recorded).toEqual([[{ name: 'otp', code: '333333', period: 30 }]]);
    t.closeClean(1);
    await opened;
    expect(recorded).toHaveLength(1);
  });

  it("a Before connect level's read lands on Connect's batch; a reconnect dial gates and records nothing new", async () => {
    const t = rig();
    const { plane, gated, recorded } = scriptedPlane();
    const { host, ran } = readingHost();
    const settled = executeWsSession(
      makeWsRequest({
        headers: [],
        scripts: { 'ws-before-connect': 'connect();' },
        autoReconnect: true,
        reconnectPeriodMs: 1,
        reconnectBackoff: false,
      }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: t.transport,
        sendId: 'send-totp-hook',
        resolution: resolutionAnsweringCode(() => '444444'),
        totp: plane,
        scriptChain: [],
        scriptHost: host,
        reconnectJitter: () => 0,
      },
    );
    await settleTick();
    // The templates carried no code; the hook's read is the dial's usage.
    expect(gated).toEqual([[{ name: 'otp', code: '444444', period: 30 }]]);
    t.open(0);
    expect(recorded).toEqual([[{ name: 'otp', code: '444444', period: 30 }]]);
    t.sever(0);
    await vi.waitFor(() => expect(t.dials()).toBe(2));
    await settleTick();
    // The second dial ran the hook again with no batch scope of its own
    // — nothing gated, nothing recorded.
    expect(ran).toHaveLength(2);
    expect(gated).toHaveLength(1);
    t.open(1);
    expect(recorded).toHaveLength(1);
    // An auto-reconnect session ends through Disconnect — a bare close
    // would read as a drop and redial.
    closeActiveWsSession('send-totp-hook');
    await settled;
  });
});

describe('executeWsSession — TOTP cooldown, riders', () => {
  it("a rider is its own batch: Connect's code is not re-gated, the rider's refusal answers the rider, the record follows the write", async () => {
    const t = rig();
    let code = '555555';
    const { plane, gated, recorded } = scriptedPlane({ '666666': REFUSAL });
    const settled = executeWsSession(makeWsRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-totp-rider',
      resolution: resolutionAnsweringCode(() => code),
      totp: plane,
    });
    await settleTick();
    t.open(0);
    expect(recorded).toEqual([[{ name: 'otp', code: '555555', period: 30 }]]);

    // A plain rider carries no code: nothing gated, nothing recorded.
    expect(await sendActiveWsSessionMessage('send-totp-rider', 'hello')).toEqual({ success: true });
    expect(gated).toHaveLength(1);
    expect(recorded).toHaveLength(1);

    // The window rolled; the rider's code is its own — gated as itself,
    // Connect's 555555 nowhere in the batch.
    code = '777777';
    expect(await sendActiveWsSessionMessage('send-totp-rider', 'otp={{vault.otp}}')).toEqual({ success: true });
    expect(gated.at(-1)).toEqual([{ name: 'otp', code: '777777', period: 30 }]);
    expect(recorded.at(-1)).toEqual([{ name: 'otp', code: '777777', period: 30 }]);
    expect(t.sent(0)).toEqual(['hello', 'otp=777777']);

    // A code in cooldown refuses THIS rider — the answer, nothing on the wire.
    code = '666666';
    expect(await sendActiveWsSessionMessage('send-totp-rider', 'otp={{vault.otp}}')).toEqual({
      success: false,
      error: REFUSAL,
    });
    expect(t.sent(0)).toHaveLength(2);
    expect(recorded).toHaveLength(2);

    closeActiveWsSession('send-totp-rider');
    await settled;
  });

  it("a Before send level's read is the rider's usage — gated with the rider", async () => {
    const t = rig();
    const { plane, gated, recorded } = scriptedPlane({ '888888': REFUSAL });
    const { host } = readingHost();
    const settled = executeWsSession(makeWsRequest({ headers: [], scripts: { 'ws-before-send': 'send();' } }), {
      workspaceId: null,
      environmentId: undefined,
      transport: t.transport,
      sendId: 'send-totp-hook-rider',
      resolution: resolutionAnsweringCode(() => '888888'),
      totp: plane,
      scriptChain: [],
      scriptHost: host,
    });
    await settleTick();
    t.open(0);
    expect(gated).toHaveLength(0);
    expect(await sendActiveWsSessionMessage('send-totp-hook-rider', 'hello')).toEqual({
      success: false,
      error: REFUSAL,
    });
    expect(gated).toEqual([[{ name: 'otp', code: '888888', period: 30 }]]);
    expect(recorded).toEqual([]);
    expect(t.sent(0)).toEqual([]);
    closeActiveWsSession('send-totp-hook-rider');
    await settled;
  });
});
