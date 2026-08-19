/**
 * Daemon listener verification — the mirror-image chain: install-root
 * derivation from the host's own shipped path (dev layout ⇒ not
 * enforced), per-platform LISTEN-owner parsers, the shared-root rule,
 * and the macOS signing-team rider over an injected command runner.
 */

import { describe, expect, it } from 'vitest';
import {
  appInstallRoot,
  type CommandResult,
  type CommandRunner,
  parseCodesignTeamId,
  parseLsofListenerPid,
  parseNetTcpListenerPid,
  parseSsListenerPid,
  verifyDaemonListener,
} from '../../src/verify-daemon';

const HOST_MAC = '/Applications/OpenHeaders.app/Contents/Resources/nm-host/oh-nm-host';
const DAEMON_MAC = '/Applications/OpenHeaders.app/Contents/MacOS/OpenHeaders';

function ok(stdout: string, stderr = ''): CommandResult {
  return { stdout, stderr, code: 0 };
}

describe('appInstallRoot', () => {
  it('finds the .app bundle on darwin and the resources parent elsewhere', () => {
    expect(appInstallRoot(HOST_MAC, 'darwin')).toBe('/Applications/OpenHeaders.app');
    expect(appInstallRoot('C:\\Program Files\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe', 'win32')).toBe(
      'C:\\Program Files\\OpenHeaders',
    );
    expect(appInstallRoot('/opt/OpenHeaders/resources/nm-host/oh-nm-host', 'linux')).toBe('/opt/OpenHeaders');
  });

  it('answers null for the dev layout', () => {
    expect(appInstallRoot('/Users/dev/open-headers/apps/nm-host/dist-bun/oh-nm-host', 'darwin')).toBeNull();
    expect(appInstallRoot('/Users/dev/open-headers/apps/nm-host/dist-bun/oh-nm-host', 'linux')).toBeNull();
  });
});

describe('listener pid parsers', () => {
  it('parses lsof -Fp LISTEN output', () => {
    expect(parseLsofListenerPid('p4242\nf12\np4242\n')).toBe(4242);
    expect(parseLsofListenerPid('')).toBeNull();
  });

  it('parses ss -tlnpH output', () => {
    const row = 'LISTEN 0 511 127.0.0.1:8137 0.0.0.0:* users:(("openheaders",pid=4242,fd=33))';
    expect(parseSsListenerPid(row)).toBe(4242);
    expect(parseSsListenerPid('LISTEN 0 511 127.0.0.1:8137 0.0.0.0:*')).toBeNull();
  });

  it('parses Get-NetTCPConnection JSON rows, bare object included', () => {
    expect(parseNetTcpListenerPid('{"LocalPort":8137,"OwningProcess":4242}')).toBe(4242);
    expect(parseNetTcpListenerPid('[{"LocalPort":8137,"OwningProcess":4242}]')).toBe(4242);
    expect(parseNetTcpListenerPid('')).toBeNull();
    expect(parseNetTcpListenerPid('not json')).toBeNull();
  });

  it('parses codesign team identifiers', () => {
    expect(parseCodesignTeamId('Identifier=oh\nTeamIdentifier=ABC123XYZ0\n')).toBe('ABC123XYZ0');
    expect(parseCodesignTeamId('TeamIdentifier=not set\n')).toBeNull();
  });
});

interface DarwinChainOptions {
  listenerExecutable?: string;
  ownTeam?: string | null;
  listenerTeam?: string | null;
  listenerFound?: boolean;
}

/** A darwin command runner scripted from one scenario's facts. */
function darwinRunner(options: DarwinChainOptions = {}): CommandRunner {
  const listenerExecutable = options.listenerExecutable ?? DAEMON_MAC;
  return async (file, args) => {
    if (file === 'lsof') return options.listenerFound === false ? ok('') : ok('p4242\n');
    if (file === 'ps') return ok(`${listenerExecutable}\n`);
    if (file === 'codesign') {
      const target = args[args.length - 1];
      const team = target === HOST_MAC ? (options.ownTeam ?? null) : (options.listenerTeam ?? null);
      return team === null ? { stdout: '', stderr: '', code: 1 } : ok('', `TeamIdentifier=${team}\n`);
    }
    throw new Error(`unexpected command ${file}`);
  };
}

describe('verifyDaemonListener', () => {
  const base = { port: 8137, ownExecutablePath: HOST_MAC, platform: 'darwin' as const };

  it('accepts a listener inside the shared install root (both unsigned)', async () => {
    const verification = await verifyDaemonListener({ ...base, run: darwinRunner() });
    expect(verification.ok).toBe(true);
    expect(verification.detail).toContain(DAEMON_MAC);
  });

  it('does not enforce from the dev layout', async () => {
    const verification = await verifyDaemonListener({
      port: 8137,
      ownExecutablePath: '/Users/dev/open-headers/apps/nm-host/dist-bun/oh-nm-host',
      platform: 'darwin',
      run: async () => {
        throw new Error('no probe should run');
      },
    });
    expect(verification.ok).toBe(true);
    expect(verification.detail).toContain('not enforced');
  });

  it('refuses when no process listens on the port', async () => {
    const verification = await verifyDaemonListener({ ...base, run: darwinRunner({ listenerFound: false }) });
    expect(verification).toMatchObject({ ok: false });
    expect(verification.detail).toContain('no LISTEN owner');
  });

  it('refuses a listener outside the install root', async () => {
    const verification = await verifyDaemonListener({
      ...base,
      run: darwinRunner({ listenerExecutable: '/usr/local/bin/squatter' }),
    });
    expect(verification).toMatchObject({ ok: false });
    expect(verification.detail).toContain('outside install root');
  });

  it('enforces the signing-team rider when the host itself is signed', async () => {
    const match = await verifyDaemonListener({
      ...base,
      run: darwinRunner({ ownTeam: 'ABC123XYZ0', listenerTeam: 'ABC123XYZ0' }),
    });
    expect(match.ok).toBe(true);
    const mismatch = await verifyDaemonListener({
      ...base,
      run: darwinRunner({ ownTeam: 'ABC123XYZ0', listenerTeam: 'EVIL000000' }),
    });
    expect(mismatch).toMatchObject({ ok: false });
    expect(mismatch.detail).toContain('does not match host team');
    const unsignedListener = await verifyDaemonListener({
      ...base,
      run: darwinRunner({ ownTeam: 'ABC123XYZ0', listenerTeam: null }),
    });
    expect(unsignedListener).toMatchObject({ ok: false });
  });

  it('walks the linux chain over ss and /proc', async () => {
    const run: CommandRunner = async (file, args) => {
      if (file === 'ss') return ok('LISTEN 0 511 127.0.0.1:8137 0.0.0.0:* users:(("openheaders",pid=4242,fd=33))');
      if (file === 'readlink') {
        expect(args).toEqual(['-f', '/proc/4242/exe']);
        return ok('/opt/OpenHeaders/openheaders\n');
      }
      throw new Error(`unexpected command ${file}`);
    };
    const verification = await verifyDaemonListener({
      port: 8137,
      ownExecutablePath: '/opt/OpenHeaders/resources/nm-host/oh-nm-host',
      platform: 'linux',
      run,
    });
    expect(verification.ok).toBe(true);
  });

  it('walks the windows chain case-insensitively', async () => {
    const run: CommandRunner = async (file, args) => {
      expect(file).toBe('powershell.exe');
      const script = args[args.length - 1];
      if (script.includes('Get-NetTCPConnection')) return ok('{"LocalPort":8137,"OwningProcess":4242}');
      return ok('{"ExecutablePath":"C:\\\\PROGRAM FILES\\\\OpenHeaders\\\\OpenHeaders.exe"}');
    };
    const verification = await verifyDaemonListener({
      port: 8137,
      ownExecutablePath: 'C:\\Program Files\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      run,
    });
    expect(verification.ok).toBe(true);
  });

  it('prefers the direct image-name probe over the WMI leg on windows', async () => {
    const run: CommandRunner = async (_file, args) => {
      const script = args[args.length - 1];
      if (script.includes('Get-NetTCPConnection')) return ok('{"LocalPort":8137,"OwningProcess":4242}');
      throw new Error('WMI leg must not run when the direct probe answers');
    };
    const verification = await verifyDaemonListener({
      port: 8137,
      ownExecutablePath: 'C:\\Program Files\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      run,
      readImageName: async (pid) => {
        expect(pid).toBe(4242);
        return 'C:\\Program Files\\OpenHeaders\\OpenHeaders.exe';
      },
    });
    expect(verification.ok).toBe(true);
  });

  it('falls back to the WMI leg when the direct probe answers null', async () => {
    const run: CommandRunner = async (_file, args) => {
      const script = args[args.length - 1];
      if (script.includes('Get-NetTCPConnection')) return ok('{"LocalPort":8137,"OwningProcess":4242}');
      return ok('{"ExecutablePath":"C:\\\\Program Files\\\\OpenHeaders\\\\OpenHeaders.exe"}');
    };
    const verification = await verifyDaemonListener({
      port: 8137,
      ownExecutablePath: 'C:\\Program Files\\OpenHeaders\\resources\\nm-host\\oh-nm-host.exe',
      platform: 'win32',
      run,
      readImageName: async () => null,
    });
    expect(verification.ok).toBe(true);
  });
});
