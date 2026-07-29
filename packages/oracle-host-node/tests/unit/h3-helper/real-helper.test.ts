/**
 * The protocol twins against the REAL Rust helper — gated on
 * `OPENHEADERS_H3_HELPER` (the h3-helper CI workflow builds the crate
 * and points this here; locally the live-pass recipe's export does the
 * same). Serverless legs only: completing any exchange proves the
 * HELLO handshake and protocol int matched (a mismatch tears the
 * client down with `helper-protocol-mismatch`), a cleartext target
 * walks the helper's deterministic https-only `bad-request` path
 * (driven below the transport's own pre-wire guard), and a dial nothing
 * answers comes back as a wire-phase closed-set code — real framing in
 * both directions, no QUIC server needed.
 */

import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createH3HelperClient,
  type H3HelperClient,
  type H3HelperFailure,
  type H3ResponseHandlers,
} from '../../../src/live/h3-helper/helper-process';
import type { H3RequestHead } from '../../../src/live/h3-helper/protocol';

const REAL_HELPER = process.env.OPENHEADERS_H3_HELPER;
const helperPresent = REAL_HELPER !== undefined && REAL_HELPER !== '' && existsSync(REAL_HELPER);

/** Wire-phase codes a dial nobody answers may legitimately land on —
 *  refused (ICMP unreachable surfaces fast on loopback) or the QUIC
 *  silence timeout; both name a real quinn failure, never a
 *  client-minted `helper-*` code. */
const DEAD_DIAL_CODES = ['connect-refused', 'connect-timeout', 'quic-transport'];

function makeHead(overrides: Partial<H3RequestHead> = {}): H3RequestHead {
  return {
    url: 'https://127.0.0.1:9/',
    method: 'GET',
    headers: [],
    bodyBytes: 0,
    insecure: true,
    ...overrides,
  };
}

function awaitError(client: H3HelperClient, head: H3RequestHead): Promise<H3HelperFailure> {
  return new Promise<H3HelperFailure>((resolve, reject) => {
    const handlers: H3ResponseHandlers = {
      onHead: () => reject(new Error('unexpected RESPONSE_HEAD')),
      onBody: () => reject(new Error('unexpected RESPONSE_BODY')),
      onTrailers: () => reject(new Error('unexpected RESPONSE_TRAILERS')),
      onEnd: () => reject(new Error('unexpected RESPONSE_END')),
      onError: resolve,
    };
    client.request(head, undefined, handlers);
  });
}

describe.skipIf(!helperPresent)('real helper twins', () => {
  let client: H3HelperClient | undefined;

  afterEach(() => {
    client?.dispose();
    client = undefined;
  });

  it('answers a cleartext target with the https-only bad-request ERROR frame', async () => {
    client = createH3HelperClient({ binaryPath: REAL_HELPER as string });
    const error = await awaitError(client, makeHead({ url: 'http://127.0.0.1:9/' }));
    expect(error.code).toBe('bad-request');
  });

  it('classifies a dial nothing answers with a wire-phase closed-set code', async () => {
    client = createH3HelperClient({ binaryPath: REAL_HELPER as string });
    const error = await awaitError(client, makeHead({ idleTimeoutMs: 2000 }));
    expect(DEAD_DIAL_CODES).toContain(error.code);
  }, 15000);

  it('multiplexes both legs over the one long-lived process', async () => {
    client = createH3HelperClient({ binaryPath: REAL_HELPER as string });
    const [badRequest, deadDial] = await Promise.all([
      awaitError(client, makeHead({ url: 'http://127.0.0.1:9/' })),
      awaitError(client, makeHead({ idleTimeoutMs: 2000 })),
    ]);
    expect(badRequest.code).toBe('bad-request');
    expect(DEAD_DIAL_CODES).toContain(deadDial.code);
  }, 15000);
});
