/**
 * Main-process half of the desktop's `backendProbe` capability: the
 * renderer's CSP (`default-src 'self'`) forbids a WebSocket to any
 * server and its file Origin would be refused anyway, so the wizard's
 * probe — the one network call the backend pane still made from the
 * renderer — runs here over Node's `WebSocket`, the socket the live
 * backend client dials with. The dispatcher only relays the plain
 * options and the core probe's result.
 */

import { type ProbeConnectionResult, type ProbeOptions, probeBackendConnection } from '@openheaders/core/identity';

export interface BackendProbeRpcOptions {
  /** Test seam; defaults to the core probe over Node's socket. */
  readonly probe?: (url: string, opts: ProbeOptions) => Promise<ProbeConnectionResult>;
}

export interface BackendProbeRpc {
  /** Answers `oh.backendProbe`; undefined for any other type (the sign-in plane's idiom). */
  dispatch(type: unknown, message: Record<string, unknown>): Promise<unknown> | undefined;
}

export function createBackendProbeRpc(options: BackendProbeRpcOptions = {}): BackendProbeRpc {
  const probe = options.probe ?? probeBackendConnection;
  return {
    dispatch(type, message) {
      if (type !== 'oh.backendProbe') return undefined;
      const url = typeof message.url === 'string' ? message.url : '';
      const opts = (message.opts ?? {}) as ProbeOptions;
      return probe(url, opts);
    },
  };
}
