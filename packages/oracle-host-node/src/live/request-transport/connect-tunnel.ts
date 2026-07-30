/**
 * The shared CONNECT-tunnel dial — the proxy leg both pinned pipelines
 * ride (`'2'` through the hand-rolled dial connector,
 * `'2-prior-knowledge'` through its own h2 session dial). undici's
 * `ProxyAgent` owns the tunnel for the negotiating pipelines, but a
 * pinned dial must own its OWN socket end-to-end (the pin's ALPN offer
 * and the prior-knowledge preface both live on the target leg), so this
 * helper opens exactly the tunnel and hands the raw socket back — the
 * caller runs its own target-leg TLS (or h2c framing) over it.
 *
 * Failure honesty, leg by leg: a dial-level failure REACHING the proxy
 * keeps its raw OS code (`ECONNREFUSED` / `ENOTFOUND` / `ETIMEDOUT` —
 * the classifier's proxied branches already name the proxy); a proxy
 * that answers the CONNECT with anything but 200 rejects with
 * {@link PROXY_CONNECT_REJECTED_CODE} carrying the status (407 names
 * the proxy-credentials setting, anything else names the tunnel);
 * everything AFTER the 200 fails on the caller's own target leg (TLS
 * handshake, h2 framing) and classifies as the origin's failure — which
 * it is, because the proxy is by then a transparent pipe.
 */

import * as net from 'node:net';
import * as tls from 'node:tls';

/** Proxy route for a tunneled dial — the URL plus the resolved
 *  `user:password` credential when the request carries one. */
export interface ProxyTunnel {
  url: string;
  credential?: string;
}

/** Code carried by a CONNECT the proxy answered with a non-200 — the
 *  transport's error classifier maps the status onto the setting
 *  (407 → proxy credentials; anything else → the tunnel itself). */
export const PROXY_CONNECT_REJECTED_CODE = 'OH_ERR_PROXY_CONNECT_REJECTED';

interface ProxyConnectRejectedError extends Error {
  code: typeof PROXY_CONNECT_REJECTED_CODE;
  proxyStatus: number;
}

function proxyConnectRejectedError(target: string, status: number): ProxyConnectRejectedError {
  return Object.assign(new Error(`The proxy answered the CONNECT request for ${target} with HTTP ${status}.`), {
    code: PROXY_CONNECT_REJECTED_CODE,
    proxyStatus: status,
  } as const);
}

/** The rejected-CONNECT status carried anywhere in an error's `cause`
 *  chain, or `undefined` when the failure was something else. */
export function proxyConnectRejectedStatus(err: unknown): number | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current !== null && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; proxyStatus?: unknown; cause?: unknown };
    if (record.code === PROXY_CONNECT_REJECTED_CODE && typeof record.proxyStatus === 'number') {
      return record.proxyStatus;
    }
    current = record.cause;
  }
  return undefined;
}

/** The tunnel's target — dialed by the PROXY, so only host + port
 *  travel (no local lookup, no socket path; both are rejected with a
 *  proxy pre-wire). */
export interface TunnelTarget {
  hostname: string;
  port: number;
}

export interface TunnelDialOptions {
  proxy: ProxyTunnel;
  signal?: AbortSignal;
  /** Ceiling on the whole tunnel dial (proxy connect + CONNECT
   *  round-trip). Default mirrors undici's connect timeout. */
  timeoutMs?: number;
}

/** undici's connect-timeout default, mirrored. */
const TUNNEL_TIMEOUT_MS = 10_000;

/** A CONNECT response header never legitimately exceeds this. */
const MAX_RESPONSE_BYTES = 16 * 1024;

/** RFC 6066 forbids IP literals in SNI — Node warns and ignores. */
function sniFor(hostname: string): string | undefined {
  return net.isIP(hostname) === 0 ? hostname : undefined;
}

/**
 * Open a CONNECT tunnel to `target` through `options.proxy` and resolve
 * with the raw tunnel socket the moment the proxy answers 200 — any
 * bytes the proxy delivered past its response header are pushed back
 * onto the socket, so the caller's target leg reads a clean stream. The
 * proxy leg itself speaks TLS when the proxy URL is `https://`
 * (runtime-default trust — the request's TLS knobs belong to the
 * TARGET leg, which the caller runs over the returned socket).
 */
export function dialConnectTunnel(target: TunnelTarget, options: TunnelDialOptions): Promise<net.Socket> {
  const proxyUrl = new URL(options.proxy.url);
  const proxySecure = proxyUrl.protocol === 'https:';
  const proxyPort = proxyUrl.port !== '' ? Number(proxyUrl.port) : proxySecure ? 443 : 80;
  const proxySni = sniFor(proxyUrl.hostname);
  const authority = `${target.hostname}:${target.port}`;
  return new Promise<net.Socket>((resolve, reject) => {
    let settled = false;
    let buffered: Buffer = Buffer.alloc(0);

    const socket: net.Socket = proxySecure
      ? tls.connect({
          host: proxyUrl.hostname,
          port: proxyPort,
          ...(proxySni !== undefined ? { servername: proxySni } : {}),
        })
      : net.connect({ host: proxyUrl.hostname, port: proxyPort });
    socket.setNoDelay(true);

    function cleanup(): void {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', onAbort);
      socket.removeListener('data', onData);
      socket.removeListener('error', fail);
      socket.removeListener('close', onClose);
    }

    function fail(err: unknown): void {
      if (settled) return;
      settled = true;
      cleanup();
      socket.destroy();
      reject(err);
    }

    function onAbort(): void {
      fail(new Error('aborted'));
    }

    function onClose(): void {
      fail(new Error(`The proxy closed the connection before answering the CONNECT request for ${authority}.`));
    }

    function onData(chunk: Buffer): void {
      buffered = buffered.length === 0 ? chunk : Buffer.concat([buffered, chunk]);
      const headerEnd = buffered.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        if (buffered.length > MAX_RESPONSE_BYTES) {
          fail(new Error(`The proxy answered the CONNECT request for ${authority} with something other than HTTP.`));
        }
        return;
      }
      const statusLine = buffered.subarray(0, headerEnd).toString('latin1').split('\r\n', 1)[0] ?? '';
      const match = /^HTTP\/1\.[01] (\d{3})/.exec(statusLine);
      if (match === null) {
        fail(new Error(`The proxy answered the CONNECT request for ${authority} with something other than HTTP.`));
        return;
      }
      const status = Number(match[1]);
      if (status !== 200) {
        fail(proxyConnectRejectedError(authority, status));
        return;
      }
      settled = true;
      cleanup();
      // Bytes past the header belong to the tunneled stream — push them
      // back so the caller's target leg reads them first.
      const leftover = buffered.subarray(headerEnd + 4);
      if (leftover.length > 0) socket.unshift(leftover);
      resolve(socket);
    }

    const timeout = setTimeout(() => {
      fail(
        Object.assign(new Error(`Tunnel dial through the proxy timed out for ${authority}.`), { code: 'ETIMEDOUT' }),
      );
    }, options.timeoutMs ?? TUNNEL_TIMEOUT_MS);

    if (options.signal !== undefined) {
      if (options.signal.aborted) {
        fail(new Error('aborted'));
        return;
      }
      options.signal.addEventListener('abort', onAbort);
    }

    socket.once(proxySecure ? 'secureConnect' : 'connect', () => {
      const credential = options.proxy.credential;
      const lines = [
        `CONNECT ${authority} HTTP/1.1`,
        `Host: ${authority}`,
        ...(credential !== undefined
          ? [`Proxy-Authorization: Basic ${Buffer.from(credential).toString('base64')}`]
          : []),
      ];
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    });
    socket.on('data', onData);
    socket.on('error', fail);
    socket.on('close', onClose);
  });
}
