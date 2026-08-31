import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildHawkNormalizedString,
  type HawkCredentials,
  type HawkSignInput,
  hawkPayloadHash,
  signHawk,
} from '../../src/auth-signing/index';

/** The scheme's published usage example — the one vector every
 *  implementation reproduces. */
const VECTOR_CREDENTIALS: HawkCredentials = {
  authId: 'dh37fgj492je',
  authKey: 'werxhqb98rpaxn39848xrunpaw3489ruxnpa98w4rxn',
  algorithm: 'sha256',
  ext: 'some-app-ext-data',
};
const VECTOR_INPUT: HawkSignInput = {
  method: 'GET',
  url: 'http://example.com:8000/resource/1?b=1&a=2',
  timestampSec: 1353832234,
  nonce: 'j4h3g2',
};

const CREDENTIALS: HawkCredentials = {
  authId: 'oh-hawk-id',
  authKey: 'oh-hawk-key',
  algorithm: 'sha256',
};

const SIGN_INPUT: HawkSignInput = {
  method: 'GET',
  url: 'https://api.openheaders.io/v1/items?page=2&sort=name',
  timestampSec: 1373131200,
  nonce: 'openheaders-nonce',
};

// ── Independent reference implementation (node:crypto) ─────────────
//
// Re-derives the expected MAC with a from-the-spec implementation that
// shares NO code with the production signer, so an error in the
// WebCrypto path can't self-confirm.

function refPayloadHash(algorithm: 'sha256' | 'sha1', text: string, contentType: string): string {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return createHash(algorithm).update(`hawk.1.payload\n${ct}\n${text}\n`).digest('base64');
}

function refMac(creds: HawkCredentials, input: HawkSignInput): string {
  const url = new URL(input.url);
  const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80';
  const hash =
    input.payload === undefined ? '' : refPayloadHash(creds.algorithm, input.payload.text, input.payload.contentType);
  let normalized =
    `hawk.1.header\n${input.timestampSec}\n${input.nonce}\n${input.method.toUpperCase()}\n` +
    `${url.pathname}${url.search}\n${url.hostname.toLowerCase()}\n${port}\n${hash}\n`;
  if (creds.ext) normalized += creds.ext.replace('\\', '\\\\').replace('\n', '\\n');
  normalized += '\n';
  if (creds.app) normalized += `${creds.app}\n${creds.dlg ?? ''}\n`;
  return createHmac(creds.algorithm, creds.authKey).update(normalized).digest('base64');
}

function headerAttributes(authorization: string): Map<string, string> {
  expect(authorization.startsWith('Hawk ')).toBe(true);
  const out = new Map<string, string>();
  for (const match of authorization.slice('Hawk '.length).matchAll(/(\w+)="((?:[^"\\]|\\.)*)"/g)) {
    out.set(match[1], match[2].replace(/\\(.)/g, '$1'));
  }
  return out;
}

describe('buildHawkNormalizedString', () => {
  it('reproduces the published vector normalized string byte-exact', () => {
    const url = new URL(VECTOR_INPUT.url);
    expect(buildHawkNormalizedString(VECTOR_CREDENTIALS, VECTOR_INPUT, url, '')).toBe(
      'hawk.1.header\n1353832234\nj4h3g2\nGET\n/resource/1?b=1&a=2\nexample.com\n8000\n\nsome-app-ext-data\n',
    );
  });

  it('defaults the port by scheme when the URL elides it', () => {
    const https = buildHawkNormalizedString({}, SIGN_INPUT, new URL('https://api.openheaders.io/x'), '');
    expect(https).toContain('\napi.openheaders.io\n443\n');
    const http = buildHawkNormalizedString({}, SIGN_INPUT, new URL('http://api.openheaders.io/x'), '');
    expect(http).toContain('\napi.openheaders.io\n80\n');
    const pinned = buildHawkNormalizedString({}, SIGN_INPUT, new URL('https://api.openheaders.io:8443/x'), '');
    expect(pinned).toContain('\napi.openheaders.io\n8443\n');
  });

  it('escapes ext first-occurrence-only, replicating the reference implementation', () => {
    const url = new URL('https://api.openheaders.io/x');
    const normalized = buildHawkNormalizedString({ ext: 'a\\b\\c\nd' }, SIGN_INPUT, url, '');
    expect(normalized).toContain('a\\\\b\\c\\nd\n');
  });

  it('appends the app/dlg pair only when app is present', () => {
    const url = new URL('https://api.openheaders.io/x');
    expect(buildHawkNormalizedString({ dlg: 'ignored-without-app' }, SIGN_INPUT, url, '')).not.toContain(
      'ignored-without-app',
    );
    expect(buildHawkNormalizedString({ app: 'oh-app', dlg: 'oh-dlg' }, SIGN_INPUT, url, '')).toMatch(
      /\noh-app\noh-dlg\n$/,
    );
  });
});

describe('hawkPayloadHash', () => {
  it('reproduces the published vector payload hash', async () => {
    expect(await hawkPayloadHash('sha256', { text: 'Thank you for flying Hawk', contentType: 'text/plain' })).toBe(
      'Yi9LfIIFRtBEPt74PVmbTF/xVAwPn7ub15ePICfgnuY=',
    );
  });

  it('normalizes the Content-Type — parameters stripped, lowercased', async () => {
    const bare = await hawkPayloadHash('sha256', { text: '{}', contentType: 'application/json' });
    expect(await hawkPayloadHash('sha256', { text: '{}', contentType: 'Application/JSON; charset=utf-8' })).toBe(bare);
  });
});

describe('signHawk', () => {
  it('reproduces the published vector MAC', async () => {
    const [header] = await signHawk(VECTOR_CREDENTIALS, VECTOR_INPUT);
    expect(header.key).toBe('Authorization');
    const attrs = headerAttributes(header.value);
    expect(attrs.get('id')).toBe('dh37fgj492je');
    expect(attrs.get('ts')).toBe('1353832234');
    expect(attrs.get('nonce')).toBe('j4h3g2');
    expect(attrs.get('ext')).toBe('some-app-ext-data');
    expect(attrs.get('mac')).toBe('6R4rV5iE+NPoym+WwjeHzjAGXUtLNIxmo1vpMofpLAE=');
    expect(attrs.has('hash')).toBe(false);
    expect(attrs.has('app')).toBe(false);
  });

  it('reproduces the published vector MAC with the payload hash', async () => {
    const input: HawkSignInput = {
      ...VECTOR_INPUT,
      method: 'POST',
      payload: { text: 'Thank you for flying Hawk', contentType: 'text/plain' },
    };
    const [header] = await signHawk(VECTOR_CREDENTIALS, input);
    const attrs = headerAttributes(header.value);
    expect(attrs.get('hash')).toBe('Yi9LfIIFRtBEPt74PVmbTF/xVAwPn7ub15ePICfgnuY=');
    expect(attrs.get('mac')).toBe('aSe1DERmZuRl3pI36/9BdZmnErTw3sNzOOAUlfeKjVw=');
  });

  it('matches the independent reference implementation', async () => {
    const [header] = await signHawk(CREDENTIALS, SIGN_INPUT);
    expect(headerAttributes(header.value).get('mac')).toBe(refMac(CREDENTIALS, SIGN_INPUT));
  });

  it('signs with SHA-1 when the credential says so', async () => {
    const creds: HawkCredentials = { ...CREDENTIALS, algorithm: 'sha1' };
    const [header] = await signHawk(creds, SIGN_INPUT);
    expect(headerAttributes(header.value).get('mac')).toBe(refMac(creds, SIGN_INPUT));
  });

  it('folds app/dlg into the MAC and echoes them as attributes', async () => {
    const creds: HawkCredentials = { ...CREDENTIALS, app: 'oh-app-id', dlg: 'oh-delegated-by' };
    const [header] = await signHawk(creds, SIGN_INPUT);
    const attrs = headerAttributes(header.value);
    expect(attrs.get('app')).toBe('oh-app-id');
    expect(attrs.get('dlg')).toBe('oh-delegated-by');
    expect(attrs.get('mac')).toBe(refMac(creds, SIGN_INPUT));
    // The pair changes the MAC — dropping it must not verify.
    expect(attrs.get('mac')).not.toBe(refMac(CREDENTIALS, SIGN_INPUT));
  });

  it('escapes quotes and backslashes in header attributes', async () => {
    const creds: HawkCredentials = { ...CREDENTIALS, ext: 'quoted "ext" with \\slash' };
    const [header] = await signHawk(creds, SIGN_INPUT);
    expect(header.value).toContain('ext="quoted \\"ext\\" with \\\\slash"');
    expect(headerAttributes(header.value).get('mac')).toBe(refMac(creds, SIGN_INPUT));
  });

  it('orders attributes id, ts, nonce, hash, ext, mac, app, dlg', async () => {
    const creds: HawkCredentials = { ...CREDENTIALS, ext: 'x', app: 'a', dlg: 'd' };
    const input: HawkSignInput = { ...SIGN_INPUT, payload: { text: 'body', contentType: 'text/plain' } };
    const [header] = await signHawk(creds, input);
    const keys = [...header.value.slice('Hawk '.length).matchAll(/(\w+)="(?:[^"\\]|\\.)*"/g)].map((m) => m[1]);
    expect(keys).toEqual(['id', 'ts', 'nonce', 'hash', 'ext', 'mac', 'app', 'dlg']);
  });
});
