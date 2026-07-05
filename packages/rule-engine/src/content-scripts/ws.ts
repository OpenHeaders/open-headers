/**
 * WebSocket message wrapper — wraps the WebSocket constructor to
 * modify / inject / drop frames on matching sockets. Self-contained func
 * injection (serialized into the page MAIN world).
 */

import type { WsRule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';
import type { FuncInjection } from '../builders/types';
import type { OhOriginals, WsConfig } from './types';

export function buildWsInjection(rule: WsRule): FuncInjection {
  const config: WsConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    operation: rule.action.operation,
    direction: rule.action.direction,
    filter: rule.action.messageFilter,
    payload: rule.action.payload ?? '',
    injectTrigger: rule.action.injectTrigger ?? 'open',
  };
  return {
    kind: 'func',
    func: wsInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

/**
 * Wraps the WebSocket constructor to modify / inject / drop frames on
 * matching sockets. The rule's URL conditions match the SOCKET endpoint
 * (`ws://` / `wss://`), tested at construction. Receive-side
 * interception relies on registration order: the interceptor listener is
 * added before the socket is handed to page code, so its
 * `stopImmediatePropagation()` runs ahead of every page listener
 * (including later `onmessage` assignments). Synthetic re-dispatches are
 * tagged `__ohSynthetic` so the interceptor never reprocesses them.
 *
 * Binary frames: a content filter only matches string data, so filtered
 * modify/drop passes binary frames through untouched; with no filter,
 * every frame in the configured direction is acted on.
 *
 * Every action additionally relays a per-frame capture (`report`) — the
 * side of the action the network capture can never see (replacement
 * delivered in-page, original of a rewritten send, injected/dropped
 * frames that never crossed the wire).
 */
function wsInjectionFunc(cfg: WsConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function resolveWsUrl(url: string): string {
    // Resolve relative / scheme-relative endpoints against the page base, then
    // map the resolved http(s) scheme to ws(s): a relative socket resolves to
    // the page's http(s) base scheme, but the wire is ws(s), so a scheme-
    // specific ws(s) url-filter (and the frame origin) must see the ws(s) form.
    // Absolute ws(s) endpoints pass through unchanged.
    try {
      return new URL(url, document.baseURI).href.replace(/^http/, 'ws');
    } catch {
      return url;
    }
  }

  function matches(url: string): boolean {
    const abs = resolveWsUrl(url);
    for (let i = 0; i < regexes.length; i++) {
      if (regexes[i]!.test(abs)) return true;
    }
    return false;
  }

  function matchesMessage(data: unknown): boolean {
    if (!cfg.filter) return true;
    if (typeof data !== 'string') return false;
    if (cfg.filter.matchType === 'regex') {
      try {
        return new RegExp(cfg.filter.value, 'i').test(data);
      } catch {
        return false;
      }
    }
    return data.indexOf(cfg.filter.value) !== -1;
  }

  function fire(url: string): void {
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.fire(cfg.ruleUid, url, 'ws');
  }

  // Relay the wire-invisible side of the action (see OhMessageCapture).
  // Optional-chained end to end: a document armed by an older setup may
  // hold an __ohOrig without captureMessage — the action still runs.
  function report(
    url: string,
    op: 'replaced' | 'dropped' | 'injected',
    sides: { original?: unknown; delivered?: string },
  ): void {
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.captureMessage?.({
      ruleUid: cfg.ruleUid,
      url: resolveWsUrl(url),
      t: Date.now(),
      direction: cfg.direction,
      op,
      ...(typeof sides.original === 'string' ? { original: sides.original } : {}),
      ...(sides.delivered !== undefined ? { delivered: sides.delivered } : {}),
    });
  }

  function originOf(url: string): string {
    // A real frame's MessageEvent.origin is the socket's origin, not the full
    // endpoint URL — resolve to the ws(s) form (as matches() does), then take
    // the origin.
    try {
      return new URL(resolveWsUrl(url)).origin;
    } catch {
      return url;
    }
  }

  type SyntheticMessageEvent = MessageEvent & { __ohSynthetic?: boolean };

  function deliver(ws: WebSocket, data: string, origin: string): void {
    const ev = new MessageEvent('message', { data, origin }) as SyntheticMessageEvent;
    ev.__ohSynthetic = true;
    ws.dispatchEvent(ev);
  }

  const OrigWebSocket = window.WebSocket;

  function WrappedWebSocket(this: unknown, url: string | URL, protocols?: string | string[]): WebSocket {
    const ws = protocols === undefined ? new OrigWebSocket(url) : new OrigWebSocket(url, protocols);
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : String(url);
    if (!matches(urlStr)) return ws;

    if (cfg.direction === 'send' && (cfg.operation === 'modify' || cfg.operation === 'drop')) {
      const origSend = ws.send.bind(ws);
      ws.send = (data: Parameters<WebSocket['send']>[0]): void => {
        if (matchesMessage(data)) {
          fire(urlStr);
          if (cfg.operation === 'drop') {
            report(urlStr, 'dropped', { original: data });
            return;
          }
          report(urlStr, 'replaced', { original: data, delivered: cfg.payload });
          origSend(cfg.payload);
          return;
        }
        origSend(data);
      };
    }

    if (cfg.direction === 'receive' && (cfg.operation === 'modify' || cfg.operation === 'drop')) {
      ws.addEventListener('message', (ev: MessageEvent) => {
        if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
        if (!matchesMessage(ev.data)) return;
        fire(urlStr);
        if (cfg.operation === 'modify') {
          report(urlStr, 'replaced', { original: ev.data, delivered: cfg.payload });
        } else {
          report(urlStr, 'dropped', { original: ev.data });
        }
        ev.stopImmediatePropagation();
        if (cfg.operation === 'modify') deliver(ws, cfg.payload, ev.origin);
      });
    }

    if (cfg.operation === 'inject') {
      // Deferred a tick so the synthetic frame lands AFTER the trigger
      // event finishes dispatching to page listeners — a synchronous
      // dispatch from inside the trigger's own listener chain would
      // deliver the injection before the frame that caused it.
      const injectSoon = (): void => {
        setTimeout(() => {
          fire(urlStr);
          if (cfg.direction === 'send') {
            if (ws.readyState === OrigWebSocket.OPEN) {
              report(urlStr, 'injected', { delivered: cfg.payload });
              ws.send(cfg.payload);
            }
          } else {
            report(urlStr, 'injected', { delivered: cfg.payload });
            deliver(ws, cfg.payload, originOf(urlStr));
          }
        }, 0);
      };
      if (cfg.injectTrigger === 'message') {
        ws.addEventListener('message', (ev: MessageEvent) => {
          if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
          if (!matchesMessage(ev.data)) return;
          injectSoon();
        });
      } else {
        ws.addEventListener('open', () => injectSoon());
      }
    }

    return ws;
  }

  // Constructed instances come from OrigWebSocket, so `instanceof` and
  // prototype patches keep working; statics cover page code reading
  // WebSocket.OPEN and friends off the constructor.
  WrappedWebSocket.prototype = OrigWebSocket.prototype;
  const statics = WrappedWebSocket as unknown as Record<string, number>;
  statics.CONNECTING = OrigWebSocket.CONNECTING;
  statics.OPEN = OrigWebSocket.OPEN;
  statics.CLOSING = OrigWebSocket.CLOSING;
  statics.CLOSED = OrigWebSocket.CLOSED;
  window.WebSocket = WrappedWebSocket as unknown as typeof WebSocket;
}
