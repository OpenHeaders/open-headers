/**
 * Header-merge wrapper — appends to (merges) request/response headers on
 * matching fetch/XHR. `extractHeaderMerges` is the producer the onCommitted
 * injector AND the CDP bootstrap compiler share, so both delivery paths read
 * one extraction with no drift.
 */

import type { HeaderRule } from '@openheaders/core/types';
import type { FuncInjection } from '../builders/types';
import type { HeaderMergeConfig, OhOriginals } from './types';

function defaultSeparator(headerName: string): string {
  const lower = headerName.toLowerCase();
  return lower === 'cookie' || lower === 'set-cookie' ? '; ' : ', ';
}

/**
 * Skip a merge mod whose template fields didn't fully resolve. If any of the
 * strings the page would inject still contains `{{`, the SW resolver couldn't
 * satisfy a reference (TOTP in `reject` mode, broken var, missing env);
 * shipping the literal would inject a `{{...}}` substring into the page's
 * headers — silently wrong. Drop instead.
 */
function isMergeModResolvable(m: { headerName: string; value?: string; mergeSeparator?: string }): boolean {
  if (m.headerName.includes('{{')) return false;
  if (typeof m.value === 'string' && m.value.includes('{{')) return false;
  if (typeof m.mergeSeparator === 'string' && m.mergeSeparator.includes('{{')) return false;
  return true;
}

/**
 * The merge operations a HeaderRule contributes to an in-page wrapper, or
 * `null` when it has none (its set/append/remove ops are pure DNR and carry no
 * wrapper). The producer half of {@link buildHeaderMergeInjection}; lives here,
 * beside the builder, so BOTH delivery paths — the `onCommitted` injector and
 * the CDP bootstrap compiler — read one extraction with no drift.
 */
export function extractHeaderMerges(
  rule: HeaderRule,
): Pick<HeaderMergeConfig, 'requestMerges' | 'responseMerges'> | null {
  const requestMerges = (rule.action.requestHeaders ?? [])
    .filter((m) => m.operation === 'merge' && m.headerName?.trim() && m.value?.trim() && isMergeModResolvable(m))
    .map((m) => ({
      headerName: m.headerName,
      value: m.value!,
      separator: m.mergeSeparator || defaultSeparator(m.headerName),
    }));
  const responseMerges = (rule.action.responseHeaders ?? [])
    .filter((m) => m.operation === 'merge' && m.headerName?.trim() && m.value?.trim() && isMergeModResolvable(m))
    .map((m) => ({
      headerName: m.headerName,
      value: m.value!,
      separator: m.mergeSeparator || defaultSeparator(m.headerName),
    }));
  if (requestMerges.length === 0 && responseMerges.length === 0) return null;
  return { requestMerges, responseMerges };
}

export function buildHeaderMergeInjection(
  ruleUid: string,
  regexSources: string[],
  requestMerges: HeaderMergeConfig['requestMerges'],
  responseMerges: HeaderMergeConfig['responseMerges'],
): FuncInjection {
  const config: HeaderMergeConfig = {
    ruleUid,
    regexSources,
    requestMerges,
    responseMerges,
  };
  return {
    kind: 'func',
    func: headerMergeInjectionFunc as unknown as (cfg: never) => void,
    args: [config],
  };
}

function headerMergeInjectionFunc(cfg: HeaderMergeConfig): void {
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
    (window as unknown as { __ohOrig?: OhOriginals }).__ohOrig?.fire(cfg.ruleUid, url, 'header-merge');
  }

  function mergeValue(existing: string, newVal: string, sep: string): string {
    if (!existing?.trim()) return newVal;
    return existing + sep + newVal;
  }

  if (cfg.requestMerges.length > 0) {
    const origFetch = window.fetch;
    window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
      const input = args[0];
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
      if (!matches(url)) return origFetch.apply(this, args);
      fire(url);
      const init = args[1] || {};
      const headers = new Headers(init.headers || {});
      for (let i = 0; i < cfg.requestMerges.length; i++) {
        const m = cfg.requestMerges[i]!;
        const existing = headers.get(m.headerName) || '';
        headers.set(m.headerName, mergeValue(existing, m.value, m.separator));
      }
      return origFetch.call(this, input as RequestInfo, Object.assign({}, init, { headers }));
    };

    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { __ohUrl?: string; __ohHeaders?: Record<string, string> },
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null,
    ): void {
      this.__ohUrl = typeof url === 'string' ? url : url.href;
      this.__ohHeaders = {};
      origXHROpen.call(this, method, url, async, username, password);
    } as typeof XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.setRequestHeader = function (
      this: XMLHttpRequest & { __ohHeaders?: Record<string, string> },
      name: string,
      value: string,
    ): void {
      if (this.__ohHeaders) this.__ohHeaders[name.toLowerCase()] = value;
      origXHRSetHeader.call(this, name, value);
    };
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { __ohUrl?: string; __ohHeaders?: Record<string, string> },
      ...args: Parameters<XMLHttpRequest['send']>
    ): void {
      const url = this.__ohUrl ?? '';
      if (url && matches(url)) {
        fire(url);
        for (let i = 0; i < cfg.requestMerges.length; i++) {
          const m = cfg.requestMerges[i]!;
          const existing = this.__ohHeaders?.[m.headerName.toLowerCase()] || '';
          origXHRSetHeader.call(this, m.headerName, mergeValue(existing, m.value, m.separator));
        }
      }
      origXHRSend.apply(this, args);
    };
  }

  if (cfg.responseMerges.length > 0) {
    const origFetchR = window.fetch;
    window.fetch = function (this: typeof window, ...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
      const input = args[0];
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : ((input as Request)?.url ?? '');
      if (!matches(url)) return origFetchR.apply(this, args);
      fire(url);
      return origFetchR.apply(this, args).then((response) => {
        const newHeaders = new Headers(response.headers);
        for (let i = 0; i < cfg.responseMerges.length; i++) {
          const m = cfg.responseMerges[i]!;
          const existing = newHeaders.get(m.headerName) || '';
          newHeaders.set(m.headerName, mergeValue(existing, m.value, m.separator));
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      });
    };
  }
}
