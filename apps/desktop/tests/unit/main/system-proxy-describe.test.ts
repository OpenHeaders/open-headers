/**
 * OS proxy-configuration snapshot parsers — the System mode's
 * informational display (the request-engine proxy design P3):
 * `scutil --proxy` dictionaries, the Windows Internet Settings
 * registry query, and the HTTP_PROXY-family environment fallback.
 */

import { describe, expect, it } from 'vitest';
import {
  parseScutilProxy,
  parseWindowsProxyRegistry,
  snapshotFromEnvironment,
} from '../../../src/main/system-proxy-describe';

describe('parseScutilProxy', () => {
  it('reads enabled proxies, PAC, WPAD, and exceptions', () => {
    const text = [
      '<dictionary> {',
      '  ExceptionsList : <array> {',
      '    0 : *.local',
      '    1 : 169.254/16',
      '  }',
      '  FTPPassive : 1',
      '  HTTPEnable : 1',
      '  HTTPPort : 8080',
      '  HTTPProxy : proxy.openheaders.io',
      '  HTTPSEnable : 1',
      '  HTTPSPort : 8443',
      '  HTTPSProxy : proxy.openheaders.io',
      '  ProxyAutoConfigEnable : 1',
      '  ProxyAutoConfigURLString : https://pac.openheaders.io/proxy.pac',
      '  ProxyAutoDiscoveryEnable : 1',
      '}',
    ].join('\n');
    expect(parseScutilProxy(text)).toEqual({
      source: 'macos-system',
      httpProxy: 'proxy.openheaders.io:8080',
      httpsProxy: 'proxy.openheaders.io:8443',
      pacUrl: 'https://pac.openheaders.io/proxy.pac',
      bypassList: '*.local, 169.254/16',
      autoDetect: true,
    });
  });

  it('ignores disabled entries — an unmanaged machine reads empty', () => {
    const text = [
      '<dictionary> {',
      '  ExceptionsList : <array> {',
      '    0 : *.local',
      '  }',
      '  HTTPEnable : 0',
      '  HTTPProxy : stale.openheaders.io',
      '  HTTPSEnable : 0',
      '  ProxyAutoConfigEnable : 0',
      '  ProxyAutoConfigURLString : https://stale.openheaders.io/proxy.pac',
      '  ProxyAutoDiscoveryEnable : 0',
      '}',
    ].join('\n');
    expect(parseScutilProxy(text)).toEqual({ source: 'macos-system', bypassList: '*.local' });
  });
});

describe('parseWindowsProxyRegistry', () => {
  it('reads the single-proxy shape with overrides', () => {
    const text = [
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
      '    ProxyEnable    REG_DWORD    0x1',
      '    ProxyServer    REG_SZ    proxy.openheaders.io:8080',
      '    ProxyOverride    REG_SZ    localhost;*.openheaders.io',
      '',
    ].join('\r\n');
    expect(parseWindowsProxyRegistry(text)).toEqual({
      source: 'windows-registry',
      httpProxy: 'proxy.openheaders.io:8080',
      httpsProxy: 'proxy.openheaders.io:8080',
      bypassList: 'localhost, *.openheaders.io',
    });
  });

  it('splits the per-scheme ProxyServer list', () => {
    const text = [
      '    ProxyEnable    REG_DWORD    0x1',
      '    ProxyServer    REG_SZ    http=proxy.openheaders.io:8080;https=secure.openheaders.io:8443',
    ].join('\r\n');
    expect(parseWindowsProxyRegistry(text)).toEqual({
      source: 'windows-registry',
      httpProxy: 'proxy.openheaders.io:8080',
      httpsProxy: 'secure.openheaders.io:8443',
    });
  });

  it('treats ProxyEnable 0x0 as no proxy but keeps an AutoConfigURL', () => {
    const text = [
      '    ProxyEnable    REG_DWORD    0x0',
      '    ProxyServer    REG_SZ    stale.openheaders.io:8080',
      '    AutoConfigURL    REG_SZ    https://pac.openheaders.io/proxy.pac',
    ].join('\r\n');
    expect(parseWindowsProxyRegistry(text)).toEqual({
      source: 'windows-registry',
      pacUrl: 'https://pac.openheaders.io/proxy.pac',
    });
  });
});

describe('snapshotFromEnvironment', () => {
  it('reads the lowercase family with uppercase fallback', () => {
    expect(
      snapshotFromEnvironment({
        http_proxy: 'http://proxy.openheaders.io:3128',
        HTTPS_PROXY: 'http://secure.openheaders.io:3129',
        auto_proxy: 'https://pac.openheaders.io/proxy.pac',
        NO_PROXY: 'localhost,.openheaders.io',
      }),
    ).toEqual({
      source: 'process-env',
      httpProxy: 'http://proxy.openheaders.io:3128',
      httpsProxy: 'http://secure.openheaders.io:3129',
      pacUrl: 'https://pac.openheaders.io/proxy.pac',
      bypassList: 'localhost,.openheaders.io',
    });
  });

  it('reads empty when nothing is exported', () => {
    expect(snapshotFromEnvironment({})).toEqual({ source: 'process-env' });
  });
});
