/**
 * Server-sent events wrapper — wraps the EventSource constructor to
 * modify / inject / drop events on matching streams. Self-contained func
 * injection (serialized into the page MAIN world).
 */

import type { SseRule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';
import type { FuncInjection } from '../builders/types';
import type { OhOriginals, SseConfig } from './types';

export function buildSseInjection(rule: SseRule): FuncInjection {
  const config: SseConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    operation: rule.action.operation,
    eventName: rule.action.eventName,
    filter: rule.action.messageFilter,
    payload: rule.action.payload ?? '',
    injectTrigger: rule.action.injectTrigger ?? 'open',
  };
  return {
    kind: 'func',
    func: sseInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

/**
 * Wraps the EventSource constructor to modify / inject / drop events on
 * matching streams. The interceptor pre-registers for the configured
 * event type (`eventName`, or the default 'message') at construction —
 * before any page listener or `onmessage` assignment — so
 * `stopImmediatePropagation()` always wins. Same `__ohSynthetic`
 * re-dispatch tagging as the WebSocket wrapper.
 */
function sseInjectionFunc(cfg: SseConfig): void {
  const regexes = cfg.regexSources.map((s) => new RegExp(s, 'i'));
  function matches(url: string): boolean {
    // Resolve relative / scheme-relative URLs against the page base so
    // `fetch('/api/x')` matches an absolute-URL pattern — the regexes are
    // compiled from absolute patterns, which is also what the network
    // layer sees. Absolute URLs resolve to themselves (idempotent).
    let abs = url;
    try {
      abs = new URL(url, document.baseURI).href;
    } catch {
      /* not resolvable — match against the raw value */
    }
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
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.fire(cfg.ruleUid, url, 'sse');
  }

  // Relay the wire-invisible side of the action (see OhMessageCapture).
  // SSE is receive-only: modify/drop act after wire capture (the wire
  // holds the original) and injected events never cross the wire, so
  // every capture is `receive` + the event type acted on. Optional-
  // chained end to end: a document armed by an older setup may hold an
  // __ohOrig without captureMessage — the action still runs.
  function report(
    url: string,
    op: 'replaced' | 'dropped' | 'injected',
    sides: { original?: unknown; delivered?: string },
  ): void {
    let abs = url;
    try {
      abs = new URL(url, document.baseURI).href;
    } catch {
      /* not resolvable — relay the raw value */
    }
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.captureMessage?.({
      ruleUid: cfg.ruleUid,
      url: abs,
      t: Date.now(),
      direction: 'receive',
      op,
      eventName: cfg.eventName || 'message',
      ...(typeof sides.original === 'string' ? { original: sides.original } : {}),
      ...(sides.delivered !== undefined ? { delivered: sides.delivered } : {}),
    });
  }

  function originOf(url: string): string {
    // A real event's MessageEvent.origin is the stream's origin, not the
    // full endpoint URL — resolve relative endpoints against the page base
    // (as matches() does), then take the origin.
    try {
      return new URL(url, document.baseURI).origin;
    } catch {
      return url;
    }
  }

  type SyntheticMessageEvent = MessageEvent & { __ohSynthetic?: boolean };

  const eventType = cfg.eventName || 'message';

  function deliver(es: EventSource, data: string, origin: string, lastEventId: string): void {
    const ev = new MessageEvent(eventType, { data, origin, lastEventId }) as SyntheticMessageEvent;
    ev.__ohSynthetic = true;
    es.dispatchEvent(ev);
  }

  const OrigEventSource = window.EventSource;

  function WrappedEventSource(this: unknown, url: string | URL, init?: EventSourceInit): EventSource {
    const es = init === undefined ? new OrigEventSource(url) : new OrigEventSource(url, init);
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : String(url);
    if (!matches(urlStr)) return es;

    if (cfg.operation === 'modify' || cfg.operation === 'drop') {
      es.addEventListener(eventType, (ev: MessageEvent) => {
        if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
        if (!matchesMessage(ev.data)) return;
        fire(urlStr);
        if (cfg.operation === 'modify') {
          report(urlStr, 'replaced', { original: ev.data, delivered: cfg.payload });
        } else {
          report(urlStr, 'dropped', { original: ev.data });
        }
        ev.stopImmediatePropagation();
        if (cfg.operation === 'modify') deliver(es, cfg.payload, ev.origin, ev.lastEventId);
      });
    } else {
      // Deferred a tick — same reasoning as the WebSocket wrapper: the
      // synthetic event must land after its trigger finishes dispatching.
      const injectSoon = (): void => {
        setTimeout(() => {
          fire(urlStr);
          report(urlStr, 'injected', { delivered: cfg.payload });
          deliver(es, cfg.payload, originOf(urlStr), '');
        }, 0);
      };
      if (cfg.injectTrigger === 'message') {
        es.addEventListener(eventType, (ev: MessageEvent) => {
          if ((ev as SyntheticMessageEvent).__ohSynthetic) return;
          if (!matchesMessage(ev.data)) return;
          injectSoon();
        });
      } else {
        es.addEventListener('open', () => injectSoon());
      }
    }

    return es;
  }

  WrappedEventSource.prototype = OrigEventSource.prototype;
  const statics = WrappedEventSource as unknown as Record<string, number>;
  statics.CONNECTING = OrigEventSource.CONNECTING;
  statics.OPEN = OrigEventSource.OPEN;
  statics.CLOSED = OrigEventSource.CLOSED;
  window.EventSource = WrappedEventSource as unknown as typeof EventSource;
}
