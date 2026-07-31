/**
 * Minimal live proxies for the local rig legs. The CONNECT proxy is
 * the H2 rig (S15), shared since P4 so the environment-plane legs
 * tunnel through the same proxy the explicit-knob legs do; it records
 * CONNECT targets and `Proxy-Authorization` values in arrival order,
 * `requireAuth` (`user:password`) demands a matching Basic header and
 * refuses with 407, and `rejectStatus` refuses EVERY tunnel with that
 * status — the proxy-reachable-but-tunnel-failed leg. The SOCKS5
 * proxy joined in P5: an RFC 1928 CONNECT server (no-auth or RFC 1929
 * username/password when `requireAuth` is set) recording targets and
 * presented credentials the same way.
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

export interface Socks5Rig {
  url: string;
  /** `host:port` CONNECT targets, arrival order — refused connections
   *  are never recorded. */
  targets: string[];
  /** `user:password` presented per RFC 1929 negotiation, arrival
   *  order; `undefined` for a no-auth connection. */
  auths: Array<string | undefined>;
  close(): Promise<void>;
}

/** The SOCKS5 target address (ATYP + addr + port) as `host:port`, or
 *  `null` while the buffer is still short of a full request. */
function readSocks5Target(buffer: Buffer): { target: string; length: number } | null {
  if (buffer.length < 5) return null;
  const atyp = buffer[3];
  let host: string;
  let addrEnd: number;
  if (atyp === 0x01) {
    if (buffer.length < 10) return null;
    host = Array.from(buffer.subarray(4, 8)).join('.');
    addrEnd = 8;
  } else if (atyp === 0x03) {
    const len = buffer[4];
    if (buffer.length < 5 + len + 2) return null;
    host = buffer.subarray(5, 5 + len).toString('utf8');
    addrEnd = 5 + len;
  } else if (atyp === 0x04) {
    if (buffer.length < 22) return null;
    const words: string[] = [];
    for (let i = 4; i < 20; i += 2) words.push(buffer.readUInt16BE(i).toString(16));
    host = `[${words.join(':')}]`;
    addrEnd = 20;
  } else {
    return null;
  }
  const port = buffer.readUInt16BE(addrEnd);
  return { target: `${host}:${port}`, length: addrEnd + 2 };
}

export async function startSocks5Proxy(options: { requireAuth?: string } = {}): Promise<Socks5Rig> {
  const targets: string[] = [];
  const auths: Array<string | undefined> = [];
  const sockets = new Set<{ destroy(): void }>();
  const server = net.createServer((client) => {
    sockets.add(client);
    let stage: 'greeting' | 'auth' | 'request' | 'piping' = 'greeting';
    let buffer = Buffer.alloc(0);
    client.on('error', () => client.destroy());
    client.on('data', (chunk) => {
      if (stage === 'piping') return;
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === 'greeting') {
        if (buffer.length < 2 || buffer.length < 2 + buffer[1]) return;
        buffer = buffer.subarray(2 + buffer[1]);
        if (options.requireAuth !== undefined) {
          stage = 'auth';
          client.write(Buffer.from([0x05, 0x02]));
        } else {
          auths.push(undefined);
          stage = 'request';
          client.write(Buffer.from([0x05, 0x00]));
        }
        if (buffer.length === 0) return;
      }
      if (stage === 'auth') {
        if (buffer.length < 2) return;
        const ulen = buffer[1];
        if (buffer.length < 2 + ulen + 1) return;
        const plen = buffer[2 + ulen];
        if (buffer.length < 2 + ulen + 1 + plen) return;
        const user = buffer.subarray(2, 2 + ulen).toString('utf8');
        const pass = buffer.subarray(3 + ulen, 3 + ulen + plen).toString('utf8');
        buffer = buffer.subarray(3 + ulen + plen);
        auths.push(`${user}:${pass}`);
        if (`${user}:${pass}` !== options.requireAuth) {
          client.write(Buffer.from([0x01, 0x01]));
          client.destroy();
          return;
        }
        stage = 'request';
        client.write(Buffer.from([0x01, 0x00]));
        if (buffer.length === 0) return;
      }
      const parsed = readSocks5Target(buffer);
      if (parsed === null) return;
      if (buffer[0] !== 0x05 || buffer[1] !== 0x01) {
        client.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        client.destroy();
        return;
      }
      const remainder = buffer.subarray(parsed.length);
      targets.push(parsed.target);
      stage = 'piping';
      const [host, portStr] = parsed.target.split(':');
      const upstream = net.connect(Number(portStr), host, () => {
        client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        if (remainder.length > 0) upstream.write(remainder);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      sockets.add(upstream);
      const drop = (): void => {
        upstream.destroy();
        client.destroy();
      };
      upstream.on('error', drop);
      client.on('close', () => upstream.destroy());
    });
  });
  const port = await listenPort(server);
  return {
    url: `socks5://127.0.0.1:${port}`,
    targets,
    auths,
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
