/**
 * The helper client against a real child process speaking the framed
 * protocol (the fake helper fixture) — spawn-on-demand, HELLO gating,
 * request-id multiplexing, terminal ERROR frames, cancel, crash
 * rejection + respawn, and the protocol-mismatch teardown.
 */

import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createH3HelperClient,
  type H3HelperClient,
  H3HelperFailure,
  type H3ResponseHandlers,
} from '../../../src/live/h3-helper/helper-process';
import type { H3HeaderPair, H3RequestHead, H3ResponseHead } from '../../../src/live/h3-helper/protocol';

const FAKE_HELPER = fileURLToPath(new URL('./fixtures/fake-helper.mjs', import.meta.url));

function makeHead(overrides: Partial<H3RequestHead> = {}): H3RequestHead {
  return {
    url: 'https://api.openheaders.io/ok',
    method: 'GET',
    headers: [],
    bodyBytes: 0,
    ...overrides,
  };
}

interface Exchange {
  head?: H3ResponseHead;
  body: Buffer[];
  trailers?: H3HeaderPair[];
  ended: boolean;
  error?: H3HelperFailure;
}

/** Handlers recording into an exchange, resolving `done` at either
 *  terminal (END or ERROR). */
function recordingHandlers(): { exchange: Exchange; handlers: H3ResponseHandlers; done: Promise<Exchange> } {
  const exchange: Exchange = { body: [], ended: false };
  let settle: (value: Exchange) => void;
  const done = new Promise<Exchange>((resolve) => {
    settle = resolve;
  });
  const handlers: H3ResponseHandlers = {
    onHead: (head) => {
      exchange.head = head;
    },
    onBody: (chunk) => {
      exchange.body.push(chunk);
    },
    onTrailers: (trailers) => {
      exchange.trailers = trailers;
    },
    onEnd: () => {
      exchange.ended = true;
      settle(exchange);
    },
    onError: (err) => {
      exchange.error = err;
      settle(exchange);
    },
  };
  return { exchange, handlers, done };
}

let client: H3HelperClient | null = null;

function makeClient(): H3HelperClient {
  client = createH3HelperClient({ binaryPath: process.execPath, args: [FAKE_HELPER], helloTimeoutMs: 2000 });
  return client;
}

afterEach(() => {
  client?.dispose();
  client = null;
});

describe('createH3HelperClient', () => {
  it('completes a full exchange: head, body, trailers, end', async () => {
    const rig = recordingHandlers();
    makeClient().request(makeHead(), undefined, rig.handlers);
    const exchange = await rig.done;
    expect(exchange.error).toBeUndefined();
    expect(exchange.head?.status).toBe(200);
    expect(exchange.head?.headers).toContainEqual(['x-echo-method', 'GET']);
    expect(exchange.ended).toBe(true);
    expect(exchange.trailers).toEqual([['x-fake-trailer', 'end']]);
    const body = JSON.parse(Buffer.concat(exchange.body).toString('utf8'));
    expect(body.path).toBe('/ok');
  });

  it('streams the request body as REQUEST_BODY frames the helper reassembles', async () => {
    const rig = recordingHandlers();
    const payload = Buffer.alloc(200 * 1024, 7);
    makeClient().request(makeHead({ method: 'POST' }), payload, rig.handlers);
    const exchange = await rig.done;
    const body = JSON.parse(Buffer.concat(exchange.body).toString('utf8'));
    expect(body.receivedBytes).toBe(payload.length);
  });

  it('multiplexes concurrent requests over one helper by id', async () => {
    const c = makeClient();
    const first = recordingHandlers();
    const second = recordingHandlers();
    c.request(makeHead({ url: 'https://api.openheaders.io/one' }), undefined, first.handlers);
    c.request(makeHead({ url: 'https://api.openheaders.io/two' }), undefined, second.handlers);
    const [a, b] = await Promise.all([first.done, second.done]);
    expect(JSON.parse(Buffer.concat(a.body).toString('utf8')).path).toBe('/one');
    expect(JSON.parse(Buffer.concat(b.body).toString('utf8')).path).toBe('/two');
  });

  it('surfaces a terminal ERROR frame as an H3HelperFailure with the frame code', async () => {
    const rig = recordingHandlers();
    makeClient().request(makeHead({ url: 'https://api.openheaders.io/error-pre' }), undefined, rig.handlers);
    const exchange = await rig.done;
    expect(exchange.error).toBeInstanceOf(H3HelperFailure);
    expect(exchange.error?.code).toBe('connect-timeout');
    expect(exchange.head).toBeUndefined();
  });

  it('a post-head ERROR frame arrives after the head and body chunks', async () => {
    const rig = recordingHandlers();
    makeClient().request(makeHead({ url: 'https://api.openheaders.io/error-post' }), undefined, rig.handlers);
    const exchange = await rig.done;
    expect(exchange.head?.status).toBe(200);
    expect(Buffer.concat(exchange.body).toString('utf8')).toBe('partial');
    expect(exchange.error?.code).toBe('reset');
    expect(exchange.ended).toBe(false);
  });

  it('rejects in-flight requests when the helper crashes, then respawns for the next send', async () => {
    const c = makeClient();
    const crash = recordingHandlers();
    c.request(makeHead({ url: 'https://api.openheaders.io/crash' }), undefined, crash.handlers);
    const crashed = await crash.done;
    expect(crashed.error?.code).toBe('helper-crashed');
    // The next request spawns a fresh helper — the client self-heals.
    const after = recordingHandlers();
    c.request(makeHead(), undefined, after.handlers);
    const healed = await after.done;
    expect(healed.error).toBeUndefined();
    expect(healed.head?.status).toBe(200);
  });

  it('a clean helper exit with nothing in flight resets quietly — the next send respawns', async () => {
    const c = makeClient();
    const first = recordingHandlers();
    c.request(makeHead({ url: 'https://api.openheaders.io/exit-clean' }), undefined, first.handlers);
    const done = await first.done;
    expect(done.error).toBeUndefined();
    expect(done.ended).toBe(true);
    // Let the helper's exit(0) land on the client — the clean-exit
    // contract must not mint helper-crashed for anyone.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const after = recordingHandlers();
    c.request(makeHead(), undefined, after.handlers);
    const healed = await after.done;
    expect(healed.error).toBeUndefined();
    expect(healed.head?.status).toBe(200);
  });

  it('a clean exit code with a send still in flight is a crash — the pending send fails classified', async () => {
    const rig = recordingHandlers();
    makeClient().request(makeHead({ url: 'https://api.openheaders.io/exit-clean-pending' }), undefined, rig.handlers);
    const exchange = await rig.done;
    expect(exchange.error?.code).toBe('helper-crashed');
  });

  it('cancel forgets the id — no callbacks fire, later requests keep working', async () => {
    const c = makeClient();
    const silent = recordingHandlers();
    const handle = c.request(makeHead({ url: 'https://api.openheaders.io/never' }), undefined, silent.handlers);
    handle.cancel();
    const after = recordingHandlers();
    c.request(makeHead(), undefined, after.handlers);
    const healed = await after.done;
    expect(healed.head?.status).toBe(200);
    expect(silent.exchange.head).toBeUndefined();
    expect(silent.exchange.error).toBeUndefined();
  });

  it('kills the helper and fails the send on a protocol-int mismatch', async () => {
    const previous = process.env.FAKE_H3_PROTOCOL;
    process.env.FAKE_H3_PROTOCOL = '999';
    try {
      const rig = recordingHandlers();
      makeClient().request(makeHead(), undefined, rig.handlers);
      const exchange = await rig.done;
      expect(exchange.error?.code).toBe('helper-protocol-mismatch');
    } finally {
      if (previous === undefined) delete process.env.FAKE_H3_PROTOCOL;
      else process.env.FAKE_H3_PROTOCOL = previous;
    }
  });

  it('fails the send when the helper never says HELLO', async () => {
    const previous = process.env.FAKE_H3_SILENT;
    process.env.FAKE_H3_SILENT = '1';
    try {
      client = createH3HelperClient({ binaryPath: process.execPath, args: [FAKE_HELPER], helloTimeoutMs: 200 });
      const rig = recordingHandlers();
      client.request(makeHead(), undefined, rig.handlers);
      const exchange = await rig.done;
      expect(exchange.error?.code).toBe('helper-no-hello');
    } finally {
      if (previous === undefined) delete process.env.FAKE_H3_SILENT;
      else process.env.FAKE_H3_SILENT = previous;
    }
  });

  it('fails the send when the binary cannot spawn at all', async () => {
    client = createH3HelperClient({ binaryPath: '/nonexistent/oh-h3-helper', helloTimeoutMs: 2000 });
    const rig = recordingHandlers();
    client.request(makeHead(), undefined, rig.handlers);
    const exchange = await rig.done;
    expect(exchange.error?.code).toBe('helper-spawn-failed');
  });
});
