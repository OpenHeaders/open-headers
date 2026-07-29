/**
 * Local rig servers for the request-settings live e2e
 * (`request-settings-live.spec.ts`) — every wire the S2–S12 knob
 * recipes need, hosted in the Playwright process so the suite never
 * leaves the machine: a self-signed HTTPS echo, a TLS 1.1-max server,
 * an h2 server that reports the negotiated protocol, a multi-purpose
 * HTTP rig (slow / big-body / redirect hops / auth+cookie echo), a
 * CONNECT proxy that records its tunnel targets, a Unix-socket echo, a
 * cleartext-h2 echo for the prior-knowledge legs, and a Caddy-fronted
 * QUIC rig for the HTTP/3 legs. Certificates are minted per run via
 * the system openssl into a temp dir (the
 * `playground/daemon-rig/cert.mjs` posture).
 */

import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import type tls from 'node:tls';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface Rig {
  port: number;
  close(): Promise<void>;
}

export interface TlsMaterial {
  key: Buffer;
  cert: Buffer;
}

/** Mint a throwaway localhost pair (SAN: localhost + 127.0.0.1) into `dir`. */
export async function mintLocalhostCert(dir: string): Promise<TlsMaterial> {
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  await execFileAsync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '2',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,DNS:openheaders.io,IP:127.0.0.1',
    '-keyout',
    keyPath,
    '-out',
    certPath,
  ]);
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

function listen(
  server: http.Server | https.Server | http2.Http2Server | http2.Http2SecureServer | tls.Server,
): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as net.AddressInfo).port);
    });
  });
}

function closer(server: { close(cb?: () => void): unknown }): () => Promise<void> {
  return () =>
    new Promise((resolve) => {
      server.close(() => resolve());
    });
}

/**
 * The multi-purpose HTTP rig. Routes:
 *   `/slow?ms=N`     — answers `ok` after N ms.
 *   `/big?bytes=N`   — answers an N-byte body.
 *   `/hops?n=N`      — 302-chains down to `n=0`, then answers `done`.
 *   `/hop-to?to=URL` — one 302 to the absolute URL (cross-origin legs).
 *   `/echo`          — JSON `{ host, url, authorization, cookie }`.
 *   `/login`         — `Set-Cookie: session=live123` + 302 → `/me`.
 *   `/me`            — `cookie=[<cookie header>]`.
 */
export async function startHttpRig(): Promise<Rig> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://rig');
    if (url.pathname === '/slow') {
      const ms = Number(url.searchParams.get('ms') ?? 0);
      setTimeout(() => res.end('ok'), ms);
      return;
    }
    if (url.pathname === '/big') {
      const bytes = Number(url.searchParams.get('bytes') ?? 0);
      res.end('x'.repeat(bytes));
      return;
    }
    if (url.pathname === '/hops') {
      const n = Number(url.searchParams.get('n') ?? 0);
      if (n > 0) {
        res.writeHead(302, { location: `/hops?n=${n - 1}` });
        res.end();
        return;
      }
      res.end('done');
      return;
    }
    if (url.pathname === '/hop-to') {
      res.writeHead(302, { location: url.searchParams.get('to') ?? '/' });
      res.end();
      return;
    }
    if (url.pathname === '/echo') {
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          host: req.headers.host ?? '',
          url: req.url ?? '',
          authorization: req.headers.authorization ?? '',
          cookie: req.headers.cookie ?? '',
        }),
      );
      return;
    }
    if (url.pathname === '/login') {
      res.setHeader('Set-Cookie', 'session=live123; Path=/; Max-Age=3600');
      res.writeHead(302, { location: '/me' });
      res.end();
      return;
    }
    if (url.pathname === '/me') {
      res.end(`cookie=[${req.headers.cookie ?? ''}]`);
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
  const port = await listen(server);
  return { port, close: closer(server) };
}

/** Mint a throwaway CLIENT pair (CN=client) into `dir` — distinct file
 *  names so it can share the dir with {@link mintLocalhostCert}. */
export async function mintClientCert(dir: string): Promise<TlsMaterial> {
  const keyPath = path.join(dir, 'client-key.pem');
  const certPath = path.join(dir, 'client-cert.pem');
  await execFileAsync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '2',
    '-subj',
    '/CN=client',
    '-keyout',
    keyPath,
    '-out',
    certPath,
  ]);
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

/** A mutual-TLS echo — demands a client certificate chaining to
 *  `clientCa` (the self-signed client cert doubles as its own CA) and
 *  answers `mtls-ok`. A certless client is severed mid-handshake. */
export async function startMtlsEcho(material: TlsMaterial, clientCa: Buffer): Promise<Rig> {
  const server = https.createServer(
    { ...material, requestCert: true, rejectUnauthorized: true, ca: clientCa },
    (_req, res) => {
      res.end('mtls-ok');
    },
  );
  const port = await listen(server);
  return { port, close: closer(server) };
}

/** Self-signed HTTPS echo — `{"ok":true}`. */
export async function startHttpsEcho(material: TlsMaterial): Promise<Rig> {
  const server = https.createServer(material, (_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end('{"ok":true}');
  });
  const port = await listen(server);
  return { port, close: closer(server) };
}

/** A TLS 1.1-max server — a modern-floor client must fail its handshake.
 *  `SECLEVEL=0` on the SERVER side permits the legacy protocol. */
export async function startTls11Echo(material: TlsMaterial): Promise<Rig> {
  const server = https.createServer(
    { ...material, minVersion: 'TLSv1', maxVersion: 'TLSv1.1', ciphers: 'DEFAULT@SECLEVEL=0' },
    (_req, res) => {
      res.end('legacy-ok');
    },
  );
  const port = await listen(server);
  return { port, close: closer(server) };
}

/** An h2 server (h2 + http/1.1 via ALPN) answering the negotiated protocol. */
export async function startH2Echo(material: TlsMaterial): Promise<Rig> {
  const server = http2.createSecureServer({ ...material, allowHTTP1: true }, (req, res) => {
    res.end(req.httpVersion === '2.0' ? 'h2' : 'http/1.1');
  });
  const port = await listen(server);
  return { port, close: closer(server) };
}

/** A CLEARTEXT h2 server (`http2.createServer` — no TLS, no `Upgrade`
 *  dance) answering the spoken protocol. Only a prior-knowledge client
 *  can talk to it: there is no ALPN seat and no h1 fallback. */
export async function startH2cEcho(): Promise<Rig> {
  const server = http2.createServer((req, res) => {
    res.end(req.httpVersion === '2.0' ? 'h2' : 'http/1.1');
  });
  const port = await listen(server);
  return { port, close: closer(server) };
}

/**
 * The HTTP/3 rig — an external Caddy serving h1 + h2 + h3 on one port
 * (TCP for h1/h2, UDP for QUIC) with the minted localhost pair,
 * answering `h3-rig-ok` (the playground `h3-rig.ts` posture: Node
 * cannot serve QUIC natively, and Caddy stays a dev-machine install).
 * Returns null when no caddy binary is on PATH so the suite can skip
 * the QUIC legs on machines without it rather than fail.
 */
export async function startH3Rig(dir: string): Promise<Rig | null> {
  const probe = await new Promise<boolean>((resolve) => {
    execFile('caddy', ['version'], (error) => resolve(error === null));
  });
  if (!probe) return null;

  const port = await freePort();
  const caddyfilePath = path.join(dir, 'Caddyfile');
  writeFileSync(
    caddyfilePath,
    [
      '{',
      '\tauto_https off',
      '\tadmin off',
      '\tservers {',
      '\t\tprotocols h1 h2 h3',
      '\t}',
      '}',
      '',
      `https://localhost:${port}, https://127.0.0.1:${port} {`,
      `\ttls ${path.join(dir, 'cert.pem')} ${path.join(dir, 'key.pem')}`,
      '\trespond "h3-rig-ok" 200',
      '}',
      '',
    ].join('\n'),
  );
  const caddy: ChildProcess = spawn('caddy', ['run', '--config', caddyfilePath, '--adapter', 'caddyfile'], {
    stdio: 'ignore',
  });

  // Readiness: poll the TCP side until the listener answers; the UDP
  // listener comes up with it.
  const deadline = Date.now() + 15_000;
  for (;;) {
    const up = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
    if (up) break;
    if (Date.now() > deadline) {
      caddy.kill();
      throw new Error('h3 rig: caddy did not start listening within 15 s');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    port,
    close: () =>
      new Promise((resolve) => {
        caddy.once('exit', () => resolve());
        caddy.kill();
      }),
  };
}

export interface ProxyRig extends Rig {
  /** `host:port` CONNECT targets, arrival order. */
  tunnels: string[];
}

/** A minimal HTTP CONNECT proxy recording every tunnel it opens. Pass
 *  `requireAuth` (`user:password`) to demand a matching Basic
 *  `Proxy-Authorization` — a missing or wrong pair is refused with 407,
 *  and refused CONNECTs are never recorded as tunnels. */
export async function startConnectProxy(requireAuth?: string): Promise<ProxyRig> {
  const tunnels: string[] = [];
  const sockets = new Set<{ destroy(): void }>();
  const server = http.createServer((_req, res) => {
    res.statusCode = 405;
    res.end();
  });
  server.on('connect', (req, clientSocket, head) => {
    if (requireAuth) {
      const expected = `Basic ${Buffer.from(requireAuth).toString('base64')}`;
      if (req.headers['proxy-authorization'] !== expected) {
        clientSocket.write(
          'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="rig"\r\n\r\n',
        );
        clientSocket.destroy();
        return;
      }
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
    const drop = () => {
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on('error', drop);
    clientSocket.on('error', drop);
  });
  const port = await listen(server);
  return {
    port,
    tunnels,
    close: () =>
      new Promise((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

export interface OAuthTokenRig extends Rig {
  /** Parsed form bodies of every `/token` POST, arrival order. */
  calls: Array<Record<string, string>>;
}

/**
 * A minimal OAuth token endpoint. `POST /token` answers a fresh bundle
 * (`access_token: at-<n>`, counting up per grant) and records the
 * parsed form body; `POST /token-broken` refuses every grant with the
 * RFC 6749 `invalid_grant` error shape — the failed-refresh leg.
 */
export async function startOAuthTokenRig(): Promise<OAuthTokenRig> {
  const calls: Array<Record<string, string>> = [];
  let minted = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.method === 'POST' && req.url === '/token') {
        calls.push(Object.fromEntries(new URLSearchParams(raw)));
        minted += 1;
        res.end(JSON.stringify({ access_token: `at-${minted}`, token_type: 'Bearer', expires_in: 3600 }));
        return;
      }
      if (req.method === 'POST' && req.url === '/token-broken') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      res.statusCode = 404;
      res.end('{"error":"not_found"}');
    });
  });
  const port = await listen(server);
  return { port, calls, close: closer(server) };
}

export interface SocketRig {
  socketPath: string;
  close(): Promise<void>;
}

/** HTTP echo on a Unix domain socket — body `<host> <url>`. */
export async function startUnixEcho(socketPath: string): Promise<SocketRig> {
  const server = http.createServer((req, res) => {
    res.end(`${req.headers.host ?? ''} ${req.url ?? ''}`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => resolve());
  });
  return { socketPath, close: closer(server) };
}

/** A TCP port with nothing listening — bound once, then released. */
export async function freePort(): Promise<number> {
  const server = net.createServer();
  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port));
  });
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  return port;
}
