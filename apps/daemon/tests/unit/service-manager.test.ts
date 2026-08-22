/**
 * `installServiceUnit` boot-persistence behavior — on Linux the install
 * enables the unit and lingering through the injected runner and
 * degrades each failure to an advisory note carrying the manual
 * command; on macOS the plist's RunAtLoad covers persistence and no
 * commands run at install time.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type CommandRunner,
  installServiceUnit,
  isServiceActive,
  restartService,
  type ServiceHost,
} from '../../src/cli/service-manager';
import type { ServiceDefinition } from '../../src/cli/service-units';

const tempDirs: string[] = [];

function makeHost(platform: NodeJS.Platform): ServiceHost {
  const homedir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-svc-'));
  tempDirs.push(homedir);
  return { platform, homedir, uid: 501 };
}

function makeDef(homedir: string): ServiceDefinition {
  return {
    command: ['/usr/bin/node', '/opt/oh/dist/main.js'],
    args: [],
    logFile: path.join(homedir, 'logs', 'daemon.log'),
  };
}

interface RecordedCall {
  command: string;
  args: readonly string[];
}

function recordingRunner(failing: ReadonlyArray<string> = []): { calls: RecordedCall[]; exec: CommandRunner } {
  const calls: RecordedCall[] = [];
  const exec: CommandRunner = (command, args) => {
    calls.push({ command, args });
    const line = `${command} ${args.join(' ')}`;
    const failed = failing.some((f) => line.includes(f));
    return Promise.resolve(failed ? { ok: false, detail: 'polkit says no' } : { ok: true, detail: '' });
  };
  return { calls, exec };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('installServiceUnit', () => {
  it('linux: writes the unit, then daemon-reload → enable → enable-linger', async () => {
    const host = makeHost('linux');
    const { calls, exec } = recordingRunner();
    const { unitPath, notes } = await installServiceUnit(host, makeDef(host.homedir), exec);

    expect(fs.existsSync(unitPath)).toBe(true);
    expect(calls.map((c) => `${c.command} ${c.args.join(' ')}`)).toEqual([
      'systemctl --user daemon-reload',
      'systemctl --user enable oh-daemon.service',
      'loginctl enable-linger',
    ]);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('unit enabled for boot');
    expect(notes[1]).toContain('lingering enabled');
  });

  it('linux: enable failure degrades to an advisory with the manual command', async () => {
    const host = makeHost('linux');
    const { exec } = recordingRunner(['systemctl --user enable']);
    const { notes } = await installServiceUnit(host, makeDef(host.homedir), exec);

    expect(notes[0]).toContain('systemctl --user enable oh-daemon.service');
    expect(notes[0]).toContain('reboot will not bring the daemon back');
    expect(notes[0]).toContain('polkit says no');
    expect(notes[1]).toContain('lingering enabled');
  });

  it('linux: linger failure degrades to an advisory with the consequence', async () => {
    const host = makeHost('linux');
    const { exec } = recordingRunner(['loginctl enable-linger']);
    const { notes } = await installServiceUnit(host, makeDef(host.homedir), exec);

    expect(notes[0]).toContain('unit enabled for boot');
    expect(notes[1]).toContain('loginctl enable-linger');
    expect(notes[1]).toContain('login session ends');
  });

  it('linux: daemon-reload failure still throws', async () => {
    const host = makeHost('linux');
    const { exec } = recordingRunner(['daemon-reload']);
    await expect(installServiceUnit(host, makeDef(host.homedir), exec)).rejects.toThrow(/daemon-reload failed/);
  });

  it('darwin: writes the plist and runs no service-manager commands', async () => {
    const host = makeHost('darwin');
    const { calls, exec } = recordingRunner();
    const { unitPath, notes } = await installServiceUnit(host, makeDef(host.homedir), exec);

    expect(fs.readFileSync(unitPath, 'utf-8')).toContain('<key>RunAtLoad</key>');
    expect(calls).toEqual([]);
    expect(notes).toEqual([]);
  });
});

describe('restartService', () => {
  it('linux: one systemctl --user restart', async () => {
    const host = makeHost('linux');
    const { calls, exec } = recordingRunner();
    await restartService(host, exec);
    expect(calls.map((c) => `${c.command} ${c.args.join(' ')}`)).toEqual([
      'systemctl --user restart oh-daemon.service',
    ]);
  });

  it('linux: a failed restart throws with the detail', async () => {
    const host = makeHost('linux');
    const { exec } = recordingRunner(['systemctl --user restart']);
    await expect(restartService(host, exec)).rejects.toThrow(/restart failed: polkit says no/);
  });

  it('darwin: kickstart -k restarts a bootstrapped service', async () => {
    const host = makeHost('darwin');
    const { calls, exec } = recordingRunner();
    await restartService(host, exec);
    expect(calls.map((c) => `${c.command} ${c.args.join(' ')}`)).toEqual([
      'launchctl kickstart -k gui/501/io.openheaders.daemon',
    ]);
  });

  it('darwin: a never-bootstrapped service restarts by bootstrapping the plist', async () => {
    const host = makeHost('darwin');
    const { calls, exec } = recordingRunner(['kickstart']);
    await restartService(host, exec);
    expect(calls.map((c) => `${c.command} ${c.args[0]}`)).toEqual(['launchctl kickstart', 'launchctl bootstrap']);
  });
});

describe('isServiceActive', () => {
  it('linux: reads systemctl --user is-active', async () => {
    const host = makeHost('linux');
    const active = recordingRunner();
    await expect(isServiceActive(host, active.exec)).resolves.toBe(true);
    expect(active.calls.map((c) => `${c.command} ${c.args.join(' ')}`)).toEqual([
      'systemctl --user is-active --quiet oh-daemon.service',
    ]);
    const inactive = recordingRunner(['is-active']);
    await expect(isServiceActive(host, inactive.exec)).resolves.toBe(false);
  });

  it('darwin: reads launchctl print on the gui domain', async () => {
    const host = makeHost('darwin');
    const active = recordingRunner();
    await expect(isServiceActive(host, active.exec)).resolves.toBe(true);
    expect(active.calls.map((c) => `${c.command} ${c.args.join(' ')}`)).toEqual([
      'launchctl print gui/501/io.openheaders.daemon',
    ]);
    const inactive = recordingRunner(['print']);
    await expect(isServiceActive(host, inactive.exec)).resolves.toBe(false);
  });

  it('an unsupported platform reads as inactive rather than throwing', async () => {
    const host = makeHost('win32');
    await expect(isServiceActive(host, recordingRunner().exec)).resolves.toBe(false);
  });
});
