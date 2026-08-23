/**
 * `ohd status` composition — the decision table between what the daemon
 * reports about itself and what the config chain resolves to now. The
 * cases that matter are the ones a self-hoster hits: a LAN bind that
 * took effect, one that was configured but never applied (restart
 * owed), a bind that failed outright, and a daemon that reports nothing
 * at all.
 */

import { describe, expect, it } from 'vitest';
import type { JoinUrl } from '../../src/cli/join-urls';
import { formatStatus, type StatusFacts } from '../../src/cli/status';
import type { RuntimeConfigSnapshot, RuntimeManifest } from '../../src/runtime-manifest';

const NOW = Date.parse('2026-08-23T12:00:00.000Z');
const STARTED = new Date(NOW - 3 * 3600_000 - 12 * 60_000).toISOString();
const CONFIG_PATH = '/home/john/.local/state/openheaders-daemon/daemon.json';

function makeSnapshot(overrides: Partial<RuntimeConfigSnapshot> = {}): RuntimeConfigSnapshot {
  return {
    dataDir: '/home/john/.local/state/openheaders-daemon',
    bindAddress: '127.0.0.1',
    bindPort: 8137,
    logLevel: 'info',
    trustedProxy: false,
    allowedHosts: [],
    allowInsecureLan: false,
    webRoot: null,
    ...overrides,
  };
}

function makeManifest(overrides: Partial<RuntimeManifest> = {}): RuntimeManifest {
  return {
    version: 1,
    pid: 4711,
    startedAt: STARTED,
    appVersion: '2026.8.5',
    configPath: CONFIG_PATH,
    config: makeSnapshot(),
    bind: { state: 'bound', host: '127.0.0.1', port: 8137 },
    setup: null,
    ...overrides,
  };
}

const LAN: JoinUrl[] = [{ host: '192.168.1.50', iface: 'eth0', url: 'ws://192.168.1.50:8137' }];

function makeFacts(overrides: Partial<StatusFacts> = {}): StatusFacts {
  return {
    config: makeSnapshot(),
    configPath: CONFIG_PATH,
    healthzOk: true,
    runtime: makeManifest(),
    runtimeAlive: true,
    lanJoinUrls: () => LAN,
    logFile: '/home/john/.local/state/openheaders-daemon/logs/daemon.log',
    nowMs: NOW,
    ...overrides,
  };
}

function report(overrides: Partial<StatusFacts> = {}): { text: string; serving: boolean } {
  const result = formatStatus(makeFacts(overrides));
  return { text: result.lines.join('\n'), serving: result.serving };
}

describe('formatStatus', () => {
  it('reports the observed bind, not the configured one', () => {
    const { text, serving } = report();
    expect(serving).toBe(true);
    expect(text).toContain('running — pid 4711, v2026.8.5, up 3h 12m');
    expect(text).toContain('listening on 127.0.0.1:8137 (loopback only');
    expect(text).toContain(`config ${CONFIG_PATH}`);
  });

  it('names the LAN addresses clients join at on a 0.0.0.0 bind', () => {
    const lanConfig = makeSnapshot({ bindAddress: '0.0.0.0', allowInsecureLan: true });
    const { text } = report({
      config: lanConfig,
      runtime: makeManifest({ config: lanConfig, bind: { state: 'bound', host: '0.0.0.0', port: 8137 } }),
    });

    expect(text).toContain('listening on 0.0.0.0:8137 (every interface)');
    expect(text).toContain('ws://192.168.1.50:8137   (eth0)');
    expect(text).toContain('check the host firewall');
    expect(text).not.toContain('ohd restart');
  });

  it('says nothing about a claim on a server that has one', () => {
    const { text } = report();
    expect(text).not.toContain('unclaimed');
    expect(text).not.toContain('setup code');
  });

  it('shows an unclaimed server where to claim it and with which code', () => {
    const lanConfig = makeSnapshot({ bindAddress: '0.0.0.0', allowInsecureLan: true });
    const { text } = report({
      config: lanConfig,
      runtime: makeManifest({
        config: lanConfig,
        bind: { state: 'bound', host: '0.0.0.0', port: 8137 },
        setup: { code: '4KFP-9QW2-XM31' },
      }),
    });

    expect(text).toContain('! this server is unclaimed — the first browser to reach it creates the admin account');
    // Browsable addresses, not the ws:// join URLs above them.
    expect(text).toContain('http://127.0.0.1:8137/');
    expect(text).toContain('http://192.168.1.50:8137/   (eth0)');
    expect(text).toContain('setup code 4KFP-9QW2-XM31 — needed from any machine but this one');
    expect(text).toContain('a restart replaces it');
  });

  it('offers only loopback on a loopback bind — no LAN address is reachable to claim from', () => {
    const { text } = report({ runtime: makeManifest({ setup: { code: '4KFP-9QW2-XM31' } }) });
    expect(text).toContain('http://127.0.0.1:8137/');
    expect(text).not.toContain('192.168.1.50');
  });

  it('flags a LAN bind that was configured but never applied', () => {
    // The reporter's case: install persisted 0.0.0.0, the service still
    // runs the loopback bind it started with.
    const { text, serving } = report({
      config: makeSnapshot({ bindAddress: '0.0.0.0', allowInsecureLan: true }),
    });

    expect(serving).toBe(true);
    expect(text).toContain('listening on 127.0.0.1:8137');
    expect(text).toContain('bind 127.0.0.1:8137 → 0.0.0.0:8137');
    expect(text).toContain('allow insecure LAN off → on');
    expect(text).toContain('apply it with: ohd restart');
  });

  it('compares the bind against the live socket, not the booted config', () => {
    // Rebound at runtime from an admin surface: the socket is the truth,
    // and it already matches what the config resolves to.
    const lanConfig = makeSnapshot({ bindAddress: '0.0.0.0', allowInsecureLan: true });
    const { text } = report({
      config: lanConfig,
      runtime: makeManifest({
        config: makeSnapshot({ allowInsecureLan: true }),
        bind: { state: 'bound', host: '0.0.0.0', port: 8137 },
      }),
    });

    expect(text).not.toContain('ohd restart');
  });

  it('diagnoses a failed bind instead of calling the daemon dead', () => {
    const { text, serving } = report({
      healthzOk: false,
      runtime: makeManifest({ bind: { state: 'failed', host: '0.0.0.0', port: 8137 } }),
    });

    expect(serving).toBe(false);
    expect(text).toContain('failed to bind on 0.0.0.0:8137');
    expect(text).toContain('another process may already hold that port');
    expect(text).toContain('logs/daemon.log');
  });

  it('says a daemon that is still binding has not finished starting', () => {
    const { text, serving } = report({ runtime: makeManifest({ bind: null }) });
    expect(serving).toBe(true);
    expect(text).toContain('binding — the daemon has not finished starting');
  });

  it('reports not running when nothing answers', () => {
    const { text, serving } = report({ healthzOk: false, runtime: null, runtimeAlive: false });
    expect(serving).toBe(false);
    expect(text).toBe('not running — no /healthz on 127.0.0.1:8137');
  });

  it('explains a dead daemon that had failed to bind', () => {
    const { text, serving } = report({
      healthzOk: false,
      runtimeAlive: false,
      runtime: makeManifest({ bind: { state: 'failed', host: '0.0.0.0', port: 8137 } }),
    });

    expect(serving).toBe(false);
    expect(text).toContain('not running');
    expect(text).toContain('the last run failed to bind on 0.0.0.0:8137');
    expect(text).toContain('logs/daemon.log');
  });

  it('ignores a manifest whose process is gone', () => {
    const { text } = report({ runtimeAlive: false });
    expect(text).toContain('running — /healthz OK on 127.0.0.1:8137');
    expect(text).toContain('this is the configuration, not an observation');
    expect(text).not.toContain('pid 4711');
  });

  it('says so when the command and the daemon read different config files', () => {
    const { text } = report({
      configPath: '/etc/openheaders/daemon.json',
      config: makeSnapshot({ bindAddress: '0.0.0.0', allowInsecureLan: true }),
    });

    expect(text).toContain('read a different config file than the daemon booted with');
    expect(text).toContain('/etc/openheaders/daemon.json');
    // The field-by-field drift would be comparing two different files.
    expect(text).not.toContain('bind 127.0.0.1:8137 → 0.0.0.0:8137');
  });

  it('lists every restart-bearing difference', () => {
    const { text } = report({
      config: makeSnapshot({
        dataDir: '/srv/openheaders',
        logLevel: 'debug',
        trustedProxy: true,
        allowedHosts: ['oh.openheaders.io'],
        webRoot: '/srv/web',
      }),
    });

    expect(text).toContain('data dir /home/john/.local/state/openheaders-daemon → /srv/openheaders');
    expect(text).toContain('log level info → debug');
    expect(text).toContain('trusted proxy off → on');
    expect(text).toContain('allowed hosts none → oh.openheaders.io');
    expect(text).toContain('web root none → /srv/web');
  });
});
