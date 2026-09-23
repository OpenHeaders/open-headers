/**
 * Open a URL in the person's browser when one can be reached from this
 * process — the device grant's convenience (RFC 8628 §3.3.1: `oh login`
 * prints the verification link either way; opening it saves the
 * typing, the way the cloud CLIs do). Darwin's `open`, Windows'
 * `cmd /c start`, elsewhere `xdg-open` under a display session
 * (`DISPLAY` / `WAYLAND_DISPLAY`). An SSH session, a container or a
 * headless box answers false and the person pastes the link on any
 * device — which is the grant's whole point. Detached and never waited
 * on past the spawn: a browser that hangs is not this command's
 * problem.
 */

import { spawn } from 'node:child_process';

export interface OpenBrowserOptions {
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  /** Test seam; production spawns the platform opener detached. */
  readonly spawnFn?: typeof spawn;
}

interface OpenerCommand {
  readonly file: string;
  readonly args: readonly string[];
}

/** Which opener this platform has in reach — null where no browser can show anything to this person. */
export function browserOpenerFor(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, url: string): OpenerCommand | null {
  // A remote shell opens the browser on the far machine's display — useless to the person here.
  if (env.SSH_CONNECTION || env.SSH_TTY) return null;
  switch (platform) {
    case 'darwin':
      return { file: 'open', args: [url] };
    case 'win32':
      return { file: 'cmd', args: ['/c', 'start', '', url] };
    default:
      return env.DISPLAY || env.WAYLAND_DISPLAY ? { file: 'xdg-open', args: [url] } : null;
  }
}

export function openBrowser(url: string, options: OpenBrowserOptions = {}): Promise<boolean> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const spawnFn = options.spawnFn ?? spawn;
  if (!/^https?:\/\//.test(url)) return Promise.resolve(false);
  const command = browserOpenerFor(platform, env, url);
  if (command === null) return Promise.resolve(false);
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnFn(command.file, [...command.args], { detached: true, stdio: 'ignore', env, windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
