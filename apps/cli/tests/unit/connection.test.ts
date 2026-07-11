/**
 * Connection resolution — the flag → env → config → default order the
 * plan pins (CLI_PLAN.md §3), plus URL normalization.
 */

import { describe, expect, it } from 'vitest';
import { DAEMON_URL_ENV, DEFAULT_DAEMON_URL, resolveConnection, TOKEN_ENV } from '../../src/connection';

describe('resolveConnection', () => {
  it('defaults to loopback with no sources at all', () => {
    const conn = resolveConnection({}, {}, {});
    expect(conn).toEqual({ daemonUrl: DEFAULT_DAEMON_URL });
  });

  it('reads the config file when flags and env are absent', () => {
    const conn = resolveConnection({}, {}, { daemonUrl: 'https://daemon.openheaders.io', token: 'oh_config' });
    expect(conn).toEqual({ daemonUrl: 'https://daemon.openheaders.io', token: 'oh_config' });
  });

  it('env overrides config', () => {
    const env = { [DAEMON_URL_ENV]: 'https://env.openheaders.io', [TOKEN_ENV]: 'oh_env' };
    const conn = resolveConnection({}, env, { daemonUrl: 'https://config.openheaders.io', token: 'oh_config' });
    expect(conn).toEqual({ daemonUrl: 'https://env.openheaders.io', token: 'oh_env' });
  });

  it('flags override env and config', () => {
    const env = { [DAEMON_URL_ENV]: 'https://env.openheaders.io', [TOKEN_ENV]: 'oh_env' };
    const conn = resolveConnection(
      { daemon: 'https://flag.openheaders.io', token: 'oh_flag' },
      env,
      { daemonUrl: 'https://config.openheaders.io', token: 'oh_config' },
    );
    expect(conn).toEqual({ daemonUrl: 'https://flag.openheaders.io', token: 'oh_flag' });
  });

  it('sources resolve independently (URL from flag, token from config)', () => {
    const conn = resolveConnection({ daemon: 'https://flag.openheaders.io' }, {}, { token: 'oh_config' });
    expect(conn).toEqual({ daemonUrl: 'https://flag.openheaders.io', token: 'oh_config' });
  });

  it('strips a trailing slash from the daemon URL', () => {
    const conn = resolveConnection({ daemon: 'https://daemon.openheaders.io/' }, {}, {});
    expect(conn.daemonUrl).toBe('https://daemon.openheaders.io');
  });

  it('treats an empty token as absent', () => {
    const conn = resolveConnection({}, { [TOKEN_ENV]: '' }, {});
    expect(conn.token).toBeUndefined();
  });
});
