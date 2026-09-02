/**
 * `oh request authorize` — the one two-call command: the request
 * resolves by name, `requests_authorize` runs, and a device grant
 * prints the gh-shaped code + URL then polls `requests_authorize_status`
 * at the provider's interval (re-read from every pending answer) until
 * the flow settles; an immediate grant prints at once; every refusal,
 * denial, expiry and failure is the exit-1 class carrying the payload
 * under `--json`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type AuthorizeIo, commandRequestAuthorize } from '../../src/commands';
import { EXIT_OPERATION_FAILED, exitCodeFor, OperationFailedError } from '../../src/exit-codes';

const ARGV = ['--daemon', 'http://127.0.0.1:8137', '--token', 'oh_secret'];

interface Call {
  name: string;
  args: Record<string, unknown>;
}

const calls: Call[] = [];

function toolResult(payload: unknown): Response {
  return Response.json({
    jsonrpc: '2.0',
    id: 1,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  });
}

/** Answers `requests_list` with the one request, then the scripted
 *  authorize / status payloads in order. */
function stubDaemon(script: readonly unknown[]): void {
  const queue = [...script];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { params: { name: string; arguments: Record<string, unknown> } };
      calls.push({ name: body.params.name, args: body.params.arguments });
      if (body.params.name === 'requests_list') {
        return toolResult({ requests: [{ uid: 'req-1', name: 'Device login' }] });
      }
      const next = queue.shift();
      if (next === undefined) throw new Error(`unscripted call ${body.params.name}`);
      return toolResult(next);
    }),
  );
}

function makeIo() {
  const progress: string[] = [];
  const sleeps: number[] = [];
  const io: AuthorizeIo = {
    progress: (line) => progress.push(line),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { io, progress, sleeps };
}

const PENDING = (intervalSeconds: number) => ({
  state: 'pending',
  approval: {
    userCode: 'OHDC-1234',
    verificationUri: 'https://auth.openheaders.io/activate',
    intervalSeconds,
    expiresAt: 1,
  },
  startedAt: 0,
});

const STARTED = {
  request: { uid: 'req-1', name: 'Device login' },
  credentialRef: 'cred-1',
  flow: 'device-code',
  outcome: 'pending',
  state: PENDING(5),
};

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});

describe('commandRequestAuthorize', () => {
  it('prints the code and the URL, polls at the interval, and reports the grant', async () => {
    stubDaemon([
      STARTED,
      { state: PENDING(5) },
      { state: PENDING(10) },
      { state: { state: 'granted', grantedAt: 1 }, token: { expiresAt: 3_600_000, hasRefreshToken: true } },
    ]);
    const { io, progress, sleeps } = makeIo();
    const lines = await commandRequestAuthorize(['Device login', ...ARGV], io);
    expect(calls.map((c) => c.name)).toEqual([
      'requests_list',
      'requests_authorize',
      'requests_authorize_status',
      'requests_authorize_status',
      'requests_authorize_status',
    ]);
    expect(calls[1].args).toEqual({ uid: 'req-1' });
    expect(progress).toEqual([
      '! First copy your one-time code: OHDC-1234',
      '  Open https://auth.openheaders.io/activate in a browser and enter it',
      '  Waiting for you to approve…',
    ]);
    // The cadence follows every pending answer's interval (slow_down grew it).
    expect(sleeps).toEqual([5000, 5000, 10_000]);
    expect(lines).toEqual(['token acquired for Device login (req-1) · device-code']);
  });

  it('opens the complete verification URI when the provider offers one', async () => {
    const complete = {
      ...STARTED,
      state: {
        ...PENDING(1),
        approval: { ...PENDING(1).approval, verificationUriComplete: 'https://auth.openheaders.io/activate?c=1' },
      },
    };
    stubDaemon([complete, { state: { state: 'granted', grantedAt: 1 }, token: null }]);
    const { io, progress } = makeIo();
    await commandRequestAuthorize(['req-1', ...ARGV], io);
    expect(progress[1]).toBe('  Open https://auth.openheaders.io/activate?c=1 in a browser and enter it');
  });

  it('an immediate grant prints at once with the expiry and the refresh-token fact', async () => {
    stubDaemon([
      {
        request: { uid: 'req-1', name: 'Device login' },
        flow: 'client-credentials',
        outcome: 'granted',
        token: { tokenType: 'Bearer', expiresAt: 0, scope: '', hasRefreshToken: false },
      },
    ]);
    const { io, progress, sleeps } = makeIo();
    const lines = await commandRequestAuthorize(['req-1', ...ARGV], io);
    expect(lines).toEqual([
      'token acquired for Device login (req-1) · client-credentials · expires 1970-01-01T00:00:00.000Z · refresh token: no',
    ]);
    expect(progress).toEqual([]);
    expect(sleeps).toEqual([]);
  });

  it('a denial is the exit-1 class with the provider words, carrying the payload under --json', async () => {
    stubDaemon([STARTED, { state: { state: 'denied', message: 'access_denied: declined' } }]);
    const { io } = makeIo();
    const err = await commandRequestAuthorize(['req-1', '--json', ...ARGV], io).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OperationFailedError);
    expect((err as Error).message).toBe('authorization denied — access_denied: declined');
    expect(exitCodeFor(err)).toBe(EXIT_OPERATION_FAILED);
    expect((err as OperationFailedError).stdout).toEqual([
      JSON.stringify({ state: { state: 'denied', message: 'access_denied: declined' } }),
    ]);
  });

  it('a refused start (the code grant) and an expiry are exit-1 too', async () => {
    stubDaemon([{ request: { uid: 'req-1', name: 'Device login' }, outcome: 'refused', error: 'needs a browser' }]);
    const { io } = makeIo();
    await expect(commandRequestAuthorize(['req-1', ...ARGV], io)).rejects.toThrow(
      'authorization refused — needs a browser',
    );
    calls.length = 0;
    stubDaemon([STARTED, { state: { state: 'expired', message: 'expired_token' } }]);
    await expect(commandRequestAuthorize(['req-1', ...ARGV], io)).rejects.toThrow(
      'authorization expired — expired_token',
    );
  });

  it('--json returns the final status payload verbatim on a grant', async () => {
    const granted = { state: { state: 'granted', grantedAt: 1 }, token: null };
    stubDaemon([STARTED, granted]);
    const { io } = makeIo();
    expect(await commandRequestAuthorize(['req-1', '--json', ...ARGV], io)).toEqual([JSON.stringify(granted)]);
  });

  it('needs exactly one target', async () => {
    const { io } = makeIo();
    await expect(commandRequestAuthorize([...ARGV], io)).rejects.toThrow(/usage: oh request authorize/);
    await expect(commandRequestAuthorize(['a', 'b', ...ARGV], io)).rejects.toThrow(/usage: oh request authorize/);
  });
});
