/**
 * Static Delay wrapper — monkey-patches fetch/XHR to delay requests matching
 * the rule's URL conditions. The injected func is self-contained (serialized
 * via Function.prototype.toString, re-parsed in the page MAIN world).
 */

import type { DelayRule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';
import type { FuncInjection } from '../builders/types';
import type { DelayConfig, OhOriginals } from './types';

export function buildDelayInjection(rule: DelayRule): FuncInjection {
  const config: DelayConfig = {
    ruleUid: rule.uid,
    regexSources: compileRuleForInjection(rule),
    delayMs: Math.max(0, Math.min(rule.action.delayMs, 5000)),
  };
  return {
    kind: 'func',
    func: delayInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

/**
 * Monkey-patches fetch/XHR to delay requests matching the configured regexes.
 * MUST be self-contained — no closures, no outer refs. Serialized via
 * Function.prototype.toString and re-parsed in the page's MAIN world.
 */
function delayInjectionFunc(cfg: DelayConfig): void {
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

  function fire(url: string): void {
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.fire(cfg.ruleUid, url, 'delay');
  }

  const origFetch = window.fetch;
  window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
    const input = args[0];
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
    if (matches(url)) {
      fire(url);
      return new Promise((resolve) => {
        setTimeout(() => resolve(origFetch.apply(this, args)), cfg.delayMs);
      });
    }
    return origFetch.apply(this, args);
  };

  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null,
  ): void {
    this.__ohUrl = typeof url === 'string' ? url : url.href;
    origXHROpen.call(this, method, url, async, username, password);
  } as typeof XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { __ohUrl?: string },
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    const url = this.__ohUrl ?? '';
    if (url && matches(url)) {
      fire(url);
      setTimeout(() => origXHRSend.apply(this, args), cfg.delayMs);
    } else {
      origXHRSend.apply(this, args);
    }
  };
}
