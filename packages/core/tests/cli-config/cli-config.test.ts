/**
 * cli-config laws — path segments (XDG > APPDATA-on-win32 > ~/.config),
 * parse (malformed is a loud path-naming error, unknown/mistyped keys
 * dropped), serialize round-trip, and the connect-ownership merge (a
 * connection write never touches telemetry/channel keys).
 */

import { describe, expect, it } from 'vitest';
import { cliConfigPathSegments, mergeCliConnection, parseCliConfig, serializeCliConfig } from '../../src/cli-config';

describe('cliConfigPathSegments', () => {
  it('prefers XDG_CONFIG_HOME', () => {
    expect(cliConfigPathSegments({ XDG_CONFIG_HOME: '/xdg' }, '/home/oh', 'linux')).toEqual([
      '/xdg',
      'openheaders',
      'cli.json',
    ]);
  });

  it('falls back to ~/.config', () => {
    expect(cliConfigPathSegments({}, '/home/oh', 'darwin')).toEqual(['/home/oh', '.config', 'openheaders', 'cli.json']);
  });

  it('ignores an empty XDG_CONFIG_HOME', () => {
    expect(cliConfigPathSegments({ XDG_CONFIG_HOME: '' }, '/home/oh', 'linux')).toEqual([
      '/home/oh',
      '.config',
      'openheaders',
      'cli.json',
    ]);
  });

  it('uses %APPDATA% on Windows', () => {
    expect(cliConfigPathSegments({ APPDATA: 'C:\\Users\\oh\\AppData\\Roaming' }, 'C:\\Users\\oh', 'win32')).toEqual([
      'C:\\Users\\oh\\AppData\\Roaming',
      'openheaders',
      'cli.json',
    ]);
  });

  it('XDG_CONFIG_HOME wins over %APPDATA% on Windows — the relocation escape hatch', () => {
    expect(
      cliConfigPathSegments({ XDG_CONFIG_HOME: '/xdg', APPDATA: 'C:\\Roaming' }, 'C:\\Users\\oh', 'win32'),
    ).toEqual(['/xdg', 'openheaders', 'cli.json']);
  });

  it('never uses APPDATA off Windows', () => {
    expect(cliConfigPathSegments({ APPDATA: '/roaming' }, '/home/oh', 'linux')).toEqual([
      '/home/oh',
      '.config',
      'openheaders',
      'cli.json',
    ]);
  });
});

describe('parseCliConfig / serializeCliConfig', () => {
  it('round-trips a config', () => {
    const config = { daemonUrl: 'https://daemon.openheaders.io', token: 'oh_secret', channel: 'beta' as const };
    expect(parseCliConfig(serializeCliConfig(config), '/x/cli.json')).toEqual(config);
  });

  it('throws a path-naming error on malformed JSON', () => {
    expect(() => parseCliConfig('not json', '/x/cli.json')).toThrow('/x/cli.json');
  });

  it('throws when the content is JSON but not an object', () => {
    expect(() => parseCliConfig('[1,2]', '/x/cli.json')).toThrow('not a JSON object');
  });

  it('drops unknown and mistyped keys', () => {
    expect(parseCliConfig(JSON.stringify({ daemonUrl: 7, token: 'oh_x', extra: true }), '/x/cli.json')).toEqual({
      token: 'oh_x',
    });
  });

  it('drops a channel value outside stable|beta', () => {
    expect(parseCliConfig(JSON.stringify({ channel: 'nightly' }), '/x/cli.json')).toEqual({});
  });
});

describe('mergeCliConnection', () => {
  it('owns only the connection pair — telemetry and channel ride over untouched', () => {
    const existing = {
      daemonUrl: 'http://127.0.0.1:59210',
      token: 'oh_old',
      channel: 'beta' as const,
      telemetry: false,
      telemetryNoticeShown: true,
      telemetryInstallId: 'abc',
    };
    expect(mergeCliConnection(existing, 'http://127.0.0.1:59999', 'oh_new')).toEqual({
      ...existing,
      daemonUrl: 'http://127.0.0.1:59999',
      token: 'oh_new',
    });
  });
});
