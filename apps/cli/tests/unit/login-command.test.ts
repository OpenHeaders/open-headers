/**
 * `oh login` — the person's sign-in from the command line (the client
 * sign-in plan §14.5): the CLI is the daemon's registered
 * `openheaders-cli` client on the device authorization grant through
 * the ONE core client. It reads the server's metadata, starts the
 * grant, prints the verification link and the user code, opens the
 * link when a browser is in reach, polls the token endpoint at the
 * server's interval (`slow_down` honoured), and rides the minted
 * session credential through the same probe-and-save path `oh connect
 * --token` uses — the merge law keeps every other key of `cli.json`.
 * Every refusal and every settled verdict short of approval is one
 * honest line on the exit class it belongs to, and nothing lands on
 * disk.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandLogin, type LoginIo } from '../../src/commands';
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
const VERIFY_LINK = `${DAEMON}/auth/oauth/device/verify?user_code=BCDF-GHJK`;
const DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

interface Dial {
  url: string;
  method: string;
  headers: Record<string, string>;
  form: Record<string, string>;
  json: unknown;
}

const dials: Dial[] = [];
let configDir: string;
let configFile: string;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function metadataFor(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/auth/oauth/authorize`,
    token_endpoint: `${origin}/auth/oauth/token`,
    device_authorization_endpoint: `${origin}/auth/oauth/device`,
    revocation_endpoint: `${origin}/auth/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', DEVICE_CODE_GRANT],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

function startedFor(origin: string, expiresIn = 300) {
  return {
    device_code: 'dev-secret',
    user_code: 'BCDF-GHJK',
    verification_uri: `${origin}/auth/oauth/device/verify`,
    verification_uri_complete: `${origin}/auth/oauth/device/verify?user_code=BCDF-GHJK`,
    expires_in: expiresIn,
    interval: 5,
  };
}

const PENDING = () => json({ error: 'authorization_pending' }, 400);
const SLOW_DOWN = () => json({ error: 'slow_down' }, 400);
const TOKEN = (secret: string) => json({ access_token: secret, token_type: 'Bearer', expires_in: 2_592_000 });

interface DaemonScript {
  origin?: string;
  metadata?: Response | Error;
  start?: Response | Error;
  polls?: readonly (Response | Error)[];
  mcpTools?: string[];
}

/**
 * A daemon answering the metadata read, the device start, then the
 * scripted token-endpoint verdicts in order, then the `/mcp` probe the
 * persist path runs. A thrown answer models a dead socket.
 */
function stubDaemon(script: DaemonScript = {}): void {
  const origin = script.origin ?? DAEMON;
  const queue = [...(script.polls ?? [])];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const body = typeof init.body === 'string' ? init.body : '';
      const isForm = headers['content-type']?.includes('x-www-form-urlencoded') ?? false;
      dials.push({
        url,
        method: init.method ?? 'GET',
        headers,
        form: isForm ? Object.fromEntries(new URLSearchParams(body)) : {},
        json: !isForm && body ? JSON.parse(body) : null,
      });
      const answer = ((): Response | Error => {
        if (url === `${origin}/.well-known/oauth-authorization-server`)
          return script.metadata ?? json(metadataFor(origin));
        if (url === `${origin}/auth/oauth/device`) return script.start ?? json(startedFor(origin));
        if (url === `${origin}/auth/oauth/token`) return queue.shift() ?? new Error('unscripted poll');
        if (url === `${origin}/mcp`) {
          const tools = (script.mcpTools ?? ['rules_list']).map((name) => ({ name }));
          return json({ jsonrpc: '2.0', id: 1, result: { tools } });
        }
        return new Error(`unexpected dial ${url}`);
      })();
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  );
}

/** The seams: progress lines kept, sleeps recorded AND applied to the faked clock, the browser open scripted. */
function makeIo(browserOpens = false) {
  const progress: string[] = [];
  const sleeps: number[] = [];
  const opened: string[] = [];
  const io: LoginIo = {
    progress: (line) => progress.push(line),
    sleep: async (ms) => {
      sleeps.push(ms);
      vi.setSystemTime(Date.now() + ms);
    },
    openBrowser: async (url) => {
      opened.push(url);
      return browserOpens;
    },
  };
  return { io, progress, sleeps, opened };
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
  // The clock only: the client's interval squelch reads Date.now(), which the sleep seam advances.
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  dials.length = 0;
  await rm(configDir, { recursive: true, force: true });
});

describe('commandLogin', () => {
  it('reads the metadata, starts the device grant as the cli, prints the link and the code, polls at the interval and saves the minted secret', async () => {
    stubDaemon({ polls: [PENDING(), PENDING(), TOKEN('oh_bound')] });
    const { io, progress, sleeps, opened } = makeIo();
    const lines = await commandLogin(['--daemon', DAEMON, '--label', 'build box'], io);

    const [metadata, start, poll1, , poll3, probe] = dials;
    expect(metadata).toMatchObject({ url: `${DAEMON}/.well-known/oauth-authorization-server`, method: 'GET' });
    expect(start).toMatchObject({
      url: `${DAEMON}/auth/oauth/device`,
      method: 'POST',
      form: { client_id: 'openheaders-cli', device_label: 'build box' },
    });
    expect(poll1).toMatchObject({
      url: `${DAEMON}/auth/oauth/token`,
      method: 'POST',
      form: { grant_type: DEVICE_CODE_GRANT, device_code: 'dev-secret', client_id: 'openheaders-cli' },
    });
    expect(poll3.form).toEqual(poll1.form);
    // The persist path's probe rides the SECRET, never the device code.
    expect(probe).toMatchObject({ url: `${DAEMON}/mcp`, json: { method: 'tools/list' } });
    expect(probe.headers.authorization).toBe('Bearer oh_bound');
    // No Origin on any dial — a native process, the shape the matrix admits clean.
    expect(dials.every((d) => d.headers.origin === undefined)).toBe(true);

    expect(progress).toEqual([
      `! Open ${VERIFY_LINK} in a browser and sign in there`,
      '  The page will ask you to approve code BCDF-GHJK for this command-line tool',
      '  Waiting for you to approve this device…',
    ]);
    expect(opened).toEqual([VERIFY_LINK]);
    expect(sleeps).toEqual([5000, 5000, 5000]);
    expect(lines).toEqual([`signed in — 1 tool(s) at ${DAEMON}`, `saved to ${configFile}`]);
    expect(await savedConfig()).toEqual({ daemonUrl: DAEMON, token: 'oh_bound' });
  });

  it('says so when the browser opened, and honours slow_down by waiting longer from then on', async () => {
    stubDaemon({ polls: [SLOW_DOWN(), PENDING(), TOKEN('oh_slow')] });
    const { io, progress, sleeps } = makeIo(true);
    await commandLogin(['--daemon', DAEMON], io);
    expect(progress[2]).toBe('  Opened it in your browser.');
    expect(sleeps).toEqual([5000, 10000, 10000]);
  });

  it('omits the label when none is given and keeps every other key of cli.json (the merge law)', async () => {
    await seedConfig({
      daemonUrl: 'http://old.openheaders.io:8137',
      token: 'oh_old',
      channel: 'beta',
      telemetry: false,
    });
    stubDaemon({ polls: [TOKEN('oh_new')] });
    const { io } = makeIo();
    await commandLogin(['--daemon', DAEMON], io);
    expect(dials[1].form).toEqual({ client_id: 'openheaders-cli' });
    expect(await savedConfig()).toEqual({ daemonUrl: DAEMON, token: 'oh_new', channel: 'beta', telemetry: false });
  });

  it('defaults the daemon to the configured one, like connect', async () => {
    await seedConfig({ daemonUrl: 'https://team.openheaders.io' });
    stubDaemon({ origin: 'https://team.openheaders.io', polls: [TOKEN('oh_team')] });
    const { io } = makeIo();
    await commandLogin([], io);
    expect(dials[0].url).toBe('https://team.openheaders.io/.well-known/oauth-authorization-server');
    expect(dials[1].url).toBe('https://team.openheaders.io/auth/oauth/device');
    expect(dials.at(-1)?.url).toBe('https://team.openheaders.io/mcp');
  });

  it('a denial on the page is exit 1 with one line and nothing saved', async () => {
    stubDaemon({ polls: [PENDING(), json({ error: 'access_denied' }, 400)] });
    const { io } = makeIo();
    const err = await commandLogin(['--daemon', DAEMON], io).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OperationFailedError);
    expect((err as Error).message).toBe("the sign-in was denied on the server's page");
    expect(exitCodeFor(err)).toBe(EXIT_OPERATION_FAILED);
    expect(await savedConfig()).toBeNull();
  });

  it('an expiry and an unknown device code are exit 1 with their own lines', async () => {
    stubDaemon({ polls: [json({ error: 'expired_token' }, 400)] });
    const { io } = makeIo();
    await expect(commandLogin(['--daemon', DAEMON], io)).rejects.toThrow(
      'the sign-in request expired before it was approved',
    );
    dials.length = 0;
    stubDaemon({ polls: [json({ error: 'invalid_grant' }, 400)] });
    await expect(commandLogin(['--daemon', DAEMON], io)).rejects.toThrow(
      'the server no longer holds this sign-in request — run oh login again',
    );
  });

  it("polls past a transport hiccup at the interval, but not past the grant's own clock", async () => {
    stubDaemon({ polls: [new Error('socket reset'), TOKEN('oh_late')] });
    const { io, sleeps } = makeIo();
    await commandLogin(['--daemon', DAEMON], io);
    expect(sleeps).toEqual([5000, 5000]);

    dials.length = 0;
    stubDaemon({ start: json(startedFor(DAEMON, 1)), polls: [new Error('socket reset')] });
    await expect(commandLogin(['--daemon', DAEMON], io)).rejects.toThrow(
      'the sign-in request expired before it was approved',
    );
  });

  it('types every start refusal on its exit class', async () => {
    const { io } = makeIo();
    const cases: Array<[DaemonScript, unknown, number, string]> = [
      [
        { start: json({ error: 'temporarily_unavailable' }, 503) },
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'too many sign-ins waiting',
      ],
      [
        { start: json({ error: 'too many failed attempts' }, 429) },
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'refusing requests from this machine',
      ],
      [
        { metadata: json({ error: 'forbidden' }, 403) },
        AuthError,
        EXIT_AUTH,
        'refused the sign-in request from this machine',
      ],
      [
        { metadata: new Error('ECONNREFUSED') },
        UnreachableError,
        EXIT_UNREACHABLE,
        'nothing answered at 10.0.0.5:8137',
      ],
      [
        { metadata: new Response('<html>', { status: 200 }) },
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'answered something unexpected',
      ],
      [
        { start: json({ error: 'invalid_client' }, 400) },
        OperationFailedError,
        EXIT_OPERATION_FAILED,
        'answered something unexpected',
      ],
    ];
    for (const [script, klass, code, words] of cases) {
      dials.length = 0;
      stubDaemon(script);
      const err = await commandLogin(['--daemon', DAEMON], io).catch((e: unknown) => e);
      expect(err, words).toBeInstanceOf(klass);
      expect((err as Error).message).toContain(words);
      expect(exitCodeFor(err)).toBe(code);
      // A refused start never polls.
      expect(dials.some((d) => d.url.endsWith('/auth/oauth/token'))).toBe(false);
    }
    expect(await savedConfig()).toBeNull();
  });

  it('refuses a token, a long label, a positional and a non-http daemon as usage errors before dialing', async () => {
    stubDaemon();
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
