/**
 * `--mcp-stdio` bridge — a protocol-only pipe between an MCP client's
 * stdio transport (line-delimited JSON-RPC on stdin/stdout) and the
 * running app's streamable-HTTP endpoint on the daemon bind. Engine-
 * opaque by contract: it never imports the engine, never becomes an app
 * instance, and holds no state beyond in-flight requests — each stdin
 * line is one POST to `/mcp` with the bearer token, each response body
 * is one stdout line. Admission (enabled/origin/token) is entirely the
 * daemon's; the bridge only adds the network failure case a local pipe
 * introduces: the app not running.
 *
 * Token and port come from argv (`--token` / `--port`) with env
 * fallbacks (`OPENHEADERS_MCP_TOKEN` / `OPENHEADERS_DAEMON_PORT`).
 * A missing token is NOT special-cased — the request goes out without
 * an Authorization header and the daemon's own 401 copy (which tells
 * the user where to mint one) is relayed to the client.
 */

import { createInterface } from 'node:readline';
import { MCP_HTTP_PATH, WS_PORT } from '@openheaders/core/protocol';
import { app } from 'electron';

const NOT_RUNNING_MESSAGE = 'Open Headers is not running — start it from the tray';

interface JsonRpcEnvelope {
  id?: number | string | null;
  [key: string]: unknown;
}

/** Reads `--name value` and `--name=value` forms; first hit wins. */
function argValue(argv: readonly string[], name: string): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === name) return argv[i + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function resolvePort(): number {
  const raw = argValue(process.argv, '--port') ?? process.env.OPENHEADERS_DAEMON_PORT;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : WS_PORT;
}

export function runMcpStdioBridge(): void {
  // No window, no tray — keep the bridge run out of the macOS dock too.
  app.dock?.hide();

  const token = argValue(process.argv, '--token') ?? process.env.OPENHEADERS_MCP_TOKEN;
  const endpoint = `http://127.0.0.1:${resolvePort()}${MCP_HTTP_PATH}`;

  function writeMessage(message: JsonRpcEnvelope, onFlushed?: () => void): void {
    process.stdout.write(`${JSON.stringify(message)}\n`, onFlushed);
  }

  async function forward(line: string): Promise<void> {
    const raw = line.trim();
    if (!raw) return;

    let envelope: JsonRpcEnvelope;
    try {
      envelope = JSON.parse(raw) as JsonRpcEnvelope;
    } catch {
      writeMessage({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    const id = envelope.id ?? null;

    let body: string;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}),
        },
        body: raw,
      });
      body = await response.text();
    } catch {
      // The one failure the bridge owns. Requests get it as a JSON-RPC
      // error; notifications have no reply channel, so stderr + exit.
      if (id !== null) {
        writeMessage({ jsonrpc: '2.0', id, error: { code: -32000, message: NOT_RUNNING_MESSAGE } }, () => app.exit(1));
      } else {
        process.stderr.write(`${NOT_RUNNING_MESSAGE}\n`);
        app.exit(1);
      }
      return;
    }

    // Notifications are answered 202 with an empty body — nothing to relay.
    if (!body) return;

    let relayed: JsonRpcEnvelope;
    try {
      relayed = JSON.parse(body) as JsonRpcEnvelope;
    } catch {
      writeMessage({ jsonrpc: '2.0', id, error: { code: -32603, message: 'invalid response from the app' } });
      return;
    }
    // Admission rejections (404/401/403) are minted with `id: null`
    // before the daemon has parsed the request — re-key them to the
    // request id so the client's correlator surfaces the error.
    if (relayed.id === null && id !== null) relayed.id = id;
    writeMessage(relayed);
  }

  const inflight = new Set<Promise<void>>();
  const reader = createInterface({ input: process.stdin, terminal: false });

  reader.on('line', (line) => {
    const task = forward(line);
    inflight.add(task);
    void task.finally(() => inflight.delete(task));
  });

  // Client closed the pipe — drain in-flight relays, then exit clean.
  reader.on('close', () => {
    void Promise.allSettled([...inflight]).then(() => app.exit(0));
  });
}
