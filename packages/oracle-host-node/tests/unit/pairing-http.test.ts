/**
 * Coverage for the daemon pairing HTTP surface (U3.3) — focused on the
 * A2 content-negotiated JSON representation of `POST /pair/<code>/confirm`
 * that the extension's in-app code-entry flow drives.
 *
 * The HTML path stays the default (a browser form POST, no
 * `application/json` in `Accept`); a client that asks for JSON gets the
 * same one-shot `confirm()` as a machine-readable body. Both ride the
 * real {@link createDaemonPairingService} + {@link mintDaemonAuthToken}
 * path through the in-memory `HostStorage` fake — no fork of the mint.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import {
  createDaemonPairingService,
  type DaemonPairingService,
  listDaemonAuthTokens,
} from '@openheaders/core/identity';
import { setHostStorage } from '@openheaders/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPairingHttpHandler } from '../../src/host-runtime/pairing-http';
import { createHostStorageFake } from './_host-storage-fake';

function makeReq(opts: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}): IncomingMessage {
  const req = Readable.from([Buffer.from(opts.body ?? '')]) as unknown as IncomingMessage;
  req.method = opts.method;
  req.url = opts.url;
  req.headers = opts.headers ?? {};
  return req;
}

interface CapturedRes {
  res: ServerResponse;
  done: Promise<void>;
  status(): number;
  header(name: string): string | undefined;
  body(): string;
}

function makeRes(): CapturedRes {
  const headers: Record<string, string> = {};
  let body = '';
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  const res = {
    statusCode: 0,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      if (chunk) body += chunk;
      resolveDone();
    },
  } as unknown as ServerResponse;
  return {
    res,
    done,
    status: () => res.statusCode,
    header: (name) => headers[name.toLowerCase()],
    body: () => body,
  };
}

const JSON_HEADERS = { accept: 'application/json', 'content-type': 'application/json' };

describe('pairing HTTP confirm — JSON content negotiation (A2)', () => {
  let pairing: DaemonPairingService;

  beforeEach(() => {
    setHostStorage(createHostStorageFake());
    pairing = createDaemonPairingService({ generateCode: () => '424242' });
  });

  it('returns the minted secret + tokenId as JSON when Accept: application/json', async () => {
    pairing.startPair({ deviceLabel: 'seed' });
    const handler = createPairingHttpHandler({ pairing });
    const cap = makeRes();
    const owned = handler(
      makeReq({ method: 'POST', url: '/pair/424242/confirm', headers: JSON_HEADERS, body: '{}' }),
      cap.res,
    );
    expect(owned).toBe(true);
    await cap.done;
    expect(cap.status()).toBe(200);
    expect(cap.header('content-type')).toContain('application/json');
    expect(cap.header('cache-control')).toBe('no-store');
    const parsed = JSON.parse(cap.body());
    expect(parsed.ok).toBe(true);
    expect(parsed.secret).toMatch(/^oh_/);
    expect(parsed.tokenId).toMatch(/^[0-9a-f-]+$/i);
  });

  it('reads deviceLabel from a JSON body and records it on the token', async () => {
    pairing.startPair({ deviceLabel: 'seed' });
    const handler = createPairingHttpHandler({ pairing });
    const cap = makeRes();
    handler(
      makeReq({
        method: 'POST',
        url: '/pair/424242/confirm',
        headers: JSON_HEADERS,
        body: JSON.stringify({ deviceLabel: 'Work Chrome' }),
      }),
      cap.res,
    );
    await cap.done;
    const tokens = await listDaemonAuthTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].label).toBe('Work Chrome');
  });

  it('answers an unknown code with {ok:false, reason:unknown} + 404', async () => {
    const handler = createPairingHttpHandler({ pairing });
    const cap = makeRes();
    handler(makeReq({ method: 'POST', url: '/pair/999999/confirm', headers: JSON_HEADERS, body: '{}' }), cap.res);
    await cap.done;
    expect(cap.status()).toBe(404);
    expect(JSON.parse(cap.body())).toEqual({ ok: false, reason: 'unknown' });
  });

  it('answers a second confirm with {ok:false, reason:consumed} + 410', async () => {
    pairing.startPair({});
    const handler = createPairingHttpHandler({ pairing });
    const first = makeRes();
    handler(makeReq({ method: 'POST', url: '/pair/424242/confirm', headers: JSON_HEADERS, body: '{}' }), first.res);
    await first.done;
    expect(JSON.parse(first.body()).ok).toBe(true);

    const second = makeRes();
    handler(makeReq({ method: 'POST', url: '/pair/424242/confirm', headers: JSON_HEADERS, body: '{}' }), second.res);
    await second.done;
    expect(second.status()).toBe(410);
    expect(JSON.parse(second.body())).toEqual({ ok: false, reason: 'consumed' });
  });

  it('still renders HTML when Accept lacks application/json (browser form POST)', async () => {
    pairing.startPair({});
    const handler = createPairingHttpHandler({ pairing });
    const cap = makeRes();
    handler(
      makeReq({
        method: 'POST',
        url: '/pair/424242/confirm',
        headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' },
        body: 'deviceLabel=form-label',
      }),
      cap.res,
    );
    await cap.done;
    expect(cap.status()).toBe(200);
    expect(cap.header('content-type')).toContain('text/html');
    expect(cap.body()).toContain('Paired successfully');
  });
});
