/**
 * A minimal live CONNECT proxy for the local rig legs — the H2 rig
 * (S15), shared since P4 so the environment-plane legs tunnel through
 * the same proxy the explicit-knob legs do. Records CONNECT targets and
 * `Proxy-Authorization` values in arrival order; `requireAuth`
 * (`user:password`) demands a matching Basic header and refuses with
 * 407; `rejectStatus` refuses EVERY tunnel with that status — the
 * proxy-reachable-but-tunnel-failed leg.
 */

import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as net from 'node:net';

export interface ProxyRig {
  url: string;
  /** `host:port` CONNECT targets, arrival order — refused CONNECTs
   *  are never recorded. */
  tunnels: string[];
  /** `Proxy-Authorization` value of every CONNECT, arrival order. */
  authHeaders: Array<string | undefined>;
  close(): Promise<void>;
}

export async function startConnectProxy(
  options: { requireAuth?: string; rejectStatus?: number } = {},
): Promise<ProxyRig> {
  const tunnels: string[] = [];
  const authHeaders: Array<string | undefined> = [];
  const sockets = new Set<{ destroy(): void }>();
  const server = http.createServer((_req, res) => {
    res.statusCode = 405;
    res.end();
  });
  server.on('connect', (req, clientSocket, head) => {
    authHeaders.push(req.headers['proxy-authorization']);
    if (options.requireAuth !== undefined) {
      const expected = `Basic ${Buffer.from(options.requireAuth).toString('base64')}`;
      if (req.headers['proxy-authorization'] !== expected) {
        clientSocket.write(
          'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="rig"\r\n\r\n',
        );
        clientSocket.destroy();
        return;
      }
    }
    if (options.rejectStatus !== undefined) {
      clientSocket.write(`HTTP/1.1 ${options.rejectStatus} Tunnel Refused\r\n\r\n`);
      clientSocket.destroy();
      return;
    }
    const target = req.url ?? '';
    tunnels.push(target);
    const [host, portStr] = target.split(':');
    const upstream = net.connect(Number(portStr ?? 443), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    sockets.add(clientSocket).add(upstream);
    const drop = (): void => {
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on('error', drop);
    clientSocket.on('error', drop);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    tunnels,
    authHeaders,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

export async function listenPort(server: net.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return (server.address() as AddressInfo).port;
}

/** An ephemeral port with nothing listening — bound once, then freed. */
export async function closedPort(): Promise<number> {
  const probe = net.createServer();
  const port = await listenPort(probe);
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}
