import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildDigestAuthorization,
  type DigestChallenge,
  DigestError,
  type DigestHashFn,
  parseDigestChallenges,
  selectDigestChallenge,
} from '../../src/auth-signing/index';

const md5: DigestHashFn = (text) => createHash('md5').update(text, 'utf8').digest('hex');

/** node:crypto SHA-256 — independent of the module's WebCrypto path. */
function refSha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ── RFC 7616 §3.9.1 example ─────────────────────────────────────────

const RFC_NONCE = '7ypf/xlj9XXwfDPEoM4URrv/xwf94BcCAzFZH4GiTo0v';
const RFC_OPAQUE = 'FQhe/qaU925kfnzjCev0ciny7QMkPqMAFRtzCUYo5tdS';
const RFC_CNONCE = 'f2/wE4q74E6zIJEtWaHKaf5wv/H5QzzpXusqGemxURZJ';

const RFC_HEADER =
  `Digest realm="http-auth@example.org", qop="auth, auth-int", algorithm=SHA-256, ` +
  `nonce="${RFC_NONCE}", opaque="${RFC_OPAQUE}", ` +
  `Digest realm="http-auth@example.org", qop="auth, auth-int", algorithm=MD5, ` +
  `nonce="${RFC_NONCE}", opaque="${RFC_OPAQUE}"`;

const RFC_CREDENTIALS = { username: 'Mufasa', password: 'Circle of Life' };
const RFC_INPUT = { method: 'GET', uri: '/dir/index.html', cnonce: RFC_CNONCE, nonceCount: 1 };

function paramOf(header: string, name: string): string | undefined {
  const quoted = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`).exec(header);
  if (quoted) return quoted[1].replace(/\\(.)/g, '$1');
  const bare = new RegExp(`${name}=([^",\\s]+)`).exec(header);
  return bare?.[1];
}

describe('parseDigestChallenges', () => {
  it('parses both RFC 7616 example challenges out of one header value', () => {
    const challenges = parseDigestChallenges(RFC_HEADER);
    expect(challenges).toHaveLength(2);
    expect(challenges[0]).toEqual({
      realm: 'http-auth@example.org',
      nonce: RFC_NONCE,
      algorithm: 'SHA-256',
      qops: ['auth', 'auth-int'],
      opaque: RFC_OPAQUE,
      userhash: false,
      stale: false,
    });
    expect(challenges[1].algorithm).toBe('MD5');
  });

  it('skips non-Digest schemes and challenges missing realm or nonce', () => {
    const challenges = parseDigestChallenges(
      'Basic realm="files.openheaders.io", Digest nonce="abc", Digest realm="api.openheaders.io", nonce="xyz"',
    );
    expect(challenges).toHaveLength(1);
    expect(challenges[0].realm).toBe('api.openheaders.io');
    expect(challenges[0].nonce).toBe('xyz');
  });

  it('defaults an absent algorithm to MD5 and drops unrecognized algorithms', () => {
    const challenges = parseDigestChallenges(
      'Digest realm="a", nonce="n1", Digest realm="b", nonce="n2", algorithm=SHA-512-256',
    );
    expect(challenges).toHaveLength(1);
    expect(challenges[0].algorithm).toBe('MD5');
  });

  it('reads userhash and stale flags and unescapes quoted strings', () => {
    const [c] = parseDigestChallenges(
      'Digest realm="say \\"hi\\"", nonce="n", userhash=true, stale=TRUE, algorithm=SHA-256-sess',
    );
    expect(c.realm).toBe('say "hi"');
    expect(c.userhash).toBe(true);
    expect(c.stale).toBe(true);
    expect(c.algorithm).toBe('SHA-256-sess');
  });

  it('ignores unknown qop tokens and keeps recognized ones in offer order', () => {
    const [c] = parseDigestChallenges('Digest realm="r", nonce="n", qop="auth-int, token68ish, auth"');
    expect(c.qops).toEqual(['auth-int', 'auth']);
  });
});

describe('selectDigestChallenge', () => {
  const sha: DigestChallenge = {
    realm: 'r',
    nonce: 'n',
    algorithm: 'SHA-256',
    qops: [],
    userhash: false,
    stale: false,
  };
  const md5c: DigestChallenge = { ...sha, algorithm: 'MD5' };

  it('honors server preference order when everything is computable', () => {
    expect(selectDigestChallenge([md5c, sha], { md5Available: true })).toBe(md5c);
  });

  it('skips MD5 challenges when no MD5 primitive is available', () => {
    expect(selectDigestChallenge([md5c, sha], { md5Available: false })).toBe(sha);
    expect(selectDigestChallenge([md5c], { md5Available: false })).toBeNull();
  });
});

describe('buildDigestAuthorization', () => {
  it('reproduces the RFC 7616 §3.9.1 SHA-256 response', async () => {
    const [sha256Challenge] = parseDigestChallenges(RFC_HEADER);
    const header = await buildDigestAuthorization(RFC_CREDENTIALS, sha256Challenge, RFC_INPUT);
    expect(paramOf(header, 'response')).toBe('753927fa0e85d155564e2e272a28d1802ca10daf4496794697cf8db5856cb6c1');
    expect(header.startsWith('Digest ')).toBe(true);
    expect(paramOf(header, 'username')).toBe('Mufasa');
    expect(paramOf(header, 'realm')).toBe('http-auth@example.org');
    expect(paramOf(header, 'uri')).toBe('/dir/index.html');
    expect(paramOf(header, 'algorithm')).toBe('SHA-256');
    expect(paramOf(header, 'qop')).toBe('auth');
    expect(paramOf(header, 'nc')).toBe('00000001');
    expect(paramOf(header, 'cnonce')).toBe(RFC_CNONCE);
    expect(paramOf(header, 'opaque')).toBe(RFC_OPAQUE);
  });

  it('reproduces the RFC 7616 §3.9.1 MD5 response', async () => {
    const [, md5Challenge] = parseDigestChallenges(RFC_HEADER);
    const header = await buildDigestAuthorization(RFC_CREDENTIALS, md5Challenge, RFC_INPUT, md5);
    expect(paramOf(header, 'response')).toBe('8ca523f5e9506fed4657c9700eebdbec');
    expect(paramOf(header, 'algorithm')).toBe('MD5');
  });

  it('computes auth-int over the entity body when auth is not offered', async () => {
    const challenge: DigestChallenge = {
      realm: 'api.openheaders.io',
      nonce: 'nonce-1',
      algorithm: 'SHA-256',
      qops: ['auth-int'],
      userhash: false,
      stale: false,
    };
    const body = '{"probe":true}';
    const input = { method: 'POST', uri: '/v1/things?x=1', cnonce: 'cnonce-1', nonceCount: 1, body };
    const header = await buildDigestAuthorization({ username: 'u', password: 'p' }, challenge, input);
    const ha1 = refSha256('u:api.openheaders.io:p');
    const ha2 = refSha256(`POST:/v1/things?x=1:${refSha256(body)}`);
    const expected = refSha256(`${ha1}:nonce-1:00000001:cnonce-1:auth-int:${ha2}`);
    expect(paramOf(header, 'response')).toBe(expected);
    expect(paramOf(header, 'qop')).toBe('auth-int');
  });

  it('falls back to the RFC 2069 computation when the server offers no qop', async () => {
    const challenge: DigestChallenge = {
      realm: 'device.openheaders.io',
      nonce: 'legacy-nonce',
      algorithm: 'MD5',
      qops: [],
      userhash: false,
      stale: false,
    };
    const header = await buildDigestAuthorization(
      { username: 'admin', password: 'pw' },
      challenge,
      { method: 'GET', uri: '/status', cnonce: 'unused', nonceCount: 1 },
      md5,
    );
    const ref = (t: string) => createHash('md5').update(t, 'utf8').digest('hex');
    const expected = ref(`${ref('admin:device.openheaders.io:pw')}:legacy-nonce:${ref('GET:/status')}`);
    expect(paramOf(header, 'response')).toBe(expected);
    expect(header).not.toContain('qop=');
    expect(header).not.toContain('nc=');
  });

  it('folds nonce + cnonce into A1 for -sess algorithms', async () => {
    const challenge: DigestChallenge = {
      realm: 'r',
      nonce: 'n',
      algorithm: 'SHA-256-sess',
      qops: ['auth'],
      userhash: false,
      stale: false,
    };
    const header = await buildDigestAuthorization({ username: 'u', password: 'p' }, challenge, {
      method: 'GET',
      uri: '/',
      cnonce: 'c',
      nonceCount: 1,
    });
    const ha1 = refSha256(`${refSha256('u:r:p')}:n:c`);
    const expected = refSha256(`${ha1}:n:00000001:c:auth:${refSha256('GET:/')}`);
    expect(paramOf(header, 'response')).toBe(expected);
  });

  it('hashes the username when the challenge demands userhash', async () => {
    const challenge: DigestChallenge = {
      realm: 'api.openheaders.io',
      nonce: 'n',
      algorithm: 'SHA-256',
      qops: ['auth'],
      userhash: true,
      stale: false,
    };
    const header = await buildDigestAuthorization({ username: 'Jäsøn Doe', password: 'Secret, or not' }, challenge, {
      method: 'GET',
      uri: '/doe.json',
      cnonce: 'c',
      nonceCount: 1,
    });
    expect(paramOf(header, 'username')).toBe(refSha256('Jäsøn Doe:api.openheaders.io'));
    expect(header).toContain('userhash=true');
  });

  it('escapes quotes and backslashes in quoted parameter values', async () => {
    const challenge: DigestChallenge = {
      realm: 'r',
      nonce: 'n',
      algorithm: 'SHA-256',
      qops: ['auth'],
      userhash: false,
      stale: false,
    };
    const header = await buildDigestAuthorization({ username: 'user"back\\slash', password: 'p' }, challenge, {
      method: 'GET',
      uri: '/',
      cnonce: 'c',
      nonceCount: 1,
    });
    expect(header).toContain('username="user\\"back\\\\slash"');
    expect(paramOf(header, 'username')).toBe('user"back\\slash');
  });

  it('throws when only auth-int is offered and the body bytes are not knowable', async () => {
    const challenge: DigestChallenge = {
      realm: 'r',
      nonce: 'n',
      algorithm: 'SHA-256',
      qops: ['auth-int'],
      userhash: false,
      stale: false,
    };
    await expect(
      buildDigestAuthorization({ username: 'u', password: 'p' }, challenge, {
        method: 'POST',
        uri: '/',
        cnonce: 'c',
        nonceCount: 1,
      }),
    ).rejects.toThrow(DigestError);
  });

  it('throws when an MD5 challenge is answered without an MD5 primitive', async () => {
    const challenge: DigestChallenge = {
      realm: 'r',
      nonce: 'n',
      algorithm: 'MD5',
      qops: ['auth'],
      userhash: false,
      stale: false,
    };
    await expect(
      buildDigestAuthorization({ username: 'u', password: 'p' }, challenge, {
        method: 'GET',
        uri: '/',
        cnonce: 'c',
        nonceCount: 1,
      }),
    ).rejects.toThrow(DigestError);
  });
});
