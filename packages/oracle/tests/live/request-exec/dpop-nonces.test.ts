/**
 * The per-origin DPoP nonce cache — keyed by origin, the latest nonce
 * wins, an absent nonce is a no-op, an unparseable URL is ignored.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { __resetDpopNoncesForTests, dpopNonceFor, rememberDpopNonce } from '../../../src/live/request-exec/dpop-nonces';

describe('dpop nonces', () => {
  beforeEach(() => __resetDpopNoncesForTests());

  it('remembers per origin, not per URL, and the latest wins', () => {
    rememberDpopNonce('https://api.openheaders.io/v1/items?x=1', 'n-1');
    expect(dpopNonceFor('https://api.openheaders.io/v1/other')).toBe('n-1');
    expect(dpopNonceFor('https://auth.openheaders.io/token')).toBeUndefined();
    rememberDpopNonce('https://api.openheaders.io/', 'n-2');
    expect(dpopNonceFor('https://api.openheaders.io/v1/items')).toBe('n-2');
  });

  it('an absent nonce leaves the cache alone; a bad URL is ignored', () => {
    rememberDpopNonce('https://api.openheaders.io/', 'n-1');
    rememberDpopNonce('https://api.openheaders.io/', undefined);
    expect(dpopNonceFor('https://api.openheaders.io/')).toBe('n-1');
    rememberDpopNonce('not a url', 'n-9');
    expect(dpopNonceFor('not a url')).toBeUndefined();
  });
});
