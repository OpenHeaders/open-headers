/**
 * The one-string server address the wizard takes — pins the shapes an
 * administrator hands a person and the canonical socket URL each one
 * becomes, plus the refusals.
 */

import { describe, expect, it } from 'vitest';
import { parseBackendAddress } from '../../src/identity';

describe('parseBackendAddress', () => {
  it('a bare host or host:port dials plain ws, a bare host on the default port', () => {
    expect(parseBackendAddress('192.168.1.20')).toBe('ws://192.168.1.20:8137');
    expect(parseBackendAddress('oh.openheaders.io:19337')).toBe('ws://oh.openheaders.io:19337');
    expect(parseBackendAddress('  localhost:8137  ')).toBe('ws://localhost:8137');
    // A dial address, not a bind: a proxied server on 443 or 80 is legitimate.
    expect(parseBackendAddress('oh.openheaders.io:443')).toBe('ws://oh.openheaders.io:443');
  });

  it('IPv6 literals are bracketed, bare or already bracketed', () => {
    expect(parseBackendAddress('::1')).toBe('ws://[::1]:8137');
    expect(parseBackendAddress('[fe80::1]:9000')).toBe('ws://[fe80::1]:9000');
  });

  it('http and ws map to ws, https and wss to wss; a typed scheme keeps its own default port', () => {
    expect(parseBackendAddress('http://192.168.1.20:8137/')).toBe('ws://192.168.1.20:8137');
    expect(parseBackendAddress('ws://192.168.1.20:8137')).toBe('ws://192.168.1.20:8137');
    expect(parseBackendAddress('https://oh.openheaders.io')).toBe('wss://oh.openheaders.io');
    expect(parseBackendAddress('wss://oh.openheaders.io:8443')).toBe('wss://oh.openheaders.io:8443');
    expect(parseBackendAddress('http://oh.openheaders.io')).toBe('ws://oh.openheaders.io');
  });

  it('a path, query or fragment is dropped and the host is lowercased', () => {
    expect(parseBackendAddress('https://OH.openheaders.io/admin/users?tab=1#x')).toBe('wss://oh.openheaders.io');
    expect(parseBackendAddress('192.168.1.20:8137/pair/123456')).toBe('ws://192.168.1.20:8137');
  });

  it('refuses an empty string, another scheme, credentials, a host with a space or no host at all', () => {
    expect(parseBackendAddress('')).toBeNull();
    expect(parseBackendAddress('   ')).toBeNull();
    expect(parseBackendAddress('ftp://oh.openheaders.io')).toBeNull();
    expect(parseBackendAddress('ws://john:secret@oh.openheaders.io')).toBeNull();
    expect(parseBackendAddress('nope host')).toBeNull();
    expect(parseBackendAddress('ws://')).toBeNull();
    expect(parseBackendAddress('10.0.0.5:99999')).toBeNull();
    expect(parseBackendAddress('http://')).toBeNull();
  });
});
