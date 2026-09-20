/**
 * `oh login` — the person's sign-in from the command line (the client
 * sign-in plan §7): the CLI starts a device sign-in on the daemon
 * through the ONE core wire client (`client: 'cli'`), prints the
 * server's approval page and the code it will show, polls the handle
 * every two seconds, and rides the approved secret through the same
 * probe-and-save path `oh connect --token` uses — the merge law keeps
 * every other key of `cli.json`. Every refusal and every settled
 * verdict short of approval is one honest line on the exit class it
 * belongs to, and nothing lands on disk.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandLogin, type WaitIo } from '../../src/commands';
import {
  AuthError,
  EXIT_AUTH,
  EXIT_OPERATION_FAILED,
  EXIT_UNREACHABLE,
  EXIT_USAGE,
  exitCodeFor,
  OperationFailedError,
  UnreachableError,
  UsageError,
} from '../../src/exit-codes';

const DAEMON = 'http://10.0.0.5:8137';
const APPROVE_URL = `${DAEMON}/pair/424242`;

interface Dial {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const dials: Dial[] = [];
let configDir: string;
let configFile: string;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const STARTED = {
  ok: true,
  code: '424242',
  pollToken: 'handle-1',
  expiresAt: Date.now() + 300_000,
  approveUrl: APPROVE_URL,
};

/**
 * A daemon answering the start, then the scripted poll verdicts in
 * order, then the `/mcp` probe the persist path runs. A thrown answer
 * models a dead socket.
 */
function stubDaemon(start: Response | Error, polls: readonly (Response | Error)[], mcpTools = ['rules_list']): void {
  const queue = [...polls];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      dials.push({
        url,
        method: init.method ?? 'GET',
        headers,
        body: init.body ? JSON.parse(String(init.body)) : null,
      });
      const answer = ((): Response | Error => {
        if (url.endsWith('/pair')) return start;
        if (url.endsWith('/pair/poll')) return queue.shift() ?? new Error('unscripted poll');
        if (url.endsWith('/mcp'))
          return json({ jsonrpc: '2.0', id: 1, result: { tools: mcpTools.map((name) => ({ name })) } });
        return new Error(`unexpected dial ${url}`);
      })();
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  );
}

function makeIo() {
  const progress: string[] = [];
  const sleeps: number[] = [];
  const io: WaitIo = {
    progress: (line) => progress.push(line),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { io, progress, sleeps };
}

async function seedConfig(config: Record<string, unknown>): Promise<void> {
  await mkdir(path.dirname(configFile), { recursive: true });
  await writeFile(configFile, JSON.stringify(config));
}

async function savedConfig(): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(configFile, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

beforeEach(async () => {
  configDir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-login-'));
  configFile = path.join(configDir, 'openheaders', 'cli.json');
  // The config path law reads XDG_CONFIG_HOME first — the test seam.
  vi.stubEnv('XDG_CONFIG_HOME', configDir);
  vi.stubEnv('OH_DAEMON_URL', undefined);
  vi.stubEnv('OH_TOKEN', undefined);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  dials.length = 0;
  await rm(configDir, { recursive: true, force: true });
});

describe('commandLogin', () => {
  it('starts the pair as the cli, prints the page and the code, polls at two seconds and saves the approved secret', async () => {
    stubDaemon(json(STARTED), [
      json({ status: 'pending', expiresAt: STARTED.expiresAt }),
      json({ status: 'pending', expiresAt: STARTED.expiresAt }),
      json({ status: 'approved', secret: 'oh_bound', tokenId: 'tok-1' }),
    ]);
    const { io, progress, sleeps } = makeIo();
    const lines = await commandLogin(['--daemon', DAEMON, '--label', 'build box'], io);

    const [start, poll1, , poll3, probe] = dials;
    expect(start).toMatchObject({
      url: `${DAEMON}/pair`,
      method: 'POST',
      body: { client: 'cli', deviceLabel: 'build box' },
    });
    expect(poll1).toMatchObject({ url: `${DAEMON}/pair/poll`, method: 'GET' });
    expect(poll1.headers.authorization).toBe('Bearer handle-1');
    expect(poll3.headers.authorization).toBe('Bearer handle-1');
    // The persist path's probe rides the SECRET, never the handle.
    expect(probe).toMatchObject({ url: `${DAEMON}/mcp`, body: { method: 'tools/list' } });
    expect(probe.headers.authorization).toBe('Bearer oh_bound');
    // No Origin on any dial — a native process, the shape the matrix admits clean.
    expect(dials.every((d) => d.headers.origin === undefined)).toBe(true);

    expect(progress).toEqual([
      `! Open ${APPROVE_URL} in a browser and sign in there`,
      '  The page will ask you to approve code 424242 for this command-line tool',
      '  Waiting for you to approve this device…',
    ]);
    expect(sleeps).toEqual([2000, 2000, 2000]);
    expect(lines).toEqual([`signed in — 1 tool(s) at ${DAEMON}`, `saved to ${configFile}`]);
    expect(await savedConfig()).toEqual({ daemonUrl: DAEMON, token: 'oh_bound' });
  });

  it('omits the label when none is given and keeps every other key of cli.json (the merge law)', async () => {
    await seedConfig({
      daemonUrl: 'http://old.openheaders.io:8137',
      token: 'oh_old',
      channel: 'beta',
      telemetry: false,
    });
    stubDaemon(json(STARTED), [json({ status: 'approved', secret: 'oh_new', tokenId: 'tok-2' })]);
    const { io } = makeIo();
    await commandLogin(['--daemon', DAEMON], io);
    expect(dials[0].body).toEqual({ client: 'cli' });
    expect(await savedConfig()).toEqual({ daemonUrl: DAEMON, token: 'oh_new', channel: 'beta', telemetry: false });
  });

  it('defaults the daemon to the configured one, like connect', async () => {
    await seedConfig({ daemonUrl: 'https://team.openheaders.io' });
    stubDaemon(json({ ...STARTED, approveUrl: 'https://team.openheaders.io/pair/424242' }), [
      json({ status: 'approved', secret: 'oh_team', tokenId: 'tok-3' }),
    ]);
    const { io } = makeIo();
    await commandLogin([], io);
    expect(dials[0].url).toBe('https://team.openheaders.io/pair');
    expect(dials.at(-1)?.url).toBe('https://team.openheaders.io/mcp');
  });

  it('a denial on the page is exit 1 with one line and nothing saved', async () => {
    stubDaemon(json(STARTED), [json({ status: 'pending', expiresAt: STARTED.expiresAt }), json({ status: 'denied' })]);
    const { io } = makeIo();
    const err = await commandLogin(['--daemon', DAEMON], io).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OperationFailedError);
    expect((err as Error).message).toBe("the sign-in was denied on the server's page");
    expect(exitCodeFor(err)).toBe(EXIT_OPERATION_FAILED);
    expect(await savedConfig()).toBeNull();
  });

  it('an expiry and a lost handle are exit 1 with their own lines', async () => {
    stubDaemon(json(STARTED), [json({ status: 'expired' })]);
    const { io } = makeIo();
    await expect(commandLogin(['--daemon', DAEMON], io)).rejects.toThrow(
      'the sign-in request expired before it was approved',
    );
    dials.length = 0;
    stubDaemon(json(STARTED), [json({ status: 'unknown' }, 404)]);
    await expect(commandLogin(['--daemon', DAEMON], io)).rejects.toThrow(
      'the server no longer holds this sign-in request — run oh login again',
    );
  });

  it("polls past a transport hiccup, but not past the pair's own clock", async () => {
    stubDaemon(json({ ...STARTED, expiresAt: Date.now() + 60_000 }), [
      new Error('socket reset'),
      json({ status: 'approved', secret: 'oh_late', tokenId: 'tok-4' }),
    ]);
    const { io, sleeps } = makeIo();
    await commandLogin(['--daemon', DAEMON], io);
    expect(sleeps).toEqual([2000, 2000]);

    dials.length = 0;
    stubDaemon(json({ ...STARTED, expiresAt: Date.now() - 1 }), [new Error('socket reset')]);
    await expect(commandLogin(['--daemon', DAEMON], io)).rejects.toThrow(
      'the sign-in request expired before it was approved',
    );
  });

  it('types every start refusal on its exit class', async () => {
    const { io } = makeIo();
    const cases: Array<[Response | Error, unknown, number, string]> = [
      [
        json({ error: 'too-many-pending' }, 503),
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'too many sign-ins waiting',
      ],
      [
        json({ error: 'throttled' }, 429),
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'refusing requests from this machine',
      ],
      [json({ error: 'forbidden' }, 403), AuthError, EXIT_AUTH, 'refused the sign-in request from this machine'],
      [new Error('ECONNREFUSED'), UnreachableError, EXIT_UNREACHABLE, 'nothing answered at 10.0.0.5:8137'],
      [
        new Response('<html>', { status: 200 }),
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'answered something unexpected',
      ],
    ];
    for (const [start, klass, code, words] of cases) {
      dials.length = 0;
      stubDaemon(start, []);
      const err = await commandLogin(['--daemon', DAEMON], io).catch((e: unknown) => e);
      expect(err, words).toBeInstanceOf(klass);
      expect((err as Error).message).toContain(words);
      expect(exitCodeFor(err)).toBe(code);
      // A refused start never polls.
      expect(dials.map((d) => d.url)).toEqual([`${DAEMON}/pair`]);
    }
    expect(await savedConfig()).toBeNull();
  });

  it('refuses a token, a long label, a positional and a non-http daemon as usage errors before dialing', async () => {
    stubDaemon(json(STARTED), []);
    const { io } = makeIo();
    for (const argv of [
      ['--daemon', DAEMON, '--token', 'oh_x'],
      ['--daemon', DAEMON, '--label', 'x'.repeat(65)],
      ['--daemon', DAEMON, 'extra'],
      ['--daemon', 'ws://10.0.0.5:8137'],
    ]) {
      const err = await commandLogin(argv, io).catch((e: unknown) => e);
      expect(err, argv.join(' ')).toBeInstanceOf(UsageError);
      expect(exitCodeFor(err)).toBe(EXIT_USAGE);
    }
    expect(dials).toEqual([]);
  });
});
