/**
 * The shared redirect policy — the fetch spec's derivation both loops
 * apply (the node follower over its wire hops, the delegating
 * transport over its place exchanges): which statuses redirect and
 * which answers are final, the ceiling's sentence, the method/body
 * demotion by status and its knob, the cross-origin Authorization
 * strip and its knob, relative `Location`s against the current hop,
 * an invalid `Location` refused, and the hop record the snapshot
 * carries.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_REDIRECTS,
  nextRedirectHop,
  REDIRECT_STATUSES,
  type RedirectHop,
  redirectHopRecord,
  redirectLimitError,
  redirectLocation,
} from '../../../src/live/request-exec/redirect-policy';
import { TransportError } from '../../../src/live/request-exec/transport';

const POST: RedirectHop = {
  url: 'https://api.openheaders.io/login',
  method: 'POST',
  headers: [
    { key: 'Authorization', value: 'Bearer t' },
    { key: 'Content-Type', value: 'application/json' },
    { key: 'X-Trace', value: '1' },
  ],
  body: { kind: 'raw', content: '{}' },
};

describe('redirectLocation', () => {
  it('names the Location of a redirecting status and nothing else', () => {
    expect(REDIRECT_STATUSES.has(302)).toBe(true);
    expect(DEFAULT_MAX_REDIRECTS).toBe(20);
    expect(redirectLocation(302, [{ key: 'Location', value: '/me' }])).toBe('/me');
    expect(redirectLocation(308, [{ key: 'location', value: 'https://x.openheaders.io/' }])).toBe(
      'https://x.openheaders.io/',
    );
    // A 3xx without a Location, and 304, are final answers.
    expect(redirectLocation(302, [])).toBeNull();
    expect(redirectLocation(304, [{ key: 'location', value: '/x' }])).toBeNull();
    expect(redirectLocation(200, [{ key: 'location', value: '/x' }])).toBeNull();
  });
});

describe('nextRedirectHop', () => {
  it('demotes 301/302 POST and 303 non-GET to GET, dropping the body and its headers', () => {
    for (const status of [301, 302, 303]) {
      const next = nextRedirectHop(POST, status, '/me', {});
      expect(next.methodChangedTo).toBe('GET');
      expect(next.hop).toEqual({
        url: 'https://api.openheaders.io/me',
        method: 'GET',
        headers: [
          { key: 'Authorization', value: 'Bearer t' },
          { key: 'X-Trace', value: '1' },
        ],
        body: { kind: 'none' },
      });
    }
    // 303 demotes any non-GET/HEAD; 301/302 only POST.
    expect(nextRedirectHop({ ...POST, method: 'PUT' }, 303, '/me', {}).hop.method).toBe('GET');
    expect(nextRedirectHop({ ...POST, method: 'PUT' }, 302, '/me', {}).hop.method).toBe('PUT');
    expect(nextRedirectHop({ ...POST, method: 'HEAD' }, 303, '/me', {}).methodChangedTo).toBeUndefined();
  });

  it('keeps the method and body on 307/308, and on every status under followOriginalHttpMethod', () => {
    for (const status of [307, 308]) {
      const next = nextRedirectHop(POST, status, '/me', {});
      expect(next.methodChangedTo).toBeUndefined();
      expect(next.hop.method).toBe('POST');
      expect(next.hop.body).toEqual(POST.body);
    }
    const kept = nextRedirectHop(POST, 302, '/me', { followOriginalHttpMethod: true });
    expect(kept.methodChangedTo).toBeUndefined();
    expect(kept.hop.headers).toEqual(POST.headers);
  });

  it('strips Authorization across origins unless the knob forwards it, and keeps it within the origin', () => {
    const stripped = nextRedirectHop(POST, 307, 'https://other.openheaders.io/me', {});
    expect(stripped.authorization).toBe('stripped');
    expect(stripped.hop.headers.some((h) => h.key === 'Authorization')).toBe(false);
    const forwarded = nextRedirectHop(POST, 307, 'https://other.openheaders.io/me', {
      followAuthorizationHeader: true,
    });
    expect(forwarded.authorization).toBe('forwarded');
    expect(forwarded.hop.headers.some((h) => h.key === 'Authorization')).toBe(true);
    const same = nextRedirectHop(POST, 307, '/me', {});
    expect(same.authorization).toBeUndefined();
    // No Authorization carried — nothing to report either way.
    expect(
      nextRedirectHop({ ...POST, headers: [] }, 307, 'https://other.openheaders.io/', {}).authorization,
    ).toBeUndefined();
  });

  it('resolves a relative Location against the current hop and refuses an invalid one', () => {
    expect(nextRedirectHop(POST, 307, '../v2/me?x=1', {}).hop.url).toBe('https://api.openheaders.io/v2/me?x=1');
    expect(() => nextRedirectHop(POST, 307, 'http://[bad', {})).toThrow(TransportError);
    expect(() => nextRedirectHop(POST, 307, 'http://[bad', {})).toThrow('Redirect points to an invalid URL');
  });
});

describe('redirectHopRecord and redirectLimitError', () => {
  it('records what was sent, what came back and what the derivation did', () => {
    const next = nextRedirectHop(POST, 302, 'https://other.openheaders.io/me', {});
    expect(redirectHopRecord(POST, 302, 'Found', 'https://other.openheaders.io/me', next)).toEqual({
      url: POST.url,
      method: 'POST',
      status: 302,
      statusText: 'Found',
      location: 'https://other.openheaders.io/me',
      methodChangedTo: 'GET',
      authorization: 'stripped',
    });
    const plain = nextRedirectHop(POST, 307, '/me', {});
    expect(redirectHopRecord(POST, 307, 'Temporary Redirect', '/me', plain)).toEqual({
      url: POST.url,
      method: 'POST',
      status: 307,
      statusText: 'Temporary Redirect',
      location: '/me',
    });
    expect(redirectLimitError(0).message).toBe("Stopped after 0 redirects — the request's redirect limit.");
  });
});
