import { describe, expect, it } from 'vitest';
import {
  isValidPacFilePath,
  isValidPacUrl,
  isValidSystemProxyBypassList,
  isValidSystemProxyValue,
} from '../../src/schemas';

describe('isValidSystemProxyValue', () => {
  it('accepts the env-var idiom: bare host:port implies http://', () => {
    expect(isValidSystemProxyValue('proxy.openheaders.io:8080')).toBe(true);
    expect(isValidSystemProxyValue('proxy.openheaders.io')).toBe(true);
    expect(isValidSystemProxyValue('  proxy.openheaders.io:8080  ')).toBe(true);
  });

  it('accepts explicit http, https, and the SOCKS5 family', () => {
    expect(isValidSystemProxyValue('http://proxy.openheaders.io:8080')).toBe(true);
    expect(isValidSystemProxyValue('https://proxy.openheaders.io:8443')).toBe(true);
    expect(isValidSystemProxyValue('socks5://proxy.openheaders.io:1080')).toBe(true);
    expect(isValidSystemProxyValue('socks://proxy.openheaders.io:1080')).toBe(true);
    expect(isValidSystemProxyValue('socks5h://proxy.openheaders.io:1080')).toBe(true);
  });

  it('rejects the SOCKS4 family the engine does not speak', () => {
    expect(isValidSystemProxyValue('socks4://proxy.openheaders.io:1080')).toBe(false);
    expect(isValidSystemProxyValue('socks4a://proxy.openheaders.io:1080')).toBe(false);
  });

  it('rejects empty, unknown schemes, and unparsable values', () => {
    expect(isValidSystemProxyValue('')).toBe(false);
    expect(isValidSystemProxyValue('   ')).toBe(false);
    expect(isValidSystemProxyValue('ftp://proxy.openheaders.io:21')).toBe(false);
    expect(isValidSystemProxyValue('http://')).toBe(false);
  });

  it('rejects hosts the URL parser tolerates but no resolver can dial', () => {
    expect(isValidSystemProxyValue("proxy;'=-example")).toBe(false);
    expect(isValidSystemProxyValue("http://proxy;'=.openheaders.io:8080")).toBe(false);
  });

  it('accepts bracketed IPv6 literals', () => {
    expect(isValidSystemProxyValue('http://[::1]:8080')).toBe(true);
  });
});

describe('isValidSystemProxyBypassList', () => {
  it('accepts NO_PROXY grammar: suffixes, host:port, CIDR, wildcard', () => {
    expect(isValidSystemProxyBypassList('localhost, .internal.openheaders.io, 10.0.0.0/8')).toBe(true);
    expect(isValidSystemProxyBypassList('openheaders.io:8443')).toBe(true);
    expect(isValidSystemProxyBypassList('*')).toBe(true);
    expect(isValidSystemProxyBypassList('localhost,')).toBe(true);
    expect(isValidSystemProxyBypassList('[::1]:8080')).toBe(true);
  });

  it('rejects spaces inside an entry, scheme prefixes, and garbage', () => {
    expect(isValidSystemProxyBypassList('local host')).toBe(false);
    expect(isValidSystemProxyBypassList('https://openheaders.io')).toBe(false);
    expect(isValidSystemProxyBypassList("[[]'2;3")).toBe(false);
  });
});

describe('isValidPacUrl', () => {
  it('accepts fetchable http(s) URLs', () => {
    expect(isValidPacUrl('https://proxy.openheaders.io/proxy.pac')).toBe(true);
    expect(isValidPacUrl('http://proxy.openheaders.io/proxy.pac')).toBe(true);
  });

  it('rejects other schemes and non-URLs', () => {
    expect(isValidPacUrl('file:///etc/proxy.pac')).toBe(false);
    expect(isValidPacUrl('/etc/proxy.pac')).toBe(false);
    expect(isValidPacUrl('proxy.pac')).toBe(false);
  });
});

describe('isValidPacFilePath', () => {
  it('accepts absolute POSIX, Windows drive, and UNC paths', () => {
    expect(isValidPacFilePath('/etc/proxy.pac')).toBe(true);
    expect(isValidPacFilePath('C:\\proxies\\proxy.pac')).toBe(true);
    expect(isValidPacFilePath('C:/proxies/proxy.pac')).toBe(true);
    expect(isValidPacFilePath('\\\\fileserver\\share\\proxy.pac')).toBe(true);
  });

  it('rejects relative paths', () => {
    expect(isValidPacFilePath('proxy.pac')).toBe(false);
    expect(isValidPacFilePath('./proxy.pac')).toBe(false);
    expect(isValidPacFilePath('')).toBe(false);
  });
});
