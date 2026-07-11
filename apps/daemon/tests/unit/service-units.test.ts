/**
 * Service-unit rendering — the launchd plist / systemd user unit `ohd
 * install` writes: exec line composition, escaping, restart
 * posture, and the per-platform unit paths.
 */

import { describe, expect, it } from 'vitest';

import { serviceUnitPath } from '../../src/cli/service-manager';
import {
  LAUNCHD_LABEL,
  renderLaunchdPlist,
  renderSystemdUnit,
  type ServiceDefinition,
} from '../../src/cli/service-units';

const def: ServiceDefinition = {
  command: ['/usr/local/bin/node', '/opt/openheaders daemon/dist/main.js'],
  args: ['--bind-address', '0.0.0.0', '--bind-port', '9000'],
  logFile: '/home/oh/.local/state/openheaders-daemon/logs/daemon.log',
};

describe('renderLaunchdPlist', () => {
  const plist = renderLaunchdPlist(def);

  it('execs the command + the baked flags, in order', () => {
    const strings = [...plist.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
    expect(strings).toEqual([
      LAUNCHD_LABEL,
      '/usr/local/bin/node',
      '/opt/openheaders daemon/dist/main.js',
      '--bind-address',
      '0.0.0.0',
      '--bind-port',
      '9000',
      def.logFile,
      def.logFile,
    ]);
  });

  it('restarts on crash but not on clean exit', () => {
    expect(plist).toContain('<key>KeepAlive</key>');
    expect(plist).toContain('<key>SuccessfulExit</key>\n    <false/>');
    expect(plist).toContain('<key>RunAtLoad</key>\n  <true/>');
  });

  it('escapes XML-special characters in paths', () => {
    const escaped = renderLaunchdPlist({ ...def, command: ['/usr/local/bin/node', '/srv/a&b/main.js'] });
    expect(escaped).toContain('<string>/srv/a&amp;b/main.js</string>');
    expect(escaped).not.toContain('/srv/a&b/');
  });
});

describe('renderSystemdUnit', () => {
  const unit = renderSystemdUnit(def);

  it('quotes ExecStart segments only when needed', () => {
    expect(unit).toContain(
      'ExecStart=/usr/local/bin/node "/opt/openheaders daemon/dist/main.js" --bind-address 0.0.0.0 --bind-port 9000',
    );
  });

  it('appends both streams to the log file and restarts on failure', () => {
    expect(unit).toContain(`StandardOutput=append:${def.logFile}`);
    expect(unit).toContain(`StandardError=append:${def.logFile}`);
    expect(unit).toContain('Restart=on-failure');
    expect(unit).toContain('WantedBy=default.target');
  });
});

describe('serviceUnitPath', () => {
  it('targets the user-scoped unit locations', () => {
    expect(serviceUnitPath({ platform: 'darwin', homedir: '/Users/oh', uid: 501 })).toBe(
      `/Users/oh/Library/LaunchAgents/${LAUNCHD_LABEL}.plist`,
    );
    expect(serviceUnitPath({ platform: 'linux', homedir: '/home/oh', uid: 1000 })).toBe(
      '/home/oh/.config/systemd/user/oh-daemon.service',
    );
  });

  it('refuses unsupported platforms with guidance', () => {
    expect(() => serviceUnitPath({ platform: 'win32', homedir: 'C:\\Users\\oh', uid: 0 })).toThrow(/not supported/);
  });
});
