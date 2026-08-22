/**
 * Service-manager control — owns the unit-file locations and the
 * launchctl/systemctl invocations behind `ohd install / start /
 * stop`. Rendering is `service-units.ts`; this module does the I/O.
 *
 * User-scoped on both platforms (LaunchAgent / `systemctl --user`) —
 * the daemon is per-user state under the platform state dir, not a
 * system service; root installs are a Phase 3 (VM) concern.
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  LAUNCHD_LABEL,
  renderLaunchdPlist,
  renderSystemdUnit,
  type ServiceDefinition,
  SYSTEMD_UNIT_NAME,
} from './service-units';

const execFileAsync = promisify(execFile);

export interface ServiceHost {
  platform: NodeJS.Platform;
  homedir: string;
  /** `process.getuid()` — launchd domain target (`gui/<uid>`). */
  uid: number;
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<{ ok: boolean; detail: string }>;

export interface InstallResult {
  unitPath: string;
  /** Boot-persistence outcome lines for the CLI to print, in order. */
  notes: string[];
}

export function serviceUnitPath(host: ServiceHost): string {
  if (host.platform === 'darwin') {
    return path.join(host.homedir, 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`);
  }
  if (host.platform === 'linux') {
    return path.join(host.homedir, '.config', 'systemd', 'user', SYSTEMD_UNIT_NAME);
  }
  throw new Error(`service install is not supported on ${host.platform} yet — run dist/main.js directly`);
}

async function run(command: string, args: readonly string[]): Promise<{ ok: boolean; detail: string }> {
  try {
    await execFileAsync(command, [...args]);
    return { ok: true, detail: '' };
  } catch (err) {
    const failure = err as { stderr?: string; message?: string };
    return { ok: false, detail: (failure.stderr || failure.message || '').trim() };
  }
}

/**
 * Write the unit file and make the daemon survive reboots. On macOS the
 * LaunchAgent's `RunAtLoad` covers this by itself (agents load at
 * login). On Linux the unit must be enabled AND the user must linger —
 * without lingering, systemd kills the user manager (and the daemon)
 * when the login session ends, e.g. on SSH disconnect. Both are run
 * here; a failure degrades to an advisory note carrying the exact
 * manual command and its consequence, so install never half-fails.
 */
export async function installServiceUnit(
  host: ServiceHost,
  def: ServiceDefinition,
  exec: CommandRunner = run,
): Promise<InstallResult> {
  const unitPath = serviceUnitPath(host);
  await fs.mkdir(path.dirname(unitPath), { recursive: true });
  await fs.mkdir(path.dirname(def.logFile), { recursive: true });
  const body = host.platform === 'darwin' ? renderLaunchdPlist(def) : renderSystemdUnit(def);
  await fs.writeFile(unitPath, body, 'utf-8');
  const notes: string[] = [];
  if (host.platform === 'linux') {
    const reload = await exec('systemctl', ['--user', 'daemon-reload']);
    if (!reload.ok) throw new Error(`systemctl --user daemon-reload failed: ${reload.detail}`);
    const enable = await exec('systemctl', ['--user', 'enable', SYSTEMD_UNIT_NAME]);
    notes.push(
      enable.ok
        ? `unit enabled for boot (systemctl --user enable ${SYSTEMD_UNIT_NAME})`
        : `could not enable the unit for boot (${enable.detail}) — run manually: ` +
            `systemctl --user enable ${SYSTEMD_UNIT_NAME} (without it a reboot will not bring the daemon back)`,
    );
    const linger = await exec('loginctl', ['enable-linger']);
    notes.push(
      linger.ok
        ? 'lingering enabled (loginctl enable-linger) — the daemon survives logout and SSH disconnect'
        : `could not enable lingering (${linger.detail}) — run manually: loginctl enable-linger ` +
            '(without it the daemon dies when your login session ends, e.g. on SSH disconnect)',
    );
  }
  return { unitPath, notes };
}

export async function startService(host: ServiceHost, exec: CommandRunner = run): Promise<void> {
  if (host.platform === 'darwin') {
    const plist = serviceUnitPath(host);
    const bootstrap = await exec('launchctl', ['bootstrap', `gui/${host.uid}`, plist]);
    if (bootstrap.ok) return;
    // Already bootstrapped — kick the existing registration instead.
    const kickstart = await exec('launchctl', ['kickstart', `gui/${host.uid}/${LAUNCHD_LABEL}`]);
    if (kickstart.ok) return;
    throw new Error(`launchctl failed: ${bootstrap.detail || kickstart.detail}`);
  }
  if (host.platform === 'linux') {
    const start = await exec('systemctl', ['--user', 'start', SYSTEMD_UNIT_NAME]);
    if (!start.ok) throw new Error(`systemctl --user start failed: ${start.detail}`);
    return;
  }
  throw new Error(`service control is not supported on ${host.platform} yet`);
}

export async function stopService(host: ServiceHost, exec: CommandRunner = run): Promise<void> {
  if (host.platform === 'darwin') {
    const bootout = await exec('launchctl', ['bootout', `gui/${host.uid}/${LAUNCHD_LABEL}`]);
    if (bootout.ok || /No such process/i.test(bootout.detail)) return;
    throw new Error(`launchctl bootout failed: ${bootout.detail}`);
  }
  if (host.platform === 'linux') {
    const stop = await exec('systemctl', ['--user', 'stop', SYSTEMD_UNIT_NAME]);
    if (!stop.ok) throw new Error(`systemctl --user stop failed: ${stop.detail}`);
    return;
  }
  throw new Error(`service control is not supported on ${host.platform} yet`);
}

/**
 * Restart the installed service in place — how a changed `daemon.json`
 * or a swapped binary takes effect. A plain `start` on an already-active
 * service is a no-op under both service managers, so reconfiguration
 * needs this verb.
 */
export async function restartService(host: ServiceHost, exec: CommandRunner = run): Promise<void> {
  if (host.platform === 'darwin') {
    // `kickstart -k` kills and relaunches an existing registration; a
    // service that was never bootstrapped restarts by bootstrapping.
    const kickstart = await exec('launchctl', ['kickstart', '-k', `gui/${host.uid}/${LAUNCHD_LABEL}`]);
    if (kickstart.ok) return;
    const bootstrap = await exec('launchctl', ['bootstrap', `gui/${host.uid}`, serviceUnitPath(host)]);
    if (bootstrap.ok) return;
    throw new Error(`launchctl failed: ${kickstart.detail || bootstrap.detail}`);
  }
  if (host.platform === 'linux') {
    const restart = await exec('systemctl', ['--user', 'restart', SYSTEMD_UNIT_NAME]);
    if (!restart.ok) throw new Error(`systemctl --user restart failed: ${restart.detail}`);
    return;
  }
  throw new Error(`service control is not supported on ${host.platform} yet`);
}

/**
 * Whether the installed service is currently active — the install
 * command's cue to point at `ohd restart` instead of `ohd start`
 * (which would silently no-op on a running service). Best-effort:
 * an unsupported platform or a failed probe reads as inactive.
 */
export async function isServiceActive(host: ServiceHost, exec: CommandRunner = run): Promise<boolean> {
  if (host.platform === 'darwin') {
    return (await exec('launchctl', ['print', `gui/${host.uid}/${LAUNCHD_LABEL}`])).ok;
  }
  if (host.platform === 'linux') {
    return (await exec('systemctl', ['--user', 'is-active', '--quiet', SYSTEMD_UNIT_NAME])).ok;
  }
  return false;
}
