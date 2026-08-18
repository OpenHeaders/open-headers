/**
 * Body-plane laws (the observability plan §6 capture contract):
 *  - the wire-path tee truncates over its cap, never the wire count;
 *  - bodies resolve to the HAR-body wire shape — UTF-8 as text, binary
 *    as base64, content-encoding decoded lazily at resolve time;
 *  - a truncated encoded capture serves raw base64 (never a corrupt
 *    decode), and the store evicts least-recently-used under its
 *    total-byte bound.
 */

import * as zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BoundedBodyBuffer, ProxyBodyStore } from '../../../src/daemon/proxy/body-store';

function captured(bytes: Buffer, cap = 1024) {
  const tee = new BoundedBodyBuffer(cap);
  tee.push(bytes);
  return tee.snapshot();
}

function retained(store: ProxyBodyStore, id: string, body: Buffer, contentEncoding?: string, cap = 1024): void {
  store.retain(id, 0, {
    method: 'GET',
    url: `https://api.openheaders.io/${id}`,
    startedAtMs: 1000,
    body: captured(body, cap),
    ...(contentEncoding !== undefined ? { contentEncoding } : {}),
  });
}

describe('BoundedBodyBuffer', () => {
  it('retains up to the cap and reports the true wire count', () => {
    const tee = new BoundedBodyBuffer(8);
    tee.push(Buffer.from('12345'));
    tee.push(Buffer.from('67890'));
    const snap = tee.snapshot();
    expect(snap.bytes.toString()).toBe('12345678');
    expect(snap.totalBytes).toBe(10);
    expect(snap.truncated).toBe(true);
  });

  it('is untruncated at or under the cap', () => {
    const tee = new BoundedBodyBuffer(8);
    tee.push(Buffer.from('12345678'));
    const snap = tee.snapshot();
    expect(snap.truncated).toBe(false);
    expect(snap.totalBytes).toBe(8);
  });
});

describe('ProxyBodyStore', () => {
  it('resolves a UTF-8 body as text and a binary body as base64', () => {
    const store = new ProxyBodyStore();
    retained(store, 'text', Buffer.from('{"ok":true}'));
    retained(store, 'binary', Buffer.from([0xff, 0x00, 0xfe, 0x01]));

    expect(store.resolve('text', 0)).toMatchObject({
      method: 'GET',
      url: 'https://api.openheaders.io/text',
      content: '{"ok":true}',
      encoding: '',
    });
    expect(store.resolve('binary', 0)).toMatchObject({
      content: Buffer.from([0xff, 0x00, 0xfe, 0x01]).toString('base64'),
      encoding: 'base64',
    });
    expect(store.resolve('unknown', 0)).toBeNull();
  });

  it('decodes gzip lazily at resolve time', () => {
    const store = new ProxyBodyStore();
    retained(store, 'zipped', zlib.gzipSync(Buffer.from('decoded-payload')), 'gzip');
    expect(store.resolve('zipped', 0)).toMatchObject({ content: 'decoded-payload', encoding: '' });
  });

  it('serves a truncated encoded capture as raw base64 rather than a corrupt decode', () => {
    const store = new ProxyBodyStore();
    const full = zlib.gzipSync(Buffer.from('x'.repeat(4096)));
    retained(store, 'cut', full, 'gzip', 16);
    const resolved = store.resolve('cut', 0);
    expect(resolved?.encoding).toBe('base64');
    expect(resolved?.content).toBe(full.subarray(0, 16).toString('base64'));
  });

  it('evicts least-recently-used bodies under the total-byte bound', () => {
    const store = new ProxyBodyStore(20);
    retained(store, 'a', Buffer.from('aaaaaaaaaa')); // 10 bytes
    retained(store, 'b', Buffer.from('bbbbbbbbbb')); // 10 bytes — at cap
    expect(store.resolve('a', 0)).not.toBeNull(); // touch: a is now the freshest
    retained(store, 'c', Buffer.from('cccccccccc')); // evicts b, not a
    expect(store.resolve('b', 0)).toBeNull();
    expect(store.resolve('a', 0)).not.toBeNull();
    expect(store.resolve('c', 0)).not.toBeNull();
  });

  it('never retains a single body over the whole store bound', () => {
    const store = new ProxyBodyStore(8);
    retained(store, 'big', Buffer.from('123456789'));
    expect(store.resolve('big', 0)).toBeNull();
  });
});
