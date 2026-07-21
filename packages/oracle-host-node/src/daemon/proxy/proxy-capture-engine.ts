/**
 * Composition root for the read-only capture plane: binds the MITM
 * server to the CA store, a live scope list, and the lifecycle mapper.
 *
 * This is the seam the daemon control plane (a later slice's
 * `oh.daemon.proxy.*` start/stop RPCs) drives, and where a daemon-side
 * `RequestLifecycleHub` will attach for cross-process delivery to the
 * panel. Here the engine only binds the port and feeds captures into the
 * provided sink — no control surface, no hub transport yet.
 */

import { hostInScope } from '@openheaders/core/proxy';
import type { ProxyCaRecord } from '@openheaders/core/types';
import type { ProxyBodyRetainer } from './body-store';
import { readProxyCa } from './ca-store';
import { type LifecycleSink, ProxyCaptureLifecycleMapper } from './capture-lifecycle';
import { createProxyMitmServer, type ProxyMitmServer } from './mitm-server';
import type { ProxyCaProvider, ProxyScope } from './mitm-types';
import type { ProxyRuleEnforcer } from './rule-enforcement';

/** CA provider over the sealed slot — `undecryptable` reads as no CA (no leaf). */
export function sealedCaProvider(): ProxyCaProvider {
  return {
    async getCa(): Promise<ProxyCaRecord | null> {
      const read = await readProxyCa();
      return read === 'undecryptable' || read === null ? null : read;
    },
  };
}

/** Scope backed by a live pattern getter, so edits take effect without rebind. */
export function scopeFromPatterns(getPatterns: () => readonly string[]): ProxyScope {
  return {
    isDecrypted(host: string): boolean {
      return hostInScope(host, getPatterns());
    },
  };
}

export interface ProxyCaptureEngineOptions {
  /** Live scope list — decrypted hosts; everything else is opaque passthrough. */
  readonly getScopePatterns: () => readonly string[];
  /** Where lifecycle updates land — typically `store.apply.bind(store)`. */
  readonly sink: LifecycleSink;
  /** Phase-3 rule enforcement on captured exchanges; absent = read-only. */
  readonly enforcer?: ProxyRuleEnforcer;
  /** Out-of-row retention for teed response bodies; absent = not retained. */
  readonly bodyRetainer?: ProxyBodyRetainer;
  readonly caProvider?: ProxyCaProvider;
  readonly now?: () => number;
}

export interface ProxyCaptureEngine {
  readonly server: ProxyMitmServer;
}

export function createProxyCaptureEngine(options: ProxyCaptureEngineOptions): ProxyCaptureEngine {
  const mapper = new ProxyCaptureLifecycleMapper(options.sink, options.bodyRetainer);
  const server = createProxyMitmServer({
    caProvider: options.caProvider ?? sealedCaProvider(),
    scope: scopeFromPatterns(options.getScopePatterns),
    observer: mapper,
    ...(options.enforcer !== undefined ? { enforcer: options.enforcer } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  return { server };
}
